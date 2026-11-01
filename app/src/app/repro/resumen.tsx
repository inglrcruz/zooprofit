import { useMemo, useState } from 'react';

import { Bar, Btn, Card, Empty, go, Grid, Grow, Loading, MenuBtn, Row, Screen, Seg, T, TabBar, Table } from '@/components/ui';
import { C, TONE, type Tone } from '@/constants/tokens';
import { bandas, kpisRepro } from '@/data/repro';
import { useRepro } from '@/hooks/use-repro';
import { addDays, plural, today, weekBounds, weekNumber } from '@/utilities/miscellaneous';

const PERIODS = ['Semana', 'Mes', 'Año'];

export default function Resumen() {
  const { farm, sows, registros, refresh, loading, first, diaInicio, inicioSemana, metas } = useRepro();
  const [period, setPeriod] = useState(0);
  const [allBandas, setAllBandas] = useState(false);

  const hoy = today();
  const week = weekBounds(hoy, diaInicio);
  const [start, end] = period === 0 ? [week.start, week.end] : period === 1 ? [`${hoy.slice(0, 7)}-01`, hoy] : [`${hoy.slice(0, 4)}-01-01`, hoy];
  const k = useMemo(() => kpisRepro(registros, start, end), [registros, start, end]);
  const filas = useMemo(() => bandas(registros, inicioSemana), [registros, inicioSemana]);
  const madres = sows.filter((s) => s.estadoActual !== 'descarte');
  const cuenta = (estado: string) => madres.filter((s) => s.estadoActual === estado).length;
  /** Una meta "mayor es mejor" (o "menor es mejor" si `max`): barra, tono y pie. */
  const meta = (value: number | null, goal: number, unit: string, max = false) => {
    if (value === null) return { value: '—', tone: 'n' as Tone, foot: `Meta ${max ? '≤ ' : ''}${goal}${unit} · sin datos` };
    const ok = max ? value <= goal : value >= goal;
    const gap = Math.abs(Math.round((goal - value) * 10) / 10);
    return { value: String(value), pct: max ? (goal ? (value / goal) * 100 : 0) : (value / goal) * 100, tone: (ok ? 'k' : 'w') as Tone, foot: `Meta ${max ? '≤ ' : ''}${goal}${unit} · ${ok ? 'cumplida' : `${max ? 'sobran' : 'faltan'} ${gap}${unit ? ' pts' : ''}`}` };
  };
  const kpis: { label: string; unit?: string; value: string; pct?: number; tone: Tone; foot: string }[] = [
    { label: 'Concepción efectiva', unit: '%', ...meta(k.concepcion, metas.tasaParto, '%') },
    { label: 'Prom. NV / parto', ...meta(k.promNV, metas.promNV, '') },
    { label: 'Mort. lactantes', unit: '%', ...meta(k.mortLactantes, metas.mortLact, '%', true) },
    { label: 'Madres en inventario', value: String(madres.length), tone: 'n', foot: `${plural(cuenta('gestante'), 'preñada')} · ${plural(cuenta('inseminada'), 'servida')} · ${cuenta('lactando')} lactando` },
  ];

  return (
    <Screen
      tabs={<TabBar module="repro" active="" />}
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Row style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <MenuBtn />
          <Grow>
            <T v="h2" size={22} accessibilityRole="header">Resumen y metas</T>
            <T v="sub">{farm?.name}</T>
          </Grow>
        </Row>
      }>
      <Seg options={PERIODS} value={period} onChange={setPeriod} />

      {first ? <Loading /> : null}

      <Grid cols={2}>
        {kpis.map((kpi) => (
          <Card key={kpi.label} gap={6} style={{ padding: 14, flex: 1 }}>
            <T v="sub">{kpi.label}</T>
            <T v="big">
              {kpi.value}
              {kpi.unit && kpi.value !== '—' ? <T v="big" size={16}>{kpi.unit}</T> : null}
            </T>
            {kpi.pct !== undefined ? <Bar pct={kpi.pct} tone={kpi.tone} /> : null}
            <T v="sub" color={kpi.tone === 'n' ? C.mute : TONE[kpi.tone][1]}>{kpi.foot}</T>
          </Card>
        ))}
      </Grid>

      <Card style={{ padding: 14, paddingHorizontal: 16 }}>
        <Row>
          <Grow><T v="h2">Bandas</T></Grow>
          {filas.length > 4 ? <T v="sub" color={C.green} onPress={() => setAllBandas(!allBandas)} accessibilityRole="button">{allBandas ? 'Ver menos' : 'Ver todas'}</T> : null}
        </Row>
        {filas.length ? (
          <Table
            head={['Banda', 'Ins.', 'Partos', 'Dest.']}
            flex={[1.3, 1, 1, 1]}
            rows={(allBandas ? filas : filas.slice(0, 4)).map((b) => [`Sem ${weekNumber(addDays(b.start, 3))}`, String(b.inseminadas), b.partos ? String(b.partos) : '—', b.destetados ? String(b.destetados) : '—'])}
          />
        ) : (
          <Empty icon="calendar" title="Sin bandas todavía" sub="Cada semana con inseminaciones forma una banda." />
        )}
      </Card>
      <Btn kind="g" icon="sliders" label="Cambiar las metas" onPress={() => go('/repro/reglas')} />
    </Screen>
  );
}
