import { useState } from 'react';

import { LotChips } from '@/components/aves/lot-chips';
import { Av, back, Bar, Btn, Card, Chips, Col, DateField, Empty, Field, Grid, Grow, Input, Li, List, Loading, Note, Options, Row, Screen, Sheet, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import type { Tone } from '@/constants/tokens';
import { useAves } from '@/hooks/use-aves';
import { useLoad, useLoading } from '@/hooks/use-load';
import useValidateInputs from '@/hooks/use-validate-inputs';
import { useGlobalStore } from '@/stores/global.store';
import { useProtocolStore } from '@/stores/protocol.store';
import { registrar } from '@/stores/registro.store';
import type { Protocol } from '@/types/data';
import { addDays, diffDays, today, viewDate } from '@/utilities/miscellaneous';

const CATEGORIAS: readonly (readonly [string, string, Tone])[] = [['Antibiótico', 'Antibiótico', 'w'], ['Vacuna', 'Vacuna', 'info'], ['Vitamina', 'Vitamina', 'k'], ['Desparasitante', 'Desparasitante', 'n']];
const VIAS = [['En agua', 'En agua'], ['En alimento', 'En alimento'], ['Inyectada', 'Inyectada'], ['Aspersión', 'Aspersión']] as const;

function ProtocolSheet(props: { visible: boolean; lotId: string; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <ProtocolSheetForm key={String(props.visible)} {...props} />;
}

function ProtocolSheetForm({ visible, lotId, onClose }: { visible: boolean; lotId: string; onClose: () => void }) {
  const loading = useLoading('protocol');
  const { inputErrors, validateInputs, setRemoveError } = useValidateInputs();
  const [frm, setFrm] = useState({ nombre: '', medicamento: '', categoria: 'Antibiótico', via: 'En agua', dosis: '', fechaInicio: today(), duracion: '5', retiro: '0' });
  const set = (k: keyof typeof frm) => (v: string) => {
    setFrm({ ...frm, [k]: v });
    setRemoveError(k);
  };
  const save = () => {
    if (!validateInputs({ nombre: frm.nombre, duracion: Number(frm.duracion) })) return;
    useProtocolStore
      .getState()
      .create({ lotId, nombre: frm.nombre.trim(), medicamento: frm.medicamento.trim(), categoria: frm.categoria, via: frm.via, dosis: frm.dosis.trim(), fechaInicio: frm.fechaInicio, duracionDias: Number(frm.duracion), retiroDias: Number(frm.retiro) || 0, activo: true })
      .then(onClose)
      .catch(() => null);
  };
  return (
    <Sheet visible={visible} title="Nuevo protocolo" onClose={onClose} footer={<Btn label="Crear protocolo" loading={loading} onPress={save} />}>
      <Field label="Nombre">
        <Input value={frm.nombre} onChangeText={set('nombre')} error={inputErrors.nombre} placeholder="Ej: Tratamiento respiratorio" maxLength={120} />
      </Field>
      <Field label="Medicamento" hint="opcional">
        <Input value={frm.medicamento} onChangeText={set('medicamento')} placeholder="Ej: Enrofloxacina 10%" maxLength={120} />
      </Field>
      <Field label="Categoría">
        <Options options={CATEGORIAS.map(([v, l]) => [v, l] as const)} value={frm.categoria} onChange={set('categoria')} />
      </Field>
      <Field label="Vía">
        <Options options={VIAS} value={frm.via} onChange={set('via')} />
      </Field>
      <Field label="Dosis" hint="opcional">
        <Input value={frm.dosis} onChangeText={set('dosis')} placeholder="Ej: 1 ml / L de agua" maxLength={60} />
      </Field>
      <Field label="Empieza">
        <DateField value={frm.fechaInicio} onChange={set('fechaInicio')} />
      </Field>
      <Grid cols={2}>
        <Field label="Duración (días)">
          <Input value={frm.duracion} onChangeText={(v) => set('duracion')(v.replace(/\D/g, ''))} error={inputErrors.duracion} keyboardType="number-pad" />
        </Field>
        <Field label="Retiro (días)">
          <Input value={frm.retiro} onChangeText={(v) => set('retiro')(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </Field>
      </Grid>
    </Sheet>
  );
}

export default function Protocolos() {
  const { rol, lots, lot, setLot, regs } = useAves();
  const all = useProtocolStore((s) => s.list);
  const refresh = useLoad(useProtocolStore);
  const loading = useLoading('listProtocol');
  const saving = useLoading('registro');
  const [tab, setTab] = useState(0);
  const [creating, setCreating] = useState(false);
  const hoy = today();
  const write = can.write(rol);

  const suyos = all.filter((p) => p.lotId === lot?.id);
  const fin = (p: Protocol) => addDays(p.fechaInicio, Math.max(1, p.duracionDias) - 1);
  const enCurso = (p: Protocol) => p.activo && fin(p) >= hoy;
  const activos = suyos.filter(enCurso);
  const hechos = suyos.filter((p) => !enCurso(p));
  const dosisHoy = (p: Protocol) => regs.some((r) => r.tipo === 'medicacion' && r.fecha === hoy && r.data?.protocolId === p.id);
  const tone = (p: Protocol) => CATEGORIAS.find((c) => c[0] === p.categoria)?.[2] ?? 'n';

  const dose = (p: Protocol) =>
    void registrar({ tipo: 'medicacion', lotId: p.lotId, fecha: hoy, data: { nombreMedicamento: p.medicamento || p.nombre, dosis: p.dosis, via: p.via, protocolId: p.id } }).catch(() => null);
  const remove = (p: Protocol) =>
    useGlobalStore.getState().showConfirm({ title: `Eliminar ${p.nombre}`, message: 'Las dosis ya registradas se conservan en la actividad del lote.', confirmText: 'Eliminar', destructive: true, onConfirm: () => void useProtocolStore.getState().delete(p.id).catch(() => null) });

  const done = hechos.length ? (
    <List>
      {hechos.map((p) => (
        <Li key={p.id} left={<Av icon="check" tone="k" />} title={p.nombre} sub={[p.categoria, p.via, viewDate(p.fechaInicio)].filter(Boolean).join(' · ')} chevron={false} onPress={write ? () => remove(p) : undefined} />
      ))}
    </List>
  ) : (
    <T v="sub">Aún no hay protocolos completados.</T>
  );

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title="Protocolos" sub={lot?.code} onBack={() => back('/aves')} right={write && lot ? <Btn small icon="plus" label="Nuevo" onPress={() => setCreating(true)} /> : null} />}>
      <LotChips lots={lots} lot={lot} onChange={setLot} />
      <Chips options={[`Activos · ${activos.length}`, 'Completados']} value={tab} onChange={setTab} />
      {loading && !all.length ? <Loading /> : null}

      {tab === 0 ? (
        <>
          {!activos.length && !loading ? <Empty icon="flask" title="Sin protocolos activos" sub={lot ? 'Crea uno para llevar las dosis y el período de retiro.' : 'Crea primero un lote de aves.'} /> : null}
          {activos.map((p) => {
            const dia = Math.min(p.duracionDias, Math.max(0, diffDays(p.fechaInicio, hoy) + 1));
            const retiroFin = addDays(fin(p), p.retiroDias);
            return (
              <Card key={p.id} gap={12}>
                <Row>
                  <Grow>
                    <T v="h2">{p.nombre}</T>
                    <T v="sub">{p.medicamento}</T>
                  </Grow>
                  {p.categoria ? <Tag tone={tone(p)}>{p.categoria}</Tag> : null}
                </Row>
                <Col gap={6}>
                  <Row>
                    <Grow><T v="b">{dia ? `Día ${dia} de ${p.duracionDias}` : `Empieza el ${viewDate(p.fechaInicio)}`}</T></Grow>
                    <T v="sub">{viewDate(p.fechaInicio)} – {viewDate(fin(p))}</T>
                  </Row>
                  <Bar pct={(dia / p.duracionDias) * 100} />
                </Col>
                <Grid cols={2}>
                  <Col gap={0}>
                    <T v="sub">Vía</T>
                    <T v="b">{p.via || '—'}</T>
                  </Col>
                  <Col gap={0}>
                    <T v="sub">Dosis</T>
                    <T v="b">{p.dosis || '—'}</T>
                  </Col>
                </Grid>
                {p.retiroDias ? <Note tone="w" icon="alert">Retiro de {p.retiroDias} días: no vender huevos hasta el {viewDate(retiroFin)}</Note> : null}
                {dosisHoy(p) ? <T v="sub">Dosis de hoy marcada</T> : write && dia ? <Btn small kind="s" icon="check" label="Marcar la dosis de hoy" loading={saving} onPress={() => dose(p)} /> : null}
                {write ? (
                  <Row gap={10}>
                    <Btn small kind="g" label="Terminar" flex={1} onPress={() => void useProtocolStore.getState().update(p.id, { activo: false }).catch(() => null)} />
                    <Btn small kind="g" icon="trash" label="Eliminar" flex={1} onPress={() => remove(p)} />
                  </Row>
                ) : null}
              </Card>
            );
          })}
          <T v="cap">Completado reciente</T>
          {done}
        </>
      ) : (
        done
      )}

      {lot ? <ProtocolSheet visible={creating} lotId={lot.id} onClose={() => setCreating(false)} /> : null}
    </Screen>
  );
}
