import { useState } from 'react';

import { MoveSheet, type MoveKind } from '@/components/inventario/move-sheet';
import { Av, Btn, Card, Empty, Field, Grid, Grow, Li, List, Loading, Row, Screen, Seg, Sheet, T, TabBar, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { huevosDe } from '@/data/aves';
import { fmt, HUEVOS_POR_CARTON } from '@/data/calc';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { moveStock, useMoveStore, useProductStore } from '@/stores/product.store';
import { useRegistroStore } from '@/stores/registro.store';
import type { Product, Registro } from '@/types/data';
import { dayLabel, diffDays, relDays, today } from '@/utilities/miscellaneous';

/** El almacén de huevos son tres productos de tipo "huevo", uno por talla, con existencia en huevos. */
const TALLAS = ['Grande', 'Mediano', 'Pequeño'];
const SALIDAS: MoveKind[] = [['venta', 'Venta', -1], ['roto', 'Rotos', -1], ['cocina', 'Cocina', -1], ['donacion', 'Donación', -1]];
const cartones = (huevos: number) => Math.floor(huevos / HUEVOS_POR_CARTON);
const enCartones = (huevos: number) => `${fmt(cartones(huevos))} cartones${huevos % HUEVOS_POR_CARTON ? ` + ${huevos % HUEVOS_POR_CARTON}` : ''}`;
/** Los huevos sucios no entran al almacén. */
const limpios = (r: Registro) => huevosDe(r.data) - (Number(r.data?.sucios) || 0);

export default function Almacen() {
  const rol = useFarmStore((s) => s.rol);
  const products = useProductStore((s) => s.list).filter((p) => p.tipo === 'huevo');
  const moves = useMoveStore((s) => s.list);
  const lots = useLotStore((s) => s.list);
  const registros = useRegistroStore((s) => s.list);
  const refresh = useLoad(useProductStore, useMoveStore, useLotStore, useRegistroStore);
  const loading = useLoading('listProduct', 'listRegistro');
  const saving = useLoading('move', 'product', 'registro');
  const [tab, setTab] = useState(0);
  const [talla, setTalla] = useState(0);
  const [salida, setSalida] = useState<Product | null>(null);
  const [picking, setPicking] = useState(false);

  const write = can.write(rol);
  const de = (t: string) => products.find((p) => p.descripcion === t);
  const stock = TALLAS.map((t) => [t, de(t)?.existencia ?? 0] as const);
  // Solo la postura reciente espera entrar: la de hace más de un mes ya se vendió o se contó.
  const pending = registros.filter((r) => r.tipo === 'postura' && !r.data?.almacenado && limpios(r) > 0 && diffDays(r.fecha, today()) <= 30).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const lotCode = (id: string) => lots.find((l) => l.id === id)?.code ?? 'Lote';
  const suyos = moves.filter((m) => products.some((p) => p.id === m.productId));
  const porLote = lots.map((l) => [l, suyos.filter((m) => m.lotId === l.id && m.cantidad > 0)] as const).filter(([, ms]) => ms.length);

  /** Entra la postura al almacén en la talla elegida y la marca para no ofrecerla otra vez. */
  const confirm = async (r: Registro) => {
    try {
      const nombre = TALLAS[talla];
      const product = de(nombre) ?? (await useProductStore.getState().create({ descripcion: nombre, tipo: 'huevo', unidad: 'huevos' }));
      await moveStock(product, { cantidad: limpios(r), tipo: 'entrada', fecha: r.fecha, lotId: r.lotId });
      await useRegistroStore.getState().update(r.id, { data: { almacenado: true, talla: nombre } });
    } catch {}
  };

  return (
    <Screen
      tabs={<TabBar module="aves" active="almacen" />}
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title="Almacén" sub={`${fmt(cartones(stock.reduce((n, s) => n + s[1], 0)))} cartones en existencia`} subAbove right={write && products.length ? <Btn small icon="upload" label="Salida" onPress={() => setPicking(true)} /> : null} />}>
      <Seg options={['Stock', 'Historial', 'Por lote']} value={tab} onChange={setTab} />
      {loading && !registros.length ? <Loading /> : null}

      {tab === 0 ? (
        <>
          <Grid cols={3}>
            {stock.map(([name, n]) => (
              <Card key={name} gap={0} style={{ padding: 14, paddingHorizontal: 12 }}>
                <T v="sub">{name}</T>
                <T v="big" size={26}>{fmt(cartones(n))}</T>
                <T v="sub">cartones{n % HUEVOS_POR_CARTON ? ` + ${n % HUEVOS_POR_CARTON}` : ''}</T>
              </Card>
            ))}
          </Grid>

          <Row>
            <Grow><T v="h2">Entradas por confirmar</T></Grow>
            {pending.length ? <Tag tone="w">{pending.length}</Tag> : null}
          </Row>
          {pending.length ? (
            <>
              {write ? (
                <Field label="Talla de lo que vas a confirmar">
                  <Seg options={TALLAS} value={talla} onChange={setTalla} />
                </Field>
              ) : null}
              {pending.slice(0, 20).map((r) => (
                <Card key={r.id} gap={12} style={{ borderColor: C.line2 }}>
                  <Row>
                    <Av icon="egg" />
                    <Grow>
                      <T v="b">{lotCode(r.lotId)} · {dayLabel(r.fecha)}</T>
                      <T v="sub">{enCartones(limpios(r))}{r.data?.sucios ? ` · ${r.data.sucios} sucios fuera` : ''}</T>
                    </Grow>
                  </Row>
                  {write ? <Btn small icon="check" label={`Confirmar como ${TALLAS[talla]}`} loading={saving} onPress={() => void confirm(r)} /> : null}
                </Card>
              ))}
              {pending.length > 20 ? <T v="sub">Y {pending.length - 20} más antiguas.</T> : null}
            </>
          ) : (
            <T v="sub">Todo confirmado. No hay entradas pendientes.</T>
          )}
        </>
      ) : null}

      {tab === 1 ? (
        suyos.length ? (
          <List>
            {suyos.slice(0, 80).map((m) => {
              const p = products.find((x) => x.id === m.productId);
              const kind = SALIDAS.find((k) => k[0] === m.tipo)?.[1] ?? 'Entrada';
              return <Li key={m.id} title={`${kind} · ${enCartones(Math.abs(m.cantidad))} ${p?.descripcion ?? ''}`} sub={[relDays(m.fecha), m.lotId ? lotCode(m.lotId) : '', m.nota].filter(Boolean).join(' · ')} right={<Tag tone={m.cantidad > 0 ? 'k' : m.tipo === 'roto' ? 'd' : 'n'}>{kind}</Tag>} />;
            })}
          </List>
        ) : (
          <Empty icon="clock" title="Sin movimientos" sub="Las entradas confirmadas y las salidas aparecerán aquí." />
        )
      ) : null}

      {tab === 2 ? (
        porLote.length ? (
          <List>
            {porLote.map(([l, ms]) => (
              <Li key={l.id} left={<Av icon="egg" />} title={l.code} sub={`Última entrada ${relDays(ms.reduce((max, m) => (m.fecha > max ? m.fecha : max), ''))}`} right={<T v="b">{fmt(cartones(ms.reduce((n, m) => n + m.cantidad, 0)))}</T>} />
            ))}
          </List>
        ) : (
          <Empty icon="egg" title="Sin entradas por lote" />
        )
      ) : null}

      <MoveSheet product={salida} kinds={SALIDAS} withLot={false} onClose={() => setSalida(null)} />
      {picking ? (
        <SalidaPicker
          products={products}
          onPick={(p) => {
            setPicking(false);
            setSalida(p);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Screen>
  );
}

/** Elige de qué talla sale; la cantidad se pide después, en huevos. */
function SalidaPicker({ products, onPick, onClose }: { products: Product[]; onPick: (p: Product) => void; onClose: () => void }) {
  return (
    <Sheet visible title="¿De qué talla sale?" onClose={onClose}>
      <T v="sub">La cantidad se registra en huevos (un cartón son {HUEVOS_POR_CARTON}). Hoy es {dayLabel(today())}.</T>
      <List>
        {products.map((p) => (
          <Li key={p.id} title={p.descripcion} sub={enCartones(p.existencia)} onPress={() => onPick(p)} />
        ))}
      </List>
    </Sheet>
  );
}
