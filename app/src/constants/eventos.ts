import type { IconName } from '@/components/icon';
import type { Tone } from '@/constants/tokens';
import type { EstadoCerda, Registro } from '@/types/data';

/** Un dato del formulario de un evento; `key` es su nombre dentro de registro.data. */
export type Campo = {
  key: string;
  label: string;
  kind: 'int' | 'dec' | 'text' | 'choice' | 'lot' | 'verraco' | 'pesos' | 'fecha';
  options?: readonly (readonly [value: string, label: string])[];
  required?: boolean;
  placeholder?: string;
  /** Solo se pide cuando otro campo tiene ese valor: [campo, valor]. */
  si?: readonly [campo: string, valor: string];
  /** Ofrece como opciones lo que ya se escribió antes en este campo. */
  recuerda?: boolean;
  /** kind 'pesos': campo con el número de lechones a pesar. */
  cuantos?: string;
};

export type Evento = {
  label: string;
  icon: IconName;
  tone?: Tone;
  /** ¿El evento es de una cerda? */
  cerda: 'req' | 'opt' | 'no';
  campos: Campo[];
  /** Estado en que queda la cerda. */
  estado?: EstadoCerda;
  /** Lote fijo al que pasa la cerda, y el motivo que se anota. */
  mover?: readonly ['destetadas' | 'atrasadas' | 'descarte', string];
  /** Campo cuya cantidad se descuenta de los animales activos del lote. */
  baja?: string;
};

const cantidad = (label: string, required = true): Campo => ({ key: 'cantidad', label, kind: 'int', required });

export const EVENTOS: Record<string, Evento> = {
  /* ── reproducción ── */
  inseminacion: {
    label: 'Inseminación', icon: 'drop', cerda: 'req', estado: 'inseminada',
    campos: [
      { key: 'verraco', label: 'Verraco / semen', kind: 'verraco' },
      { key: 'hora', label: 'Hora (opcional)', kind: 'text', placeholder: 'HH:MM' },
      { key: 'tecnico', label: 'Quién inseminó', kind: 'text', placeholder: 'Nombre del técnico', recuerda: true },
    ],
  },
  diagnostico: {
    label: 'Diagnóstico', icon: 'search', cerda: 'req',
    campos: [{ key: 'resultado', label: 'Resultado', kind: 'choice', required: true, options: [['positivo', 'Positivo'], ['negativo', 'Negativo'], ['descarga', 'Descarga vulvar'], ['inconcluso', 'No concluyente']] }],
  },
  parto: {
    label: 'Parto', icon: 'heart', cerda: 'req', estado: 'lactando',
    campos: [
      { key: 'lechonesVivos', label: 'Nacidos vivos', kind: 'int', required: true },
      { key: 'lechonesMuertos', label: 'Nacidos muertos', kind: 'int' },
      { key: 'momias', label: 'Momias', kind: 'int' },
      { key: 'pesoCamada', label: 'Peso de la camada (kg)', kind: 'dec' },
      { key: 'pesosLechones', label: 'Pesos individuales (kg)', kind: 'pesos', cuantos: 'lechonesVivos' },
    ],
  },
  destete: {
    label: 'Destete', icon: 'arrowRight', cerda: 'req', estado: 'destetada', mover: ['destetadas', 'Destete'],
    campos: [
      { key: 'lechonesDestetados', label: 'Lechones destetados', kind: 'int', required: true },
      { key: 'pesoCamadaDestete', label: 'Peso de la camada (kg)', kind: 'dec' },
      { key: 'pesosLechones', label: 'Pesos individuales (kg)', kind: 'pesos', cuantos: 'lechonesDestetados' },
    ],
  },
  celo: { label: 'Celo no servido', icon: 'clock', cerda: 'req', estado: 'celo', mover: ['atrasadas', 'CNS'], campos: [] },
  aborto: { label: 'Aborto', icon: 'alert', cerda: 'req', estado: 'abortada', mover: ['atrasadas', 'Aborto'], campos: [{ key: 'causa', label: 'Causa (opcional)', kind: 'text' }] },
  adopcion: {
    label: 'Adopción', icon: 'adopt', cerda: 'req',
    campos: [
      { key: 'direccion', label: 'Movimiento', kind: 'choice', required: true, options: [['entrada', 'Recibe lechones'], ['salida', 'Entrega lechones']] },
      { key: 'madre', label: 'Madre donante (opcional)', kind: 'text', placeholder: 'ID de la cerda', si: ['direccion', 'entrada'] },
      { key: 'madre', label: 'Madre receptora (opcional)', kind: 'text', placeholder: 'ID de la cerda', si: ['direccion', 'salida'] },
      { key: 'cantidadLechones', label: 'Lechones', kind: 'int', required: true },
    ],
  },
  /* ── animales ── */
  entrada: {
    label: 'Entrada', icon: 'plus', cerda: 'req',
    campos: [
      { key: 'tipoEntrada', label: 'Tipo', kind: 'choice', required: true, options: [['primeriza', 'Primeriza'], ['multipara', 'Multípara']] },
      { key: 'partosPrevios', label: 'Partos previos', kind: 'int', si: ['tipoEntrada', 'multipara'] },
      { key: 'fechaNacimiento', label: 'Fecha de nacimiento', kind: 'fecha' },
      { key: 'genetica', label: 'Genética (opcional)', kind: 'text', placeholder: 'Ej: PIC, F2', recuerda: true },
    ],
  },
  traslado: { label: 'Traslado', icon: 'swap', cerda: 'req', campos: [{ key: 'loteDestinoId', label: 'Lote de destino', kind: 'lot', required: true }] },
  cambio_codigo: { label: 'Cambio de código', icon: 'tag', cerda: 'req', campos: [{ key: 'codigoNuevo', label: 'ID nuevo', kind: 'text', required: true }] },
  pesada: {
    label: 'Pesada', icon: 'scale', cerda: 'no',
    campos: [
      { key: 'cantidadPesada', label: 'Animales pesados', kind: 'int', required: true },
      { key: 'pesoTotal', label: 'Peso total (kg)', kind: 'dec', required: true },
    ],
  },
  /* ── manejo ── */
  medicacion: {
    label: 'Medicación', icon: 'flask', cerda: 'opt',
    campos: [
      { key: 'nombreMedicamento', label: 'Medicamento', kind: 'text', required: true },
      { key: 'dosis', label: 'Dosis (opcional)', kind: 'text' },
      { key: 'via', label: 'Vía (opcional)', kind: 'text', placeholder: 'Inyectada, en agua…' },
    ],
  },
  alimento: {
    label: 'Alimento', icon: 'box', cerda: 'no',
    campos: [
      { key: 'sacos', label: 'Sacos (100 lb)', kind: 'dec', required: true },
      { key: 'tipoAlimento', label: 'Tipo de alimento (opcional)', kind: 'text' },
    ],
  },
  venta: { label: 'Venta', icon: 'coin', cerda: 'no', baja: 'cantidad', campos: [cantidad('Animales vendidos'), { key: 'precio', label: 'Precio total (opcional)', kind: 'dec' }] },
  /* ── bajas ── */
  muerte: { label: 'Muerte', icon: 'x', tone: 'd', cerda: 'no', baja: 'cantidad', campos: [cantidad('Animales muertos'), { key: 'causa', label: 'Causa (opcional)', kind: 'text' }] },
  muerte_cerda: { label: 'Muerte cerda', icon: 'x', tone: 'd', cerda: 'req', estado: 'descarte', mover: ['descarte', 'Muerte'], campos: [{ key: 'causa', label: 'Causa', kind: 'text' }] },
  muerte_lactante: { label: 'Muerte lactantes', icon: 'x', tone: 'd', cerda: 'req', campos: [cantidad('Lechones muertos'), { key: 'causa', label: 'Causa', kind: 'text', recuerda: true }] },
  eliminar: { label: 'A eliminar', icon: 'trash', tone: 'd', cerda: 'req', estado: 'descarte', mover: ['descarte', 'Eliminada'], campos: [{ key: 'motivo', label: 'Motivo', kind: 'text' }] },
  descarte: {
    label: 'Descarte cerda', icon: 'minus', tone: 'd', cerda: 'req', estado: 'descarte', mover: ['descarte', 'Descarte'],
    campos: [
      { key: 'motivo', label: 'Motivo', kind: 'choice', required: true, options: [['venta', 'Venta'], ['edad', 'Edad'], ['improductiva', 'Improductiva'], ['otro', 'Otro']] },
      { key: 'precioVenta', label: 'Precio de venta (opcional)', kind: 'dec' },
    ],
  },
  /* ── aves ── */
  postura: {
    label: 'Postura', icon: 'egg', cerda: 'no',
    campos: [
      { key: 'pilas', label: 'Pilas (× 360)', kind: 'int' },
      { key: 'cartones', label: 'Cartones (× 30)', kind: 'int' },
      { key: 'unidades', label: 'Unidades sueltas', kind: 'int' },
      { key: 'sucios', label: 'Sucios', kind: 'int' },
    ],
  },
  venta_aves: {
    label: 'Venta', icon: 'coin', cerda: 'no',
    campos: [
      { key: 'tipoVenta', label: '¿Qué se vendió?', kind: 'choice', required: true, options: [['huevos', 'Huevos (cartones)'], ['aves', 'Aves']] },
      { key: 'cantidadVenta', label: 'Cantidad', kind: 'int', required: true },
      { key: 'precio', label: 'Precio total (opcional)', kind: 'dec' },
    ],
  },
  iluminacion: { label: 'Iluminación', icon: 'bulb', cerda: 'no', campos: [{ key: 'horasLuz', label: 'Horas de luz al día', kind: 'dec', required: true }] },
  averia: { label: 'Avería', icon: 'wrench', tone: 'w', cerda: 'no', campos: [{ key: 'descripcion', label: '¿Qué se dañó?', kind: 'text', required: true }] },
  nota: { label: 'Nota', icon: 'info', tone: 'n', cerda: 'no', campos: [] },
};

/** Tipos que el sistema anota por su cuenta junto a otro evento. */
EVENTOS.reinseminacion_salida = { label: 'Salida por repetición', icon: 'repeat', tone: 'w', cerda: 'req', campos: [] };
EVENTOS.aborto_salida = { label: 'Salida por aborto', icon: 'alert', tone: 'w', cerda: 'req', campos: [] };
EVENTOS.reubicacion_salida = { label: 'Salida por traslado', icon: 'swap', cerda: 'req', campos: [] };

export const eventoDe = (tipo: string): Evento => EVENTOS[tipo] ?? { label: tipo, icon: 'info', tone: 'n', cerda: 'no', campos: [] };

/** Hoja "¿Qué vas a registrar?" de reproducción. */
export const GRUPOS_REPRO: { title: string; tone: Tone; tipos: string[] }[] = [
  { title: 'Reproducción', tone: 'info', tipos: ['inseminacion', 'diagnostico', 'parto', 'destete', 'celo', 'aborto', 'adopcion'] },
  { title: 'Animales', tone: 'info', tipos: ['entrada', 'traslado', 'cambio_codigo', 'pesada'] },
  { title: 'Manejo', tone: 'info', tipos: ['medicacion', 'alimento', 'venta'] },
  { title: 'Bajas', tone: 'd', tipos: ['muerte_cerda', 'muerte_lactante', 'eliminar', 'descarte'] },
];
export const TIPOS_PROD = ['pesada', 'muerte', 'alimento', 'medicacion', 'venta'];
export const TIPOS_AVES = ['alimento', 'pesada', 'venta_aves', 'iluminacion', 'averia', 'muerte'];

/** El tipo con que se guarda (venta_aves es solo el formulario de "venta" para aves). */
export const tipoGuardado = (tipo: string) => (tipo === 'venta_aves' ? 'venta' : tipo);

export const ESTADO: Record<string, readonly [label: string, tone: Tone]> = {
  vacia: ['Por servir', 'w'],
  inseminada: ['Servida', 'info'],
  gestante: ['Preñada', 'info'],
  lactando: ['Lactando', 'k'],
  celo: ['En celo no servido', 'w'],
  destetada: ['Destetada', 'w'],
  abortada: ['Abortada', 'd'],
  descarte: ['Eliminada', 'd'],
};
export const estadoDe = (estado: string) => ESTADO[estado] ?? ([estado || 'Sin estado', 'n'] as const);

const lech = (n: unknown) => `${Number(n) || 0}`;
const pesos = (d: Record<string, any>) => !!d.pesosLechones?.length && `pesos: ${d.pesosLechones.join(', ')} kg`;

/** Una línea que resume lo que dice un registro. */
export function resumen(r: Registro): string {
  const d = r.data ?? {};
  const parts: (string | false | undefined)[] = (() => {
    switch (r.tipo) {
      case 'inseminacion': return [d.verraco && `Verraco ${d.verraco}`, d.tecnico, d.hora, d.esReinseminacion && 'repetición'];
      case 'diagnostico': return [eventoDe('diagnostico').campos[0].options?.find((o) => o[0] === d.resultado)?.[1] ?? d.resultado];
      case 'parto': return [`${lech(d.lechonesVivos)} vivos`, !!d.lechonesMuertos && `${d.lechonesMuertos} muertos`, !!d.momias && `${d.momias} momias`, !!d.pesoCamada && `${d.pesoCamada} kg`, pesos(d)];
      case 'destete': return [`${lech(d.lechonesDestetados)} lechones`, !!d.edadDestete && `${d.edadDestete} días`, !!d.pesoCamadaDestete && `${d.pesoCamadaDestete} kg`, pesos(d)];
      case 'adopcion': return [`${d.direccion === 'salida' ? '−' : '+'}${lech(d.cantidadLechones)} lechones`, !!d.madre && `${d.direccion === 'salida' ? 'receptora' : 'donante'} ${d.madre}`];
      case 'entrada': return [d.tipoEntrada === 'multipara' ? `Multípara · ${lech(d.partosPrevios)} partos` : d.tipoEntrada === 'primeriza' ? 'Primeriza' : !!d.cantidadAnimales && `${d.cantidadAnimales} animales`];
      case 'cambio_codigo': return [`Antes ${d.codigoAnterior ?? '—'}`];
      case 'traslado': return [d.loteDestinoCode ? `A ${d.loteDestinoCode}` : d.loteTexto];
      case 'pesada': return [`${lech(d.cantidadPesada)} animales`, !!d.pesoPromedio && `${d.pesoPromedio} kg prom.`];
      case 'medicacion': return [d.nombreMedicamento, d.dosis, d.via];
      case 'alimento': return [`${lech(d.sacos)} sacos`, d.tipoAlimento || d.tipoAlim];
      case 'venta': return [`${lech(d.cantidad ?? d.cantidadVenta)} ${d.tipoVenta ?? 'animales'}`, !!d.precio && `RD$ ${d.precio}`];
      case 'muerte': case 'muerte_lactante': return [`${Number(d.cantidad) || 1}`, d.causa];
      case 'muerte_cerda': case 'aborto': return [d.causa];
      case 'eliminar': case 'descarte': return [d.motivo, !!d.precioVenta && `RD$ ${d.precioVenta}`];
      case 'postura': return [`${lech(d.totalHuevos)} huevos`, !!d.sucios && `${d.sucios} sucios`];
      case 'iluminacion': return [`${d.horasLuz} h de luz`];
      case 'averia': return [d.descripcion];
      default: return [];
    }
  })();
  return [...parts, r.nota].filter(Boolean).join(' · ');
}
