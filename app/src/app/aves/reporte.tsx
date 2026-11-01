import { useMemo, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { LotChips } from '@/components/aves/lot-chips';
import { Card, Chips, Empty, Grow, IconBtn, Loading, Row, Screen, T, TabBar, Table, Top } from '@/components/ui';
import { C, F } from '@/constants/tokens';
import { semanas, type Semana } from '@/data/aves';
import { signed } from '@/data/calc';
import { getDekalbStandard, type DekalbStandard } from '@/data/dekalb';
import { useAves } from '@/hooks/use-aves';

/** Métrica: columna propia, columna del estándar, unidad y si más alto es mejor. */
const METRICS: { label: string; title: string; key: keyof Semana; std: keyof DekalbStandard; unit: string; up: boolean }[] = [
  { label: 'Postura', title: 'Tasa de postura', key: 'postura', std: 'posturaHenDay', unit: '%', up: true },
  { label: 'Mortalidad', title: 'Mortalidad acumulada', key: 'mortAcum', std: 'mortAcum', unit: '%', up: false },
  { label: 'Consumo', title: 'Consumo por ave al día', key: 'consumo', std: 'consumo', unit: ' g', up: false },
  { label: 'Peso ave', title: 'Peso del ave', key: 'pesoAve', std: 'pesoAve', unit: ' g', up: true },
];
const W = 318;
const H = 160;
const TOP = 10;
const BOTTOM = 136;
const WEEKS = 8;

/** Descarga el CSV en web; en el teléfono lo pasa a la hoja de compartir. */
const exportCsv = (name: string, csv: string) => {
  if (Platform.OS !== 'web') return void Share.share({ title: name, message: csv });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export default function Reporte() {
  const { lots, lot, setLot, registros, refresh, loading, first } = useAves();
  const [metric, setMetric] = useState(0);
  const m = METRICS[metric];
  const todas = useMemo(() => (lot ? semanas(lot, registros) : []), [lot, registros]);
  const filas = todas.filter((s) => s[m.key] !== null).slice(-WEEKS).map((s) => ({ semana: s.semana, real: s[m.key] as number, std: getDekalbStandard(s.semana)[m.std] as number | null }));

  const valores = filas.flatMap((f) => (f.std === null ? [f.real] : [f.real, f.std]));
  const [lo, hi] = valores.length ? [Math.min(...valores), Math.max(...valores)] : [0, 1];
  const pad = (hi - lo || 1) * 0.15;
  const x = (i: number) => 26 + (filas.length > 1 ? i / (filas.length - 1) : 0.5) * (W - 36);
  const y = (v: number) => BOTTOM - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (BOTTOM - TOP);
  const path = (get: (f: (typeof filas)[number]) => number | null) => {
    const pts = filas.map((f, i) => [i, get(f)] as const).filter((p): p is readonly [number, number] => p[1] !== null);
    return pts.length > 1 ? `M${pts.map(([i, v]) => `${x(i)} ${y(v)}`).join('L')}` : '';
  };
  const ultima = filas[filas.length - 1];
  const fmtV = (v: number) => `${v.toFixed(m.unit === '%' ? 1 : 0)}${m.unit}`;
  const color = (d: number) => ((m.up ? d >= 0 : d <= 0) ? C.ok : Math.abs(d) > (hi - lo) * 0.3 ? C.bad : C.warn);

  const download = () =>
    lot &&
    exportCsv(
      `reporte-${lot.code}.csv`,
      ['Semana,Postura %,Dekalb %,Mortalidad acum. %,Consumo g/ave,Peso ave g', ...todas.map((s) => [s.semana, s.postura ?? '', getDekalbStandard(s.semana).posturaHenDay?.toFixed(1) ?? '', s.mortAcum ?? '', s.consumo ?? '', s.pesoAve ?? ''].join(','))].join('\n'),
    );

  return (
    <Screen
      tabs={<TabBar module="aves" active="reporte" />}
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title="Reporte" sub={lot ? `${lot.code} · vs. Dekalb White` : undefined} subAbove right={todas.length ? <IconBtn icon="download" label="Exportar el reporte en CSV" onPress={download} /> : null} />}>
      <LotChips lots={lots} lot={lot} onChange={setLot} />
      <Chips options={METRICS.map((x) => x.label)} value={metric} onChange={setMetric} />
      {first ? <Loading /> : null}

      {ultima ? (
        <>
          <Card>
            <T v="sub">{m.title} · semana {ultima.semana}</T>
            <Row align="flex-end" gap={8}>
              <T v="big">{fmtV(ultima.real)}</T>
              {ultima.std !== null ? <T v="b" color={color(ultima.real - ultima.std)} style={{ paddingBottom: 4 }}>{signed(ultima.real - ultima.std)} vs. estándar</T> : null}
            </Row>
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`${m.title} real contra el estándar Dekalb, semanas ${filas[0].semana} a ${ultima.semana}. Última: ${fmtV(ultima.real)}.`}>
              {[lo, (lo + hi) / 2, hi].map((v, i) => (
                <Path key={i} d={`M0 ${y(v)}H${W}`} stroke={C.line} strokeWidth={1} />
              ))}
              {[lo, hi].map((v, i) => (
                <SvgText key={i} x={0} y={y(v) - 4} fontSize={10} fontFamily={F.b} fill={C.mute}>{fmtV(v)}</SvgText>
              ))}
              {filas.map((f, i) =>
                filas.length <= 5 || i % 2 === 0 ? (
                  <SvgText key={f.semana} x={x(i)} y={H - 4} fontSize={10} fontFamily={F.b} fill={C.mute} textAnchor="middle">{String(f.semana)}</SvgText>
                ) : null,
              )}
              <Path d={path((f) => f.std)} fill="none" stroke={C.warn} strokeWidth={2.5} strokeDasharray="2 7" strokeLinecap="round" />
              <Path d={path((f) => f.real)} fill="none" stroke={C.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={x(filas.length - 1)} cy={y(ultima.real)} r={5} fill={C.green} stroke="#fff" strokeWidth={2} />
            </Svg>
            <Row gap={16}>
              <Row gap={6}>
                <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: C.green }} />
                <T v="sub">Real</T>
              </Row>
              <Row gap={6}>
                <View style={{ width: 18, borderTopWidth: 3, borderStyle: 'dotted', borderColor: C.warn }} />
                <T v="sub">Estándar Dekalb</T>
              </Row>
              <Grow />
            </Row>
          </Card>

          <Card style={{ padding: 14, paddingHorizontal: 16 }}>
            <Table
              head={['Semana', 'Real', 'Estándar', 'Dif.']}
              flex={[1.3, 1, 1, 0.8]}
              rows={[...filas].reverse().slice(0, 6).map((f, i) => [i ? String(f.semana) : `${f.semana} · actual`, fmtV(f.real), f.std !== null ? fmtV(f.std) : '—', f.std !== null ? <T key="d" v="b" color={color(f.real - f.std)}>{signed(f.real - f.std)}</T> : '—'])}
            />
          </Card>
        </>
      ) : first ? null : (
        <Empty icon="chart" title={`Sin datos de ${m.label.toLowerCase()}`} sub={lot ? (m.key === 'pesoAve' ? 'Registra pesadas del lote para ver esta curva.' : 'Aparecen al guardar el registro del día.') : 'Crea primero un lote de aves.'} />
      )}
    </Screen>
  );
}
