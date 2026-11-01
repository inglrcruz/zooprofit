import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Av, Bar, Btn, Card, Col, Empty, go, Grid, Grow, Loading, Row, Screen, swap, T, TabBar, Tag } from '@/components/ui';
import { can } from '@/constants/config';
import { C, type Tone } from '@/constants/tokens';
import { kpisRepro, pendientes, type Pendientes } from '@/data/repro';
import { useLoad } from '@/hooks/use-load';
import { useRepro } from '@/hooks/use-repro';
import { useAuthStore } from '@/stores/auth.store';
import { useProductStore } from '@/stores/product.store';
import { dayLabel, plural, today, weekBounds } from '@/utilities/miscellaneous';

/** Cada grupo de pendientes, dicho como una tarea. */
const TAREAS: { key: keyof Pendientes; icon: IconName; tone: Tone; uno: string; varios: string; tipo: string }[] = [
  { key: 'partos', icon: 'heart', tone: 'w', uno: '1 parto esperado', varios: 'partos esperados', tipo: 'parto' },
  { key: 'inseminar', icon: 'drop', tone: 'info', uno: '1 cerda por servir', varios: 'cerdas por servir', tipo: 'inseminacion' },
  { key: 'destetes', icon: 'arrowRight', tone: 'info', uno: '1 destete por hacer', varios: 'destetes por hacer', tipo: 'destete' },
  { key: 'diagnostico', icon: 'search', tone: 'info', uno: '1 cerda por revisar', varios: 'cerdas por revisar si quedaron preñadas', tipo: 'diagnostico' },
  { key: 'repeticiones', icon: 'repeat', tone: 'w', uno: '1 posible repetición', varios: 'posibles repeticiones', tipo: 'inseminacion' },
];

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export default function ReproHoy() {
  const { farm, rol, lots, sows, registros, refresh, loading, first, diaInicio, metas, edadDestete } = useRepro();
  const user = useAuthStore((s) => s.user);
  const products = useProductStore((s) => s.list);
  const refreshProducts = useLoad(useProductStore);

  const hoy = today();
  const week = weekBounds(hoy, diaInicio);
  // Lo que toca hasta hoy: lo de esta semana que ya venció y lo atrasado.
  const porHacer = useMemo(() => pendientes(sows, registros, lots, week.start, hoy, hoy, edadDestete), [sows, registros, lots, week.start, hoy, edadDestete]);
  const mes = useMemo(() => kpisRepro(registros, `${hoy.slice(0, 7)}-01`, hoy), [registros, hoy]);
  const tareas = TAREAS.map((t) => ({ ...t, list: porHacer[t.key] })).filter((t) => t.list.length);
  const quedan = tareas.reduce((n, t) => n + t.list.length, 0);
  const hechas = registros.filter((r) => r.fecha === hoy && r.tipo !== 'nota').length;
  const bajos = products.filter((p) => p.minimo > 0 && p.existencia < p.minimo);
  const madres = sows.filter((s) => s.estadoActual !== 'descarte');
  const preñadas = madres.filter((s) => s.estadoActual === 'gestante').length;
  const servidas = madres.filter((s) => s.estadoActual === 'inseminada').length;
  const write = can.write(rol);

  /** Una palabra en vez de una meta: bien si la cumple, casi si le falta poco. */
  const nota = (value: number | null, goal: number, max = false): [string, Tone] | null => {
    if (value === null) return null;
    const ok = max ? value <= goal : value >= goal;
    const cerca = max ? value <= goal * 1.2 : value >= goal * 0.9;
    return ok ? ['Bien', 'k'] : cerca ? ['Casi', 'w'] : ['Atención', 'd'];
  };
  const cifras: { label: string; value: string; chip: [string, Tone] | null; sub?: string }[] = [
    { label: 'Preñez', value: mes.concepcion !== null ? `${Math.round(mes.concepcion)}%` : '—', chip: nota(mes.concepcion, metas.tasaParto) },
    { label: 'Nacidos vivos', value: mes.promNV !== null ? String(mes.promNV) : '—', chip: nota(mes.promNV, metas.promNV) },
    { label: 'Madres', value: String(madres.length), chip: null, sub: `${plural(preñadas, 'preñada')} · ${plural(servidas, 'servida')}` },
  ];

  return (
    <Screen tabs={<TabBar module="repro" active="inicio" />} refreshing={loading} onRefresh={() => (refresh(), refreshProducts())}>
      <Row style={{ marginTop: 16 }}>
        <Grow>
          <T v="sub" size={14}>{saludo()}, {user?.name.split(' ')[0]}</T>
          <Pressable onPress={() => swap('/modulos')} accessibilityRole="button" accessibilityLabel={`${farm?.name}, cambiar de granja`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
            <T v="h1" size={24} numberOfLines={1} style={{ flexShrink: 1 }}>{farm?.name}</T>
            <Icon name="down" />
          </Pressable>
        </Grow>
        <Pressable onPress={() => go('/perfil')} accessibilityRole="button" accessibilityLabel="Mi perfil">
          <Av text={(user?.name ?? 'U').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')} round />
        </Pressable>
      </Row>

      <Card dark gap={10} style={{ borderRadius: 24, padding: 20 }}>
        <T v="sub" size={14} color={C.forestText}>{dayLabel(hoy).replace('Hoy · ', '')}</T>
        <T v="h1" size={28} color="#fff">
          {first ? 'Cargando…' : quedan ? `Te ${quedan === 1 ? 'queda 1 tarea' : `quedan ${quedan} tareas`} hoy` : 'Todo al día'}
        </T>
        {quedan || hechas ? (
          <Row gap={10}>
            <Grow><Bar pct={(hechas / (hechas + quedan)) * 100} track={C.forestLine} fill={C.yolk} /></Grow>
            <T v="b" size={13} color={C.forestText}>{hechas} {hechas === 1 ? 'registro' : 'registros'} hoy</T>
          </Row>
        ) : null}
      </Card>

      {first ? <Loading /> : null}

      {tareas.length || bajos.length ? (
        <>
          <Row>
            <Grow><T v="h2" size={19}>Para hoy</T></Grow>
            <T v="b" size={14} color={C.green} onPress={() => swap('/repro/semana')} accessibilityRole="link" style={{ paddingVertical: 12 }}>Ver la semana</T>
          </Row>
          <Col gap={10}>
            {tareas.map((t) => {
              const aretes = t.list.slice(0, 3).map((p) => p.sow.arete).join(', ');
              const uno = t.list.length === 1 ? t.list[0].sow : null;
              return (
                <Card key={t.key} style={{ padding: 14 }}>
                  <Row>
                    <Av icon={t.icon} tone={t.tone} />
                    <Grow style={{ gap: 2 }}>
                      <T v="b" size={16}>{t.list.length === 1 ? t.uno : `${t.list.length} ${t.varios}`}</T>
                      <T v="sub" numberOfLines={1}>{t.list.length === 1 ? 'ID' : 'IDs'} {aretes}{t.list.length > 3 ? '…' : ''}</T>
                    </Grow>
                    {write ? (
                      <Btn small label="Registrar" a11y={`Registrar: ${t.varios}`} onPress={() => (uno ? go(`/evento?tipo=${t.tipo}&arete=${encodeURIComponent(uno.arete)}`) : swap('/repro/semana'))} />
                    ) : null}
                  </Row>
                </Card>
              );
            })}
            {bajos.length ? (
              <Card style={{ padding: 14 }}>
                <Row>
                  <Av icon="box" tone="d" />
                  <Grow style={{ gap: 2 }}>
                    <T v="b" size={16}>{bajos.length === 1 ? 'Queda poco de 1 producto' : `Queda poco de ${bajos.length} productos`}</T>
                    <T v="sub" numberOfLines={1}>{bajos.slice(0, 2).map((p) => `${p.descripcion}: ${p.existencia} ${p.unidad}`).join(' · ')}</T>
                  </Grow>
                  <Btn small kind="g" label="Ver" a11y="Ver alimento y medicinas" onPress={() => go('/prod/insumos')} />
                </Row>
              </Card>
            ) : null}
          </Col>
        </>
      ) : first ? null : (
        <Empty icon="check" title="No hay nada pendiente" sub={sows.length ? 'Cuando a una cerda le toque servicio, parto o destete, aparecerá aquí.' : 'Empieza registrando tus cerdas con el botón amarillo.'} />
      )}

      <Row>
        <Grow><T v="h2" size={19}>Cómo va la granja</T></Grow>
        <T v="b" size={14} color={C.green} onPress={() => go('/repro/resumen')} accessibilityRole="link" style={{ paddingVertical: 12 }}>Ver más</T>
      </Row>
      <Grid cols={3}>
        {cifras.map((c) => (
          <Card key={c.label} gap={4} style={{ padding: 12, borderRadius: 18, flex: 1 }}>
            <T v="sub" size={12}>{c.label}</T>
            <T v="h1" size={24}>{c.value}</T>
            {c.chip ? <View style={{ alignSelf: 'flex-start' }}><Tag tone={c.chip[1]}>{c.chip[0]}</Tag></View> : <T v="sub" size={12}>{c.sub ?? 'este mes'}</T>}
          </Card>
        ))}
      </Grid>
    </Screen>
  );
}
