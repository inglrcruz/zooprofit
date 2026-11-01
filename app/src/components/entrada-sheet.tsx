import { useState } from 'react';

import { EventFields, missing, toData } from '@/components/event-fields';
import { Btn, DateField, Field, Input, Sheet } from '@/components/ui';
import { eventoDe } from '@/constants/eventos';
import { useLoading } from '@/hooks/use-load';
import { editarEntrada } from '@/stores/registro.store';
import { useSowStore } from '@/stores/sow.store';
import type { Registro } from '@/types/data';

const CAMPOS = eventoDe('entrada').campos;

/** Corrige el evento de entrada de una cerda: fecha, tipo, partos previos, genética y nota. */
export function EntradaSheet({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const sow = useSowStore((s) => s.list.find((x) => (registro.sowId ? x.id === registro.sowId : x.arete === registro.cerdaCodigo)));
  const d = registro.data ?? {};
  const saving = useLoading('registro', 'sow');
  const [fecha, setFecha] = useState(registro.fecha);
  const [nota, setNota] = useState(registro.nota ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({
    tipoEntrada: d.tipoEntrada ?? sow?.tipo ?? '',
    partosPrevios: d.partosPrevios ? String(d.partosPrevios) : '',
    genetica: d.genetica ?? sow?.genetica ?? '',
    fechaNacimiento: d.fechaNacimiento ?? sow?.fechaNacimiento ?? '',
  });

  const save = () => {
    const faltan = missing(CAMPOS, values);
    setErrors(faltan);
    if (faltan.length) return;
    editarEntrada(registro, { fecha, nota, data: toData(CAMPOS, values) }).then(onClose).catch(() => null);
  };

  return (
    <Sheet visible title={`Editar entrada · ID ${registro.cerdaCodigo}`} onClose={onClose} footer={<Btn icon="check" label="Guardar cambios" loading={saving} onPress={save} />}>
      <Field label="Fecha de entrada">
        <DateField value={fecha} onChange={setFecha} futuro />
      </Field>
      <EventFields tipo="entrada" campos={CAMPOS} values={values} onChange={setValues} errors={errors} />
      <Field label="Nota">
        <Input value={nota} onChangeText={setNota} placeholder="Observaciones…" maxLength={2000} />
      </Field>
    </Sheet>
  );
}
