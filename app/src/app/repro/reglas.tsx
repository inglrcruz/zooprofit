import { useState } from 'react';
import { Switch } from 'react-native';

import { back, Btn, Field, Input, Li, List, Note, Row, Screen, Seg, Sheet, T, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { mergeReglas, REGLAS_TOGGLE_LABELS, REGLAS_UMBRAL_LABELS, type ReglasReproduccion } from '@/data/reglas';
import { useLoading } from '@/hooks/use-load';
import { METAS } from '@/hooks/use-repro';
import { useFarmStore } from '@/stores/farm.store';
import { num } from '@/utilities/miscellaneous';

/** La semana empieza en L…D; el API guarda 0 = domingo … 6 = sábado. */
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const GOALS: { key: string; label: string; unit: string }[] = [
  { key: 'tasaParto', label: 'Concepción efectiva', unit: '%' },
  { key: 'promNV', label: 'Prom. NV / parto', unit: '' },
  { key: 'mortLact', label: '% Mort. lactantes (máx.)', unit: '%' },
  { key: 'edadDestete', label: 'Edad de destete', unit: 'días' },
];

type Editing = { title: string; unit: string; value: string; save: (n: number) => Promise<unknown> };

export default function Reglas() {
  const farm = useFarmStore((s) => s.current);
  const rol = useFarmStore((s) => s.rol);
  const update = useFarmStore((s) => s.update);
  const saving = useLoading('farm');
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);

  const owner = can.members(rol);
  const reglas = mergeReglas(farm?.config?.reglas as Partial<ReglasReproduccion>);
  const kpi = farm?.config?.kpiConfig ?? {};
  const metas: Record<string, number> = { ...METAS, ...Object.fromEntries(Object.entries(kpi.targets ?? {}).filter(([, v]) => v > 0)), edadDestete: kpi.edadDestete || 21 };
  const diaInicio = farm?.config?.weekConfig?.diaInicio ?? 1;

  // El API reemplaza cada clave de primer nivel de config: se envía completa.
  const setRegla = (key: keyof ReglasReproduccion, value: boolean | number) => update({ config: { reglas: { ...reglas, [key]: value } } }).catch(() => null);
  const setMeta = (key: string, value: number) =>
    update({ config: { kpiConfig: key === 'edadDestete' ? { ...kpi, edadDestete: value } : { ...kpi, targets: { ...kpi.targets, [key]: value } } } }).catch(() => null);

  const values = (items: { key: string; label: string; unit: string; value: number; save: (n: number) => Promise<unknown> }[]) => (
    <List>
      {items.map((g) => (
        <Li
          key={g.key}
          title={<T>{g.label}</T>}
          right={<T v="b">{`${g.value}${g.unit === '%' ? '%' : g.unit ? ` ${g.unit}` : ''}`}</T>}
          onPress={owner ? () => setEditing({ title: g.label, unit: g.unit, value: String(g.value), save: g.save }) : undefined}
        />
      ))}
    </List>
  );

  return (
    <Screen top={<Top title="Metas y reglas" sub={farm?.name} onBack={back} />}>
      <Seg options={['Metas', 'Reglas', 'Umbrales']} value={tab} onChange={setTab} />
      {owner ? null : <Note>Solo el propietario de la granja puede cambiar estos ajustes.</Note>}

      {tab === 0 ? (
        <>
          <Field label="La semana productiva inicia el">
            <Seg options={DAYS} value={(diaInicio + 6) % 7} onChange={(i) => owner && void update({ config: { weekConfig: { diaInicio: (i + 1) % 7 } } }).catch(() => null)} />
          </Field>
          {values(GOALS.map((g) => ({ ...g, value: metas[g.key], save: (n) => setMeta(g.key, n) })))}
        </>
      ) : null}

      {tab === 1 ? (
        <>
          <List>
            {REGLAS_TOGGLE_LABELS.map((r) => (
              <Li
                key={r.key}
                title={<T>{r.label}</T>}
                sub={r.help}
                right={
                  <Switch
                    value={!!reglas[r.key]}
                    disabled={!owner || saving}
                    onValueChange={(v) => void setRegla(r.key, v)}
                    accessibilityLabel={r.label}
                    trackColor={{ true: C.green, false: C.line2 }}
                    thumbColor="#fff"
                  />
                }
              />
            ))}
          </List>
          <T v="sub">Al guardar un evento se validan la lactancia antes de inseminar, la fecha de entrada, el verraco y la causa de muerte obligatorios, y los umbrales. Las demás reglas quedan guardadas como preferencia de la granja.</T>
        </>
      ) : null}

      {tab === 2 ? values(REGLAS_UMBRAL_LABELS.map((u) => ({ key: u.key, label: u.label, unit: u.unidad, value: reglas[u.key] as number, save: (n) => setRegla(u.key, n) }))) : null}

      <Sheet
        visible={!!editing}
        title={editing?.title ?? ''}
        onClose={() => setEditing(null)}
        footer={<Btn label="Guardar" loading={saving} disabled={!editing?.value.trim()} onPress={() => editing && void editing.save(num(editing.value)).then(() => setEditing(null))} />}>
        <Row gap={10}>
          <Input strong value={editing?.value ?? ''} onChangeText={(v) => editing && setEditing({ ...editing, value: v.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" autoFocus style={{ flex: 1 }} />
          {editing?.unit ? <T v="b">{editing.unit}</T> : null}
        </Row>
      </Sheet>
    </Screen>
  );
}
