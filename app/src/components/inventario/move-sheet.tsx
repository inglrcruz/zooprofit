import { useState } from 'react';

import { Btn, DateField, Field, Input, Options, Seg, Sheet, T } from '@/components/ui';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useLotStore } from '@/stores/lot.store';
import { moveStock } from '@/stores/product.store';
import type { Product } from '@/types/data';
import { num, today } from '@/utilities/miscellaneous';

/** Tipos de movimiento: [valor guardado, etiqueta, signo]. */
export type MoveKind = readonly [tipo: string, label: string, sign: 1 | -1];
export const MOVES_INSUMO: MoveKind[] = [['entrada', 'Llegó compra', 1], ['consumo', 'Se usó', -1], ['ajuste', 'Se perdió', -1]];

/** Registra una entrada o una salida de un producto; la existencia la ajusta el API. */
export function MoveSheet(props: { product: Product | null; kinds?: MoveKind[]; initial?: number; withLot?: boolean; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <MoveSheetForm key={props.product?.id ?? ''} {...props} />;
}

function MoveSheetForm({ product, kinds = MOVES_INSUMO, initial = 0, withLot = true, onClose }: { product: Product | null; kinds?: MoveKind[]; initial?: number; withLot?: boolean; onClose: () => void }) {
  const lots = useLotStore((s) => s.list).filter((l) => !l.archivado && !l.esFijo);
  const loading = useLoading('move');
  const [kind, setKind] = useState(initial);
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState(today());
  const [lotId, setLotId] = useState('');
  const [nota, setNota] = useState('');

  const [tipo, , sign] = kinds[Math.min(kind, kinds.length - 1)];
  const n = num(cantidad);
  const falta = !!product && sign < 0 && n > product.existencia;
  const save = () => product && moveStock(product, { cantidad: sign * n, tipo, fecha, lotId: sign < 0 ? lotId : '', nota: nota.trim() }).then(onClose).catch(() => null);

  return (
    <Sheet visible={!!product} title={product?.descripcion ?? ''} onClose={onClose} footer={<Btn icon="check" label="Guardar" disabled={n <= 0 || falta} loading={loading} onPress={() => void save()} />}>
      <T v="sub">En existencia: {product?.existencia} {product?.unidad}</T>
      <Seg options={kinds.map((k) => k[1])} value={kind} onChange={setKind} />
      <Field label={`Cantidad${product?.unidad ? ` (${product.unidad})` : ''}`}>
        <Input strong value={cantidad} onChangeText={(v) => setCantidad(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="0" error={falta} autoFocus />
        {falta ? <T v="sub" color={C.bad}>No hay tanta existencia.</T> : null}
      </Field>
      <Field label="Fecha">
        <DateField value={fecha} onChange={setFecha} />
      </Field>
      {withLot && sign < 0 && lots.length ? (
        <Field label="Lote que lo consume" hint="opcional">
          <Options options={lots.slice(0, 12).map((l) => [l.id, l.code] as const)} value={lotId} onChange={(v) => setLotId(v === lotId ? '' : v)} />
        </Field>
      ) : null}
      <Field label="Nota" hint="opcional">
        <Input value={nota} onChangeText={setNota} placeholder={sign > 0 ? 'Ej: compra, proveedor…' : 'Observaciones…'} maxLength={255} />
      </Field>
    </Sheet>
  );
}
