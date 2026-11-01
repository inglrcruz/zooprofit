import { useState } from 'react';

import { Bar, Btn, Card, Chips, Empty, Field, Grid, Grow, Input, Loading, Options, Row, Screen, Sheet, Stepper, T, TabBar, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { fmt } from '@/data/calc';
import { useLoad, useLoading } from '@/hooks/use-load';
import useValidateInputs from '@/hooks/use-validate-inputs';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { useCorralStore, useNaveStore } from '@/stores/nave.store';
import type { Corral, Nave } from '@/types/data';
import { num } from '@/utilities/miscellaneous';

/** Crea una nave, o un corral dentro de la nave abierta, o edita un corral. */
function CorralSheet(props: { visible: boolean; nave: Nave; corral: Corral | null; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <CorralSheetForm key={String(props.visible)} {...props} />;
}

function CorralSheetForm({ visible, nave, corral, onClose }: { visible: boolean; nave: Nave; corral: Corral | null; onClose: () => void }) {
  const lots = useLotStore((s) => s.list).filter((l) => !l.archivado);
  const { create, update, delete: remove } = useCorralStore.getState();
  const loading = useLoading('corral');
  const { inputErrors, validateInputs, setRemoveError } = useValidateInputs();
  const [frm, setFrm] = useState({ numero: corral?.numero ?? '', capacidad: corral?.capacidad ? String(corral.capacidad) : '', largo: corral?.largo ? String(corral.largo) : '', ancho: corral?.ancho ? String(corral.ancho) : '', animales: corral?.animalesActivos ?? 0, lotId: corral?.lotId ?? '' });

  const save = () => {
    if (!validateInputs({ numero: frm.numero })) return;
    const body = { numero: frm.numero.trim(), capacidad: Math.round(num(frm.capacidad)), largo: num(frm.largo), ancho: num(frm.ancho), animalesActivos: frm.animales, lotId: frm.animales ? frm.lotId : '' };
    (corral ? update(corral.id, body) : create({ ...body, naveId: nave.id })).then(onClose).catch(() => null);
  };
  const destroy = () => {
    if (!corral) return;
    onClose();
    useGlobalStore.getState().showConfirm({ title: `Eliminar corral ${corral.numero}`, message: 'Se quita de la nave. Los animales del lote no cambian.', confirmText: 'Eliminar', destructive: true, onConfirm: () => void remove(corral.id).catch(() => null) });
  };

  return (
    <Sheet
      visible={visible}
      title={corral ? `Corral ${corral.numero}` : `Nuevo corral en ${nave.nombre}`}
      onClose={onClose}
      footer={
        <>
          <Btn label={corral ? 'Guardar cambios' : 'Agregar corral'} loading={loading} onPress={save} />
          {corral ? <Btn kind="g" icon="trash" label="Eliminar corral" onPress={destroy} /> : null}
        </>
      }>
      <Grid cols={2}>
        <Field label="Número">
          <Input value={frm.numero} onChangeText={(v) => (setFrm({ ...frm, numero: v }), setRemoveError('numero'))} error={inputErrors.numero} placeholder="Ej: 5" maxLength={20} />
        </Field>
        <Field label="Capacidad" hint="animales">
          <Input value={frm.capacidad} onChangeText={(v) => setFrm({ ...frm, capacidad: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="0" />
        </Field>
        <Field label="Largo (m)">
          <Input value={frm.largo} onChangeText={(v) => setFrm({ ...frm, largo: v })} keyboardType="decimal-pad" placeholder="0.0" />
        </Field>
        <Field label="Ancho (m)">
          <Input value={frm.ancho} onChangeText={(v) => setFrm({ ...frm, ancho: v })} keyboardType="decimal-pad" placeholder="0.0" />
        </Field>
      </Grid>
      <Field label="Animales en el corral">
        <Stepper label="animales en el corral" value={frm.animales} onChange={(n) => setFrm({ ...frm, animales: n })} />
      </Field>
      {frm.animales ? (
        <Field label="Lote al que pertenecen">
          {lots.length ? <Options options={lots.map((l) => [l.id, l.code] as const)} value={frm.lotId} onChange={(v) => setFrm({ ...frm, lotId: v })} /> : <T v="sub">Esta granja no tiene lotes activos.</T>}
        </Field>
      ) : null}
    </Sheet>
  );
}

/** Pasa animales de un corral a otro de la misma nave. */
function MoveSheet({ visible, corrales, onClose }: { visible: boolean; corrales: Corral[]; onClose: () => void }) {
  const loading = useLoading('corral');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [n, setN] = useState(1);
  const origen = corrales.find((c) => c.id === from);
  const destino = corrales.find((c) => c.id === to);
  const ok = origen && destino && from !== to && n > 0 && n <= origen.animalesActivos && (!destino.animalesActivos || !destino.lotId || destino.lotId === origen.lotId);

  const move = async () => {
    if (!origen || !destino) return;
    const { update } = useCorralStore.getState();
    try {
      // Primero entran en el destino: si lo segundo falla, sobra un conteo en vez de perderse animales.
      await update(destino.id, { animalesActivos: destino.animalesActivos + n, lotId: origen.lotId });
      await update(origen.id, { animalesActivos: origen.animalesActivos - n, lotId: origen.animalesActivos - n ? origen.lotId : '' });
      onClose();
    } catch {}
  };
  const label = (c: Corral) => [c.id, `${c.numero} · ${c.animalesActivos}`] as const;

  return (
    <Sheet visible={visible} title="Mover animales" onClose={onClose} footer={<Btn icon="swap" label="Mover" disabled={!ok} loading={loading} onPress={() => void move()} />}>
      <Field label="Desde el corral">
        <Options options={corrales.filter((c) => c.animalesActivos > 0).map(label)} value={from} onChange={setFrom} />
      </Field>
      <Field label="Al corral">
        <Options options={corrales.filter((c) => c.id !== from).map(label)} value={to} onChange={setTo} />
      </Field>
      <Field label="Cantidad">
        <Stepper label="cantidad a mover" value={n} onChange={setN} />
      </Field>
      {origen && n > origen.animalesActivos ? <T v="sub" color={C.bad}>El corral {origen.numero} solo tiene {origen.animalesActivos}.</T> : null}
      {origen && destino && destino.animalesActivos > 0 && destino.lotId && destino.lotId !== origen.lotId ? <T v="sub" color={C.bad}>El corral {destino.numero} tiene animales de otro lote.</T> : null}
    </Sheet>
  );
}

export default function Granja() {
  const rol = useFarmStore((s) => s.rol);
  const naves = useNaveStore((s) => s.list);
  const corrales = useCorralStore((s) => s.list);
  const lots = useLotStore((s) => s.list);
  const refresh = useLoad(useNaveStore, useCorralStore, useLotStore);
  const loading = useLoading('listNave', 'listCorral');
  const savingNave = useLoading('nave');
  const [i, setI] = useState(0);
  const [sheet, setSheet] = useState<{ corral: Corral | null } | null>(null);
  const [moving, setMoving] = useState(false);
  const [newNave, setNewNave] = useState<string | null>(null);
  const write = can.write(rol);

  const en = (naveId: string) => corrales.filter((c) => c.naveId === naveId).sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  const total = (cs: Corral[]) => cs.reduce((n, c) => n + c.animalesActivos, 0);
  const nave = naves[Math.min(i, naves.length - 1)];
  const suyos = nave ? en(nave.id) : [];
  const cap = suyos.reduce((n, c) => n + c.capacidad, 0);
  const lotCode = (id: string) => lots.find((l) => l.id === id)?.code;

  const addNave = () =>
    newNave?.trim() &&
    useNaveStore
      .getState()
      .create({ nombre: newNave.trim(), orden: naves.length })
      .then(() => (setNewNave(null), setI(naves.length)))
      .catch(() => null);
  const removeNave = () =>
    nave &&
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${nave.nombre}`,
      message: `Se eliminan la nave y sus ${suyos.length} corrales. Los lotes y sus animales no cambian.`,
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void useNaveStore.getState().delete(nave.id).then(() => (setI(0), refresh())).catch(() => null),
    });

  return (
    <Screen
      tabs={<TabBar module="prod" active="granja" />}
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title="Granja" sub={`Población actual · ${fmt(total(corrales))} animales`} subAbove right={write ? <Btn small icon="plus" label="Nave" onPress={() => setNewNave('')} /> : null} />}>
      {loading && !naves.length ? <Loading /> : null}
      {!loading && !naves.length ? <Empty icon="grid" title="Aún no hay naves" sub="Crea la primera nave y luego sus corrales para ver dónde está cada lote." /> : null}

      {nave ? (
        <>
          <Chips options={naves.map((n) => `${n.nombre} · ${total(en(n.id))}`)} value={Math.min(i, naves.length - 1)} onChange={setI} />

          <Card gap={8} style={{ padding: 14, paddingHorizontal: 16 }}>
            <Row>
              <Grow><T v="b">{[nave.nombre, nave.tipo].filter(Boolean).join(' · ')}</T></Grow>
              <T v="sub">{cap ? `${total(suyos)} de ${cap} lugares` : `${total(suyos)} animales`}</T>
            </Row>
            {cap ? <Bar pct={(total(suyos) / cap) * 100} /> : null}
          </Card>

          {suyos.length ? (
            <Grid cols={2}>
              {suyos.map((c) => {
                const over = c.capacidad ? c.animalesActivos - c.capacidad : 0;
                const area = c.largo * c.ancho;
                const info = [c.animalesActivos ? lotCode(c.lotId) : 'Vacío', area ? `${Math.round(area)} m²` : ''].filter(Boolean).join(' · ');
                return (
                  <Card key={c.id} gap={6} onPress={write ? () => setSheet({ corral: c }) : undefined} label={`Corral ${c.numero}, ${c.animalesActivos} animales`} style={{ padding: 12, paddingHorizontal: 14, flex: 1, ...(over > 0 ? { borderWidth: 2, borderColor: C.warn } : null) }}>
                    <Row>
                      <Grow><T v="b" size={17}>Corral {c.numero}</T></Grow>
                      <T v="b" color={over > 0 ? C.warn : C.ink}>{c.animalesActivos}</T>
                    </Row>
                    {c.capacidad ? <Bar pct={(c.animalesActivos / c.capacidad) * 100} tone={over > 0 ? 'w' : 'info'} /> : null}
                    <T v="sub" color={over > 0 ? C.warn : C.mute}>{over > 0 ? `Excede por ${over} · ${lotCode(c.lotId) ?? ''}` : info}</T>
                  </Card>
                );
              })}
            </Grid>
          ) : (
            <T v="sub" style={{ textAlign: 'center', paddingVertical: 24 }}>Sin corrales. Agrega los corrales de esta nave.</T>
          )}

          {write ? (
            <>
              <Btn kind="g" icon="plus" label="Agregar corral" onPress={() => setSheet({ corral: null })} />
              {suyos.length > 1 ? <Btn kind="g" icon="swap" label="Mover animales entre corrales" onPress={() => setMoving(true)} /> : null}
              <Btn kind="g" icon="trash" label={`Eliminar ${nave.nombre}`} onPress={removeNave} />
            </>
          ) : null}

          <CorralSheet visible={!!sheet} nave={nave} corral={sheet?.corral ?? null} onClose={() => setSheet(null)} />
          <MoveSheet visible={moving} corrales={suyos} onClose={() => setMoving(false)} />
        </>
      ) : null}

      <Sheet visible={newNave !== null} title="Nueva nave" onClose={() => setNewNave(null)} footer={<Btn label="Crear nave" disabled={!newNave?.trim()} loading={savingNave} onPress={() => void addNave()} />}>
        <Field label="Nombre">
          <Input value={newNave ?? ''} onChangeText={setNewNave} placeholder="Ej: Nave 3" maxLength={60} autoFocus />
        </Field>
      </Sheet>
    </Screen>
  );
}
