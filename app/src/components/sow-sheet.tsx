import { useState } from 'react';

import { Btn, DatePick, Field, Input, Options, Sheet, T } from '@/components/ui';
import { ESTADO } from '@/constants/eventos';
import { useLoading } from '@/hooks/use-load';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { cambiarFechaEntrada } from '@/stores/registro.store';
import { useSowStore } from '@/stores/sow.store';
import type { Sow } from '@/types/data';

/** Corrige a mano los datos de una cerda: estado, lote, partos, genética. */
export function SowSheet(props: { sow: Sow; visible: boolean; onClose: () => void; onDeleted: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <SowSheetForm key={String(props.visible)} {...props} />;
}

function SowSheetForm({ sow, visible, onClose, onDeleted }: { sow: Sow; visible: boolean; onClose: () => void; onDeleted: () => void }) {
  const lots = useLotStore((s) => s.list).filter((l) => !l.archivado || l.id === sow.lotIdActual);
  const loading = useLoading('sow');
  const [frm, setFrm] = useState({ estadoActual: sow.estadoActual, lotIdActual: sow.lotIdActual, partos: String(sow.partosHistoricos), genetica: sow.genetica, fechaEntrada: sow.fechaEntrada ?? '' });

  const save = () =>
    (frm.fechaEntrada !== (sow.fechaEntrada ?? '') ? cambiarFechaEntrada(sow, frm.fechaEntrada) : Promise.resolve())
      .then(() => useSowStore.getState().update(sow.id, { estadoActual: frm.estadoActual, lotIdActual: frm.lotIdActual, partosHistoricos: Number(frm.partos) || 0, genetica: frm.genetica.trim(), fechaEntrada: frm.fechaEntrada }))
      .then(onClose)
      .catch(() => null);
  const remove = () => {
    onClose();
    useGlobalStore.getState().showConfirm({
      title: `Eliminar la cerda ${sow.arete}`,
      message: 'Se borra su ficha. Sus registros se conservan en los lotes. Si la cerda salió de la granja, registra mejor un descarte o una muerte.',
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void useSowStore.getState().delete(sow.id).then(onDeleted).catch(() => null),
    });
  };

  return (
    <Sheet
      visible={visible}
      title={`Corregir ID ${sow.arete}`}
      onClose={onClose}
      footer={
        <>
          <Btn label="Guardar cambios" loading={loading} onPress={save} />
          <Btn kind="g" icon="trash" label="Eliminar ficha" onPress={remove} />
        </>
      }>
      <T v="sub">Lo normal es que el estado y el lote cambien solos al registrar eventos. Usa esto solo para corregir un error.</T>
      <Field label="Estado">
        <Options options={Object.entries(ESTADO).map(([k, [label]]) => [k, label] as const)} value={frm.estadoActual} onChange={(v) => setFrm({ ...frm, estadoActual: v })} />
      </Field>
      <Field label="Lote">
        <Options options={lots.map((l) => [l.id, l.code] as const)} value={frm.lotIdActual} onChange={(v) => setFrm({ ...frm, lotIdActual: v })} />
      </Field>
      <Field label="Fecha de entrada">
        <DatePick value={frm.fechaEntrada} onChange={(v) => setFrm({ ...frm, fechaEntrada: v })} futuro />
      </Field>
      <Field label="Partos">
        <Input value={frm.partos} onChangeText={(v) => setFrm({ ...frm, partos: v.replace(/\D/g, '') })} keyboardType="number-pad" />
      </Field>
      <Field label="Genética">
        <Input value={frm.genetica} onChangeText={(v) => setFrm({ ...frm, genetica: v })} maxLength={40} />
      </Field>
    </Sheet>
  );
}
