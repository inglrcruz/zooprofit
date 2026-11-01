import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Av, Btn, Empty, go, Grow, Loading, Row, Screen, T, Tag } from '@/components/ui';
import { FARM_KIND, ROLE_LABEL } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { useFarmStore } from '@/stores/farm.store';
import type { Farm } from '@/types/farm';
import { getUserInitials } from '@/utilities/miscellaneous';

export default function Granjas() {
  const user = useAuthStore((s) => s.user);
  const farms = useFarmStore((s) => s.list);
  const lastId = useFarmStore((s) => s.current?.id);
  const loading = useLoading('listFarm');
  // Sin sesión la pantalla está a punto de redirigir: no hay nada que pedir.
  const load = useCallback(() => void (useAuthStore.getState().token && useFarmStore.getState().findAll().catch(() => null)), []);
  useFocusEffect(load);

  const open = (f: Farm) => {
    useFarmStore.getState().select(f);
    // Socios y personas con préstamo solo ven su propio portal.
    go(f.rol === 'aportante' || f.rol === 'prestatario' ? '/coop-portal' : FARM_KIND[f.type].href);
  };
  // La última granja abierta va primero y destacada: es a la que casi siempre se vuelve.
  const sorted = [...farms].sort((a, b) => Number(b.id === lastId) - Number(a.id === lastId));

  return (
    <Screen
      refreshing={loading}
      onRefresh={load}
      footer={
        <Row gap={10}>
          <Btn kind="g" icon="key" label="Tengo un código" flex={1} onPress={() => go('/codigo')} />
          <Btn icon="plus" label="Nueva granja" flex={1} onPress={() => go('/nuevo-modulo')} />
        </Row>
      }>
      <Row style={{ marginTop: 16 }}>
        <Grow>
          <T v="sub" size={14}>Hola, {user?.name.split(' ')[0]}</T>
          <T v="h1" size={28} accessibilityRole="header">Tus granjas</T>
        </Grow>
        <Pressable onPress={() => go('/perfil')} accessibilityRole="button" accessibilityLabel="Mi perfil">
          <Av text={getUserInitials(user?.name)} round />
        </Pressable>
      </Row>

      {loading && !farms.length ? <Loading /> : null}
      {!loading && !farms.length ? (
        <Empty icon="barn" title="Aún no tienes granjas" sub="Crea la primera, o entra a una con el código que te dio su dueño." />
      ) : null}

      {sorted.map((f) => {
        const dark = f.id === lastId;
        const mine = f.rol === 'admin';
        return (
          <Pressable
            key={f.id}
            onPress={() => open(f)}
            accessibilityRole="button"
            accessibilityLabel={`${f.name}, ${FARM_KIND[f.type].label}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: dark ? 18 : 16, borderRadius: dark ? 24 : 22, backgroundColor: dark ? C.forest : C.card, borderWidth: dark ? 0 : 1, borderColor: C.line }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: dark ? C.forestLine : mine ? C.green2 : C.neutral, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={FARM_KIND[f.type].icon} color={dark ? '#fff' : mine ? C.green : C.ink2} />
            </View>
            <Grow style={{ gap: 3 }}>
              <T v={dark ? 'h1' : 'b'} size={dark ? 21 : 17} color={dark ? '#fff' : C.ink} numberOfLines={1}>{f.name}</T>
              <T v="sub" color={dark ? C.forestText : C.mute}>{FARM_KIND[f.type].label}{dark ? ' · la última que abriste' : ''}</T>
              {mine ? null : <View style={{ alignSelf: 'flex-start' }}><Tag tone="n">{ROLE_LABEL[f.rol ?? 'auxiliar']}</Tag></View>}
            </Grow>
            <Icon name="next" color={dark ? '#fff' : C.mute} />
          </Pressable>
        );
      })}
    </Screen>
  );
}
