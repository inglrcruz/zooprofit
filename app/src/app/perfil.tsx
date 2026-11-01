import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { PasswordInput } from '@/components/password-input';
import { back, Btn, Card, Col, Field, go, Grow, IconBtn, Input, Row, Screen, Sheet, swap, T, Top } from '@/components/ui';
import { VERSION } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { ESCALA_LIMITES, useEsc, useEscala } from '@/stores/escala.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { getUserInitials } from '@/utilities/miscellaneous';

const EMPTY = { current: '', password: '', repeat: '' };

export default function Perfil() {
  const { user, updateProfile, changePassword, resetStore } = useAuthStore();
  const farms = useFarmStore((s) => s.list.length);
  const { showConfirm, showAlert } = useGlobalStore.getState();
  const { escala, cambiar } = useEscala();
  const esc = useEsc();
  const saving = useLoading('profileUpdate');
  const changing = useLoading('changePassword');
  const [sheet, setSheet] = useState<'name' | 'pin' | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [pin, setPin] = useState(EMPTY);
  const set = (k: keyof typeof pin) => (v: string) => setPin({ ...pin, [k]: v });
  const distinta = pin.repeat.length === 4 && pin.repeat !== pin.password;
  const igual = pin.password.length === 4 && pin.password === pin.current;
  const lista = pin.current.length === 4 && pin.password.length === 4 && pin.repeat === pin.password && !igual;
  const close = () => {
    setSheet(null);
    setPin(EMPTY);
    setName(user?.name ?? '');
  };

  const save = () =>
    updateProfile({ name: name.trim() })
      .then(() => setSheet(null))
      .catch(() => null);

  const change = () =>
    changePassword(pin.current, pin.password)
      .then(() => {
        close();
        showAlert({ title: 'Clave cambiada', message: 'La próxima vez que entres usa tu clave nueva.', type: 'success' });
      })
      .catch(() => null);

  const signOut = () =>
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Quieres salir de tu cuenta en este dispositivo?',
      confirmText: 'Salir',
      icon: 'logout',
      onConfirm: () => {
        resetStore();
        swap('/');
      },
    });

  const row = (icon: IconName, title: string, sub: string, onPress: () => void, first = false) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.green2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={C.green} />
      </View>
      <Grow style={{ gap: 2 }}>
        <T v="b" size={16}>{title}</T>
        <T v="sub">{sub}</T>
      </Grow>
      <Icon name="next" color={C.mute} />
    </Pressable>
  );

  return (
    <Screen
      top={<Top title="Mi perfil" onBack={back} />}
      footer={
        <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="Cerrar sesión" style={{ height: esc(56), borderRadius: esc(18), borderWidth: 1, borderColor: C.bad, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="logout" size={esc(22)} color={C.bad} />
          <T v="b" size={esc(16)} color={C.bad}>Cerrar sesión</T>
        </Pressable>
      }>
      <Col gap={8} align="center" style={{ paddingVertical: 8 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center' }}>
          <T v="h1" size={30} color="#fff">{getUserInitials(user?.name)}</T>
        </View>
        <T v="h1" size={22}>{user?.name}</T>
        <T v="sub" size={14}>{user?.phone ?? user?.email ?? ''}</T>
      </Col>

      <Card gap={0} style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
        {row('user', 'Cambiar mi nombre', 'Así te ve tu equipo', () => setSheet('name'), true)}
        {row('lock', 'Cambiar mi clave', '4 números', () => setSheet('pin'))}
        {row('home', 'Mis granjas', farms ? `Estás en ${farms}` : 'Ver la lista', () => swap('/modulos'))}
        {row('key', 'Usar un código de invitación', 'Para entrar a otra granja', () => go('/codigo'))}
      </Card>
      <Card style={{ padding: 14 }}>
        <Row>
          <Grow style={{ gap: 2 }}>
            <T v="b" size={16}>Tamaño de los botones</T>
            <T v="sub">{Math.round(escala * 100)}% · solo en este teléfono</T>
          </Grow>
          {escala > ESCALA_LIMITES.MIN ? <IconBtn icon="minus" label="Reducir los botones" onPress={() => cambiar(-1)} /> : null}
          {escala < ESCALA_LIMITES.MAX ? <IconBtn icon="plus" label="Agrandar los botones" onPress={() => cambiar(1)} /> : null}
        </Row>
      </Card>
      <T v="sub" size={12} style={{ textAlign: 'center' }}>ZooProfit {VERSION}</T>

      <Sheet visible={sheet === 'name'} title="Cambiar mi nombre" onClose={close} footer={<Btn label="Guardar" disabled={!name.trim() || name.trim() === user?.name} loading={saving} onPress={save} />}>
        <Field label="Tu nombre">
          <Input value={name} onChangeText={setName} maxLength={120} autoFocus />
        </Field>
      </Sheet>

      <Sheet visible={sheet === 'pin'} title="Cambiar mi clave" onClose={close} footer={<Btn icon="lock" label="Cambiar clave" disabled={!lista} loading={changing} onPress={change} />}>
        <Field label="Clave actual">
          <PasswordInput value={pin.current} onChangeText={set('current')} textContentType="password" accessibilityLabel="Clave actual" />
        </Field>
        <Field label="Clave nueva" hint="4 números">
          <PasswordInput value={pin.password} onChangeText={set('password')} error={igual} textContentType="newPassword" accessibilityLabel="Clave nueva" />
          {igual ? <T v="sub" color={C.bad}>La clave nueva debe ser distinta de la actual</T> : null}
        </Field>
        <Field label="Repite la clave nueva">
          <PasswordInput value={pin.repeat} onChangeText={set('repeat')} error={distinta} textContentType="newPassword" accessibilityLabel="Repite la clave nueva" />
          {distinta ? <T v="sub" color={C.bad}>Las dos claves no coinciden</T> : null}
        </Field>
      </Sheet>
    </Screen>
  );
}
