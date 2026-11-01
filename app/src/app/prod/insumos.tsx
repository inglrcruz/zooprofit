import { useState } from 'react';

import { MoveSheet, MOVES_INSUMO } from '@/components/inventario/move-sheet';
import { ProductSheet } from '@/components/inventario/product-sheet';
import { Btn, Card, Col, Empty, Grow, Li, List, Loading, MenuBtn, Row, Screen, Seg, T, TabBar, Tag } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { useMoveStore, useProductStore } from '@/stores/product.store';
import type { Product } from '@/types/data';
import { relDays } from '@/utilities/miscellaneous';

const TIPOS = ['Alimento', 'Medicamento', 'Vacuna', 'Otro'];

export default function Insumos() {
  const prod = useFarmStore((s) => s.current?.type === 'produccion');
  const rol = useFarmStore((s) => s.rol);
  const products = useProductStore((s) => s.list);
  const moves = useMoveStore((s) => s.list);
  const lots = useLotStore((s) => s.list);
  const refresh = useLoad(useProductStore, useMoveStore, useLotStore);
  const loading = useLoading('listProduct', 'listMove');
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState<{ product: Product | null } | null>(null);
  const [moving, setMoving] = useState<{ product: Product; kind: number } | null>(null);

  const write = can.write(rol);
  const low = products.filter((p) => p.minimo > 0 && p.existencia < p.minimo);
  const fine = products.filter((p) => !low.includes(p));
  const name = (id: string) => products.find((p) => p.id === id);
  const sub = (p: Product) => p.tipo;

  return (
    <Screen
      tabs={<TabBar module={prod ? 'prod' : 'repro'} active="" />}
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Row style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <MenuBtn />
          <Grow><T v="h2" size={22} accessibilityRole="header">Alimento y medicinas</T></Grow>
          {write ? <Btn small icon="plus" a11y="Agregar un producto nuevo" onPress={() => setEditing({ product: null })} /> : null}
        </Row>
      }>
      <Seg options={['Lo que hay', 'Entradas y salidas']} value={tab} onChange={setTab} />
      {loading && !products.length ? <Loading /> : null}

      {tab === 0 ? (
        <>
          {!loading && !products.length ? <Empty icon="box" title="Aún no hay insumos" sub="Agrega el alimento, los medicamentos y las vacunas que quieres controlar." /> : null}
          {low.length ? (
            <Row>
              <Grow><T v="h2" size={19}>Hay que comprar</T></Grow>
              <Tag tone="d">{low.length}</Tag>
            </Row>
          ) : null}
          {low.map((p) => (
            <Card key={p.id} style={{ borderColor: C.bad, borderWidth: 2, borderRadius: 22 }}>
              <Row>
                <Grow>
                  <T v="b">{p.descripcion}</T>
                  <T v="sub">{[p.tipo, `avisa por debajo de ${p.minimo}`].filter(Boolean).join(' · ')}</T>
                </Grow>
                <Col gap={0} align="flex-end">
                  <T v="h1" size={28} color={C.bad}>{p.existencia}</T>
                  <T v="sub">{p.unidad}</T>
                </Col>
              </Row>
              {write ? (
                <Row gap={10}>
                  <Btn small label="Llegó compra" flex={1} onPress={() => setMoving({ product: p, kind: 0 })} />
                  <Btn small kind="g" label="Se usó" flex={1} onPress={() => setMoving({ product: p, kind: 1 })} />
                  <Btn small kind="g" icon="sliders" a11y={`Editar ${p.descripcion}`} onPress={() => setEditing({ product: p })} />
                </Row>
              ) : null}
            </Card>
          ))}

          {fine.length ? (
            <>
              <T v="h2" size={19}>Suficiente</T>
              <List>
                {fine.map((p) => (
                  <Li key={p.id} title={p.descripcion} sub={sub(p) || undefined} right={<T v="b">{p.existencia} {p.unidad}</T>} onPress={write ? () => setMoving({ product: p, kind: 0 }) : undefined} />
                ))}
              </List>
              {write ? <T v="sub">Toca un producto para anotar una compra o lo que se usó.</T> : null}
            </>
          ) : null}
        </>
      ) : moves.length ? (
        <List>
          {moves.slice(0, 80).map((m) => {
            const p = name(m.productId);
            const kind = MOVES_INSUMO.find((k) => k[0] === m.tipo);
            return (
              <Li
                key={m.id}
                title={`${p?.descripcion ?? 'Producto eliminado'} · ${m.cantidad > 0 ? '+' : '−'}${Math.abs(m.cantidad)} ${p?.unidad ?? ''}`}
                sub={[relDays(m.fecha), lots.find((l) => l.id === m.lotId)?.code, m.nota].filter(Boolean).join(' · ')}
                right={<Tag tone={m.cantidad > 0 ? 'k' : 'n'}>{kind?.[1] ?? m.tipo}</Tag>}
              />
            );
          })}
        </List>
      ) : loading ? null : (
        <Empty icon="clock" title="Sin movimientos" sub="Las entradas y los consumos que registres aparecerán aquí." />
      )}

      <ProductSheet visible={!!editing} product={editing?.product ?? null} tipos={TIPOS} onClose={() => setEditing(null)} />
      <MoveSheet product={moving?.product ?? null} initial={moving?.kind ?? 0} onClose={() => setMoving(null)} />
    </Screen>
  );
}
