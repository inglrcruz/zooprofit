import { useState } from 'react';

import { PasswordInput } from '@/components/password-input';
import { Av, back, Btn, Card, Field, Grow, Input, Note, Row, Screen, swap, T, Top } from '@/components/ui';
import { ROLE_LABEL } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import type { InvitationPreview } from '@/types/user';

/**
 * Usar un código de invitación. Sin sesión crea la cuenta del trabajador ya
 * dentro de la granja; con sesión une la cuenta actual a esa granja.
 */
export default function Codigo() {
  const { token, previewInvitation, join, acceptInvitation } = useAuthStore();
  const showAlert = useGlobalStore((s) => s.showAlert);
  const checking = useLoading('invitation');
  const joining = useLoading('join');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const short = password.length < 4;

  const check = () => previewInvitation(code).then(setPreview).catch(() => null);

  const done = (farmName: string, login?: string | null) => {
    showAlert({ title: 'Listo', message: `Ya formas parte de ${farmName}.${login ? ` Para iniciar sesión usa ${login} y tu clave.` : ''}`, type: 'success' });
    swap('/modulos');
  };
  const submit = () => {
    if (!preview) return;
    if (token) {
      acceptInvitation(code)
        .then(() => useFarmStore.getState().findAll())
        .then(() => done(preview.farmName))
        .catch(() => null);
    } else {
      join({ code, password, ...(phone.trim() ? { phone: phone.trim() } : {}) })
        .then((user) => done(preview.farmName, user.phone ?? user.email))
        .catch(() => null);
    }
  };

  return (
    <Screen
      top={<Top title="Código de invitación" onBack={() => back(token ? '/modulos' : '/')} />}
      footer={
        preview ? (
          <Btn label={token ? `Unirme a ${preview.farmName}` : 'Crear mi cuenta'} loading={joining || checking} disabled={!token && short} onPress={submit} />
        ) : (
          <Btn label="Continuar" loading={checking} disabled={code.length !== 6} onPress={check} />
        )
      }>
      <T v="sub" size={15}>Escribe el código de 6 dígitos que te dio el propietario de la granja.</T>
      <Field label="Código">
        <Input
          strong
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, 6));
            setPreview(null);
          }}
          keyboardType="number-pad"
          placeholder="000000"
          maxLength={6}
          autoFocus
          onSubmitEditing={check}
          style={{ height: 64, fontSize: 28, letterSpacing: 6, textAlign: 'center' }}
        />
      </Field>

      {preview ? (
        <>
          <Card style={{ borderColor: C.line2 }}>
            <Row>
              <Av icon="check" tone="k" />
              <Grow>
                <T v="b">{preview.farmName}</T>
                <T v="sub">Invitación para {preview.nombre} · {ROLE_LABEL[preview.rol as keyof typeof ROLE_LABEL] ?? preview.rol}</T>
              </Grow>
            </Row>
          </Card>
          {token ? (
            <Note>Se usará la cuenta con la que ya iniciaste sesión.</Note>
          ) : (
            <>
              <Field label="Tu teléfono" hint="opcional · con él inicias sesión">
                <Input value={phone} onChangeText={setPhone} placeholder="809-555-0000" keyboardType="phone-pad" />
              </Field>
              <Field label="Crea tu clave" hint="4 dígitos">
                <PasswordInput value={password} onChangeText={setPassword} textContentType="newPassword" />
              </Field>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
