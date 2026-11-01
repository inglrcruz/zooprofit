import { usePathname } from 'expo-router';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Av, Col, go, Grow, IconBtn, Row, swap, T, Tag } from '@/components/ui';
import { can, FARM_KIND, ROLE_LABEL } from '@/constants/config';
import { C, F } from '@/constants/tokens';
import { useAuthStore } from '@/stores/auth.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { useMenu } from '@/stores/menu.store';
import { useProductStore } from '@/stores/product.store';
import { useSowStore } from '@/stores/sow.store';
import type { FarmType } from '@/types/farm';
import { getUserInitials } from '@/utilities/miscellaneous';

type Item = { label: string; icon: IconName; path: string; count?: 'cerdas' | 'lotes' | 'bajos'; owner?: boolean };
const EQUIPO: Item = { label: 'Equipo', icon: 'users', path: '/miembros', owner: true };
const INSUMOS: Item = { label: 'Alimento y medicinas', icon: 'box', path: '/prod/insumos', count: 'bajos' };

/** Qué ofrece el menú en cada tipo de granja: [lo de todos los días, lo de la granja]. */
const SECTIONS: Record<FarmType, [Item[], Item[]]> = {
  reproduccion: [
    [
      { label: 'Hoy', icon: 'home', path: '/repro' },
      { label: 'Semana', icon: 'calendar', path: '/repro/semana' },
      { label: 'Cerdas', icon: 'tag', path: '/repro/cerdas', count: 'cerdas' },
      { label: 'Lotes', icon: 'grid', path: '/repro/lotes', count: 'lotes' },
    ],
    [
      { label: 'Resumen y metas', icon: 'chart', path: '/repro/resumen' },
      { label: 'Verracos', icon: 'drop', path: '/repro/verracos' },
      INSUMOS,
      EQUIPO,
      { label: 'Reglas de la granja', icon: 'sliders', path: '/repro/reglas' },
    ],
  ],
  produccion: [
    [
      { label: 'Lotes', icon: 'grid', path: '/prod', count: 'lotes' },
      { label: 'Granja', icon: 'barn', path: '/prod/granja' },
      { label: 'Destetes', icon: 'download', path: '/prod/destetes' },
    ],
    [INSUMOS, EQUIPO],
  ],
  ponedora: [
    [
      { label: 'Hoy', icon: 'home', path: '/aves' },
      { label: 'Huevos', icon: 'box', path: '/aves/almacen' },
      { label: 'Reporte', icon: 'chart', path: '/aves/reporte' },
    ],
    [
      { label: 'Medicinas y vacunas', icon: 'flask', path: '/aves/protocolos' },
      { label: 'Resumen del lote', icon: 'spark', path: '/aves/asistente' },
      EQUIPO,
    ],
  ],
  engorde: [[{ label: 'Hoy', icon: 'home', path: '/aves' }, { label: 'Reporte', icon: 'chart', path: '/aves/reporte' }], [{ label: 'Medicinas y vacunas', icon: 'flask', path: '/aves/protocolos' }, EQUIPO]],
  fabrica: [[{ label: 'Inventario', icon: 'factory', path: '/fabrica' }], [EQUIPO]],
  coopprofit: [[{ label: 'Cooperativa', icon: 'coin', path: '/coop' }], [EQUIPO]],
};

/** Menú lateral con todo lo de la granja abierta. Se monta una vez, en el layout raíz. */
export function Menu() {
  const { visible, hide } = useMenu();
  const { top, bottom } = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const farm = useFarmStore((s) => s.current);
  const rol = useFarmStore((s) => s.rol);
  const cerdas = useSowStore((s) => s.list.filter((x) => x.estadoActual !== 'descarte').length);
  const lotes = useLotStore((s) => s.list.filter((l) => !l.archivado && !l.esFijo).length);
  const bajos = useProductStore((s) => s.list.filter((p) => p.minimo > 0 && p.existencia < p.minimo).length);
  if (!visible || !farm) return null;

  const [daily, rest] = SECTIONS[farm.type];
  const open = (path: string, tab = true) => {
    hide();
    if (path !== pathname) (tab ? swap : go)(path);
  };
  const signOut = () => {
    hide();
    useGlobalStore.getState().showConfirm({
      title: 'Cerrar sesión',
      message: '¿Quieres salir de tu cuenta en este dispositivo?',
      confirmText: 'Salir',
      icon: 'logout',
      onConfirm: () => {
        useAuthStore.getState().resetStore();
        swap('/');
      },
    });
  };
  const row = (i: Item, tab: boolean) => {
    if (i.owner && !can.members(rol)) return null;
    const on = pathname === i.path;
    const n = i.count === 'cerdas' ? cerdas : i.count === 'lotes' ? lotes : i.count === 'bajos' ? bajos : 0;
    return (
      <Pressable
        key={i.path}
        onPress={() => open(i.path, tab)}
        accessibilityRole="menuitem"
        accessibilityState={{ selected: on }}
        style={{ height: 52, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? C.green2 : 'transparent' }}>
        <Icon name={i.icon} color={on ? C.forest : C.ink2} />
        <Grow><T size={16} color={on ? C.forest : C.ink} style={{ fontFamily: on ? F.x : F.b }}>{i.label}</T></Grow>
        {n ? i.count === 'bajos' ? <Tag tone="d">{n} bajos</Tag> : <T v="sub" size={14}>{n}</T> : null}
      </Pressable>
    );
  };
  const section = (title: string, items: Item[], tab: boolean) => (
    <Col gap={2}>
      <T v="cap" style={{ paddingHorizontal: 12, paddingVertical: 4 }}>{title}</T>
      {items.map((i) => row(i, tab))}
    </Col>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hide}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(31,42,28,0.55)' }}>
        <View accessibilityRole="menu" style={{ width: 324, maxWidth: '86%', backgroundColor: C.bg, borderTopRightRadius: 28, borderBottomRightRadius: 28, paddingTop: top + 20, paddingBottom: Math.max(bottom, 16), paddingHorizontal: 16, gap: 14 }}>
          <Pressable
            onPress={() => open('/modulos')}
            accessibilityRole="button"
            accessibilityLabel={`${farm.name}, cambiar de granja`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: C.forest }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.forestLine, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={FARM_KIND[farm.type].icon} color="#fff" />
            </View>
            <Grow>
              <T v="h2" color="#fff" numberOfLines={1}>{farm.name}</T>
              <T v="sub" color={C.forestText}>{FARM_KIND[farm.type].label} · cambiar</T>
            </Grow>
            <Icon name="swapV" color="#fff" />
          </Pressable>

          <ScrollView contentContainerStyle={{ gap: 14 }}>
            {section('Día a día', daily, true)}
            {section('La granja', rest, false)}
          </ScrollView>

          <Row style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
            <Pressable onPress={() => open('/perfil', false)} accessibilityRole="button" accessibilityLabel={`Mi perfil: ${user?.name}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
              <Av text={getUserInitials(user?.name)} round />
              <Grow>
                <T v="b" numberOfLines={1}>{user?.name}</T>
                <T v="sub">{ROLE_LABEL[rol ?? 'auxiliar']} · mi perfil</T>
              </Grow>
            </Pressable>
            <IconBtn icon="logout" label="Cerrar sesión" onPress={signOut} />
          </Row>
        </View>
        <Pressable style={{ flex: 1, alignItems: 'center', paddingTop: top + 24 }} onPress={hide} accessibilityRole="button" accessibilityLabel="Cerrar el menú">
          <Icon name="x" color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
