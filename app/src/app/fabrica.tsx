import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { ProductSheet } from '@/components/inventario/product-sheet';
import { back, Bar, Btn, Card, Chips, Empty, Grow, IconBtn, MenuBtn, Input, Li, List, Loading, Row, Screen, Sheet, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { fmt } from '@/data/calc';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useConteoStore } from '@/stores/conteo.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { useProductStore } from '@/stores/product.store';
import type { ConteoItem, Product } from '@/types/data';
import { normalizeText, today, viewDate } from '@/utilities/miscellaneous';

const PAGE = 40;
/** Un conteo guarda lo contado por código de producto (o por id si no tiene código). */
const keyOf = (p: Product) => p.codigo || p.id;
const contado = (i?: ConteoItem) => !!i && (i.bultos !== undefined || i.librasSueltas !== undefined);

export default function Fabrica() {
  const farm = useFarmStore((s) => s.current);
  const rol = useFarmStore((s) => s.rol);
  const products = useProductStore((s) => s.list);
  const conteos = useConteoStore((s) => s.list);
  const refresh = useLoad(useProductStore, useConteoStore);
  const loading = useLoading('listProduct', 'listConteo');
  const saving = useLoading('conteo');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ product: Product | null } | null>(null);
  const [history, setHistory] = useState(false);
  // Lo que se está contando no salta de lista a media anotación: se queda hasta cambiar de filtro.
  const [kept, setKept] = useState<string[]>([]);
  const write = can.write(rol);

  const conteo = conteos.find((c) => c.status === 'abierto');
  const items = conteo?.items ?? {};
  const counted = products.filter((p) => contado(items[keyOf(p)])).length;
  const left = products.length - counted;
  const term = normalizeText(q);
  const shown = products.filter((p) => (!conteo || filter === 2 || kept.includes(keyOf(p)) || contado(items[keyOf(p)]) === (filter === 1)) && (normalizeText(p.descripcion).includes(term) || p.codigo.toLowerCase().includes(term)));

  const start = () => void useConteoStore.getState().create({ fecha: today(), status: 'abierto', items: {} }).catch(() => null);
  /** Guarda una celda al salir de ella; el API combina los items clave por clave. */
  const commit = (p: Product, k: keyof ConteoItem) => {
    const id = `${keyOf(p)}.${k}`;
    if (!conteo || !(id in draft)) return;
    const value = draft[id] === '' ? undefined : Number(draft[id]);
    const item = { ...items[keyOf(p)], [k]: value };
    void useConteoStore
      .getState()
      .update(conteo.id, { items: { [keyOf(p)]: item } })
      .then(() => setDraft(({ [id]: _, ...rest }) => rest))
      .catch(() => null);
  };
  const close = () =>
    conteo &&
    useGlobalStore.getState().showConfirm({
      title: 'Cerrar conteo',
      message: left ? `Quedan ${left} productos sin contar. Al cerrar ya no se podrá seguir anotando en este conteo.` : 'Al cerrar ya no se podrá seguir anotando en este conteo.',
      confirmText: 'Cerrar conteo',
      onConfirm: () => void useConteoStore.getState().update(conteo.id, { status: 'cerrado' }).catch(() => null),
    });

  const cell = (p: Product, k: keyof ConteoItem, label: string) => {
    const id = `${keyOf(p)}.${k}`;
    return (
      <Input
        value={draft[id] ?? (items[keyOf(p)]?.[k] !== undefined ? String(items[keyOf(p)][k]) : '')}
        onChangeText={(v) => (setDraft({ ...draft, [id]: v.replace(/\D/g, '') }), kept.includes(keyOf(p)) || setKept([...kept, keyOf(p)]))}
        onBlur={() => commit(p, k)}
        editable={write}
        accessibilityLabel={`${label} de ${p.descripcion}`}
        placeholder="—"
        keyboardType="number-pad"
        style={{ width: 76, paddingHorizontal: 0, textAlign: 'center' }}
      />
    );
  };

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Top
          title="Inventario"
          sub={farm?.name}
          onBack={() => back('/modulos')}
          right={
            <>
              <MenuBtn />
              <IconBtn icon="clock" label="Historial de conteos" onPress={() => setHistory(true)} />
            </>
          }
        />
      }
      footer={
        write ? (
          <Row gap={10}>
            <Btn kind="g" icon="plus" label="Producto" flex={1} onPress={() => setEditing({ product: null })} />
            {conteo ? <Btn label="Cerrar conteo" flex={1.4} loading={saving} onPress={close} /> : <Btn label="Iniciar conteo" flex={1.4} disabled={!products.length} loading={saving} onPress={start} />}
          </Row>
        ) : undefined
      }>
      {loading && !products.length ? <Loading /> : null}

      {conteo ? (
        <Card>
          <Row>
            <Grow><T v="b">Conteo del {viewDate(conteo.fecha)} en curso</T></Grow>
            <Tag tone={left ? 'w' : 'k'}>{left ? `${left} sin contar` : 'Completo'}</Tag>
          </Row>
          <Bar pct={products.length ? (counted / products.length) * 100 : 0} height={10} />
          <T v="sub">{counted} de {products.length} productos contados</T>
        </Card>
      ) : products.length ? (
        <Card>
          <T v="b">No hay un conteo en curso</T>
          <T v="sub">Inicia uno para anotar los bultos y las libras sueltas de cada producto.</T>
        </Card>
      ) : null}

      {products.length ? (
        <>
          <View>
            <Input value={q} onChangeText={(t) => (setQ(t), setLimit(PAGE))} placeholder="Buscar por nombre o código…" accessibilityLabel="Buscar producto" style={{ paddingLeft: 46 }} />
            <View style={{ position: 'absolute', left: 14, top: 15 }} pointerEvents="none">
              <Icon name="search" color={C.mute} />
            </View>
          </View>
          {conteo ? <Chips options={[`Sin contar · ${left}`, `Contados · ${counted}`, 'Todos']} value={filter} onChange={(i) => (setFilter(i), setLimit(PAGE), setKept([]))} /> : null}

          <Card gap={0} style={{ paddingVertical: 12 }}>
            <Row style={{ paddingBottom: 8 }}>
              <Grow><T v="cap">Producto</T></Grow>
              {conteo ? (
                <>
                  <T v="cap" style={{ width: 76, textAlign: 'center' }}>Bultos</T>
                  <T v="cap" style={{ width: 76, textAlign: 'center' }}>Lb sueltas</T>
                </>
              ) : null}
            </Row>
            {shown.slice(0, limit).map((p) => (
              <Row key={p.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
                <Grow style={{ gap: 2 }}>
                  <T v="b" onPress={write ? () => setEditing({ product: p }) : undefined}>{p.descripcion}</T>
                  <T v="sub">{[p.codigo, `sistema ${fmt(p.existencia)} ${p.unidad.toLowerCase() || 'lb'}`].filter(Boolean).join(' · ')}</T>
                </Grow>
                {conteo ? (
                  <>
                    {cell(p, 'bultos', 'Bultos')}
                    {cell(p, 'librasSueltas', 'Libras sueltas')}
                  </>
                ) : null}
              </Row>
            ))}
            {!shown.length ? <T v="sub" style={{ paddingVertical: 16, textAlign: 'center' }}>Sin productos en esta vista</T> : null}
          </Card>
          {shown.length > limit ? <Btn small kind="g" label={`Ver más (${shown.length - limit})`} onPress={() => setLimit(limit + PAGE)} /> : null}
        </>
      ) : loading ? null : (
        <Empty icon="factory" title="Aún no hay productos" sub="Agrega las materias primas y los alimentos con el botón Producto." />
      )}

      <ProductSheet visible={!!editing} product={editing?.product ?? null} unidad="LIBRAS" onClose={() => setEditing(null)} />
      <Sheet visible={history} title="Historial de conteos" onClose={() => setHistory(false)}>
        {conteos.length ? (
          <List>
            {conteos.map((c) => (
              <Li key={c.id} title={`Conteo del ${viewDate(c.fecha)}`} sub={`${Object.values(c.items ?? {}).filter(contado).length} productos contados`} right={<Tag tone={c.status === 'abierto' ? 'w' : 'k'}>{c.status === 'abierto' ? 'En curso' : 'Cerrado'}</Tag>} />
            ))}
          </List>
        ) : (
          <Empty icon="clock" title="Aún no hay conteos" />
        )}
      </Sheet>
    </Screen>
  );
}
