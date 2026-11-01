import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Grid, Row, T } from '@/components/ui';
import { C } from '@/constants/tokens';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'x'];

/** Las cuatro casillas de la clave y un teclado de números grandes. */
export function PinPad({ value, onChange, disabled }: { value: string; onChange: (pin: string) => void; disabled?: boolean }) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'x') onChange(value.slice(0, -1));
    else if (value.length < 4) onChange(value + k);
  };
  return (
    <View style={{ gap: 18 }}>
      <Row gap={16} style={{ justifyContent: 'center' }} accessibilityLabel={`Clave: ${value.length} de 4 números escritos`}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ width: 56, height: 64, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: i <= value.length ? 2 : 1, borderColor: i < value.length ? C.green : i === value.length ? C.yolk : C.line2 }}>
            {i < value.length ? <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.ink }} /> : null}
          </View>
        ))}
      </Row>
      <Grid cols={3}>
        {KEYS.map((k) =>
          k ? (
            <Pressable
              key={k}
              onPress={() => press(k)}
              accessibilityRole="button"
              accessibilityLabel={k === 'x' ? 'Borrar el último número' : k}
              style={({ pressed }) => ({ height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'x' ? C.neutral : pressed ? C.green2 : C.card, borderWidth: k === 'x' ? 0 : 1, borderColor: C.line, opacity: disabled ? 0.5 : 1 })}>
              {k === 'x' ? <Icon name="erase" size={26} /> : <T v="h2" size={26}>{k}</T>}
            </Pressable>
          ) : (
            <View key="vacio" />
          ),
        )}
      </Grid>
    </View>
  );
}
