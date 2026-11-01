// Cálculos de los formularios. Sin imports: se verifica con `node scripts/check-calc.mjs`.

export const HUEVOS_POR_PILA = 360;
export const HUEVOS_POR_CARTON = 30;
export const LB_POR_KG = 2.20462;

export function totalHuevos(e: { pilas: number; cartones: number; unidades: number; sucios: number }) {
  return e.pilas * HUEVOS_POR_PILA + e.cartones * HUEVOS_POR_CARTON + e.unidades + e.sucios;
}

/** Porcentaje de postura con un decimal; 0 si no hay aves */
export function postura(huevos: number, aves: number) {
  return aves > 0 ? Math.round((huevos / aves) * 1000) / 10 : 0;
}

/** Peso promedio en kg a partir del total de la muestra o del promedio ya calculado */
export function pesoPromedioKg(peso: number, animales: number, modo: 'total' | 'promedio', unidad: 'kg' | 'lb') {
  const kg = unidad === 'lb' ? peso / LB_POR_KG : peso;
  if (modo === 'promedio') return Math.round(kg * 10) / 10;
  return animales > 0 ? Math.round((kg / animales) * 10) / 10 : 0;
}

export const fmt = (n: number) => n.toLocaleString('en-US');
export const signed = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;
