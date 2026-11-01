import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, Share, View } from 'react-native';

import { Icon } from '@/components/icon';

import { InviteSheet } from '@/components/miembros/invite-sheet';
import { MemberSheet } from '@/components/miembros/member-sheet';
import { Av, back, Btn, Card, Empty, Field, Grow, Input, Li, List, Loading, Row, Screen, swap, T, Top } from '@/components/ui';
import { ROLE_CAN, ROLE_LABEL } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import type { Invitation, Member } from '@/types/farm';
import { getUserInitials, viewDate } from '@/utilities/miscellaneous';

const share = (text: string) =>
  Platform.OS === 'web' ? navigator.clipboard?.writeText(text).then(() => useGlobalStore.getState().showAlert({ title: 'Copiado', message: 'El código se copió al portapapeles.', type: 'success' })) : Share.share({ message: text });

export default function Miembros() {
  const user = useAuthStore((s) => s.user);
  const { current: farm, members, invitations } = useFarmStore();
  const { findMembers, revokeInvitation, update, delete: remove } = useFarmStore.getState();
  const lots = useLotStore((s) => s.list);
  const loading = useLoading('listMember');
  const saving = useLoading('farm');
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [name, setName] = useState(farm?.name ?? '');
  useLoad(useLotStore);
  const load = useCallback(() => void findMembers().catch(() => null), [findMembers]);
  useFocusEffect(load);

  const pending = invitations.filter((i) => !i.usado && new Date(i.expiresAt) > new Date());
  const text = (i: Invitation) => `Hola ${i.nombre}, te invito a ${farm?.name} en ZooProfit. Abre la app, toca "Tengo un código de invitación" y escribe: ${i.code}`;
  const access = (m: Member) => {
    const ids = m.allowedLotIds ?? [];
    if (!ids.length) return ROLE_CAN[m.rol];
    const codes = lots.filter((l) => ids.includes(l.id)).map((l) => l.code);
    return `solo ve ${ids.length} ${ids.length === 1 ? 'lote' : 'lotes'}${codes.length ? `: ${codes.join(', ')}` : ''}`;
  };
  const destroy = () =>
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${farm?.name}`,
      message: 'Se borran para siempre sus lotes, registros, animales e inventario, para ti y para todo el equipo. No se puede deshacer.',
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () =>
        void remove(farm!.id)
          .then(() => swap('/modulos'))
          .catch(() => null),
    });

  return (
    <Screen
      refreshing={loading}
      onRefresh={load}
      top={<Top title="Equipo" sub={`${farm?.name} · ${members.length + 1} ${members.length ? 'personas' : 'persona'}`} onBack={back} />}
      footer={<Btn icon="plus" label="Invitar a alguien" onPress={() => setInviting(true)} />}>
      {pending.map((i) => (
        <Card key={i.id} dark gap={12} style={{ borderRadius: 24, padding: 18 }}>
          <Row>
            <Grow><T v="b" size={16} color="#fff">Invitación para {i.nombre}</T></Grow>
            <View style={{ borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: C.yolk }}>
              <T v="b" size={12}>{ROLE_LABEL[i.rol]}</T>
            </View>
          </Row>
          <T v="sub" size={14} color={C.forestText}>Dale este código. Lo escribe al abrir la app. Vence el {viewDate(i.expiresAt.slice(0, 10))}.</T>
          <Row gap={6} accessibilityLabel={`Código ${i.code.split('').join(' ')}`}>
            {i.code.split('').map((d, n) => (
              <View key={n} style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <T v="h1" size={26} selectable>{d}</T>
              </View>
            ))}
          </Row>
          <Row gap={10}>
            <Pressable onPress={() => void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text(i))}`)} accessibilityRole="button" accessibilityLabel="Enviar por WhatsApp" style={{ flex: 1.4, height: 48, borderRadius: 16, backgroundColor: C.yolk, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="send" size={18} />
              <T v="b">WhatsApp</T>
            </Pressable>
            <Pressable onPress={() => void share(text(i))} accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 16, borderWidth: 1, borderColor: C.forestText, alignItems: 'center', justifyContent: 'center' }}>
              <T v="b" color="#fff">{Platform.OS === 'web' ? 'Copiar' : 'Compartir'}</T>
            </Pressable>
            <Pressable onPress={() => void revokeInvitation(i.id).catch(() => null)} accessibilityRole="button" accessibilityLabel={`Anular la invitación de ${i.nombre}`} style={{ width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: C.forestText, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={18} color="#fff" />
            </Pressable>
          </Row>
        </Card>
      ))}

      <T v="h2" size={19}>Quién trabaja aquí</T>
      {loading && !members.length ? <Loading /> : null}
      <List>
        <Li left={<Av text={getUserInitials(user?.name)} round />} title={`${user?.name ?? ''} (tú)`} sub={`${ROLE_LABEL.admin} · ${ROLE_CAN.admin}`} />
        {members.map((m) => (
          <Li key={m.userId} left={<Av text={getUserInitials(m.name)} tone="n" round />} title={m.name} sub={`${ROLE_LABEL[m.rol]} · ${access(m)}`} onPress={() => setEditing(m)} />
        ))}
      </List>
      {members.length ? (
        <T v="sub">Toca a una persona para cambiar lo que puede hacer o quitarla.</T>
      ) : loading ? null : (
        <Empty icon="adopt" title="Aún trabajas solo" sub="Invita a tu equipo con un código: sirve para una cuenta nueva o para una que ya existe." />
      )}

      <T v="h2" size={19}>Ajustes de la granja</T>
      <Field label="Nombre">
        <Row gap={10}>
          <Grow><Input value={name} onChangeText={setName} maxLength={120} /></Grow>
          <Btn label="Guardar" disabled={!name.trim() || name.trim() === farm?.name} loading={saving} onPress={() => void update({ name: name.trim() }).catch(() => null)} />
        </Row>
      </Field>
      <Btn kind="g" icon="trash" label="Eliminar esta granja" onPress={destroy} />

      <InviteSheet visible={inviting} onClose={() => setInviting(false)} />
      <MemberSheet member={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
