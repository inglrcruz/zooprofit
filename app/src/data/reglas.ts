// Reglas y validaciones configurables del módulo de reproducción. Se guardan
// en la configuración de la granja (config.reglas) y se validan en el cliente
// con los datos ya cargados. Sin imports: se verifica con `node scripts/check-calc.mjs`.

/** "2026-10-08" como se muestra: "08-10-2026". */
const dmy = (ymd: string) => ymd.split('-').reverse().join('-');
const dias = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

export interface ReglasReproduccion {
  // ── Validaciones de comportamiento ──
  exigirVerracoEnServicio: boolean;
  exigirSemenEnServicio: boolean;
  permitirServirHembraYaServida: boolean;
  exigirDestetoAntesDeInseminar: boolean;
  exigirFinLactanciaAntesDeEliminar: boolean;
  alertarPrimeraCubricionSinCeloRegistrado: boolean;
  exigirCausaMuerteLactantes: boolean;
  alertarDiscrepanciaDestetados: boolean;
  exigirFechaNacimiento: boolean;
  exigirFechaPosteriorAEntrada: boolean;
  alertarCeloAnteriorMuyCercano: boolean;
  finalizarLactanciaAlDestetar: boolean;
  verificarInventarioLactantesEnMuerte: boolean;
  // ── Umbrales (días / cantidades) ──
  edadMinPrimeraCubricionDias: number;
  diasMaxServicioAborto: number;
  diasMinServicioParto: number;
  diasMaxServicioParto: number;
  diasMinPartoParto: number;
  maxNacidosPorParto: number;
  maxMuertesLactantesPorEvento: number;
  maxDestetadosPorEvento: number;
}

export const REGLAS_DEFAULT: ReglasReproduccion = {
  exigirVerracoEnServicio: false,
  exigirSemenEnServicio: false,
  permitirServirHembraYaServida: false,
  exigirDestetoAntesDeInseminar: true,
  exigirFinLactanciaAntesDeEliminar: false,
  alertarPrimeraCubricionSinCeloRegistrado: false,
  exigirCausaMuerteLactantes: false,
  alertarDiscrepanciaDestetados: true,
  exigirFechaNacimiento: false,
  exigirFechaPosteriorAEntrada: true,
  alertarCeloAnteriorMuyCercano: true,
  finalizarLactanciaAlDestetar: true,
  verificarInventarioLactantesEnMuerte: false,
  edadMinPrimeraCubricionDias: 0,
  diasMaxServicioAborto: 120,
  diasMinServicioParto: 105,
  diasMaxServicioParto: 125,
  diasMinPartoParto: 105,
  maxNacidosPorParto: 35,
  maxMuertesLactantesPorEvento: 35,
  maxDestetadosPorEvento: 35,
};

// Etiquetas para la pantalla de configuración — texto propio, parafraseado.
export const REGLAS_TOGGLE_LABELS: { key: keyof ReglasReproduccion; label: string; help?: string }[] = [
  { key: 'exigirVerracoEnServicio', label: 'Exigir verraco registrado al guardar un servicio' },
  { key: 'exigirSemenEnServicio', label: 'Exigir semen/dosis registrado al guardar un servicio' },
  { key: 'permitirServirHembraYaServida', label: 'Permitir volver a servir una hembra ya servida', help: 'Si está apagado, se bloquea reinseminar sin registrar antes una salida (celo, aborto, etc.)' },
  { key: 'exigirDestetoAntesDeInseminar', label: 'No permitir inseminar una cerda que sigue lactando', help: 'Bloquea el servicio si el último evento es un parto sin destete posterior' },
  { key: 'exigirFinLactanciaAntesDeEliminar', label: 'Exigir que termine la lactancia antes de eliminar una cerda' },
  { key: 'alertarPrimeraCubricionSinCeloRegistrado', label: 'Alertar si la primera cubrición no tiene un celo registrado antes' },
  { key: 'exigirCausaMuerteLactantes', label: 'Exigir causa de muerte al registrar muerte de lactantes' },
  { key: 'alertarDiscrepanciaDestetados', label: 'Alertar si el número de destetados no cuadra con los nacidos vivos' },
  { key: 'exigirFechaNacimiento', label: 'Exigir fecha de nacimiento al registrar una cerda nueva' },
  { key: 'exigirFechaPosteriorAEntrada', label: 'No permitir eventos con fecha anterior a la entrada de la cerda', help: 'Bloquea guardar un evento si su fecha es antes de la fecha de entrada registrada' },
  { key: 'alertarCeloAnteriorMuyCercano', label: 'Alertar si el celo anterior fue registrado demasiado cerca' },
  { key: 'finalizarLactanciaAlDestetar', label: 'Finalizar automáticamente la lactancia al registrar el destete' },
  { key: 'verificarInventarioLactantesEnMuerte', label: 'Verificar el inventario de lactantes al registrar una muerte' },
];

export const REGLAS_UMBRAL_LABELS: { key: keyof ReglasReproduccion; label: string; unidad: string }[] = [
  { key: 'edadMinPrimeraCubricionDias', label: 'Edad mínima para la primera cubrición', unidad: 'días' },
  { key: 'diasMaxServicioAborto', label: 'Máximo días entre servicio y aborto', unidad: 'días' },
  { key: 'diasMinServicioParto', label: 'Mínimo días entre servicio y parto', unidad: 'días' },
  { key: 'diasMaxServicioParto', label: 'Máximo días entre servicio y parto', unidad: 'días' },
  { key: 'diasMinPartoParto', label: 'Mínimo días entre parto y parto', unidad: 'días' },
  { key: 'maxNacidosPorParto', label: 'Máximo de lechones nacidos por parto', unidad: 'lechones' },
  { key: 'maxMuertesLactantesPorEvento', label: 'Máximo de muertes de lactantes por evento', unidad: 'lechones' },
  { key: 'maxDestetadosPorEvento', label: 'Máximo de destetados por evento', unidad: 'lechones' },
];

export function mergeReglas(partial: Partial<ReglasReproduccion> | null | undefined): ReglasReproduccion {
  return { ...REGLAS_DEFAULT, ...(partial ?? {}) };
}

// ─── Validadores (100% locales — reciben datos ya cargados, no consultan nada) ──

export interface ValidacionResultado {
  ok: boolean;
  motivo?: string;
}

/**
 * ¿Se puede registrar un servicio (inseminación) para esta cerda?
 * `registrosOrdenados` = eventos de la cerda YA ordenados por fecha ascendente.
 */
export function validarPuedeInseminar(
  registrosOrdenados: { tipo: string; fecha: string }[],
  reglas: ReglasReproduccion
): ValidacionResultado {
  if (!reglas.exigirDestetoAntesDeInseminar) return { ok: true };
  const ultimo = registrosOrdenados[registrosOrdenados.length - 1];
  if (ultimo?.tipo === 'parto') {
    return { ok: false, motivo: 'Esta cerda sigue lactando (tiene un parto sin destete registrado). Registra el destete antes de inseminarla de nuevo.' };
  }
  return { ok: true };
}

/**
 * ¿El intervalo entre el servicio (inseminación) y el parto que se está
 * guardando es válido según los umbrales configurados?
 * `fechaInseminacion` puede ser null si no se encontró el servicio de origen.
 */
export function validarIntervaloServicioParto(
  fechaInseminacion: string | null,
  fechaParto: string,
  reglas: ReglasReproduccion
): ValidacionResultado {
  if (!fechaInseminacion) return { ok: true };
  const dias = Math.round(
    (new Date(fechaParto + 'T00:00:00').getTime() - new Date(fechaInseminacion + 'T00:00:00').getTime()) / 86400000
  );
  if (dias < reglas.diasMinServicioParto) {
    return { ok: false, motivo: `Solo pasaron ${dias} días desde el servicio (${dmy(fechaInseminacion)}) — el mínimo configurado es ${reglas.diasMinServicioParto}. Revisa la fecha.` };
  }
  if (dias > reglas.diasMaxServicioParto) {
    return { ok: false, motivo: `Pasaron ${dias} días desde el servicio (${dmy(fechaInseminacion)}) — el máximo configurado es ${reglas.diasMaxServicioParto}. Revisa la fecha.` };
  }
  return { ok: true };
}

/**
 * ¿La fecha del evento es válida frente a la fecha de entrada de la cerda?
 * `fechaEntrada` puede ser null/undefined si la cerda no la tiene registrada
 * (cerdas viejas de antes de este campo) — en ese caso no hay nada que validar.
 */
export function validarFechaPosteriorAEntrada(
  fechaEvento: string,
  fechaEntrada: string | null | undefined,
  reglas: ReglasReproduccion
): ValidacionResultado {
  if (!reglas.exigirFechaPosteriorAEntrada || !fechaEntrada) return { ok: true };
  if (fechaEvento < fechaEntrada) {
    return { ok: false, motivo: `La fecha del evento (${dmy(fechaEvento)}) es anterior a la fecha de entrada de la cerda (${dmy(fechaEntrada)}). Revisa la fecha.` };
  }
  return { ok: true };
}

/** ¿El total nacidos/muertes/destetados de un evento está dentro de los máximos configurados? */
export function validarCantidadesEvento(
  tipo: 'parto' | 'muerte_lactante' | 'destete',
  cantidad: number,
  reglas: ReglasReproduccion
): ValidacionResultado {
  const max = tipo === 'parto' ? reglas.maxNacidosPorParto
    : tipo === 'muerte_lactante' ? reglas.maxMuertesLactantesPorEvento
    : reglas.maxDestetadosPorEvento;
  if (cantidad > max) {
    return { ok: false, motivo: `${cantidad} es más del máximo configurado (${max}). Verifica el número antes de guardar.` };
  }
  return { ok: true };
}

/** Hasta cuántos días después se considera el mismo celo: un servicio suele llevar varias dosis. */
export const DIAS_MISMO_CELO = 2;
const DIAS_MIN_ENTRE_CELOS = 18;

const SERVIDA = ['inseminada', 'gestante'];
const REQUIERE: Record<string, { estados: string[]; motivo: string }> = {
  parto: { estados: SERVIDA, motivo: 'Solo puede parir una cerda servida o preñada. Registra primero la inseminación.' },
  diagnostico: { estados: SERVIDA, motivo: 'Solo se diagnostica una cerda servida. Registra primero la inseminación.' },
  aborto: { estados: SERVIDA, motivo: 'Solo puede abortar una cerda servida o preñada.' },
  destete: { estados: ['lactando'], motivo: 'Solo se desteta una cerda lactando. Registra primero el parto.' },
  muerte_lactante: { estados: ['lactando'], motivo: 'Esta cerda no está lactando: no tiene lechones que registrar.' },
  adopcion: { estados: ['lactando'], motivo: 'Solo una cerda lactando puede recibir o entregar lechones.' },
};

/**
 * ¿El evento tiene sentido para el estado de la cerda? Las importadas sin
 * ningún registro pueden tener un estado sin historia que lo respalde: a
 * ellas no se les exige, salvo si ya salieron de la granja.
 */
export function validarSecuencia(tipo: string, estado: string, conHistoria: boolean): ValidacionResultado {
  if (estado === 'descarte') return { ok: false, motivo: 'Esta cerda ya salió de la granja. Corrige su estado en la ficha si es un error.' };
  const r = REQUIERE[tipo];
  if (!r || !conHistoria || r.estados.includes(estado)) return { ok: true };
  return { ok: false, motivo: r.motivo };
}

/** Volver a servir una cerda servida, pasado el celo del último servicio. */
export function validarServicioRepetido(estado: string, ultimoServicio: string | null, fecha: string, reglas: ReglasReproduccion): ValidacionResultado {
  if (reglas.permitirServirHembraYaServida || !SERVIDA.includes(estado)) return { ok: true };
  if (ultimoServicio && dias(ultimoServicio, fecha) <= DIAS_MISMO_CELO) return { ok: true };
  return { ok: false, motivo: 'Esta cerda ya está servida. Registra antes su salida (celo, aborto o diagnóstico negativo), o permítelo en las reglas de la granja.' };
}

export function validarEliminarLactando(estado: string, reglas: ReglasReproduccion): ValidacionResultado {
  if (!reglas.exigirFinLactanciaAntesDeEliminar || estado !== 'lactando') return { ok: true };
  return { ok: false, motivo: 'Esta cerda sigue lactando. Registra el destete antes de sacarla de la granja.' };
}

/** Edad al primer servicio; sin fecha de nacimiento no hay nada que validar. */
export function validarEdadPrimerServicio(nacimiento: string | null | undefined, fecha: string, reglas: ReglasReproduccion): ValidacionResultado {
  const min = reglas.edadMinPrimeraCubricionDias;
  if (!min || !nacimiento || dias(nacimiento, fecha) >= min) return { ok: true };
  return { ok: false, motivo: `Tiene ${dias(nacimiento, fecha)} días y el mínimo configurado para el primer servicio es ${min}.` };
}

export function validarIntervaloServicioAborto(ultimoServicio: string | null, fecha: string, reglas: ReglasReproduccion): ValidacionResultado {
  if (!ultimoServicio || dias(ultimoServicio, fecha) <= reglas.diasMaxServicioAborto) return { ok: true };
  return { ok: false, motivo: `Pasaron ${dias(ultimoServicio, fecha)} días desde el servicio (${dmy(ultimoServicio)}) y el máximo configurado es ${reglas.diasMaxServicioAborto}. Revisa la fecha.` };
}

export function validarIntervaloPartos(ultimoParto: string | null | undefined, fecha: string, reglas: ReglasReproduccion): ValidacionResultado {
  if (!ultimoParto || dias(ultimoParto, fecha) >= reglas.diasMinPartoParto) return { ok: true };
  return { ok: false, motivo: `Solo pasaron ${dias(ultimoParto, fecha)} días desde su último parto (${dmy(ultimoParto)}) y el mínimo configurado es ${reglas.diasMinPartoParto}.` };
}

/**
 * Lechones que tiene hoy: los nacidos vivos del último parto, más los que
 * recibió, menos los que entregó y los muertos. null si no hay parto registrado.
 */
export function lechonesActuales(historia: { tipo: string; data?: Record<string, any> | null }[]): number | null {
  const desde = historia.map((r) => r.tipo).lastIndexOf('parto');
  if (desde < 0) return null;
  let total = 0;
  for (const r of historia.slice(desde)) {
    const d = r.data ?? {};
    if (r.tipo === 'parto') total += Number(d.lechonesVivos) || 0;
    else if (r.tipo === 'adopcion') total += (d.direccion === 'salida' ? -1 : 1) * (Number(d.cantidadLechones) || 0);
    else if (r.tipo === 'muerte_lactante') total -= Number(d.cantidad) || 1;
  }
  return Math.max(0, total);
}

export function validarInventarioLactantes(lechones: number | null, muertos: number, reglas: ReglasReproduccion): ValidacionResultado {
  if (!reglas.verificarInventarioLactantesEnMuerte || lechones === null || muertos <= lechones) return { ok: true };
  return { ok: false, motivo: `Registras ${muertos === 1 ? '1 muerto' : `${muertos} muertos`} y esta cerda tiene ${lechones === 1 ? '1 lechón' : `${lechones} lechones`}.` };
}

// ── Avisos: no impiden guardar, se muestran después ──

export function avisoDestetados(lechones: number | null, destetados: number, reglas: ReglasReproduccion): string | null {
  if (!reglas.alertarDiscrepanciaDestetados || lechones === null || lechones === destetados) return null;
  return `Destetaste ${destetados === 1 ? '1 lechón' : `${destetados} lechones`}, pero según sus registros tenía ${lechones}.`;
}

export function avisoPrimerServicioSinCelo(historia: { tipo: string }[], reglas: ReglasReproduccion): string | null {
  if (!reglas.alertarPrimeraCubricionSinCeloRegistrado || historia.some((r) => r.tipo === 'inseminacion' || r.tipo === 'celo')) return null;
  return 'Es su primer servicio y no tiene un celo registrado antes.';
}

export function avisoCeloCercano(ultimoCelo: string | null, fecha: string, reglas: ReglasReproduccion): string | null {
  if (!reglas.alertarCeloAnteriorMuyCercano || !ultimoCelo || dias(ultimoCelo, fecha) >= DIAS_MIN_ENTRE_CELOS) return null;
  return `Su celo anterior fue hace ${dias(ultimoCelo, fecha)} días (${dmy(ultimoCelo)}). Revisa si es correcto.`;
}
