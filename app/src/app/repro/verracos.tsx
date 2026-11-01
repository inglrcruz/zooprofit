import { useMemo, useState } from 'react';

import { Icon } from '@/components/icon';
import { Av, back, Bar, Btn, Card, Col, Empty, Field, Grid, Grow, Input, Loading, Row, Screen, Sheet, Stat, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { C, TONE } from '@/constants/tokens';
import { verracos } from '@/data/repro';
import { useLoad, useLoading } from '@/hooks/use-load';
import useValidateInputs from '@/hooks/use-validate-inputs';
import { useBoarStore } from '@/stores/boar.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { useRegistroStore } from '@/stores/registro.store';
import type { Boar } from '@/types/data';
import { today, viewDate } from '@/utilities/miscellaneous';

function BoarSheet(props: { visible: boolean; boar: Boar | null; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <BoarSheetForm key={String(props.visible)} {...props} />;
}

function BoarSheetForm({ visible, boar, onClose }: { visible: boolean; boar: Boar | null; onClose: () => void }) {
  const { create, update, delete: remove } = useBoarStore.getState();
  const loading = useLoading('boar');
  const { inputErrors, validateInputs, setRemoveError } = useValidateInputs();
  const [frm, setFrm] = useState({ codigo: boar?.codigo ?? '', nombre: boar?.nombre ?? '', genetica: boar?.genetica ?? '' });
  const set = (k: keyof typeof frm) => (v: string) => {
    setFrm({ ...frm, [k]: v });
    setRemoveError(k);
  };

  const save = () => {
    if (!validateInputs({ codigo: frm.codigo })) return;
    const body = { codigo: frm.codigo.trim().toUpperCase(), nombre: frm.nombre.trim(), genetica: frm.genetica.trim() };
    (boar ? update(boar.id, body) : create({ ...body, fechaEntrada: today(), activo: true })).then(onClose).catch(() => null);
  };
  const destroy = () => {
    if (!boar) return;
    onClose();
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${boar.codigo}`,
      message: 'Sus inseminaciones ya registradas se conservan. Si solo dejó de usarse, márcalo como inactivo.',
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void remove(boar.id).catch(() => null),
    });
  };

  return (
    <Sheet
      visible={visible}
      title={boar ? `Editar ${boar.codigo}` : 'Nuevo verraco'}
      onClose={onClose}
      footer={
        <>
          <Btn label={boar ? 'Guardar cambios' : 'Agregar verraco'} loading={loading} onPress={save} />
          {boar ? (
            <Row gap={10}>
              <Btn kind="g" label={boar.activo ? 'Marcar inactivo' : 'Reactivar'} flex={1} onPress={() => void update(boar.id, { activo: !boar.activo }).then(onClose).catch(() => null)} />
              <Btn kind="g" icon="trash" label="Eliminar" flex={1} onPress={destroy} />
            </Row>
          ) : null}
        </>
      }>
      <Grid cols={2}>
        <Field label="Código">
          <Input value={frm.codigo} onChangeText={set('codigo')} error={inputErrors.codigo} placeholder="Ej: VR-02" autoCapitalize="characters" maxLength={40} />
        </Field>
        <Field label="Nombre" hint="opcional">
          <Input value={frm.nombre} onChangeText={set('nombre')} placeholder="Ej: Titan" maxLength={60} />
        </Field>
      </Grid>
      <Field label="Genética" hint="opcional">
        <Input value={frm.genetica} onChangeText={set('genetica')} placeholder="Ej: PIC 408" maxLength={40} />
      </Field>
    </Sheet>
  );
}

export default function Verracos() {
  const rol = useFarmStore((s) => s.rol);
  const boars = useBoarStore((s) => s.list);
  const registros = useRegistroStore((s) => s.list);
  const refresh = useLoad(useBoarStore, useRegistroStore);
  const loading = useLoading('listBoar', 'listRegistro');
  const [sheet, setSheet] = useState<{ boar: Boar | null } | null>(null);
  const stats = useMemo(() => verracos(registros), [registros]);
  const write = can.write(rol);

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title="Verracos" sub={`${boars.filter((b) => b.activo).length} machos reproductores`} onBack={() => back('/repro/cerdas')} right={write ? <Btn small icon="plus" label="Agregar" onPress={() => setSheet({ boar: null })} /> : null} />}>
      {loading && !boars.length ? <Loading /> : null}
      {!loading && !boars.length ? <Empty icon="tag" title="Aún no hay verracos" sub="Agrégalos para elegirlos al registrar una inseminación." /> : null}

      {boars.map((b) => {
        const { ins, partos } = stats.get(b.codigo) ?? { ins: 0, partos: 0 };
        const rate = ins ? Math.round((partos / ins) * 100) : null;
        const tone = rate !== null && rate >= 80 ? 'k' : 'w';
        return (
          <Card key={b.id} gap={12} onPress={write ? () => setSheet({ boar: b }) : undefined} label={b.codigo}>
            <Row>
              <Av text={b.codigo.replace(/\D/g, '').slice(-2) || b.codigo.slice(0, 2)} tone={!b.activo ? 'n' : tone === 'k' ? 'info' : 'w'} />
              <Grow>
                <T v="h2">{b.nombre ? `${b.codigo} · ${b.nombre}` : b.codigo}</T>
                <T v="sub">{[b.genetica, b.fechaEntrada ? `desde ${viewDate(b.fechaEntrada)}` : ''].filter(Boolean).join(' · ') || 'Sin datos'}</T>
              </Grow>
              {b.activo ? null : <Tag tone="n">Inactivo</Tag>}
              {write ? <Icon name="next" color={C.mute} /> : null}
            </Row>
            {rate !== null ? (
              <Col gap={6}>
                <Row>
                  <Grow><T v="sub">Tasa de concepción</T></Grow>
                  <T v="b" color={TONE[tone][1]}>{rate}%</T>
                </Row>
                <Bar pct={rate} tone={tone} />
              </Col>
            ) : null}
            <Grid cols={2}>
              <Stat value={String(ins)} label="Inseminaciones" />
              <Stat value={String(partos)} label="Partos" />
            </Grid>
          </Card>
        );
      })}
      {boars.length ? <T v="sub">La tasa se calcula con los partos sobre inseminaciones de cada macho.</T> : null}

      <BoarSheet visible={!!sheet} boar={sheet?.boar ?? null} onClose={() => setSheet(null)} />
    </Screen>
  );
}
