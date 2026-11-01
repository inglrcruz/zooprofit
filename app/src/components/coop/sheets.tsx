import { useState } from 'react';

import { Btn, Field, Grid, Input, Note, Options, Seg, Sheet, T } from '@/components/ui';
import { C } from '@/constants/tokens';
import { fmt } from '@/data/calc';
import { useLoading } from '@/hooks/use-load';
import { cuotaDe, moverCapital, pagarCuota, useAportanteStore, usePrestamoStore } from '@/stores/coop.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import type { Aportante, Prestamo } from '@/types/data';
import { num, today } from '@/utilities/miscellaneous';

export const rd = (n: number) => `RD$ ${fmt(Math.round(n))}`;
const money = (v: string) => v.replace(/[^\d.,]/g, '');

/** Cuenta de la granja a la que se enlaza una fila, para que su dueño la vea en su portal. */
function Cuenta({ rol, value, onChange }: { rol: 'aportante' | 'prestatario'; value: string; onChange: (id: string) => void }) {
  const members = useFarmStore((s) => s.members).filter((m) => m.rol === rol);
  if (!members.length) return <T v="sub">Para que vea su portal, invítalo desde Equipo con el rol {rol} y enlázalo aquí.</T>;
  return (
    <Field label="Cuenta con acceso al portal" hint="opcional">
      <Options options={members.map((m) => [m.userId, m.name] as const)} value={value} onChange={(v) => onChange(v === value ? '' : v)} />
    </Field>
  );
}

/** Alta de un aportante (con su capital inicial) o de un préstamo. */
export function NuevoSheet(props: { visible: boolean; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <NuevoSheetForm key={String(props.visible)} {...props} />;
}

function NuevoSheetForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const loading = useLoading('aportante', 'prestamo', 'coopMove');
  const [kind, setKind] = useState(0);
  const [frm, setFrm] = useState({ nombre: '', monto: '', tasa: '10', cuotas: '4', userId: '' });
  const set = (k: keyof typeof frm) => (v: string) => setFrm({ ...frm, [k]: v });
  const monto = num(frm.monto);
  const cuotas = Math.round(num(frm.cuotas));
  const cuota = cuotaDe({ monto, tasa: num(frm.tasa), cuotas });
  const ok = frm.nombre.trim() && (kind === 0 ? monto >= 0 : monto > 0 && cuotas > 0);

  const save = async () => {
    try {
      if (kind === 0) {
        const a = await useAportanteStore.getState().create({ nombre: frm.nombre.trim(), capital: 0, userId: frm.userId });
        if (monto > 0) await moverCapital(a, monto, 'Aporte inicial');
      } else {
        await usePrestamoStore.getState().create({ nombre: frm.nombre.trim(), monto, tasa: num(frm.tasa), cuotas, pagadas: 0, fecha: today(), userId: frm.userId });
      }
      onClose();
    } catch {}
  };

  return (
    <Sheet visible={visible} title="Nuevo" onClose={onClose} footer={<Btn label={kind ? 'Crear préstamo' : 'Agregar socio'} disabled={!ok} loading={loading} onPress={() => void save()} />}>
      <Seg options={['Socio', 'Préstamo']} value={kind} onChange={setKind} />
      <Field label={kind ? 'A quién se le presta' : 'Nombre'}>
        <Input value={frm.nombre} onChangeText={set('nombre')} placeholder="Nombre y apellido" maxLength={120} />
      </Field>
      <Field label={kind ? 'Monto prestado (RD$)' : 'Capital inicial (RD$)'}>
        <Input strong value={frm.monto} onChangeText={(v) => set('monto')(money(v))} keyboardType="decimal-pad" placeholder="0" />
      </Field>
      {kind ? (
        <>
          <Grid cols={2}>
            <Field label="Tasa quincenal (%)">
              <Input value={frm.tasa} onChangeText={(v) => set('tasa')(money(v))} keyboardType="decimal-pad" />
            </Field>
            <Field label="N.º de cuotas">
              <Input value={frm.cuotas} onChangeText={(v) => set('cuotas')(v.replace(/\D/g, ''))} keyboardType="number-pad" />
            </Field>
          </Grid>
          {monto > 0 && cuotas > 0 ? <Note icon="coin">Cuota quincenal de {rd(cuota.total)}: {rd(cuota.capital)} de capital + {rd(cuota.interes)} de interés. Total a pagar {rd(cuota.total * cuotas)}.</Note> : null}
        </>
      ) : null}
      <Cuenta rol={kind ? 'prestatario' : 'aportante'} value={frm.userId} onChange={set('userId')} />
    </Sheet>
  );
}

/** Aporte o retiro de capital de un aportante. */
export function AportanteSheet(props: { aportante: Aportante | null; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <AportanteSheetForm key={props.aportante?.id ?? ''} {...props} />;
}

function AportanteSheetForm({ aportante, onClose }: { aportante: Aportante | null; onClose: () => void }) {
  const loading = useLoading('aportante', 'coopMove');
  const [kind, setKind] = useState(0);
  const [monto, setMonto] = useState('');
  const [userId, setUserId] = useState(aportante?.userId ?? '');
  const n = num(monto);
  const falta = !!aportante && kind === 1 && n > aportante.capital;

  const save = () => aportante && moverCapital(aportante, kind ? -n : n).then(onClose).catch(() => null);
  const link = (id: string) => {
    setUserId(id);
    if (aportante) void useAportanteStore.getState().update(aportante.id, { userId: id }).catch(() => null);
  };
  const remove = () => {
    if (!aportante) return;
    onClose();
    useGlobalStore.getState().showConfirm({
      title: `Eliminar a ${aportante.nombre}`,
      message: 'Se quita de la lista de socios. Sus movimientos ya registrados se conservan en el historial.',
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void useAportanteStore.getState().delete(aportante.id).catch(() => null),
    });
  };

  return (
    <Sheet
      visible={!!aportante}
      title={aportante?.nombre ?? ''}
      onClose={onClose}
      footer={
        <>
          <Btn label={kind ? 'Registrar retiro' : 'Registrar aporte'} disabled={n <= 0 || falta} loading={loading} onPress={() => void save()} />
          <Btn kind="g" icon="trash" label="Eliminar socio" onPress={remove} />
        </>
      }>
      <T v="sub">Capital actual: {rd(aportante?.capital ?? 0)}</T>
      <Seg options={['Aporte', 'Retiro']} value={kind} onChange={setKind} />
      <Field label="Monto (RD$)">
        <Input strong value={monto} onChangeText={(v) => setMonto(money(v))} keyboardType="decimal-pad" placeholder="0" error={falta} />
        {falta ? <T v="sub" color={C.bad}>No puede retirar más que su capital.</T> : null}
      </Field>
      <Cuenta rol="aportante" value={userId} onChange={link} />
    </Sheet>
  );
}

/** Cobro de la siguiente cuota de un préstamo. */
export function PrestamoSheet({ prestamo, onClose }: { prestamo: Prestamo | null; onClose: () => void }) {
  const loading = useLoading('prestamo', 'coopMove');
  if (!prestamo) return null;
  const cuota = cuotaDe(prestamo);
  const pagado = prestamo.pagadas >= prestamo.cuotas;
  const remove = () => {
    onClose();
    useGlobalStore.getState().showConfirm({
      title: `Eliminar el préstamo de ${prestamo.nombre}`,
      message: 'Las cuotas ya cobradas se conservan en el historial.',
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void usePrestamoStore.getState().delete(prestamo.id).catch(() => null),
    });
  };
  return (
    <Sheet
      visible
      title={prestamo.nombre}
      onClose={onClose}
      footer={
        <>
          {pagado ? null : <Btn icon="check" label={`Registrar pago de la cuota ${prestamo.pagadas + 1}`} loading={loading} onPress={() => void pagarCuota(prestamo).then(onClose).catch(() => null)} />}
          <Btn kind="g" icon="trash" label="Eliminar préstamo" onPress={remove} />
        </>
      }>
      <T v="sub">{rd(prestamo.monto)} · {prestamo.tasa}% quincenal · {prestamo.pagadas} de {prestamo.cuotas} cuotas pagadas</T>
      {pagado ? <Note icon="check">Este préstamo ya está pagado.</Note> : <Note icon="coin">Cuota de {rd(cuota.total)}: {rd(cuota.capital)} de capital + {rd(cuota.interes)} de interés.</Note>}
    </Sheet>
  );
}
