import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Field, Input, Row, T } from '@/components/ui';
import { estadoDe } from '@/constants/eventos';
import { C } from '@/constants/tokens';
import { useLotStore } from '@/stores/lot.store';
import { useSowStore } from '@/stores/sow.store';
import type { Sow } from '@/types/data';
import { plural } from '@/utilities/miscellaneous';

/** La cerda activa con ese arete, o la última que lo tuvo. */
export const findSow = (sows: Sow[], arete: string) => {
  const a = arete.trim().toUpperCase();
  return a ? sows.find((s) => s.arete === a && s.estadoActual !== 'descarte') ?? sows.find((s) => s.arete === a) : undefined;
};

/**
 * ID de una cerda, con la confirmación de cuál es. `nueva` es para
 * registrar una que aún no existe; `quiet` no escribe la confirmación
 * (la pantalla la muestra a su manera).
 */
export function SowInput({ value, onChange, nueva, label = 'ID', quiet }: { value: string; onChange: (arete: string) => void; nueva?: boolean; label?: string; quiet?: boolean }) {
  const sows = useSowStore((s) => s.list);
  const lots = useLotStore((s) => s.list);
  const found = findSow(sows, value);
  const ok = nueva ? !found || found.estadoActual === 'descarte' : !!found;
  const lot = lots.find((l) => l.id === found?.lotIdActual)?.code;
  return (
    <Field label={label}>
      <View>
        <Input strong value={value} onChangeText={onChange} autoCapitalize="characters" autoCorrect={false} placeholder="Escribe el ID…" maxLength={40} style={{ height: 64, fontSize: 26, paddingLeft: 50, paddingRight: 56 }} />
        <View style={{ position: 'absolute', left: 16, top: 20 }} pointerEvents="none">
          <Icon name="search" color={C.mute} />
        </View>
        {value ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Borrar el ID" style={{ position: 'absolute', right: 10, top: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: C.neutral, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={18} color={C.ink2} />
          </Pressable>
        ) : null}
      </View>
      {value.trim() && !quiet ? (
        <Row gap={6}>
          <Icon name={ok ? 'check' : 'alert'} size={16} color={ok ? C.ok : C.warn} />
          <T v="sub" color={ok ? C.ok : C.warn} style={{ flex: 1 }}>
            {nueva
              ? ok ? 'ID disponible' : 'Ya hay una cerda activa con ese ID'
              : found ? `Encontrada · ${estadoDe(found.estadoActual)[0]}${lot ? ` · ${lot}` : ''} · ${plural(found.partosHistoricos, 'parto')}` : 'No hay una cerda con ese ID'}
          </T>
        </Row>
      ) : null}
    </Field>
  );
}
