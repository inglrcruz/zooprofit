import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Av, Btn, Card, Col, Empty, go, Grid, Grow, IconBtn, Loading, Row, Screen, T, TabBar, Tag } from '@/components/ui';
import { can } from '@/constants/config';
import { C, type Tone } from '@/constants/tokens';
import { kpisRepro, pendientes, type Pendiente, type Pendientes } from '@/data/repro';
import { useRepro } from '@/hooks/use-repro';
import { addDays, diffDays, relDays, today, viewDate, weekBounds, weekNumber } from '@/utilities/miscellaneous';

const GROUPS: { key: keyof Pendientes; title: string; accion: string; icon: IconName; tone?: Tone; tipo: string; sub: (p: Pendiente) => string }[] = [
  { key: 'inseminar', title: 'Cerdas por servir', accion: 'Servir', icon: 'drop', tipo: 'inseminacion', sub: (p) => (p.fecha ? `Esperando desde ${relDays(p.fecha)}` : 'Lista para servir') },
  { key: 'partos', title: 'Partos esperados', accion: 'Parto', icon: 'heart', tone: 'w', tipo: 'parto', sub: (p) => `Le toca ${relDays(p.fecha)} · ${viewDate(p.fecha)}` },
  { key: 'diagnostico', title: 'Revisar si quedaron preñadas', accion: 'Revisar', icon: 'search', tipo: 'diagnostico', sub: (p) => `Tocaba ${relDays(p.fecha)}` },
  { key: 'destetes', title: 'Destetes por hacer', accion: 'Destetar', icon: 'arrowRight', tipo: 'destete', sub: (p) => `Le toca ${relDays(p.fecha)} · ${viewDate(p.fecha)}` },
  { key: 'repeticiones', title: 'Posibles repeticiones', accion: 'Servir', icon: 'repeat', tone: 'w', tipo: 'inseminacion', sub: (p) => `Servida ${relDays(p.fecha)} · sin revisar` },
];
const DIAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const SHOWN = 5;

export default function Semana() {
  const { rol, lots, sows, registros, refresh, loading, first, diaInicio, edadDestete } = useRepro();
  const [open, setOpen] = useState<string | null>('inseminar');
  const [full, setFull] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);

  const hoy = today();
  const { start, end } = weekBounds(addDays(hoy, offset * 7), diaInicio);
  const current = offset === 0;
  const k = useMemo(() => kpisRepro(registros, start, end), [registros, start, end]);
  const porHacer = useMemo(() => pendientes(sows, registros, lots, start, end, hoy, edadDestete), [sows, registros, lots, start, end, hoy, edadDestete]);
  const total = Object.values(porHacer).reduce((n, l) => n + l.length, 0);
  const sinDatos = !k.inseminadas && !k.partos && !k.destetes && !k.muertesLactantes;

  return (
    <Screen
      tabs={<TabBar module="repro" active="semana" />}
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Row style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <IconBtn icon="back" label="Semana anterior" onPress={() => setOffset(offset - 1)} />
          <Grow style={{ alignItems: 'center' }}>
            <T v="h2" size={22} accessibilityRole="header">{current ? 'Esta semana' : `Semana ${weekNumber(addDays(start, 3))}`}</T>
            <T v="sub" size={14}>Del {viewDate(start)} al {viewDate(end)}</T>
          </Grow>
          <IconBtn icon="next" label="Semana siguiente" onPress={() => setOffset(Math.min(0, offset + 1))} />
        </Row>
      }>
      {first ? <Loading /> : null}

      <Row gap={6}>
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
          const on = d === hoy;
          const past = d < hoy;
          return (
            <View key={d} accessibilityLabel={`${viewDate(d)}${on ? ', hoy' : ''}`} style={{ flex: 1, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? C.forest : past ? C.green2 : C.card, borderWidth: on || past ? 0 : 1, borderColor: C.line }}>
              <T size={12} color={on ? C.forestText : past ? C.forest : C.mute}>{on ? 'Hoy' : DIAS[(diaInicio + (diffDays(start, d))) % 7]}</T>
              <T v="b" size={16} color={on ? '#fff' : past ? C.forest : C.ink}>{Number(d.slice(8))}</T>
            </View>
          );
        })}
      </Row>

      <Grid cols={4} gap={8}>
        {(
          [
            [k.inseminadas, 'Servicios'],
            [k.partos, 'Partos'],
            [k.destetes, 'Destetes'],
            [k.muertesLactantes, 'Lechones muertos'],
          ] as const
        ).map(([value, label]) => (
          <Card key={label} gap={0} style={{ paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, alignItems: 'center', flex: 1 }}>
            <T v="h1" size={22}>{value}</T>
            <T v="sub" size={11} style={{ textAlign: 'center' }}>{label}</T>
          </Card>
        ))}
      </Grid>

      {current ? (
        <>
          <Row>
            <Grow><T v="h2" size={19}>Falta por hacer</T></Grow>
            {total ? <Tag tone="w">{total}</Tag> : null}
          </Row>
          {!total && !first ? <Empty icon="check" title="Todo al día" sub="No hay eventos pendientes para esta semana." /> : null}

          {GROUPS.filter((g) => porHacer[g.key].length).map((g) => {
            const list = porHacer[g.key];
            const isOpen = open === g.key;
            const shown = full.includes(g.key) ? list : list.slice(0, SHOWN);
            return (
              <Card key={g.key} gap={8} style={{ paddingVertical: 8 }}>
                <Pressable onPress={() => setOpen(isOpen ? null : g.key)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                  <Row style={{ minHeight: 52 }}>
                    <Av icon={g.icon} tone={g.tone} />
                    <Grow><T v="b">{g.title}</T></Grow>
                    <T v="b">{list.length}</T>
                    <Icon name={isOpen ? 'up' : 'down'} color={C.mute} />
                  </Row>
                </Pressable>
                {isOpen ? (
                  <Col gap={8} style={{ paddingBottom: 8 }}>
                    {shown.map((p) => (
                      <Row key={p.sow.id} style={{ padding: 6, paddingLeft: 14, borderRadius: 14, backgroundColor: C.bg }}>
                        <Pressable style={{ flex: 1 }} onPress={() => go(`/repro/cerda?id=${p.sow.id}`)} accessibilityRole="button" accessibilityLabel={`Ver la cerda ${p.sow.arete}`}>
                          <T v="b">ID {p.sow.arete}</T>
                          <T v="sub">{g.sub(p)}</T>
                        </Pressable>
                        {can.write(rol) ? <Btn small label={g.accion} a11y={`Registrar ${g.tipo} de la cerda ${p.sow.arete}`} onPress={() => go(`/evento?tipo=${g.tipo}&arete=${encodeURIComponent(p.sow.arete)}`)} /> : null}
                      </Row>
                    ))}
                    {list.length > shown.length ? (
                      <Pressable onPress={() => setFull([...full, g.key])} accessibilityRole="button" style={{ paddingLeft: 14, paddingVertical: 6 }}>
                        <T v="b" size={14} color={C.green}>Ver las otras {list.length - shown.length}</T>
                      </Pressable>
                    ) : null}
                  </Col>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : (
        <>
          {sinDatos && !first ? <Empty icon="calendar" title="No hay registros de esta semana" /> : null}
          <Btn small kind="g" label="Volver a la semana actual" onPress={() => setOffset(0)} />
        </>
      )}
    </Screen>
  );
}
