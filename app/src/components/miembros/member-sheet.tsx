import { useState } from 'react';

import { LotPicker } from '@/components/lot-picker';
import { Btn, Field, Options, Sheet, T } from '@/components/ui';
import { INVITE_ROLES, ROLE_LABEL } from '@/constants/config';
import { useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import type { Member, MemberRol } from '@/types/farm';

/** Cambia el rol y los lotes de un miembro, o lo quita de la granja. */
export function MemberSheet(props: { member: Member | null; onClose: () => void }) {
  // La clave reinicia el formulario cada vez que se abre.
  return <MemberSheetForm key={props.member?.userId ?? ''} {...props} />;
}

function MemberSheetForm({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const coop = useFarmStore((s) => s.current?.type === 'coopprofit');
  const { updateMember, removeMember } = useFarmStore.getState();
  const loading = useLoading('member');
  const [rol, setRol] = useState<MemberRol>(member?.rol ?? 'auxiliar');
  const [lotIds, setLotIds] = useState<string[]>(member?.allowedLotIds ?? []);

  const roles = INVITE_ROLES[coop ? 'coop' : 'farm'];
  const save = () => member && updateMember(member.userId, { rol, allowedLotIds: lotIds }).then(onClose).catch(() => null);
  const remove = () => {
    if (!member) return;
    onClose();
    useGlobalStore.getState().showConfirm({
      title: `Quitar a ${member.name}`,
      message: 'Perderá el acceso a esta granja de inmediato. Sus registros se conservan.',
      confirmText: 'Quitar',
      destructive: true,
      onConfirm: () => void removeMember(member.userId).catch(() => null),
    });
  };

  return (
    <Sheet
      visible={!!member}
      title={member?.name ?? ''}
      onClose={onClose}
      footer={
        <>
          <Btn label="Guardar cambios" loading={loading} onPress={save} />
          <Btn kind="g" icon="trash" label="Quitar de la granja" onPress={remove} />
        </>
      }>
      <T v="sub">{member?.phone ?? member?.email ?? ''}</T>
      <Field label="Rol">
        <Options options={[...new Set([...roles, rol])].map((r) => [r, ROLE_LABEL[r]] as const)} value={rol} onChange={setRol} />
      </Field>
      {coop ? null : (
        <Field label="Lotes que puede ver" hint="ninguno marcado = todos">
          <LotPicker value={lotIds} onChange={setLotIds} />
        </Field>
      )}
    </Sheet>
  );
}
