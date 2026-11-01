import { can } from '@/constants/config';
import { eventoDe, tipoGuardado } from '@/constants/eventos';
import { deCerda, loteFijo } from '@/data/repro';
import {
  avisoCeloCercano, avisoDestetados, avisoPrimerServicioSinCelo, DIAS_MISMO_CELO, lechonesActuales, mergeReglas, validarCantidadesEvento, validarEdadPrimerServicio, validarEliminarLactando,
  validarFechaPosteriorAEntrada, validarIntervaloPartos, validarIntervaloServicioAborto, validarIntervaloServicioParto, validarInventarioLactantes, validarPuedeInseminar, validarSecuencia, validarServicioRepetido,
} from '@/data/reglas';
import { Registro, Sow } from '@/types/data';
import { diffDays, weekBounds, weekNumber } from '@/utilities/miscellaneous';
import { useAuthStore } from './auth.store';
import { useFarmStore } from './farm.store';
import { useGlobalStore } from './global.store';
import { useLotStore } from './lot.store';
import { createResourceStore } from './resource';
import { useSowStore } from './sow.store';

// A registro is created under its lot and reached by id from the farm.
export const useRegistroStore = createResourceStore<Registro>('registro', 'registros', (r) => `lots/${r.lotId}/registros`, (r) => `${eventoDe(r?.tipo ?? '').label || 'registro'}${r?.cerdaCodigo ? ` · ID ${r.cerdaCodigo}` : ''}`);

export type NuevoEvento = { tipo: string; lotId: string; fecha: string; arete?: string; nota?: string; data?: Record<string, any> };

const n = (v: unknown) => Number(v) || 0;

/**
 * The lot of the weekly band a service date belongs to. Bands are the lots
 * with a start and end date; the one for a new week is created on demand,
 * named with the year and the week number ("2641").
 *
 * @param fecha Date of the insemination
 * @returns Id of the band's lot
 */
const bandaDe = async (fecha: string): Promise<string> => {
  const lots = useLotStore.getState();
  const banda = lots.list.find((l) => !l.esFijo && !l.archivado && l.fechaInicio && l.fechaFin && l.fechaInicio <= fecha && fecha <= l.fechaFin);
  if (banda) return banda.id;
  const diaInicio = useFarmStore.getState().current?.config?.weekConfig?.diaInicio ?? 1;
  const { start, end } = weekBounds(fecha, diaInicio);
  const code = `${start.slice(2, 4)}${String(weekNumber(start)).padStart(2, '0')}`;
  return (await lots.create({ code, fase: 'gestacion', fechaInicio: start, fechaFin: end, data: { autoCreado: true } })).id;
};

/** Shows why an event cannot be saved and aborts it. */
const reject = (message: string): never => {
  useGlobalStore.getState().showAlert({ title: 'No se puede guardar', message, type: 'error' });
  throw new Error(message);
};

/**
 * Records an event and applies what it means for the sow and the lot: the
 * sow's state and lot, its parity, the lot's live animals.
 *
 * ponytail: the registro and its consequences are separate requests, as they
 * were separate writes in the previous app. If one of the later ones fails
 * the user is told and can fix the sow from its page; move this into one
 * backend transaction if that ever proves not enough.
 *
 * @param e Event type, lot, date, sow tag and the data of its form
 * @returns The created registro
 */
export const registrar = async (e: NuevoEvento): Promise<Registro> => {
  const evento = eventoDe(e.tipo);
  const farm = useFarmStore.getState().current;
  const reglas = mergeReglas(farm?.config?.reglas as any);
  const sows = useSowStore.getState();
  const lots = useLotStore.getState();
  const registros = useRegistroStore.getState();
  const data: Record<string, any> = { ...e.data };
  const arete = (e.arete ?? '').trim().toUpperCase();
  let lotId = e.lotId;
  let sow: Sow | undefined = arete ? sows.list.find((s) => s.arete === arete && s.estadoActual !== 'descarte') ?? sows.list.find((s) => s.arete === arete) : undefined;
  const patch: Partial<Sow> = {};
  const avisos: (string | null)[] = [];

  if (evento.cerda === 'req' && !arete) reject('Indica el ID de la cerda.');

  if (e.tipo === 'entrada') {
    if (sow && sow.estadoActual !== 'descarte') reject(`Ya hay una cerda activa con el ID ${arete}.`);
    // Toda cerda nueva empieza en el lote fijo Entradas.
    lotId = loteFijo(lots.list, 'entradas')?.id ?? '';
    if (reglas.exigirFechaNacimiento && !data.fechaNacimiento) reject('Indica la fecha de nacimiento de la cerda.');
    if (!lotId) reject('No se encontró el lote Entradas. Actualiza la pantalla o pide acceso a ese lote.');
    sow = await sows.create({
      arete, tipo: data.tipoEntrada, genetica: data.genetica ?? '', estadoActual: 'vacia', lotIdActual: lotId, fechaEntrada: e.fecha, fechaNacimiento: data.fechaNacimiento ?? '',
      partosHistoricos: data.tipoEntrada === 'multipara' ? n(data.partosPrevios) : 0,
    });
  } else if (evento.cerda === 'req' && !sow) {
    reject(`No hay una cerda con el ID ${arete}. Regístrala primero con el evento "Entrada".`);
  }

  if (sow && e.tipo !== 'entrada') {
    const historia = deCerda(registros.list, sow);
    const ultimo = (tipo: string) => historia.filter((r) => r.tipo === tipo).pop()?.fecha ?? null;
    const check = (v: { ok: boolean; motivo?: string }) => v.ok || reject(v.motivo ?? 'Dato inválido.');
    check(validarSecuencia(e.tipo, sow.estadoActual, historia.length > 0));
    check(validarFechaPosteriorAEntrada(e.fecha, sow.fechaEntrada, reglas));

    if (e.tipo === 'inseminacion') {
      check(validarPuedeInseminar(historia, reglas));
      check(validarServicioRepetido(sow.estadoActual, ultimo('inseminacion'), e.fecha, reglas));
      if (!ultimo('inseminacion')) check(validarEdadPrimerServicio(sow.fechaNacimiento, e.fecha, reglas));
      if ((reglas.exigirVerracoEnServicio || reglas.exigirSemenEnServicio) && !data.verraco) reject('Indica el verraco o el semen del servicio.');
      if (data.hora && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(data.hora)) reject('Escribe la hora como HH:MM, por ejemplo 08:30.');
      avisos.push(avisoPrimerServicioSinCelo(historia, reglas));
      // Otra dosis del mismo celo es el mismo servicio, no una repetición.
      const ultimoServicio = ultimo('inseminacion');
      if (sow.estadoActual === 'inseminada' && !(ultimoServicio && diffDays(ultimoServicio, e.fecha) <= DIAS_MISMO_CELO)) {
        data.esReinseminacion = true;
        patch.numRepeticiones = sow.numRepeticiones + 1;
      }
      // The sow joins the lot it was served in: the one given, or the week's band.
      lotId = lotId || (await bandaDe(e.fecha));
      if (sow.lotIdActual !== lotId) Object.assign(patch, { lotIdActual: lotId, lotOrigenId: sow.lotIdActual, motivoSalida: data.esReinseminacion ? 'repeticion' : 'mover' });
    } else if (e.tipo === 'diagnostico') {
      if (data.resultado === 'positivo') patch.estadoActual = 'gestante';
      else if (data.resultado === 'negativo' || data.resultado === 'descarga') {
        patch.estadoActual = 'vacia';
        const atrasadas = loteFijo(lots.list, 'atrasadas');
        if (atrasadas) Object.assign(patch, { lotIdActual: atrasadas.id, lotOrigenId: sow.lotIdActual, motivoSalida: 'DiagNeg' });
      }
    } else if (e.tipo === 'adopcion') {
      if (data.madre) data.madre = String(data.madre).trim().toUpperCase();
      if (data.madre === sow.arete) reject('La madre donante o receptora debe ser otra cerda.');
    } else if (e.tipo === 'parto') {
      completarPesoCamada(data, 'pesoCamada', data.lechonesVivos);
      data.lechones = n(data.lechonesVivos) + n(data.lechonesMuertos) + n(data.momias);
      check(validarCantidadesEvento('parto', data.lechones, reglas));
      check(validarIntervaloServicioParto(ultimo('inseminacion'), e.fecha, reglas));
      check(validarIntervaloPartos(ultimo('parto') ?? sow.fechaUltimoParto, e.fecha, reglas));
      Object.assign(patch, { partosHistoricos: sow.partosHistoricos + 1, fechaUltimoParto: e.fecha });
    } else if (e.tipo === 'destete') {
      check(validarCantidadesEvento('destete', n(data.lechonesDestetados), reglas));
      avisos.push(avisoDestetados(lechonesActuales(historia), n(data.lechonesDestetados), reglas));
      completarPesoCamada(data, 'pesoCamadaDestete', data.lechonesDestetados);
      if (sow.fechaUltimoParto) data.edadDestete = diffDays(sow.fechaUltimoParto, e.fecha);
      if (n(data.lechonesDestetados) && n(data.pesoCamadaDestete)) data.pesoPromedioDestete = Math.round((n(data.pesoCamadaDestete) / n(data.lechonesDestetados)) * 100) / 100;
    } else if (e.tipo === 'muerte_lactante') {
      check(validarCantidadesEvento('muerte_lactante', n(data.cantidad), reglas));
      check(validarInventarioLactantes(lechonesActuales(historia), n(data.cantidad), reglas));
      if (reglas.exigirCausaMuerteLactantes && !data.causa) reject('Indica la causa de la muerte.');
    } else if (e.tipo === 'aborto') {
      check(validarIntervaloServicioAborto(ultimo('inseminacion'), e.fecha, reglas));
    } else if (e.tipo === 'celo') {
      avisos.push(avisoCeloCercano(ultimo('celo'), e.fecha, reglas));
    } else if (e.tipo === 'eliminar' || e.tipo === 'descarte') {
      check(validarEliminarLactando(sow.estadoActual, reglas));
    } else if (e.tipo === 'traslado') {
      const destino = lots.list.find((l) => l.id === data.loteDestinoId);
      if (!destino || destino.id === sow.lotIdActual) reject('Elige un lote de destino distinto al actual.');
      data.loteDestinoCode = destino!.code;
      // The move is recorded in the lot the sow leaves.
      lotId = sow.lotIdActual || lotId;
      Object.assign(patch, { lotIdActual: destino!.id, lotOrigenId: sow.lotIdActual, motivoSalida: 'Traslado' });
    } else if (e.tipo === 'cambio_codigo') {
      const nuevo = String(data.codigoNuevo ?? '').trim().toUpperCase();
      if (!nuevo || nuevo === sow.arete) reject('Indica un ID nuevo distinto al actual.');
      if (sows.list.some((s) => s.arete === nuevo && s.estadoActual !== 'descarte')) reject(`Ya hay una cerda activa con el ID ${nuevo}.`);
      data.codigoAnterior = sow.arete;
      delete data.codigoNuevo;
      Object.assign(patch, { arete: nuevo, codigosAnteriores: [...(sow.codigosAnteriores ?? []), sow.arete] });
    }

    const sigueLactando = e.tipo === 'destete' && !reglas.finalizarLactanciaAlDestetar;
    if (evento.estado && !sigueLactando) patch.estadoActual = evento.estado;
    if (evento.mover && !sigueLactando) {
      const destino = loteFijo(lots.list, evento.mover[0]);
      if (destino) Object.assign(patch, { lotIdActual: destino.id, lotOrigenId: sow.lotIdActual, motivoSalida: evento.mover[1] });
    }
  }

  // Any other event of a sow belongs to the lot the sow is in.
  lotId = lotId || sow?.lotIdActual || '';
  if (!lotId) reject('Elige el lote del registro.');

  if (e.tipo === 'pesada' && n(data.cantidadPesada)) data.pesoPromedio = Math.round((n(data.pesoTotal) / n(data.cantidadPesada)) * 100) / 100;
  if (e.tipo === 'postura') data.totalHuevos = n(data.pilas) * 360 + n(data.cartones) * 30 + n(data.unidades) + n(data.sucios);

  const registro = await registros.create({
    lotId, tipo: tipoGuardado(e.tipo), fecha: e.fecha, nota: (e.nota ?? '').trim(), data,
    sowId: sow?.id ?? '', cerdaCodigo: patch.arete ?? sow?.arete ?? '',
  });

  if (sow && Object.keys(patch).length) await sows.update(sow.id, patch);

  const bajas = bajasDe(registro);
  const lot = lots.list.find((l) => l.id === lotId);
  if (bajas && lot) await lots.update(lot.id, { activeAnimals: Math.max(0, lot.activeAnimals - bajas) });

  const texto = avisos.filter(Boolean).join('\n');
  if (texto) useGlobalStore.getState().showAlert({ title: 'Guardado, pero revisa esto', message: texto, type: 'info' });

  return registro;
};

/** With every piglet weighed, the litter's weight is their sum unless it was typed. */
const completarPesoCamada = (data: Record<string, any>, campo: string, lechones: unknown) => {
  const pesos: number[] = data.pesosLechones ?? [];
  if (!data[campo] && pesos.length && pesos.length === n(lechones)) data[campo] = Math.round(pesos.reduce((a, p) => a + p, 0) * 100) / 100;
};

/** A sow cannot enter after the first thing recorded about her (if the farm's rule says so). */
const validarFechaEntrada = (sow: Sow, fecha: string) => {
  const reglas = mergeReglas(useFarmStore.getState().current?.config?.reglas as any);
  const primero = deCerda(useRegistroStore.getState().list, sow).find((r) => r.tipo !== 'entrada');
  if (!primero) return;
  const v = validarFechaPosteriorAEntrada(primero.fecha, fecha, reglas);
  if (!v.ok) reject(v.motivo ?? 'Fecha inválida.');
};

/** Lo mismo que exige el API para cambiar un registro: quien audita, todo; el resto, sus pendientes. */
export const puedeCambiar = (r: Registro) =>
  can.audit(useFarmStore.getState().rol) || (r.creadoPor === useAuthStore.getState().user?.id && r.status === 'pending');

/**
 * Corrects an "entrada" event and what it set on the sow. Later parities are
 * kept: only the ones declared on entry are swapped.
 */
export const editarEntrada = async (r: Registro, e: { fecha: string; nota: string; data: Record<string, any> }): Promise<void> => {
  const sows = useSowStore.getState();
  const sow = sows.list.find((s) => (r.sowId ? s.id === r.sowId : s.arete === r.cerdaCodigo));
  if (sow) validarFechaEntrada(sow, e.fecha);
  if (mergeReglas(useFarmStore.getState().current?.config?.reglas as any).exigirFechaNacimiento && !e.data.fechaNacimiento) reject('Indica la fecha de nacimiento de la cerda.');
  const { tipoEntrada: _t, partosPrevios: antes, genetica: _g, fechaNacimiento: _n, ...resto } = r.data ?? {};
  await useRegistroStore.getState().update(r.id, { fecha: e.fecha, nota: e.nota.trim(), data: { ...resto, ...e.data } });
  if (!sow) return;
  await sows.update(sow.id, {
    fechaEntrada: e.fecha, tipo: e.data.tipoEntrada, genetica: e.data.genetica ?? '', fechaNacimiento: e.data.fechaNacimiento ?? '',
    partosHistoricos: Math.max(0, sow.partosHistoricos - n(antes) + n(e.data.partosPrevios)),
  });
};

/**
 * A new entry date typed on the sow's page: checked against her history and
 * carried to her "entrada" event when the user may change it.
 */
export const cambiarFechaEntrada = async (sow: Sow, fecha: string): Promise<void> => {
  validarFechaEntrada(sow, fecha);
  const registros = useRegistroStore.getState();
  const entrada = deCerda(registros.list, sow).find((r) => r.tipo === 'entrada');
  if (entrada && entrada.fecha !== fecha && puedeCambiar(entrada)) await registros.update(entrada.id, { fecha });
};

/** Animals a registro takes out of its lot. */
const bajasDe = (r: Registro) => {
  if (r.tipo === 'muerte') return n(r.data?.cantidad) || 1;
  if (r.tipo === 'venta') return r.data?.tipoVenta === 'huevos' ? 0 : n(r.data?.cantidad ?? r.data?.cantidadVenta);
  return 0;
};

/**
 * Deletes a registro and gives back to the lot the animals it had taken out.
 * A sow's state is not rolled back: it is corrected from the sow's page.
 */
export const eliminarRegistro = async (r: Registro): Promise<void> => {
  await useRegistroStore.getState().delete(r.id);
  const lots = useLotStore.getState();
  const lot = lots.list.find((l) => l.id === r.lotId);
  const bajas = bajasDe(r);
  if (bajas && lot) await lots.update(lot.id, { activeAnimals: lot.activeAnimals + bajas });
};

/** Confirms a pending registro (auditors only; the API enforces it). */
export const confirmarRegistro = (r: Registro) => useRegistroStore.getState().update(r.id, { status: 'confirmed' });
