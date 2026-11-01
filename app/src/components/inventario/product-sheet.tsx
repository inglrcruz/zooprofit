import { useState } from 'react';

import { Btn, Field, Grid, Input, Options, Sheet } from '@/components/ui';
import { useLoading } from '@/hooks/use-load';
import useValidateInputs from '@/hooks/use-validate-inputs';
import { useGlobalStore } from '@/stores/global.store';
import { useProductStore } from '@/stores/product.store';
import type { Product } from '@/types/data';
import { num } from '@/utilities/miscellaneous';

/** Crea o edita un producto del inventario. `tipos` son las categorías que ofrece la pantalla. */
export function ProductSheet(props: { visible: boolean; product: Product | null; tipos?: string[]; unidad?: string; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <ProductSheetForm key={String(props.visible)} {...props} />;
}

function ProductSheetForm({ visible, product, tipos, unidad = '', onClose }: { visible: boolean; product: Product | null; tipos?: string[]; unidad?: string; onClose: () => void }) {
  const { create, update, delete: remove } = useProductStore.getState();
  const loading = useLoading('product');
  const { inputErrors, validateInputs, setRemoveError } = useValidateInputs();
  const [frm, setFrm] = useState({ descripcion: product?.descripcion ?? '', codigo: product?.codigo ?? '', tipo: product?.tipo ?? tipos?.[0] ?? '', unidad: product?.unidad ?? unidad, minimo: product?.minimo ? String(product.minimo) : '' });
  const set = (k: keyof typeof frm) => (v: string) => {
    setFrm({ ...frm, [k]: v });
    setRemoveError(k);
  };

  const save = () => {
    if (!validateInputs({ descripcion: frm.descripcion })) return;
    const body = { descripcion: frm.descripcion.trim(), codigo: frm.codigo.trim(), tipo: frm.tipo, unidad: frm.unidad.trim(), minimo: num(frm.minimo) };
    (product ? update(product.id, body) : create(body)).then(onClose).catch(() => null);
  };
  const destroy = () => {
    if (!product) return;
    onClose();
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${product.descripcion}`,
      message: 'Se borran el producto y todos sus movimientos. No se puede deshacer.',
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void remove(product.id).catch(() => null),
    });
  };

  return (
    <Sheet
      visible={visible}
      title={product ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      footer={
        <>
          <Btn label={product ? 'Guardar cambios' : 'Crear producto'} loading={loading} onPress={save} />
          {product ? <Btn kind="g" icon="trash" label="Eliminar producto" onPress={destroy} /> : null}
        </>
      }>
      <Field label="Nombre">
        <Input value={frm.descripcion} onChangeText={set('descripcion')} error={inputErrors.descripcion} placeholder="Ej: Iniciador cerdos 50 kg" maxLength={160} />
      </Field>
      {tipos ? (
        <Field label="Tipo">
          <Options options={tipos.map((t) => [t, t] as const)} value={frm.tipo} onChange={set('tipo')} />
        </Field>
      ) : null}
      <Grid cols={2}>
        <Field label="Unidad">
          <Input value={frm.unidad} onChangeText={set('unidad')} placeholder="sacos, dosis, lb…" maxLength={20} autoCapitalize="none" />
        </Field>
        <Field label="Mínimo" hint="avisa por debajo">
          <Input value={frm.minimo} onChangeText={set('minimo')} keyboardType="decimal-pad" placeholder="0" />
        </Field>
      </Grid>
      <Field label="Código" hint="opcional">
        <Input value={frm.codigo} onChangeText={set('codigo')} maxLength={40} autoCapitalize="characters" />
      </Field>
    </Sheet>
  );
}
