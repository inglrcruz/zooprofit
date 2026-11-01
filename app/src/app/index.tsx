import { useState } from 'react';
import { Pressable } from 'react-native';

import { Logo } from '@/components/logo';
import { PinPad } from '@/components/pin-pad';
import { Av, Col, Field, go, Grow, Input, Loading, Row, Screen, swap, T } from '@/components/ui';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { useGlobalStore } from '@/stores/global.store';
import { getUserInitials } from '@/utilities/miscellaneous';

export default function Entrar() {
  const { signIn, lastAccount, forgetAccount } = useAuthStore();
  const showAlert = useGlobalStore((s) => s.showAlert);
  const loading = useLoading('signIn');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const quien = lastAccount?.identifier ?? identifier.trim();

  // Con el cuarto número se entra, sin botón aparte.
  const type = (next: string) => {
    setPin(next);
    if (next.length < 4) return;
    if (!quien) {
      setPin('');
      return showAlert({ title: 'Falta tu teléfono', message: 'Escribe arriba el teléfono o el correo con el que te registraste.', type: 'info' });
    }
    signIn({ identifier: quien, password: next })
      .then(() => swap('/modulos'))
      .catch(() => setPin(''));
  };

  const link = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, height: 52, borderRadius: 18, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
      <T v="b" size={14}>{label}</T>
    </Pressable>
  );

  return (
    <Screen>
      <Logo />

      <Col gap={4} style={{ marginTop: 6 }}>
        <T v="h1" size={28}>{lastAccount ? 'Hola de nuevo' : 'Bienvenido'}</T>
        <T v="sub" size={15}>{lastAccount ? 'Escribe tu clave de 4 números.' : 'Escribe tu teléfono y tu clave de 4 números.'}</T>
      </Col>

      {lastAccount ? (
        <Pressable onPress={forgetAccount} accessibilityRole="button" accessibilityLabel={`Entrar como ${lastAccount.name}. Cambiar de cuenta`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
          <Av text={getUserInitials(lastAccount.name)} round />
          <Grow>
            <T v="b" size={16}>{lastAccount.name}</T>
            <T v="sub">{lastAccount.identifier}</T>
          </Grow>
          <T v="b" size={14} color={C.green}>Cambiar</T>
        </Pressable>
      ) : (
        <Field label="Teléfono o correo">
          <Input value={identifier} onChangeText={setIdentifier} placeholder="809-555-0000 o correo@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" />
        </Field>
      )}

      {loading ? <Loading /> : <PinPad value={pin} onChange={type} />}

      <Pressable
        accessibilityRole="button"
        style={{ alignSelf: 'center', padding: 12 }}
        onPress={() => showAlert({ title: 'Olvidé mi clave', message: 'Todavía no se puede recuperar la clave desde la app. Pide al dueño de tu granja una invitación nueva, o escribe a soporte para restablecerla.', type: 'info' })}>
        <T v="b" color={C.green}>Olvidé mi clave</T>
      </Pressable>

      <Row gap={10}>
        {link('Tengo un código', () => go('/codigo'))}
        {link('Crear cuenta', () => go('/registro'))}
      </Row>
    </Screen>
  );
}
