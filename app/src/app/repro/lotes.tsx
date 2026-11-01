import { useState } from 'react';

import { Icon } from '@/components/icon';
import { faseLabel, LotSheet } from '@/components/lotes/lot-sheet';
import { Btn, Card, Chips, Empty, go, Grid, Grow, Li, List, Loading, MenuBtn, Row, Screen, Stat, T, TabBar, Tag } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useRepro } from '@/hooks/use-repro';
import { relDays } from '@/utilities/miscellaneous';

/** Para qué sirve cada lote del sistema. */
const FIJOS: Record<string, string> = {
  __entradas__: 'Cerdas recién llegadas',
  __destetadas__: 'Esperando servicio',
  __atrasadas__: 'No quedaron preñadas',
  __abiertas__: 'No quedaron preñadas',
  __descarte__: 'Para salir de la granja',
};

export default function Lotes() {
  const { rol, lots, sows, registros, refresh, loading, first } = useRepro();
  const [filter, setFilter] = useState(0);
  const [creating, setCreating] = useState(false);

  const cerdasEn = (id: string) => sows.filter((s) => s.lotIdActual === id).length;
  const activos = lots.filter((l) => !l.esFijo && !l.archivado);
  const shown = filter === 0 ? activos : lots.filter((l) => !l.esFijo && l.archivado);
  const fijos = lots.filter((l) => l.esFijo);

  return (
    <Screen
      tabs={<TabBar module="repro" active="" />}
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Row style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <MenuBtn />
          <Grow>
            <T v="h2" size={24} accessibilityRole="header">Lotes</T>
            <T v="sub">Dónde está cada cerda ahora mismo</T>
          </Grow>
          {can.write(rol) ? <Btn small icon="plus" label="Nuevo" a11y="Nuevo lote" onPress={() => setCreating(true)} /> : null}
        </Row>
      }>
      <Chips options={[`Activos · ${activos.length}`, 'Archivados']} value={filter} onChange={setFilter} />

      {first ? <Loading /> : null}
      {!first && !shown.length ? (
        <Empty icon="list" title={filter ? 'No hay lotes archivados' : 'Aún no hay lotes'} sub={filter ? undefined : 'Al registrar una inseminación se crea el lote de esa semana. También puedes crear uno con el botón Nuevo.'} />
      ) : null}

      {shown.map((l) => {
        const regs = registros.filter((r) => r.lotId === l.id && r.tipo !== 'nota');
        const pend = regs.filter((r) => r.status === 'pending').length;
        const last = regs.reduce((max, r) => (r.fecha > max ? r.fecha : max), '');
        return (
          <Card key={l.id} onPress={() => go(`/repro/lote?id=${l.id}`)} label={l.code} style={{ padding: 14, paddingHorizontal: 16 }}>
            <Row>
              <Grow><T v="h2">{l.code}</T></Grow>
              {l.fase ? <Tag>{faseLabel(l.fase)}</Tag> : null}
            </Row>
            <Grid cols={3}>
              <Stat value={String(cerdasEn(l.id))} label={cerdasEn(l.id) === 1 ? 'cerda' : 'cerdas'} />
              <Stat value={String(regs.length)} label={regs.length === 1 ? 'registro' : 'registros'} />
              <Stat value={String(regs.filter((r) => r.tipo === 'parto').length)} label={regs.filter((r) => r.tipo === 'parto').length === 1 ? 'parto' : 'partos'} />
            </Grid>
            <Row gap={6}>
              <Icon name={pend ? 'clock' : 'check'} size={16} color={pend ? C.warn : C.mute} />
              <T v="sub" color={pend ? C.warn : C.mute}>{pend ? `${pend} por confirmar` : last ? `Último registro ${relDays(last)}` : 'Sin registros'}</T>
            </Row>
          </Card>
        );
      })}

      {filter === 0 && fijos.length ? (
        <>
          <T v="h2" size={19}>Lotes fijos</T>
          <List>
            {fijos.map((l) => (
              <Li key={l.id} title={l.code} sub={FIJOS[l.codeInterno]} right={<T v="b">{cerdasEn(l.id)}</T>} onPress={() => go(`/repro/lote?id=${l.id}`)} />
            ))}
          </List>
        </>
      ) : null}

      <LotSheet visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
