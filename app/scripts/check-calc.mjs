// node scripts/check-calc.mjs
import assert from 'node:assert/strict';

import { pesoPromedioKg, postura, signed, totalHuevos } from '../src/data/calc.ts';

assert.equal(totalHuevos({ pilas: 12, cartones: 1, unidades: 17, sucios: 38 }), 4405);
assert.equal(postura(4405, 4820), 91.4);
assert.equal(postura(10, 0), 0);
assert.equal(pesoPromedioKg(972, 20, 'total', 'kg'), 48.6);
assert.equal(pesoPromedioKg(48.6, 20, 'promedio', 'kg'), 48.6);
assert.equal(pesoPromedioKg(2142.9, 20, 'total', 'lb'), 48.6);
assert.equal(pesoPromedioKg(100, 0, 'total', 'kg'), 0);
assert.equal(signed(-0.7), '−0.7');
assert.equal(signed(42.2), '+42.2');
console.log('calc ok');

// ── fechas ──
const m = await import('../src/utilities/miscellaneous.ts');
assert.equal(m.addDays('2026-10-08', 114), '2027-01-30');
assert.equal(m.diffDays('2026-10-01', '2026-10-08'), 7);
assert.deepEqual(m.weekBounds('2026-10-08', 1), { start: '2026-10-05', end: '2026-10-11' });
assert.deepEqual(m.weekBounds('2026-10-11', 0), { start: '2026-10-11', end: '2026-10-17' });
assert.equal(m.weekNumber('2026-10-08'), 41);
assert.equal(m.weekNumber('2027-01-01'), 53);
assert.equal(m.isYMD('2026-02-30'), false);
assert.equal(m.num('1,5'), 1.5);

// ── reproducción ──
const R = await import('../src/data/repro.ts');
let id = 0;
const reg = (tipo, fecha, cerdaCodigo, data = {}, lotId = 'L1') => ({ id: String(++id), tipo, fecha, cerdaCodigo, data, lotId, sowId: '', status: 'pending', nota: '' });
const regs = [
  // banda del 2026-06-15: A pare, B repite (falla), C aborta
  reg('inseminacion', '2026-06-15', 'A', { verraco: 'VR-01 · Titan' }),
  reg('inseminacion', '2026-06-16', 'B', { verraco: 'VR-02' }),
  reg('inseminacion', '2026-06-17', 'C', { verraco: 'VR-01' }),
  reg('inseminacion', '2026-07-07', 'B', { verraco: 'VR-02', esReinseminacion: true }),
  reg('aborto', '2026-08-01', 'C'),
  reg('parto', '2026-10-07', 'A', { lechonesVivos: 12, lechonesMuertos: 1, momias: 1 }),
  reg('muerte_lactante', '2026-10-08', 'A', { cantidad: 3 }),
  reg('destete', '2026-10-28', 'A', { lechonesDestetados: 9, pesoCamadaDestete: 54, edadDestete: 21 }),
];
const k = R.kpisRepro(regs, '2026-10-05', '2026-10-11');
assert.equal(k.partos, 1);
assert.equal(k.promNV, 12);
assert.equal(k.mortLactantes, 25);
assert.equal(k.concepcion, 33.3); // de A, B y C solo A sigue sin falla
assert.equal(R.kpisRepro([], '2026-10-05', '2026-10-11').concepcion, null);

const lunes = (ymd) => m.weekBounds(ymd, 1).start;
const banda = R.bandas(regs, lunes).find((b) => b.start === '2026-06-15');
assert.deepEqual(banda, { start: '2026-06-15', inseminadas: 3, partos: 1, destetados: 9 });

const v = R.verracos(regs);
assert.deepEqual(v.get('VR-01'), { ins: 2, partos: 1 });
assert.deepEqual(v.get('VR-02'), { ins: 2, partos: 0 });

const sow = (arete, estadoActual, extra = {}) => ({ id: arete, arete, estadoActual, lotIdActual: 'L1', partosHistoricos: 0, fechaEntrada: '2026-01-01', codigosAnteriores: [], ...extra });
const lots = [{ id: 'L1', codeInterno: '' }, { id: 'D', codeInterno: '__destetadas__' }];
const p = R.pendientes(
  [sow('V', 'vacia'), sow('G', 'gestante'), sow('S', 'inseminada'), sow('L', 'lactando'), sow('X', 'descarte'), sow('N', 'gestante')],
  [reg('inseminacion', '2026-06-16', 'G'), reg('inseminacion', '2026-09-17', 'S'), reg('parto', '2026-09-18', 'L'), reg('inseminacion', '2026-08-01', 'N'), reg('diagnostico', '2026-08-22', 'N', { resultado: 'positivo' })],
  lots, '2026-10-05', '2026-10-11', '2026-10-08',
);
assert.deepEqual(p.inseminar.map((x) => x.sow.arete), ['V']);
assert.deepEqual(p.partos.map((x) => [x.sow.arete, x.fecha]), [['G', '2026-10-08']]);
assert.deepEqual(p.repeticiones.map((x) => x.sow.arete), ['S']); // día 21 sin diagnóstico
assert.deepEqual(p.destetes.map((x) => [x.sow.arete, x.fecha]), [['L', '2026-10-09']]);
assert.equal(p.diagnostico.length, 0); // N ya tiene diagnóstico y pare en noviembre

const cs = R.ciclos(regs.filter((r) => r.cerdaCodigo === 'A'), 3);
assert.equal(cs.length, 1);
assert.equal(cs[0].n, 3); // tenía 2 partos antes de entrar
assert.ok(cs[0].destete);
const cb = R.ciclos(regs.filter((r) => r.cerdaCodigo === 'B'), 0);
assert.equal(cb[0].repeticiones, 1);

assert.deepEqual(R.camadas(regs)[0], { key: 'L1_2026-10-28', lotId: 'L1', fecha: '2026-10-28', lechones: 9, pesoTotal: 54, cerdas: ['A'], edad: 21 });
assert.equal(R.deCerda([{ ...regs[0], sowId: 'otra' }, regs[5]], sow('A', 'lactando')).length, 1);

// ── reglas ──
const G = await import('../src/data/reglas.ts');
const reglas = G.mergeReglas({ maxNacidosPorParto: 20 });
assert.equal(G.validarPuedeInseminar([{ tipo: 'parto', fecha: '2026-10-07' }], reglas).ok, false);
assert.equal(G.validarPuedeInseminar([{ tipo: 'parto', fecha: '2026-10-07' }, { tipo: 'destete', fecha: '2026-10-28' }], reglas).ok, true);
assert.equal(G.validarIntervaloServicioParto('2026-06-15', '2026-10-07', reglas).ok, true);
assert.equal(G.validarIntervaloServicioParto('2026-08-15', '2026-10-07', reglas).ok, false);
assert.equal(G.validarCantidadesEvento('parto', 21, reglas).ok, false);
assert.equal(G.validarFechaPosteriorAEntrada('2025-12-31', '2026-01-01', reglas).ok, false);
assert.equal(G.validarSecuencia('parto', 'vacia', true).ok, false);
assert.equal(G.validarSecuencia('parto', 'vacia', false).ok, true); // importada sin historia
assert.equal(G.validarSecuencia('parto', 'gestante', true).ok, true);
assert.equal(G.validarSecuencia('destete', 'abortada', true).ok, false);
assert.equal(G.validarSecuencia('medicacion', 'descarte', false).ok, false);
assert.equal(G.validarServicioRepetido('inseminada', '2026-10-01', '2026-10-03', reglas).ok, true); // misma monta
assert.equal(G.validarServicioRepetido('inseminada', '2026-10-01', '2026-10-20', reglas).ok, false);
assert.equal(G.validarServicioRepetido('inseminada', '2026-10-01', '2026-10-20', G.mergeReglas({ permitirServirHembraYaServida: true })).ok, true);
assert.equal(G.validarIntervaloPartos('2026-06-01', '2026-07-01', reglas).ok, false);
assert.equal(G.validarIntervaloServicioAborto('2026-01-01', '2026-10-01', reglas).ok, false);
const hist = [{ tipo: 'parto', data: { lechonesVivos: 10 } }, { tipo: 'adopcion', data: { direccion: 'salida', cantidadLechones: 2 } }, { tipo: 'adopcion', data: { direccion: 'entrada', cantidadLechones: 1 } }, { tipo: 'muerte_lactante', data: { cantidad: 3 } }];
assert.equal(G.lechonesActuales(hist), 6);
assert.equal(G.lechonesActuales([{ tipo: 'entrada' }]), null);
assert.equal(G.validarInventarioLactantes(6, 7, G.mergeReglas({ verificarInventarioLactantesEnMuerte: true })).ok, false);
assert.ok(G.avisoDestetados(6, 5, reglas));
assert.equal(G.avisoDestetados(6, 6, reglas), null);
assert.ok(G.avisoCeloCercano('2026-10-01', '2026-10-05', reglas));
assert.match(G.validarFechaPosteriorAEntrada('2025-12-31', '2026-01-01', reglas).motivo, /31-12-2025.*01-01-2026/);

// ── aves y engorde ──
const A = await import('../src/data/aves.ts');
const lot = { id: 'L1', initialAnimals: 1000, birthDate: '2026-01-01', entryDate: '2026-01-01', entryWeight: 6, fechaInicio: '' };
const aves = [
  reg('postura', '2026-10-05', '', { pilas: 2, cartones: 3, unidades: 0, sucios: 10 }), // 820
  reg('muerte', '2026-10-05', '', { cantidad: 10 }),
  reg('alimento', '2026-10-05', '', { sacos: 2 }),
  reg('postura', '2026-10-06', '', { totalHuevos: 891 }),
  reg('postura', '2026-10-06', '', {}, 'OTRO'),
];
const d = A.dias(lot, aves);
assert.deepEqual(d.map((x) => [x.fecha, x.huevos, x.aves, x.postura]), [['2026-10-05', 820, 1000, 82], ['2026-10-06', 891, 990, 90]]);
assert.equal(A.avesVivas(lot, aves), 990);
assert.equal(A.semanaDeEdad(lot, '2026-10-05'), 40);
const s = A.semanas(lot, aves)[0];
assert.deepEqual(s, { semana: 40, postura: 86, mortAcum: 1, consumo: 91, pesoAve: null });

const e = A.engorde(lot, [reg('pesada', '2026-01-31', '', { pesoPromedio: 21 }), reg('muerte', '2026-01-10', '', {}), reg('venta', '2026-02-01', '', { cantidad: 99 }), reg('alimento', '2026-01-15', '', { sacos: 100 })]);
assert.equal(e.activos, 900);
assert.equal(e.gananciaDiaria, 0.5);
assert.equal(e.mortalidad, 0.1);
assert.equal(e.conversion, 0.34);

const K = await import('../src/data/dekalb.ts');
assert.equal(K.getDekalbStandard(40).posturaHenDay, 91.5);
assert.equal(K.getDekalbStandard(100).posturaHenDay, null);

console.log('datos ok');
