import { useState } from 'react';
import { Pressable, type TextInputProps, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Input } from '@/components/ui';
import { C } from '@/constants/tokens';

/** La clave de la cuenta: 4 dígitos, como exige el API. */
export function PasswordInput({ onChangeText, ...p }: TextInputProps & { error?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <Input placeholder="4 dígitos" {...p} onChangeText={(t) => onChangeText?.(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry={!show} style={{ paddingRight: 52 }} />
      <Pressable
        onPress={() => setShow(!show)}
        accessibilityRole="button"
        accessibilityLabel={show ? 'Ocultar clave' : 'Mostrar clave'}
        style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={show ? 'lock' : 'eye'} color={C.mute} />
      </Pressable>
    </View>
  );
}
