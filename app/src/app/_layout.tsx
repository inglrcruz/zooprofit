import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';

import { AlertDialog, ConfirmDialog } from '@/components/dialog';
import { Menu } from '@/components/menu';
import { C } from '@/constants/tokens';
import { useSync } from '@/hooks/use-sync';
import { useAuthStore } from '@/stores/auth.store';
import { useFarmStore } from '@/stores/farm.store';

SplashScreen.preventAutoHideAsync();

/** Pantallas que se ven sin sesión; "codigo" sirve con y sin ella. */
const PUBLIC = ['', 'registro', 'codigo'];
/** Pantallas que no necesitan una granja abierta. */
const NO_FARM = [...PUBLIC, 'modulos', 'nuevo-modulo', 'perfil'];

/** True once the persisted session and farm have been read from storage. */
function useHydrated() {
  const [ready, setReady] = useState(() => useAuthStore.persist.hasHydrated() && useFarmStore.persist.hasHydrated());
  useEffect(() => {
    const check = () => setReady(useAuthStore.persist.hasHydrated() && useFarmStore.persist.hasHydrated());
    const subs = [useAuthStore.persist.onFinishHydration(check), useFarmStore.persist.onFinishHydration(check)];
    check();
    return () => subs.forEach((off) => off());
  }, []);
  return ready;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const hydrated = useHydrated();
  const ready = (loaded || !!error) && hydrated;
  const token = useAuthStore((s) => s.token);
  const hasFarm = useFarmStore((s) => !!s.current);
  const screen: string = useSegments()[0] ?? '';
  useSync();

  // Con el teclado abierto, Atrás solo lo cierra: no se pierde lo escrito.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!Keyboard.isVisible()) return false;
      Keyboard.dismiss();
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Sin sesión solo se ve lo público; con sesión, la entrada lleva a los módulos.
  useEffect(() => {
    if (!ready) return;
    if (!token && !PUBLIC.includes(screen)) router.replace('/');
    else if (token && (screen === '' || screen === 'registro')) router.replace('/modulos');
    else if (token && !hasFarm && !NO_FARM.includes(screen)) router.replace('/modulos');
  }, [ready, token, hasFarm, screen]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="nuevo-modulo" options={{ presentation: 'modal' }} />
        <Stack.Screen name="repro/registrar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="evento" options={{ presentation: 'modal' }} />
      </Stack>
      <Menu />
      <AlertDialog />
      <ConfirmDialog />
    </>
  );
}
