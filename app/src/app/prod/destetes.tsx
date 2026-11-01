import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { LotSheet } from '@/components/lotes/lot-sheet';
import { Av, Btn, Card, Empty, go, Grid, Grow, Li, List, Loading, Note, Options, Row, Screen, Sheet, Stat, T, TabBar, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { camadas, type Camada } from '@/data/repro';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useDesteteStore } from '@/stores/destete.store';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { addDays, diffDays, relDays, today, viewDate } from '@/utilities/miscellaneous';

export default function Destetes() {
  const { current: farm, rol, list: farms } = useFarmStore();
  const prodLots = useLotStore((s) => s.list);
  const { destetes, lots: reproLots } = useDesteteStore();
  const refreshLots = useLoad(useLotStore);
  const loading = useLoading('listDestete');
  const saving = useLoading('lot', 'farm');
  const [linking, setLinking] = useState(false);
  const [buying, setBuying] = useState(false);

  const reproId = farm?.config?.reproFarmId;
  const repros = farms.filter((f) => f.type === 'reproduccion');
  const repro = farms.find((f) => f.id === reproId);
  const load = useCallback(() => {
    if (!farms.length) void useFarmStore.getState().findAll().catch(() => null);
    if (reproId) void useDesteteStore.getState().findAll(reproId).catch(() => null);
  }, [reproId, farms.length]);
  useFocusEffect(load);

  const todas = useMemo(() => camadas(destetes), [destetes]);
  const hechos = new Set(prodLots.map((l) => l.data?.origenKey).filter(Boolean));
  // Solo los destetes de los últimos 60 días se ofrecen: los anteriores ya no son lechones por entrar.
  const pending = todas.filter((c) => !hechos.has(c.key) && diffDays(c.fecha, today()) <= 60);
  const convertidos = prodLots.filter((l) => l.origenLotId || l.data?.esCompra);
  const code = (id: string) => reproLots.find((l) => l.id === id)?.code ?? 'Lote';
  const write = can.write(rol);

  const convert = (c: Camada) =>
    useLotStore
      .getState()
      .create({
        code: `P${code(c.lotId)}`,
        fase: 'destete',
        origenLotId: c.lotId,
        entryDate: c.fecha,
        birthDate: c.edad ? addDays(c.fecha, -c.edad) : '',
        initialAnimals: c.lechones,
        activeAnimals: c.lechones,
        entryWeight: c.pesoTotal ? Math.round((c.pesoTotal / c.lechones) * 100) / 100 : 0,
        data: { origenKey: c.key, origenLotCode: code(c.lotId), cerdasOrigen: c.cerdas },
      })
      .catch(() => null);

  return (
    <Screen
      tabs={<TabBar module="prod" active="destetes" />}
      refreshing={loading}
      onRefresh={() => (load(), refreshLots())}
      top={<Top title="Destetes disponibles" sub={farm?.name} subAbove />}>
      {repro ? (
        <Note icon="link" action={can.members(rol) ? 'Cambiar' : undefined} onPress={can.members(rol) ? () => setLinking(true) : undefined}>Enlazada con {repro.name}</Note>
      ) : (
        <Note tone="w" icon="link" action={can.members(rol) && repros.length ? 'Enlazar' : undefined} onPress={can.members(rol) && repros.length ? () => setLinking(true) : undefined}>
          {reproId ? 'No tienes acceso a la granja de reproducción enlazada.' : repros.length ? 'Enlaza una granja de reproducción para recibir sus destetes.' : 'Para recibir destetes necesitas pertenecer también a una granja de reproducción.'}
        </Note>
      )}

      {loading && !todas.length ? <Loading /> : null}
      {pending.map((c) => (
        <Card key={c.key} gap={12}>
          <Row>
            <Grow>
              <T v="h2">{code(c.lotId)}</T>
              <T v="sub">Destete del {viewDate(c.fecha)} · {relDays(c.fecha)}</T>
            </Grow>
            <Tag tone={diffDays(c.fecha, today()) > 7 ? 'd' : 'w'}>{diffDays(c.fecha, today()) > 7 ? 'Sin lote' : 'Nuevo'}</Tag>
          </Row>
          <Grid cols={3}>
            <Stat value={String(c.lechones)} label="lechones" />
            <Stat value={c.pesoTotal ? `${(c.pesoTotal / c.lechones).toFixed(1)} kg` : '—'} label="peso prom." />
            <Stat value={c.edad ? String(c.edad) : '—'} label="días de edad" />
          </Grid>
          {write ? <Btn icon="plus" label="Crear lote de producción" loading={saving} onPress={() => void convert(c)} /> : null}
        </Card>
      ))}
      {repro && !loading && !pending.length ? <Empty icon="check" title="No hay destetes pendientes de convertir" sub="Los destetes de los últimos 60 días aparecen aquí." /> : null}

      {convertidos.length ? (
        <>
          <T v="cap">Ya convertidos</T>
          <List>
            {convertidos.map((l) => (
              <Li key={l.id} left={<Av icon="check" tone="k" />} title={l.code} sub={`${l.initialAnimals} ${l.data?.esCompra ? 'comprados' : 'lechones'}${l.data?.origenLotCode ? ` · desde ${l.data.origenLotCode}` : ''}`} onPress={() => go(`/prod/lote?id=${l.id}`)} />
            ))}
          </List>
        </>
      ) : null}
      {write ? <Btn kind="g" icon="plus" label="Agregar lote por compra" onPress={() => setBuying(true)} /> : null}

      <Sheet visible={linking} title="Granja de reproducción" onClose={() => setLinking(false)}>
        <T v="sub">Los destetes que se registren en ella aparecerán aquí para convertirlos en lotes de engorde.</T>
        <Options
          options={repros.map((f) => [f.id, f.name] as const)}
          value={reproId ?? ''}
          onChange={(id) => void useFarmStore.getState().update({ config: { reproFarmId: id } }).then(() => setLinking(false)).catch(() => null)}
        />
      </Sheet>
      <LotSheet visible={buying} onClose={() => setBuying(false)} defaults={{ fase: 'destete', data: { esCompra: true } }} />
    </Screen>
  );
}
