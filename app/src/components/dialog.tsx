import { Modal, View } from 'react-native';

import { Av, Btn, Row, T } from '@/components/ui';
import { C } from '@/constants/tokens';
import { useGlobalStore } from '@/stores/global.store';

const TYPE = {
  info: ['info', 'info'],
  success: ['check', 'k'],
  error: ['alert', 'd'],
} as const;

function Box({ children }: { children: React.ReactNode }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: 'rgba(31,42,28,0.45)' }}>
        <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 400, alignItems: 'center', gap: 10, padding: 24, borderRadius: 24, backgroundColor: C.card }}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Aviso global: lo abre cualquier store con `showAlert`. */
export function AlertDialog() {
  const alert = useGlobalStore((s) => s.alert);
  const hideAlert = useGlobalStore((s) => s.hideAlert);
  if (!alert.visible) return null;
  const [icon, tone] = TYPE[alert.type ?? 'info'];
  return (
    <Box>
      <Av icon={icon} tone={tone} />
      <T v="h2" style={{ textAlign: 'center' }}>{alert.title}</T>
      <T v="sub" size={15} color={C.ink2} style={{ textAlign: 'center', marginBottom: 8 }}>{alert.message}</T>
      <View style={{ alignSelf: 'stretch' }}>
        <Btn label="Entendido" onPress={hideAlert} />
      </View>
    </Box>
  );
}

/** Confirmación global, para lo que no se puede deshacer. */
export function ConfirmDialog() {
  const confirm = useGlobalStore((s) => s.confirm);
  const hideConfirm = useGlobalStore((s) => s.hideConfirm);
  if (!confirm.visible) return null;
  return (
    <Box>
      <Av icon={confirm.icon ?? (confirm.destructive ? 'trash' : 'info')} tone={confirm.destructive ? 'd' : 'info'} />
      <T v="h2" style={{ textAlign: 'center' }}>{confirm.title}</T>
      <T v="sub" size={15} color={C.ink2} style={{ textAlign: 'center', marginBottom: 8 }}>{confirm.message}</T>
      <Row gap={10} style={{ alignSelf: 'stretch' }}>
        <Btn kind="g" label={confirm.cancelText ?? 'Cancelar'} flex={1} onPress={hideConfirm} />
        <Btn
          kind={confirm.destructive ? 'd' : 'p'}
          label={confirm.confirmText ?? 'Confirmar'}
          flex={1}
          onPress={() => {
            hideConfirm();
            confirm.onConfirm?.();
          }}
        />
      </Row>
    </Box>
  );
}
