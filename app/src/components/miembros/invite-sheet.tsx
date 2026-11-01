import { useState } from 'react';

import { LotPicker } from '@/components/lot-picker';
import { Btn, Field, Input, Options, Sheet, T } from '@/components/ui';
import { INVITE_ROLES, ROLE_CAN, ROLE_LABEL } from '@/constants/config';
import { useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';
import type { MemberRol } from '@/types/farm';

/** Crea una invitación: el código sirve para una cuenta nueva o una que ya existe. */
export function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const coop = useFarmStore((s) => s.current?.type === 'coopprofit');
  const invite = useFarmStore((s) => s.invite);
  const loading = useLoading('invite');
  const roles = INVITE_ROLES[coop ? 'coop' : 'farm'];
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState<MemberRol>(roles[0]);
  const [lotIds, setLotIds] = useState<string[]>([]);

  const submit = () =>
    invite({ nombre: nombre.trim(), rol, lotIds, telefono: telefono.trim() })
      .then(() => {
        setNombre('');
        setTelefono('');
        setLotIds([]);
        onClose();
      })
      .catch(() => null);

  return (
    <Sheet visible={visible} title="Invitar a alguien" onClose={onClose} footer={<Btn label="Crear código de invitación" disabled={!nombre.trim()} loading={loading} onPress={submit} />}>
      <Field label="Nombre">
        <Input value={nombre} onChangeText={setNombre} placeholder="Nombre de la persona" maxLength={120} />
      </Field>
      <Field label="Teléfono" hint="opcional">
        <Input value={telefono} onChangeText={setTelefono} placeholder="809-555-0000" keyboardType="phone-pad" maxLength={20} />
      </Field>
      <Field label="¿Qué va a hacer?">
        <Options options={roles.map((r) => [r, ROLE_LABEL[r]] as const)} value={rol} onChange={setRol} />
        <T v="sub">{ROLE_LABEL[rol]}: {ROLE_CAN[rol]}.</T>
      </Field>
      {coop ? null : (
        <Field label="Lotes que puede ver" hint="ninguno marcado = todos">
          <LotPicker value={lotIds} onChange={setLotIds} />
        </Field>
      )}
    </Sheet>
  );
}
