import { useState } from 'react';
import { Pressable } from 'react-native';

import { Av, back, Btn, Field, Grid, Input, Note, Row, Screen, Seg, T, Top } from '@/components/ui';
import { MODULE_TYPES } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';

export default function NuevoModulo() {
  const create = useFarmStore((s) => s.create);
  const loading = useLoading('farm');
  const [name, setName] = useState('');
  const [type, setType] = useState(0);
  const [mode, setMode] = useState(0);
  const t = MODULE_TYPES[type];

  const submit = () =>
    create({ name: name.trim(), species: t.species, type: t.types[mode] })
      .then(() => back())
      .catch(() => null);

  return (
    <Screen
      top={<Top title="Nueva granja" onBack={back} close />}
      footer={
        <Row gap={10}>
          <Btn kind="g" label="Cancelar" flex={1} onPress={back} />
          <Btn label="Crear granja" flex={1.4} disabled={!name.trim()} loading={loading} onPress={submit} />
        </Row>
      }>
      <Field label="Nombre">
        <Input value={name} onChangeText={setName} placeholder="Ej: Granja La Loma" maxLength={120} />
      </Field>

      <Field label="Tipo">
        <Grid cols={2}>
          {MODULE_TYPES.map((m, i) => {
            const on = i === type;
            return (
              <Pressable
                key={m.label}
                onPress={() => {
                  setType(i);
                  setMode(0);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? C.green : C.line,
                  backgroundColor: on ? C.green2 : C.card,
                }}>
                <Av icon={m.icon} tone={on ? 'info' : 'n'} />
                <T v="b">{m.label}</T>
              </Pressable>
            );
          })}
        </Grid>
      </Field>

      {t.modes ? (
        <Field label="Tipo de producción">
          <Seg options={t.modes} value={mode} onChange={setMode} />
        </Field>
      ) : null}

      {t.note && (!t.modes || mode === 0) ? <Note>{t.note}</Note> : null}
    </Screen>
  );
}
