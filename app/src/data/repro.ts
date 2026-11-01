// Indicadores de cerdos · reproducción, calculados sobre los registros ya
// cargados. Solo importa tipos: se verifica con `node scripts/check-calc.mjs`.
import type { Lot, Registro, Sow } from '../types/data';

const DAY = 86400000;
const GESTACION = 114;
const DIAS_DIAGNOSTICO = 21;

const at = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime();
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const diff = (a: string, b: string) => Math.round((at(b) - at(a)) / DAY);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const inRange = (r: Registro, start: string, end: string) => r.fecha >= start && r.fecha <= end;
/** Quién es la cerda de un registro: su id; en los importados, solo su ID de oreja. Un ID se reutiliza cuando una cerda sale. */
const cerdaDe = (r: Registro) => r.sowId || r.cerdaCodigo;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Eventos que anulan una inseminación anterior. */
const FALLAS = new Set(['celo', 'aborto', 'aborto_salida', 'reinseminacion_salida']);
const DIAG_NEGATIVO = new Set(['negativo', 'descarga']);
const esFalla = (r: Registro) =>
  FALLAS.has(r.tipo) || (r.tipo === 'diagnostico' && DIAG_NEGATIVO.has(r.data?.resultado)) || (r.tipo === 'inseminacion' && !!r.data?.esReinseminacion);

/** Los lotes del sistema; "Atrasadas" se llamaba "Abiertas" en los datos importados. */
export const FIJO = {
  entradas: ['__entradas__'],
  destetadas: ['__destetadas__'],
  atrasadas: ['__atrasadas__', '__abiertas__'],
  descarte: ['__descarte__'],
} as const;
export const loteFijo = (lots: Lot[], cual: keyof typeof FIJO) => lots.find((l) => (FIJO[cual] as readonly string[]).includes(l.codeInterno));

/** Estados de una cerda que espera servicio. */
export const POR_SERVIR = ['vacia', 'destetada', 'celo', 'abortada'];

export type KpisRepro = {
  inseminadas: number;
  partos: number;
  destetes: number;
  nacidosVivos: number;
  destetados: number;
  muertesLactantes: number;
  /** % de las inseminadas 114 días antes del período que no tuvieron una falla después. */
  concepcion: number | null;
  promNV: number | null;
  promDestetados: number | null;
  mortLactantes: number | null;
};

export function kpisRepro(regs: Registro[], start: string, end: string): KpisRepro {
  const per = (tipo: string) => regs.filter((r) => r.tipo === tipo && inRange(r, start, end));
  const cerdas = (rs: Registro[]) => new Set(rs.map(cerdaDe).filter(Boolean)).size;
  const partos = per('parto');
  const destetes = per('destete');

  // La banda que pare en este período se inseminó 114 días antes.
  const [bStart, bEnd] = [addDays(start, -GESTACION), addDays(end, -GESTACION)];
  const ultimaIns = new Map<string, string>();
  for (const r of regs) {
    if (r.tipo !== 'inseminacion' || !cerdaDe(r) || !inRange(r, bStart, bEnd)) continue;
    if (r.fecha > (ultimaIns.get(cerdaDe(r)) ?? '')) ultimaIns.set(cerdaDe(r), r.fecha);
  }
  const conFalla = new Set(regs.filter((r) => esFalla(r) && r.fecha > (ultimaIns.get(cerdaDe(r)) ?? '9')).map(cerdaDe));

  const nacidosVivos = partos.reduce((a, r) => a + n(r.data?.lechonesVivos), 0);
  const destetados = destetes.reduce((a, r) => a + n(r.data?.lechonesDestetados), 0);
  const muertesLactantes = per('muerte_lactante').reduce((a, r) => a + (n(r.data?.cantidad) || 1), 0);
  const [nPartos, nDestetes] = [cerdas(partos), cerdas(destetes)];
  return {
    inseminadas: cerdas(per('inseminacion')),
    partos: nPartos,
    destetes: nDestetes,
    nacidosVivos,
    destetados,
    muertesLactantes,
    concepcion: pct(ultimaIns.size - conFalla.size, ultimaIns.size),
    promNV: nPartos ? Math.round((nacidosVivos / nPartos) * 10) / 10 : null,
    promDestetados: nDestetes ? Math.round((destetados / nDestetes) * 10) / 10 : null,
    mortLactantes: pct(muertesLactantes, nacidosVivos),
  };
}

/**
 * Registros de una cerda, del más antiguo al más reciente. Los nuevos llevan
 * su id; los importados solo el arete (el actual o uno anterior).
 */
export const deCerda = (regs: Registro[], sow: Sow) => {
  const aretes = new Set([sow.arete, ...(sow.codigosAnteriores ?? [])]);
  return regs
    .filter((r) => (r.sowId ? r.sowId === sow.id : aretes.has(r.cerdaCodigo)))
    .sort(enOrden);
};

/** Por fecha; en el mismo día, en el orden en que se registraron. */
const enOrden = (a: Registro, b: Registro) => a.fecha.localeCompare(b.fecha) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');

const porCerda = (regs: Registro[]) => {
  const map = new Map<string, Registro[]>();
  for (const r of regs) {
    const key = cerdaDe(r);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  for (const list of map.values()) list.sort(enOrden);
  return map;
};

/** Inseminación a la que se atribuye un parto: la última entre 100 y 130 días antes. */
const servicioDe = (historia: Registro[], parto: Registro) =>
  historia.filter((r) => r.tipo === 'inseminacion' && diff(r.fecha, parto.fecha) >= 100 && diff(r.fecha, parto.fecha) <= 130).pop();

export type Banda = { start: string; inseminadas: number; partos: number; destetados: number };

/**
 * Bandas: cada una es la semana en que se inseminó un grupo de cerdas. Los
 * partos y destetes cuentan en la banda de la inseminación que los originó.
 */
export function bandas(regs: Registro[], inicioSemana: (ymd: string) => string): Banda[] {
  const map = new Map<string, { ins: Set<string>; partos: number; destetados: number }>();
  const banda = (ymd: string) => {
    const start = inicioSemana(ymd);
    if (!map.has(start)) map.set(start, { ins: new Set(), partos: 0, destetados: 0 });
    return map.get(start)!;
  };
  for (const historia of porCerda(regs).values()) {
    let actual: ReturnType<typeof banda> | null = null;
    for (const r of historia) {
      if (r.tipo === 'inseminacion') banda(r.fecha).ins.add(cerdaDe(r));
      else if (r.tipo === 'parto') {
        const servicio = servicioDe(historia, r);
        actual = servicio ? banda(servicio.fecha) : null;
        if (actual) actual.partos++;
      } else if (r.tipo === 'destete' && actual) {
        actual.destetados += n(r.data?.lechonesDestetados);
        actual = null;
      }
    }
  }
  return [...map.entries()]
    .map(([start, b]) => ({ start, inseminadas: b.ins.size, partos: b.partos, destetados: b.destetados }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

export type Pendiente = { sow: Sow; fecha: string };
export type Pendientes = Record<'inseminar' | 'partos' | 'diagnostico' | 'destetes' | 'repeticiones', Pendiente[]>;

/**
 * Lo que toca registrar en la semana [start, end], y lo que quedó atrasado
 * de semanas anteriores.
 */
export function pendientes(sows: Sow[], regs: Registro[], lots: Lot[], start: string, end: string, hoy: string, edadDestete = 21): Pendientes {
  const out: Pendientes = { inseminar: [], partos: [], diagnostico: [], destetes: [], repeticiones: [] };
  const historia = porCerda(regs);
  const porServir = new Set<string>([...FIJO.destetadas, ...FIJO.atrasadas]);
  const interno = new Map(lots.map((l) => [l.id, l.codeInterno]));
  const enSemana = (f: string) => f >= start && f <= end;

  for (const sow of sows) {
    const h = [...(historia.get(sow.id) ?? []), ...(historia.get(sow.arete) ?? [])].sort(enOrden);
    const ultimo = (tipo: string) => h.filter((r) => r.tipo === tipo).pop();
    const estado = sow.estadoActual;
    if (estado === 'descarte') continue;
    if (POR_SERVIR.includes(estado) || porServir.has(interno.get(sow.lotIdActual) ?? '')) {
      out.inseminar.push({ sow, fecha: ultimo('destete')?.fecha ?? sow.fechaEntrada ?? '' });
    } else if (estado === 'inseminada' || estado === 'gestante') {
      const ins = ultimo('inseminacion');
      if (!ins) continue;
      const parto = addDays(ins.fecha, GESTACION);
      const diagnostico = addDays(ins.fecha, DIAS_DIAGNOSTICO);
      const dias = diff(ins.fecha, hoy);
      const tieneDiag = h.some((r) => r.tipo === 'diagnostico' && r.fecha >= ins.fecha);
      if (parto <= end) out.partos.push({ sow, fecha: parto });
      else if (!tieneDiag && dias >= 18 && dias <= 24) out.repeticiones.push({ sow, fecha: ins.fecha });
      else if (!tieneDiag && (enSemana(diagnostico) || (diagnostico < start && dias <= 60))) out.diagnostico.push({ sow, fecha: diagnostico });
    } else if (estado === 'lactando') {
      const parto = ultimo('parto')?.fecha ?? sow.fechaUltimoParto;
      if (parto && addDays(parto, edadDestete) <= end) out.destetes.push({ sow, fecha: addDays(parto, edadDestete) });
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return out;
}

export type Ciclo = { n: number; inseminacion?: Registro; diagnostico?: Registro; parto?: Registro; destete?: Registro; repeticiones: number; falla?: Registro };

/**
 * Ciclos reproductivos de una cerda, del más reciente al más antiguo.
 * `partosTotales` es su número de partos hoy, incluidos los anteriores a la granja.
 */
export function ciclos(historia: Registro[], partosTotales = 0): Ciclo[] {
  const out: Ciclo[] = [];
  const s: { c: Ciclo | null } = { c: null };
  const abrir = () => (s.c ??= { n: 0, repeticiones: 0 });
  const cerrar = () => {
    if (s.c) out.push(s.c);
    s.c = null;
  };
  for (const r of historia) {
    if (r.tipo === 'inseminacion') {
      // Un servicio después de un parto abre un ciclo nuevo; antes, es una repetición.
      if (s.c?.parto) cerrar();
      const ciclo = abrir();
      if (ciclo.inseminacion) ciclo.repeticiones++;
      ciclo.inseminacion = r;
      ciclo.diagnostico = ciclo.falla = undefined;
    } else if (r.tipo === 'diagnostico') abrir().diagnostico = r;
    else if (r.tipo === 'parto') abrir().parto = r;
    else if (r.tipo === 'destete') {
      abrir().destete = r;
      cerrar();
    } else if (r.tipo === 'celo' || r.tipo === 'aborto') abrir().falla = r;
  }
  cerrar();
  // Se numeran por parto: los previos a entrar a la granja cuentan.
  let partos = Math.max(0, partosTotales - out.filter((x) => x.parto).length);
  for (const x of out) x.n = x.parto ? ++partos : partos + 1;
  return out.reverse();
}

/** Inseminaciones y partos atribuidos a cada verraco (por su código). */
export function verracos(regs: Registro[]): Map<string, { ins: number; partos: number }> {
  const out = new Map<string, { ins: number; partos: number }>();
  const de = (codigo: string) => {
    const key = String(codigo ?? '').split('·')[0].trim();
    if (!out.has(key)) out.set(key, { ins: 0, partos: 0 });
    return out.get(key)!;
  };
  for (const historia of porCerda(regs).values()) {
    for (const r of historia) {
      if (r.tipo === 'inseminacion' && r.data?.verraco) de(r.data.verraco).ins++;
      else if (r.tipo === 'parto') {
        const servicio = servicioDe(historia, r);
        if (servicio?.data?.verraco) de(servicio.data.verraco).partos++;
      }
    }
  }
  return out;
}

/** Destetes de un lote agrupados por fecha: lo que producción recibe como lote nuevo. */
export type Camada = { key: string; lotId: string; fecha: string; lechones: number; pesoTotal: number; cerdas: string[]; edad: number };

export function camadas(regs: Registro[]): Camada[] {
  const map = new Map<string, Camada>();
  for (const r of regs) {
    if (r.tipo !== 'destete') continue;
    const key = `${r.lotId}_${r.fecha}`;
    const c = map.get(key) ?? { key, lotId: r.lotId, fecha: r.fecha, lechones: 0, pesoTotal: 0, cerdas: [], edad: 0 };
    c.lechones += n(r.data?.lechonesDestetados);
    c.pesoTotal += n(r.data?.pesoCamadaDestete);
    c.edad = Math.max(c.edad, n(r.data?.edadDestete));
    if (r.cerdaCodigo) c.cerdas.push(r.cerdaCodigo);
    map.set(key, c);
  }
  return [...map.values()].filter((c) => c.lechones > 0).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
