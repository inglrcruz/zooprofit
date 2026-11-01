import { useState } from 'react';

import { PasswordInput } from '@/components/password-input';
import { back, Btn, Field, Input, Screen, swap, T, Top } from '@/components/ui';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import useValidateInputs from '@/hooks/use-validate-inputs';
import { useAuthStore } from '@/stores/auth.store';

export default function Registro() {
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useLoading('signUp');
  const { inputErrors, validateInputs, setRemoveError } = useValidateInputs();
  const [frm, setFrm] = useState({ name: '', contact: '', password: '' });
  const set = (k: keyof typeof frm) => (v: string) => {
    setFrm({ ...frm, [k]: v });
    setRemoveError(k);
  };
  const short = frm.password.length > 0 && frm.password.length < 4;

  const submit = () => {
    if (!validateInputs(frm) || short) return;
    const contact = frm.contact.trim();
    // El API acepta correo o teléfono; se distingue igual que al iniciar sesión.
    signUp({ name: frm.name.trim(), password: frm.password, ...(contact.includes('@') ? { email: contact } : { phone: contact }) })
      .then(() => swap('/modulos'))
      .catch(() => null);
  };

  return (
    <Screen top={<Top title="Crear cuenta" onBack={() => back('/')} />} footer={<Btn label="Crear cuenta" loading={loading} onPress={submit} />}>
      <T v="sub" size={15}>Con tu cuenta puedes crear tus granjas e invitar a tu equipo.</T>
      <Field label="Tu nombre">
        <Input value={frm.name} onChangeText={set('name')} error={inputErrors.name} placeholder="Nombre y apellido" textContentType="name" />
      </Field>
      <Field label="Teléfono o correo" hint="con esto inicias sesión">
        <Input value={frm.contact} onChangeText={set('contact')} error={inputErrors.contact} placeholder="809-555-0000 o correo@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
      </Field>
      <Field label="Clave" hint="4 dígitos">
        <PasswordInput value={frm.password} onChangeText={set('password')} error={inputErrors.password || short} textContentType="newPassword" />
        {short ? <T v="sub" color={C.bad}>La clave debe tener 4 dígitos</T> : null}
      </Field>
    </Screen>
  );
}
