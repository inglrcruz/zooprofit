import { useState } from 'react';

import { faseLabel, LotSheet } from '@/components/lotes/lot-sheet';
import { Btn, Card, Chips, Empty, go, Grid, Grow, Loading, Row, Screen, Stat, swap, T, TabBar, Tag, Top } from '@/components/ui';
import { can, FARM_KIND } from '@/constants/config';
import { engorde } from '@/data/aves';
import { useLotes } from '@/hooks/use-lotes';
import { diffDays, today } from '@/utilities/miscellaneous';

export default function ProdLotes() {
  const { farm, rol, lots, registros, refresh, loading, first } = useLotes();
  const [filter, setFilter] = useState(0);
  const [creating, setCreating] = useState(false);
  const activos = lots.filter((l) => !l.archivado);
  const shown = filter ? lots.filter((l) => l.archivado) : activos;

  return (
    <Screen
      tabs={<TabBar module="prod" active="lotes" />}
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Top
          title={farm?.name ?? ''}
          sub={FARM_KIND.produccion.label}
          subAbove
          onTitle={() => swap('/modulos')}
          right={
            <>
              {can.write(rol) ? <Btn small icon="plus" label="Lote" onPress={() => setCreating(true)} /> : null}
            </>
          }
        />
      }>
      <Chips options={[`Activos · ${activos.length}`, 'Cerrados']} value={filter} onChange={setFilter} />
      {first ? <Loading /> : null}
      {!first && !shown.length ? (
        <Empty icon="scale" title={filter ? 'No hay lotes cerrados' : 'Aún no hay lotes de engorde'} sub={filter ? undefined : 'Crea uno con el botón Lote, o conviértelo desde un destete en la pestaña Destetes.'} />
      ) : null}

      {shown.map((l) => {
        const e = engorde(l, registros);
        const peso = e.pesadas[e.pesadas.length - 1]?.[1];
        const inicio = l.entryDate || l.fechaInicio;
        return (
          <Card key={l.id} onPress={() => go(`/prod/lote?id=${l.id}`)} label={l.code} style={{ padding: 14, paddingHorizontal: 16 }}>
            <Row>
              <Grow>
                <T v="h2">{l.code}</T>
                <T v="sub">{[inicio ? `Día ${diffDays(inicio, today())}` : '', l.nave].filter(Boolean).join(' · ') || 'Sin fecha de entrada'}</T>
              </Grow>
              {l.fase ? <Tag>{faseLabel(l.fase)}</Tag> : null}
            </Row>
            <Grid cols={3}>
              <Stat value={String(e.activos)} label={`cerdos, de ${l.initialAnimals}`} />
              <Stat value={peso ? `${peso} kg` : '—'} label="peso prom." />
              <Stat value={e.mortalidad !== null ? `${e.mortalidad}%` : '—'} label="mortalidad" />
            </Grid>
          </Card>
        );
      })}

      <LotSheet visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
