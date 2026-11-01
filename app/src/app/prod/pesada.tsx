import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { back, Btn, Card, DateField, Field, Grow, Input, Note, Options, Row, Screen, Seg, Stepper, T, Top } from '@/components/ui';
import { C } from '@/constants/tokens';
import { engorde } from '@/data/aves';
import { pesoPromedioKg, signed } from '@/data/calc';
import { useLoading } from '@/hooks/use-load';
import { useLotes } from '@/hooks/use-lotes';
import { registrar } from '@/stores/registro.store';
import { num, today } from '@/utilities/miscellaneous';

export default function Pesada() {
  const params = useLocalSearchParams<{ lotId?: string }>();
  const { lots, registros } = useLotes();
  const saving = useLoading('registro');
  const [lotId, setLotId] = useState(params.lotId ?? '');
  const [fecha, setFecha] = useState(today());
  const [animals, setAnimals] = useState(10);
  const [mode, setMode] = useState(0);
  const [unit, setUnit] = useState(0);
  const [peso, setPeso] = useState('');

  const activos = lots.filter((l) => !l.archivado);
  const lot = lots.find((l) => l.id === lotId);
  const e = lot ? engorde(lot, registros) : null;
  const anterior = e && e.pesadas.length > 1 ? e.pesadas[e.pesadas.length - 1][1] : null;
  const prom = pesoPromedioKg(num(peso), animals, mode ? 'promedio' : 'total', unit ? 'lb' : 'kg');
  const line = (label: string, value: string, color?: string) => (
    <Row>
      <Grow><T>{label}</T></Grow>
      <T v="b" size={20} color={color}>{value}</T>
    </Row>
  );

  const save = () =>
    lot &&
    // El registro guarda siempre kilogramos; pesoTotal es el de la muestra pesada.
    registrar({ tipo: 'pesada', lotId: lot.id, fecha, data: { cantidadPesada: animals, pesoTotal: Math.round(prom * animals * 10) / 10 } })
      .then(() => back())
      .catch(() => null);

  return (
    <Screen
      top={<Top title="Pesada" sub={lot ? `${lot.code} · ${e?.activos} activos` : undefined} onBack={back} close />}
      footer={<Btn icon="check" label="Guardar pesada" disabled={!lot || prom <= 0 || animals <= 0} loading={saving} onPress={save} />}>
      {params.lotId ? null : (
        <Field label="Lote">
          {activos.length ? <Options options={activos.map((l) => [l.id, l.code] as const)} value={lotId} onChange={setLotId} /> : <Note tone="w" icon="alert">Crea primero un lote en la pestaña Lotes.</Note>}
        </Field>
      )}
      <Field label="Fecha">
        <DateField value={fecha} onChange={setFecha} />
      </Field>
      <Field label="Animales pesados">
        <Stepper label="animales pesados" value={animals} onChange={setAnimals} />
      </Field>
      <Field label="¿Qué peso tienes?">
        <Seg options={['Total de la muestra', 'Promedio por animal']} value={mode} onChange={setMode} />
      </Field>
      <Row gap={10} align="flex-end">
        <Grow>
          <Field label={mode ? 'Peso promedio' : 'Peso total'}>
            <Input strong value={peso} onChangeText={(v) => setPeso(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="0.0" style={{ height: 64, fontSize: 28 }} />
          </Field>
        </Grow>
        <View style={{ width: 124 }}>
          <Seg options={['kg', 'lb']} value={unit} onChange={setUnit} />
        </View>
      </Row>

      {lot && prom > 0 ? (
        <Card style={{ backgroundColor: C.green2, borderColor: C.green2 }}>
          {line('Peso promedio', `${prom.toFixed(1)} kg`)}
          {lot.entryWeight ? line('Ganancia vs. entrada', `${signed(prom - lot.entryWeight)} kg`, prom >= lot.entryWeight ? C.ok : C.bad) : null}
          {anterior !== null ? line('Desde la pesada anterior', `${signed(prom - anterior)} kg`, prom >= anterior ? C.ok : C.bad) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
