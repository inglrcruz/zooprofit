import { useMemo } from 'react';
import { View } from 'react-native';

import { Card, Chip, Col, DatePick, Field, Grid, Input, Options, Row, StepRow, T } from '@/components/ui';
import { C } from '@/constants/tokens';
import type { Campo } from '@/constants/eventos';
import { useBoarStore } from '@/stores/boar.store';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { useRegistroStore } from '@/stores/registro.store';
import { useSowStore } from '@/stores/sow.store';
import { normalizeText, num } from '@/utilities/miscellaneous';

type Values = Record<string, string>;

/** Los pesos se escriben en una casilla por lechón; en el formulario viajan unidos por "|". */
const SEP = '|';
const MAX_PESOS = 40;
const OPCIONES = 12;

/** ¿Se pide este campo con lo que ya se eligió en el formulario? */
const pedido = (c: Campo, values: Values) => !c.si || values[c.si[0]] === c.si[1];

const aPesos = (c: Campo, values: Values) =>
  (values[c.key] ?? '').split(SEP).slice(0, Math.min(num(values[c.cuantos ?? '']), MAX_PESOS)).map(num).filter((p) => p > 0);

/** Convierte lo escrito en el formulario al `data` del registro: números como números, vacíos fuera. */
export const toData = (campos: Campo[], values: Values) =>
  Object.fromEntries(
    campos
      .filter((c) => pedido(c, values))
      .map((c) => {
        if (c.kind === 'pesos') {
          const pesos = aPesos(c, values);
          return [c.key, pesos.length ? pesos : undefined] as const;
        }
        return [c.key, c.kind === 'int' || c.kind === 'dec' ? (values[c.key] ? Number(values[c.key].replace(',', '.')) : undefined) : values[c.key]?.trim() || undefined] as const;
      })
      .filter(([, v]) => v !== undefined && !Number.isNaN(v)),
  );

/** Campos obligatorios que faltan. */
export const missing = (campos: Campo[], values: Values) => campos.filter((c) => pedido(c, values) && c.required && !values[c.key]?.trim()).map((c) => c.key);

/** Sin vacíos ni repetidos (sin distinguir mayúsculas ni acentos), conservando el orden. */
const unicos = (list: unknown[]) => {
  const vistos = new Set<string>();
  return list
    .map((v) => String(v ?? '').trim())
    .filter((v) => {
      const k = normalizeText(v);
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
};

/** Una casilla por lechón, con el total de lo pesado. */
function Pesos({ c, values, set }: { c: Campo; values: Values; set: (key: string, v: string) => void }) {
  const cuantos = Math.min(num(values[c.cuantos ?? '']), MAX_PESOS);
  if (!cuantos) return <T v="sub">Indica primero cuántos lechones son.</T>;
  const casillas = (values[c.key] ?? '').split(SEP);
  const pesos = aPesos(c, values);
  const total = pesos.reduce((a, p) => a + p, 0);
  return (
    <Col gap={8}>
      <Grid cols={4} gap={8}>
        {Array.from({ length: cuantos }, (_, i) => (
          <Col key={i} gap={2}>
            <T v="sub" size={12}>N.º {i + 1}</T>
            <Input
              value={casillas[i] ?? ''}
              onChangeText={(v) => {
                const next = Array.from({ length: cuantos }, (_x, j) => casillas[j] ?? '');
                next[i] = v.replace(/[^\d.,]/g, '');
                set(c.key, next.join(SEP));
              }}
              accessibilityLabel={`Peso del lechón ${i + 1}`}
              keyboardType="decimal-pad"
              placeholder="0.0"
              style={{ paddingHorizontal: 8, textAlign: 'center' }}
            />
          </Col>
        ))}
      </Grid>
      {pesos.length ? <T v="sub">{pesos.length} de {cuantos} pesados · total {total.toFixed(2)} kg · promedio {(total / pesos.length).toFixed(2)} kg</T> : null}
    </Col>
  );
}

/** Los campos propios de un tipo de evento, según su definición en constants/eventos. */
export function EventFields({ tipo, campos, values, onChange, errors = [] }: { tipo?: string; campos: Campo[]; values: Values; onChange: (v: Values) => void; errors?: string[] }) {
  const boars = useBoarStore((s) => s.list).filter((b) => b.activo);
  const semen = useFarmStore((s) => s.current?.config?.catalogos?.porcino?.catSemen) ?? [];
  const tecnicos = useFarmStore((s) => s.current?.config?.catalogos?.porcino?.catTecnicos) ?? [];
  const lots = useLotStore((s) => s.list).filter((l) => !l.archivado);
  const sows = useSowStore((s) => s.list);
  const registros = useRegistroStore((s) => s.list);
  // Lo escrito antes queda en los registros: de ahí salen las opciones, también sin conexión y para cualquier rol.
  const delTipo = useMemo(() => registros.filter((r) => r.tipo === tipo).sort((a, b) => b.fecha.localeCompare(a.fecha)), [registros, tipo]);
  const recordados = (key: string) => delTipo.map((r) => r.data?.[key]);
  const set = (key: string, v: string) => onChange({ ...values, [key]: v });

  const field = (c: Campo) => {
    const value = values[c.key] ?? '';
    const text = (extra?: object) => <Input value={value} onChangeText={(v) => set(c.key, v)} error={errors.includes(c.key)} placeholder={c.placeholder} {...extra} />;
    // Al escribir quedan las opciones que coinciden.
    const quick = (options: unknown[]) => {
      const buscado = normalizeText(value);
      const shown = unicos(options).filter((o) => normalizeText(o).includes(buscado)).slice(0, OPCIONES);
      return shown.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {shown.map((o) => (
            <Chip key={o} label={o} on={o === value} onPress={() => set(c.key, o === value ? '' : o)} />
          ))}
        </Row>
      ) : null;
    };
    return (
      <Field key={c.key} label={c.label}>
        {c.kind === 'choice' ? <Options options={c.options ?? []} value={value} onChange={(v) => set(c.key, v)} /> : null}
        {c.kind === 'lot' ? <Options options={lots.map((l) => [l.id, l.code] as const)} value={value} onChange={(v) => set(c.key, v)} /> : null}
        {c.kind === 'verraco' ? (
          <>
            {quick([...boars.map((b) => (b.nombre ? `${b.codigo} · ${b.nombre}` : b.codigo)), ...semen, ...recordados(c.key)])}
            {text({ placeholder: 'Otro verraco o dosis…' })}
          </>
        ) : null}
        {c.kind === 'text' ? (
          <>
            {c.recuerda ? quick([...(c.key === 'tecnico' ? tecnicos : []), ...recordados(c.key), ...(c.key === 'genetica' ? sows.map((s) => s.genetica) : [])]) : null}
            {text(c.key === 'madre' ? { autoCapitalize: 'characters', autoCorrect: false, maxLength: 40 } : undefined)}
          </>
        ) : null}
        {c.kind === 'dec' ? text({ keyboardType: 'decimal-pad', onChangeText: (v: string) => set(c.key, v.replace(/[^\d.,]/g, '')) }) : null}
        {c.kind === 'fecha' ? <DatePick value={value} onChange={(v) => set(c.key, v)} /> : null}
        {c.kind === 'pesos' ? <Pesos c={c} values={values} set={set} /> : null}
      </Field>
    );
  };

  // Las cantidades seguidas se cuentan juntas, en una tarjeta de más y menos.
  const groups: Campo[][] = [];
  for (const c of campos.filter((x) => pedido(x, values))) {
    const last = groups[groups.length - 1];
    if (c.kind === 'int' && last?.[0].kind === 'int') last.push(c);
    else groups.push([c]);
  }

  return (
    <>
      {groups.map((g) =>
        g[0].kind === 'int' ? (
          <Card key={g[0].key} gap={0} style={{ paddingVertical: 4, borderRadius: 22, borderColor: g.some((c) => errors.includes(c.key)) ? C.bad : C.line }}>
            {g.map((c, i) => (
              <View key={c.key} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : null}>
                <StepRow label={c.label} value={Number(values[c.key]) || 0} onChange={(n) => set(c.key, n ? String(n) : '')} />
              </View>
            ))}
          </Card>
        ) : (
          field(g[0])
        ),
      )}
    </>
  );
}
