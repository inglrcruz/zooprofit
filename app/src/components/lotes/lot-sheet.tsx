import { useState } from 'react';

import { Btn, DatePick, Field, Grid, Input, Options, Sheet } from '@/components/ui';
import { useLoading } from '@/hooks/use-load';
import useValidateInputs from '@/hooks/use-validate-inputs';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import type { Lot } from '@/types/data';
import { isYMD, num, today } from '@/utilities/miscellaneous';

const FASES: Record<string, readonly (readonly [string, string])[]> = {
  reproduccion: [['gestacion', 'Gestación'], ['maternidad', 'Maternidad'], ['destete', 'Destete']],
  produccion: [['destete', 'Destete'], ['crecimiento', 'Crecimiento'], ['engorde', 'Engorde']],
};
export const faseLabel = (fase: string) => Object.values(FASES).flat().find((f) => f[0] === fase)?.[1] ?? fase;

/** Crea un lote o edita uno existente. Los campos dependen del tipo de granja. */
export function LotSheet(props: { visible: boolean; lot?: Lot | null; onClose: () => void; defaults?: Partial<Lot> }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <LotSheetForm key={String(props.visible)} {...props} />;
}

function LotSheetForm({ visible, lot, onClose, defaults }: { visible: boolean; lot?: Lot | null; onClose: () => void; defaults?: Partial<Lot> }) {
  const type = useFarmStore((s) => s.current?.type ?? 'reproduccion');
  const { create, update } = useLotStore.getState();
  const loading = useLoading('lot');
  const { inputErrors, validateInputs, setRemoveError } = useValidateInputs();
  const repro = type === 'reproduccion';
  const src = lot ?? defaults;
  const [frm, setFrm] = useState({ code: src?.code ?? '', nave: src?.nave ?? '', fase: src?.fase ?? '', entryDate: src?.entryDate || today(), birthDate: src?.birthDate ?? '', initialAnimals: src?.initialAnimals ? String(src.initialAnimals) : '', entryWeight: src?.entryWeight ? String(src.entryWeight) : '' });
  const set = (k: keyof typeof frm) => (v: string) => {
    setFrm({ ...frm, [k]: v });
    setRemoveError(k);
  };

  const submit = () => {
    if (!validateInputs(repro ? { code: frm.code } : { code: frm.code, initialAnimals: num(frm.initialAnimals) })) return;
    const animals = Math.round(num(frm.initialAnimals));
    const body: Partial<Lot> = {
      code: frm.code.trim(),
      nave: frm.nave.trim(),
      fase: frm.fase,
      ...(repro ? {} : {
        entryDate: isYMD(frm.entryDate) ? frm.entryDate : '',
        birthDate: isYMD(frm.birthDate) ? frm.birthDate : '',
        entryWeight: num(frm.entryWeight),
        initialAnimals: animals,
        // Los activos de un lote nuevo son los que entran; al editar se ajustan en la misma medida.
        activeAnimals: lot ? Math.max(0, lot.activeAnimals + animals - lot.initialAnimals) : animals,
      }),
    };
    (lot ? update(lot.id, body) : create({ ...defaults, ...body })).then(onClose).catch(() => null);
  };

  return (
    <Sheet visible={visible} title={lot ? 'Editar lote' : 'Nuevo lote'} onClose={onClose} footer={<Btn label={lot ? 'Guardar cambios' : 'Crear lote'} loading={loading} onPress={submit} />}>
      <Grid cols={2}>
        <Field label="Nombre o código">
          <Input value={frm.code} onChangeText={set('code')} error={inputErrors.code} placeholder={repro ? 'Ej: Gestación B-14' : 'Ej: E-22'} maxLength={60} />
        </Field>
        <Field label="Nave" hint="opcional">
          <Input value={frm.nave} onChangeText={set('nave')} placeholder="Ej: Nave 3" maxLength={60} />
        </Field>
      </Grid>
      {FASES[type] ? (
        <Field label="Fase">
          <Options options={FASES[type]} value={frm.fase} onChange={set('fase')} />
        </Field>
      ) : null}
      {repro ? null : (
        <>
          <Grid cols={2}>
            <Field label={type === 'produccion' ? 'Animales que entran' : 'Aves que entran'}>
              <Input value={frm.initialAnimals} onChangeText={(v) => set('initialAnimals')(v.replace(/\D/g, ''))} error={inputErrors.initialAnimals} keyboardType="number-pad" placeholder="0" />
            </Field>
            {type === 'produccion' ? (
              <Field label="Peso de entrada (kg)">
                <Input value={frm.entryWeight} onChangeText={set('entryWeight')} keyboardType="decimal-pad" placeholder="0.0" />
              </Field>
            ) : (
              <Field label="Fecha de nacimiento">
                <DatePick value={frm.birthDate} onChange={set('birthDate')} />
              </Field>
            )}
          </Grid>
          <Field label="Fecha de entrada">
            <DatePick value={frm.entryDate} onChange={set('entryDate')} />
          </Field>
        </>
      )}
    </Sheet>
  );
}
