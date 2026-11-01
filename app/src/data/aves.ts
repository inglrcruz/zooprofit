// Indicadores de aves y de lotes de engorde, calculados sobre los registros
// ya cargados. Solo importa tipos: se verifica con `node scripts/check-calc.mjs`.
import type { Lot, Registro } from '../types/data';

const DAY = 86400000;
export const LB_POR_SACO = 100;
const G_POR_LB = 453.592;

const at = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime();
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const r1 = (v: number) => Math.round(v * 10) / 10;

export const huevosDe = (d: Record<string, any> | null | undefined) =>
  n(d?.totalHuevos) || n(d?.pilas) * 360 + n(d?.cartones) * 30 + n(d?.unidades) + n(d?.sucios);

/** Semana de edad del lote en una fecha (la primera semana es la 1). */
export const semanaDeEdad = (lot: Lot, ymd: string) => {
  const nacimiento = lot.birthDate || lot.entryDate;
  return nacimiento ? Math.max(1, Math.floor((at(ymd) - at(nacimiento)) / DAY / 7) + 1) : 0;
};

export type Dia = { fecha: string; huevos: number; sucios: number; muertes: number; sacos: number; aves: number; postura: number };

/**
 * Un renglón por día con registros, del más antiguo al más reciente. Las
 * aves vivas de cada día son las iniciales menos las muertes y ventas de aves
 * anteriores.
 */
export function dias(lot: Lot, regs: Registro[]): Dia[] {
  const map = new Map<string, Dia & { bajas: number }>();
  for (const r of regs) {
    if (r.lotId !== lot.id) continue;
    const d = map.get(r.fecha) ?? { fecha: r.fecha, huevos: 0, sucios: 0, muertes: 0, sacos: 0, aves: 0, postura: 0, bajas: 0 };
    if (r.tipo === 'postura') {
      d.huevos += huevosDe(r.data);
      d.sucios += n(r.data?.sucios);
    } else if (r.tipo === 'muerte') {
      d.muertes += n(r.data?.cantidad) || 1;
      d.bajas += n(r.data?.cantidad) || 1;
    } else if (r.tipo === 'alimento') d.sacos += n(r.data?.sacos);
    else if (r.tipo === 'venta' && r.data?.tipoVenta === 'aves') d.bajas += n(r.data?.cantidadVenta);
    else continue;
    map.set(r.fecha, d);
  }
  let aves = lot.initialAnimals;
  return [...map.values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(({ bajas, ...d }) => {
      const dia = { ...d, aves, postura: aves > 0 ? r1((d.huevos / aves) * 100) : 0 };
      aves = Math.max(0, aves - bajas);
      return dia;
    });
}

/** Aves vivas hoy según los registros. */
export const avesVivas = (lot: Lot, regs: Registro[]) =>
  Math.max(0, lot.initialAnimals - regs.reduce((a, r) => {
    if (r.lotId !== lot.id) return a;
    if (r.tipo === 'muerte') return a + (n(r.data?.cantidad) || 1);
    if (r.tipo === 'venta' && r.data?.tipoVenta === 'aves') return a + n(r.data?.cantidadVenta);
    return a;
  }, 0));

export type Semana = { semana: number; postura: number | null; mortAcum: number | null; consumo: number | null; pesoAve: number | null };

/** Promedios por semana de edad, de la más antigua a la más reciente. */
export function semanas(lot: Lot, regs: Registro[]): Semana[] {
  const map = new Map<number, { huevos: number; avesDia: number; avesDiaAlim: number; sacos: number; pesos: number[] }>();
  const de = (ymd: string) => {
    const s = semanaDeEdad(lot, ymd);
    if (!map.has(s)) map.set(s, { huevos: 0, avesDia: 0, avesDiaAlim: 0, sacos: 0, pesos: [] });
    return map.get(s)!;
  };
  const serie = dias(lot, regs);
  for (const d of serie) {
    const s = de(d.fecha);
    if (d.huevos) {
      s.huevos += d.huevos;
      s.avesDia += d.aves;
    }
    if (d.sacos) {
      s.sacos += d.sacos;
      s.avesDiaAlim += d.aves;
    }
  }
  for (const r of regs) {
    if (r.lotId === lot.id && r.tipo === 'pesada' && n(r.data?.pesoPromedio)) de(r.fecha).pesos.push(n(r.data?.pesoPromedio));
  }
  let muertes = 0;
  const muertesHasta = new Map<number, number>();
  for (const d of serie) {
    muertes += d.muertes;
    muertesHasta.set(semanaDeEdad(lot, d.fecha), muertes);
  }
  let acum = 0;
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, s]) => {
      acum = muertesHasta.get(semana) ?? acum;
      return {
        semana,
        postura: s.avesDia ? r1((s.huevos / s.avesDia) * 100) : null,
        mortAcum: lot.initialAnimals ? Math.round((acum / lot.initialAnimals) * 1000) / 10 : null,
        consumo: s.avesDiaAlim ? Math.round((s.sacos * LB_POR_SACO * G_POR_LB) / s.avesDiaAlim) : null,
        pesoAve: s.pesos.length ? Math.round(s.pesos.reduce((a, b) => a + b, 0) / s.pesos.length) : null,
      };
    });
}

/* ───── lotes de engorde (cerdos · producción) ───── */

export type Engorde = {
  activos: number;
  muertes: number;
  vendidos: number;
  /** [fecha, kg promedio], empezando por el peso de entrada. */
  pesadas: [string, number][];
  alimentoKg: number;
  gananciaDiaria: number | null;
  conversion: number | null;
  mortalidad: number | null;
};

export function engorde(lot: Lot, regs: Registro[]): Engorde {
  const mine = regs.filter((r) => r.lotId === lot.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const suma = (tipo: string, campo: string, min = 0) => mine.filter((r) => r.tipo === tipo).reduce((a, r) => a + (n(r.data?.[campo]) || min), 0);
  const muertes = suma('muerte', 'cantidad', 1);
  const vendidos = suma('venta', 'cantidad');
  const alimentoKg = (suma('alimento', 'sacos') * LB_POR_SACO) / 2.20462;
  const inicio = lot.entryDate || lot.fechaInicio;
  const pesadas: [string, number][] = [
    ...(lot.entryWeight > 0 && inicio ? [[inicio, lot.entryWeight] as [string, number]] : []),
    ...mine.filter((r) => r.tipo === 'pesada' && n(r.data?.pesoPromedio) > 0).map((r) => [r.fecha, n(r.data?.pesoPromedio)] as [string, number]),
  ];
  const activos = Math.max(0, lot.initialAnimals - muertes - vendidos);
  const [primera, ultima] = [pesadas[0], pesadas[pesadas.length - 1]];
  const diasEntre = primera && ultima ? Math.round((at(ultima[0]) - at(primera[0])) / DAY) : 0;
  const ganancia = primera && ultima ? ultima[1] - primera[1] : 0;
  return {
    activos,
    muertes,
    vendidos,
    pesadas,
    alimentoKg,
    gananciaDiaria: diasEntre > 0 ? Math.round((ganancia / diasEntre) * 100) / 100 : null,
    conversion: ganancia > 0 && activos > 0 && alimentoKg > 0 ? Math.round((alimentoKg / (ganancia * activos)) * 100) / 100 : null,
    mortalidad: lot.initialAnimals > 0 ? r1((muertes / lot.initialAnimals) * 100) : null,
  };
}
