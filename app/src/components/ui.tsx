import { type Href, router } from 'expo-router';
import { Children, type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { C, F, TONE, type Tone } from '@/constants/tokens';
import { useAuthStore } from '@/stores/auth.store';
import { useEsc } from '@/stores/escala.store';
import { useMenu } from '@/stores/menu.store';
import { pendingOf, useOutbox } from '@/stores/outbox.store';
import { addDays, dmy, toDate, today } from '@/utilities/miscellaneous';

/* ───── navegación ───── */

export const go = (path: string) => router.push(path as Href);
export const swap = (path: string) => router.replace(path as Href);
/** Vuelve atrás; si no hay historial (recarga en web), va a `fallback`. */
export const back = (fallback: unknown = '/modulos') => (router.canGoBack() ? router.back() : swap(typeof fallback === 'string' ? fallback : '/modulos'));

/* ───── texto ───── */

const TV = {
  h1: { fontFamily: F.dx, fontSize: 25, letterSpacing: -0.5 },
  h2: { fontFamily: F.d, fontSize: 18 },
  big: { fontFamily: F.dx, fontSize: 28, letterSpacing: -0.5 },
  b: { fontFamily: F.x, fontSize: 15 },
  body: { fontFamily: F.b, fontSize: 15 },
  sub: { fontFamily: F.m, fontSize: 13, color: C.mute },
  cap: { fontFamily: F.b, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: C.mute },
} satisfies Record<string, TextStyle>;

export function T({
  v = 'body',
  color,
  size,
  style,
  ...p
}: TextProps & { v?: keyof typeof TV; color?: string; size?: number }) {
  return (
    <Text
      {...p}
      style={[
        { color: C.ink, fontVariant: ['tabular-nums'] },
        TV[v],
        size ? { fontSize: size } : null,
        color ? { color } : null,
        style,
      ]}
    />
  );
}

/* ───── estructura ───── */

/** Ancho máximo del contenido en tablet y escritorio. */
const MAX_W = 720;

type Gap = { gap?: number; align?: ViewStyle['alignItems'] };

export function Row({ gap = 12, align = 'center', style, ...p }: ViewProps & Gap) {
  return <View {...p} style={[{ flexDirection: 'row', alignItems: align, gap }, style]} />;
}

export function Col({ gap = 4, align, style, ...p }: ViewProps & Gap) {
  return <View {...p} style={[{ gap, alignItems: align }, style]} />;
}

export function Grow({ style, ...p }: ViewProps) {
  return <View {...p} style={[{ flex: 1, minWidth: 0 }, style]} />;
}

export function Grid({ cols, gap = 10, children }: { cols: number; gap?: number; children: ReactNode }) {
  const kids = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < kids.length; i += cols) rows.push(kids.slice(i, i + cols));
  return (
    <View style={{ gap }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {row.map((kid, j) => (
            <View key={j} style={{ flex: 1, minWidth: 0 }}>
              {kid}
            </View>
          ))}
          {Array.from({ length: cols - row.length }, (_, j) => (
            <View key={`e${j}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function Screen({
  top,
  children,
  footer,
  tabs,
  refreshing,
  onRefresh,
}: {
  top?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tabs?: ReactNode;
  /** con onRefresh, la pantalla se actualiza al deslizar hacia abajo */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <SyncBar />
      {top}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.green} colors={[C.green]} /> : undefined}
        style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 + (footer || tabs ? 0 : bottom) }}>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            gap: 10,
            padding: 12,
            paddingHorizontal: 20,
            paddingBottom: Math.max(bottom, 16),
            backgroundColor: C.card,
            borderTopWidth: 1,
            borderTopColor: C.line,
          }}>
          {footer}
        </View>
      ) : null}
      </KeyboardAvoidingView>
      {tabs}
    </SafeAreaView>
  );
}

export function Top({
  title,
  sub,
  subAbove,
  onBack,
  close,
  onTitle,
  right,
}: {
  title: string;
  sub?: string;
  /** subtítulo encima del título (pantallas raíz) */
  subAbove?: boolean;
  onBack?: () => void;
  close?: boolean;
  onTitle?: () => void;
  right?: ReactNode;
}) {
  const root = !onBack;
  const subEl = sub ? <T v="sub">{sub}</T> : null;
  const titleEl = (
    <Row gap={4}>
      <T v={root && !onTitle ? 'h1' : 'h2'} size={root && !onTitle ? undefined : 20} accessibilityRole="header">
        {title}
      </T>
      {onTitle ? <Icon name="down" /> : null}
    </Row>
  );
  const text = (
    <Col gap={0}>
      {subAbove ? subEl : null}
      {titleEl}
      {subAbove ? null : subEl}
    </Col>
  );
  return (
    <Row style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
      {onBack ? (
        <IconBtn icon={close ? 'x' : 'back'} label={close ? 'Cerrar' : 'Volver'} onPress={onBack} />
      ) : null}
      <Grow>
        {onTitle ? (
          <Pressable onPress={onTitle} accessibilityRole="button" accessibilityLabel={`${title}, cambiar de módulo`}>
            {text}
          </Pressable>
        ) : (
          text
        )}
      </Grow>
      {right}
    </Row>
  );
}

/* ───── superficies ───── */

export function Card({
  children,
  onPress,
  style,
  gap = 10,
  dark,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  gap?: number;
  dark?: boolean;
  label?: string;
}) {
  const s: ViewStyle[] = [
    {
      gap,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: dark ? C.forest : C.line,
      backgroundColor: dark ? C.forest : C.card,
    },
    style ?? {},
  ];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s}>
      {children}
    </Pressable>
  ) : (
    <View style={s}>{children}</View>
  );
}

/** Tarjeta con filas separadas por una línea */
export function List({ children }: { children: ReactNode }) {
  return (
    <Card gap={0} style={{ paddingVertical: 4 }}>
      {Children.toArray(children).map((kid, i) => (
        <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : null}>
          {kid}
        </View>
      ))}
    </Card>
  );
}

export function Li({
  left,
  title,
  sub,
  right,
  onPress,
  chevron = !!onPress,
}: {
  left?: ReactNode;
  title: ReactNode;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <Row style={{ minHeight: 60, paddingVertical: 10 }}>
      {left}
      <Grow style={{ gap: 2 }}>
        {typeof title === 'string' ? <T v="b">{title}</T> : title}
        {sub ? <T v="sub">{sub}</T> : null}
      </Grow>
      {right}
      {chevron ? <Icon name="next" color={C.mute} /> : null}
    </Row>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Av({ icon, text, tone = 'info', round }: { icon?: IconName; text?: string; tone?: Tone; round?: boolean }) {
  const [bg, fg] = TONE[tone];
  const size = round ? 36 : 44;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? 18 : 13,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {icon ? <Icon name={icon} color={fg} /> : <T v="b" size={14} color={fg}>{text}</T>}
    </View>
  );
}

export function Tag({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const [bg, fg] = TONE[tone];
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: bg, justifyContent: 'center' }}>
      <T v="b" size={12} color={fg} numberOfLines={1}>
        {children}
      </T>
    </View>
  );
}

export function Note({
  tone = 'info',
  icon = 'info',
  children,
  action,
  onPress,
}: {
  tone?: 'info' | 'w' | 'd';
  icon?: IconName;
  children: ReactNode;
  action?: string;
  onPress?: () => void;
}) {
  const [bg, fg] = TONE[tone];
  const ink = tone === 'info' ? C.forest : fg;
  const body = (
    <Row gap={10} style={{ padding: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: bg }}>
      <Icon name={icon} color={ink} />
      <Grow>
        <T v="sub" color={ink}>
          {children}
        </T>
      </Grow>
      {action ? <T v="b" size={13} color={fg}>{action}</T> : null}
      {onPress && !action ? <Icon name="next" color={ink} /> : null}
    </Row>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Bar({ pct, tone = 'info', height = 8, track = C.track, fill }: { pct: number; tone?: Tone; height?: number; track?: string; fill?: string }) {
  const color = fill ?? (tone === 'w' ? C.warnBar : TONE[tone][1]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function Stat({ value, label, color, size = 20, center }: { value: string; label: string; color?: string; size?: number; center?: boolean }) {
  return (
    <Col gap={0} align={center ? 'center' : undefined}>
      <T v="b" size={size} color={color}>
        {value}
      </T>
      <T v="sub" size={center ? 12 : 13}>
        {label}
      </T>
    </Col>
  );
}

/** Tarjeta verde oscuro con la cifra principal de la pantalla */
export function Hero({
  label,
  value,
  unit,
  side,
  sideLabel,
  children,
  foot,
}: {
  label: string;
  value: string;
  unit?: string;
  side?: string;
  sideLabel?: string;
  children?: ReactNode;
  foot?: [string, string];
}) {
  return (
    <Card dark gap={12}>
      <Row align="flex-end">
        <Grow>
          <T v="sub" color={C.forestText}>{label}</T>
          <T v="big" size={36} color="#fff">
            {value}
            {unit ? <T v="big" size={18} color="#fff">{` ${unit}`}</T> : null}
          </T>
        </Grow>
        {side ? (
          <Col gap={0} align="flex-end">
            <T v="b" size={20} color="#fff">{side}</T>
            <T v="sub" color={C.forestText}>{sideLabel}</T>
          </Col>
        ) : null}
      </Row>
      {children}
      {foot ? (
        <Row>
          <Grow><T v="b" size={12} color={C.forestText}>{foot[0]}</T></Grow>
          <T v="b" size={12} color={C.forestText}>{foot[1]}</T>
        </Row>
      ) : null}
    </Card>
  );
}

/** Tabla simple: primera columna a la izquierda, el resto a la derecha */
export function Table({ head, rows, flex }: { head: string[]; rows: ReactNode[][]; flex?: number[] }) {
  const cell = (c: ReactNode, i: number, isHead: boolean) => (
    <View key={i} style={{ flex: flex?.[i] ?? 1, alignItems: i ? 'flex-end' : 'flex-start' }}>
      {typeof c === 'string' ? <T v={isHead ? 'cap' : 'body'}>{c}</T> : c}
    </View>
  );
  return (
    <Col gap={10}>
      <Row gap={8}>{head.map((h, i) => cell(h, i, true))}</Row>
      {rows.map((r, i) => (
        <Row key={i} gap={8}>
          {r.map((c, j) => cell(c, j, false))}
        </Row>
      ))}
    </Col>
  );
}

/* ───── controles ───── */

export function IconBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  const esc = useEsc();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: esc(48),
        height: esc(48),
        borderRadius: esc(16),
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} size={esc(22)} />
    </Pressable>
  );
}

export function Btn({
  label,
  icon,
  kind = 'p',
  small,
  onPress,
  flex,
  disabled: off,
  loading,
  a11y,
}: {
  label?: string;
  icon?: IconName;
  /** p = principal, g = secundario con borde, s = suave, d = destructivo */
  kind?: 'p' | 'g' | 's' | 'd';
  small?: boolean;
  onPress?: () => void;
  flex?: number;
  disabled?: boolean;
  /** muestra un indicador y bloquea el botón mientras se guarda */
  loading?: boolean;
  a11y?: string;
}) {
  const esc = useEsc();
  const bg = kind === 'p' ? C.green : kind === 's' ? C.green2 : kind === 'd' ? C.bad : C.card;
  const fg = kind === 'p' || kind === 'd' ? '#fff' : kind === 's' ? C.green : C.ink;
  const disabled = off || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => ({
        flex,
        height: esc(small ? 44 : 56),
        paddingHorizontal: esc(16),
        borderRadius: esc(small ? 14 : 18),
        borderWidth: kind === 'g' ? 1 : 0,
        borderColor: C.line2,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      })}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={esc(22)} color={fg} /> : null}
      {label ? <T v="b" size={esc(small ? 14 : 16)} color={fg} numberOfLines={1}>{label}</T> : null}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, icon, wide }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName; wide?: boolean }) {
  const esc = useEsc();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={{
        height: esc(44),
        paddingHorizontal: esc(14),
        borderRadius: esc(22),
        borderWidth: 1,
        borderColor: on ? C.forest : C.line2,
        backgroundColor: on ? C.forest : C.card,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: wide ? 'flex-start' : 'center',
        gap: 6,
      }}>
      {icon ? <Icon name={icon} size={esc(16)} color={on ? '#fff' : C.ink2} /> : null}
      <T size={esc(14)} color={on ? '#fff' : C.ink2}>{label}</T>
    </Pressable>
  );
}

/** Fila de chips de selección única con scroll horizontal */
export function Chips({ options, value, onChange }: { options: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {options.map((o, i) => (
        <Chip key={o} label={o} on={i === value} onPress={() => onChange(i)} />
      ))}
    </ScrollView>
  );
}

export function Seg({ options, value, onChange, disabledFrom }: { options: string[]; value: number; onChange: (i: number) => void; disabledFrom?: number }) {
  const esc = useEsc();
  return (
    <Row gap={0} style={{ padding: 4, borderRadius: 14, backgroundColor: C.track }}>
      {options.map((o, i) => {
        const on = i === value;
        const off = disabledFrom !== undefined && i >= disabledFrom;
        return (
          <Pressable
            key={o}
            disabled={off}
            onPress={() => onChange(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: off }}
            style={{
              flex: 1,
              height: esc(40),
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? C.card : 'transparent',
            }}>
            <T size={esc(off ? 12.5 : 14)} color={on ? C.ink : off ? C.mute : C.ink2} numberOfLines={1}>
              {o}
            </T>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Col gap={6}>
      <T size={13} color={C.ink2}>
        {label}
        {hint ? <T v="sub">{` ${hint}`}</T> : null}
      </T>
      {children}
    </Col>
  );
}

export function Input({ strong, error, style, ...p }: TextInputProps & { strong?: boolean; error?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={C.mute}
      {...p}
      style={[
        {
          height: 52,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: strong ? 2 : 1,
          borderColor: error ? C.bad : strong ? C.green : C.line2,
          backgroundColor: C.card,
          fontFamily: strong ? F.x : F.m,
          fontSize: strong ? 20 : 16,
          color: C.ink,
        },
        style,
      ]}
    />
  );
}

export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const esc = useEsc();
  const side = (delta: number) => (
    <Pressable
      onPress={() => onChange(Math.max(0, value + delta))}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Sumar' : 'Restar'} uno a ${label}`}
      style={{
        width: esc(48),
        height: esc(48),
        borderRadius: esc(16),
        borderWidth: delta > 0 ? 0 : 1,
        borderColor: C.line2,
        backgroundColor: delta > 0 ? C.green : C.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={delta > 0 ? 'plus' : 'minus'} size={esc(22)} color={delta > 0 ? '#fff' : C.ink} />
    </Pressable>
  );
  return (
    <Row gap={6}>
      {side(-1)}
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        // Vacío en 0, para que al escribir no quede el cero pegado al número.
        value={value ? String(value) : ''}
        placeholder="0"
        placeholderTextColor={C.mute}
        maxLength={6}
        onChangeText={(t) => onChange(Number(t.replace(/\D/g, '')) || 0)}
        style={{ flex: 1, minWidth: 44, textAlign: 'center', fontFamily: F.dx, fontSize: esc(value >= 1000 ? 16 : 26), color: C.ink, padding: 0 }}
      />
      {side(1)}
    </Row>
  );
}

/** Una fila "nombre · menos · número · más", para contar sin teclear */
export function StepRow({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  const esc = useEsc();
  return (
    <Row style={{ paddingVertical: 10 }}>
      <Grow style={{ gap: 1 }}>
        <T v="b" size={16}>{label}</T>
        {hint ? <T v="sub">{hint}</T> : null}
      </Grow>
      <View style={{ width: esc(168) }}>
        <Stepper label={label.toLowerCase()} value={value} onChange={onChange} />
      </View>
    </Row>
  );
}

export function Tile({ icon, label, on, tone = 'info', onPress }: { icon: IconName; label: string; on?: boolean; tone?: Tone; onPress?: () => void }) {
  const esc = useEsc();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: esc(78),
        padding: 6,
        borderRadius: 16,
        borderWidth: on ? 2 : 1,
        borderColor: on ? C.green : C.line,
        backgroundColor: on ? C.green2 : C.card,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
      <Icon name={icon} size={esc(22)} color={TONE[tone][1]} />
      <T size={esc(11.5)} style={{ textAlign: 'center' }}>{label}</T>
    </Pressable>
  );
}

/** Opciones de selección única que pasan a otra línea si no caben */
export function Options<V extends string>({ options, value, onChange }: { options: readonly (readonly [V, string])[]; value: V | ''; onChange: (v: V) => void }) {
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {options.map(([v, label]) => (
        <Chip key={v} label={label} on={v === value} onPress={() => onChange(v)} />
      ))}
    </Row>
  );
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Calendario en una hoja. Al tocar el título se salta a los meses y de ahí a
 * los años, para llegar rápido a fechas lejanas. `max` limita hasta qué día se puede elegir.
 */
function Calendario({ value, max, onPick, onClose }: { value: string; max?: string; onPick: (ymd: string) => void; onClose: () => void }) {
  const base = toDate(value) ?? new Date();
  const [vista, setVista] = useState<'dias' | 'meses' | 'anios'>('dias');
  const [anio, setAnio] = useState(base.getFullYear());
  const [mes, setMes] = useState(base.getMonth());
  const hoy = today();
  const desde = anio - ((anio % 12) + 12) % 12;

  const mover = (n: number) => {
    if (vista === 'anios') return setAnio(anio + n * 12);
    if (vista === 'meses') return setAnio(anio + n);
    const d = new Date(anio, mes + n, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  };
  const celda = (key: string, label: string, on: boolean, off: boolean, onPress: () => void, a11y = label, marcada = false) => (
    <Pressable
      key={key}
      disabled={off}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: on, disabled: off }}
      style={{ height: 44, borderRadius: 12, borderWidth: marcada && !on ? 1 : 0, borderColor: C.green, backgroundColor: on ? C.forest : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <T size={15} color={on ? '#fff' : off ? C.line2 : C.ink} style={{ fontFamily: on ? F.x : F.b }}>{label}</T>
    </Pressable>
  );

  const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const dias = new Date(anio, mes + 1, 0).getDate();

  return (
    <Sheet visible title="Elegir fecha" onClose={onClose} footer={<Btn small kind="g" label="Ir a hoy" disabled={!!max && hoy > max} onPress={() => onPick(hoy)} />}>
      <Row gap={8}>
        <IconBtn icon="back" label="Anterior" onPress={() => mover(-1)} />
        <Pressable onPress={() => setVista(vista === 'dias' ? 'meses' : vista === 'meses' ? 'anios' : 'dias')} accessibilityRole="button" accessibilityLabel="Cambiar mes o año" style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: C.green2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <T v="b" size={16} color={C.forest}>{vista === 'dias' ? `${MESES[mes]} ${anio}` : vista === 'meses' ? String(anio) : `${desde} – ${desde + 11}`}</T>
          <Icon name="down" size={18} color={C.forest} />
        </Pressable>
        <IconBtn icon="next" label="Siguiente" onPress={() => mover(1)} />
      </Row>

      {vista === 'dias' ? (
        <Col gap={6}>
          <Grid cols={7} gap={4}>{SEMANA.map((d) => <T key={d} v="sub" size={12} style={{ textAlign: 'center' }}>{d}</T>)}</Grid>
          <Grid cols={7} gap={4}>
            {Array.from({ length: huecos }, (_, i) => <View key={`h${i}`} />)}
            {Array.from({ length: dias }, (_, i) => {
              const ymd = `${anio}-${pad(mes + 1)}-${pad(i + 1)}`;
              return celda(ymd, String(i + 1), ymd === value, !!max && ymd > max, () => onPick(ymd), dmy(ymd), ymd === hoy);
            })}
          </Grid>
        </Col>
      ) : null}
      {vista === 'meses' ? (
        <Grid cols={3} gap={8}>
          {MESES.map((m, i) => celda(m, m, i === mes, !!max && `${anio}-${pad(i + 1)}-01` > max, () => (setMes(i), setVista('dias')), `${m} ${anio}`))}
        </Grid>
      ) : null}
      {vista === 'anios' ? (
        <Grid cols={3} gap={8}>
          {Array.from({ length: 12 }, (_, i) => desde + i).map((y) => celda(String(y), String(y), y === anio, !!max && `${y}-01-01` > max, () => (setAnio(y), setVista('meses'))))}
        </Grid>
      ) : null}
    </Sheet>
  );
}

/** Fecha "YYYY-MM-DD" que se elige en el calendario y se muestra dd-mm-aaaa. `futuro` permite días por venir. */
export function DatePick({ value, onChange, futuro, label = 'Elegir fecha' }: { value: string; onChange: (ymd: string) => void; futuro?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? dmy(value) : 'sin fecha'}`} style={{ height: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="calendar" color={C.green} />
        <T size={16} color={value ? C.ink : C.mute}>{value ? dmy(value) : label}</T>
      </Pressable>
      {open ? <Calendario value={value} max={futuro ? undefined : today()} onClose={() => setOpen(false)} onPick={(ymd) => (onChange(ymd), setOpen(false))} /> : null}
    </>
  );
}

/** Fecha "YYYY-MM-DD": hoy, ayer u otra elegida en el calendario. */
export function DateField({ value, onChange, futuro }: { value: string; onChange: (ymd: string) => void; futuro?: boolean }) {
  const esc = useEsc();
  const hoy = today();
  const ayer = addDays(hoy, -1);
  const [open, setOpen] = useState(false);
  const other = value !== hoy && value !== ayer;
  return (
    <Col gap={8}>
      <Row gap={8}>
        {(
          [
            ['Hoy', value === hoy, () => onChange(hoy)],
            ['Ayer', value === ayer, () => onChange(ayer)],
            [other ? dmy(value) : 'Otro día', other, () => setOpen(true)],
          ] as const
        ).map(([label, on, onPress], i) => (
          <Pressable
            key={i}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={i === 2 ? `Elegir otra fecha en el calendario${other ? `: ${label}` : ''}` : label}
            accessibilityState={{ selected: on }}
            style={{ flex: i === 2 ? 1.5 : 1, height: esc(48), borderRadius: esc(16), borderWidth: on ? 0 : 1, borderColor: C.line2, backgroundColor: on ? C.forest : C.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {i === 2 ? <Icon name="calendar" size={esc(18)} color={on ? '#fff' : C.ink} /> : null}
            <T size={esc(15)} numberOfLines={1} color={on ? '#fff' : C.ink} style={{ fontFamily: on ? F.x : F.b }}>{label}</T>
          </Pressable>
        ))}
      </Row>
      {other ? null : <T v="sub">{dmy(value)}</T>}
      {open ? <Calendario value={value} max={futuro ? undefined : hoy} onClose={() => setOpen(false)} onPick={(ymd) => (onChange(ymd), setOpen(false))} /> : null}
    </Col>
  );
}

/* ───── estados ───── */

export function Loading() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }} accessibilityRole="progressbar" accessibilityLabel="Cargando">
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );
}

export function Empty({ icon = 'info', title, sub, children }: { icon?: IconName; title: string; sub?: string; children?: ReactNode }) {
  return (
    <Col gap={8} align="center" style={{ paddingVertical: 36, paddingHorizontal: 12 }}>
      <Av icon={icon} tone="n" />
      <T v="b" style={{ textAlign: 'center' }}>{title}</T>
      {sub ? <T v="sub" style={{ textAlign: 'center' }}>{sub}</T> : null}
      {children}
    </Col>
  );
}

/** Formulario que sube desde abajo sobre la pantalla */
export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,42,28,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', maxHeight: '88%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Row style={{ padding: 20, paddingBottom: 12 }}>
            <Grow><T v="h2" size={20} accessibilityRole="header">{title}</T></Grow>
            <IconBtn icon="x" label="Cerrar" onPress={onClose} />
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingBottom: 20 }}>
            {children}
          </ScrollView>
          {footer ? (
            <View style={{ gap: 10, padding: 12, paddingHorizontal: 20, paddingBottom: Math.max(bottom, 16), backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ───── navegación inferior por módulo ───── */

type TabDef = readonly [key: string, label: string, icon: IconName, path: string];
const TABS = {
  repro: {
    add: '/repro/registrar',
    addLabel: 'Registrar',
    items: [
      ['inicio', 'Hoy', 'home', '/repro'],
      ['cerdas', 'Cerdas', 'tag', '/repro/cerdas'],
      ['semana', 'Semana', 'calendar', '/repro/semana'],
    ],
  },
  prod: {
    add: '/prod/pesada',
    addLabel: 'Registrar una pesada',
    items: [
      ['lotes', 'Lotes', 'grid', '/prod'],
      ['granja', 'Granja', 'barn', '/prod/granja'],
      ['destetes', 'Destetes', 'download', '/prod/destetes'],
    ],
  },
  aves: {
    add: '/aves/registro',
    addLabel: 'Anotar el día',
    items: [
      ['inicio', 'Hoy', 'home', '/aves'],
      ['almacen', 'Huevos', 'box', '/aves/almacen'],
      ['reporte', 'Reporte', 'chart', '/aves/reporte'],
    ],
  },
} satisfies Record<string, { add: string; addLabel: string; items: TabDef[] }>;

/**
 * Barra flotante: lo de todos los días, el botón de registrar al centro y el
 * menú lateral con todo lo demás. `active` puede no ser ninguna pestaña.
 */
export function TabBar({ module, active }: { module: keyof typeof TABS; active: string }) {
  const { bottom } = useSafeAreaInsets();
  const esc = useEsc();
  const { add, addLabel, items } = TABS[module];
  const slot = (key: string, label: string, icon: IconName, onPress: () => void, on = false, role: 'tab' | 'button' = 'tab') => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'tab' ? { selected: on } : undefined}
      style={{ flex: 1, height: esc(56), borderRadius: 20, backgroundColor: on ? C.forestLine : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name={icon} size={esc(22)} color={on ? '#fff' : C.forestText} />
      <T size={esc(12)} color={on ? '#fff' : C.forestText} style={{ fontFamily: on ? F.x : F.b }}>{label}</T>
    </Pressable>
  );
  const tab = ([key, label, icon, path]: TabDef) => slot(key, label, icon, () => key !== active && swap(path), key === active);
  return (
    <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(bottom, 14) }}>
      <Row gap={4} style={{ padding: 8, borderRadius: 28, backgroundColor: C.forest }}>
        {items.slice(0, 2).map(tab)}
        <Pressable
          onPress={() => go(add)}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={{ width: esc(60), height: esc(60), marginHorizontal: 6, borderRadius: esc(30), backgroundColor: C.yolk, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={esc(28)} />
        </Pressable>
        {items.slice(2).map(tab)}
        {slot('menu', 'Menú', 'list', () => useMenu.getState().show(), false, 'button')}
      </Row>
    </View>
  );
}

/** Botón que abre el menú lateral, para las pantallas a las que se llega desde él */
export function MenuBtn() {
  return <IconBtn icon="list" label="Abrir el menú" onPress={() => useMenu.getState().show()} />;
}

/* ───── sin conexión ───── */

/**
 * Aviso de que se trabaja sin conexión o de que hay cambios por enviar. No
 * ocupa lugar cuando todo está al día. Al tocarlo se ve qué falta y se puede
 * enviar ahora o descartar lo que el servidor no aceptó.
 */
export function SyncBar() {
  const queue = useOutbox((s) => s.queue);
  const online = useOutbox((s) => s.online);
  const sending = useOutbox((s) => s.sending);
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const [open, setOpen] = useState(false);
  const [waiting, failed] = pendingOf(queue, userId);
  if (online && !waiting.length && !failed.length) return null;

  const n = waiting.length;
  const cambios = (k: number) => `${k} ${k === 1 ? 'cambio' : 'cambios'}`;
  const [tone, icon, text]: [Tone, IconName, string] = failed.length
    ? ['d', 'alert', `${cambios(failed.length)} no se ${failed.length === 1 ? 'pudo' : 'pudieron'} enviar`]
    : !online
      ? ['w', 'upload', n ? `Sin conexión · ${cambios(n)} guardado${n === 1 ? '' : 's'} en el teléfono` : 'Sin conexión · ves lo último guardado']
      : ['info', 'sync', `Enviando ${cambios(n)}…`];
  const [bg, fg] = TONE[tone];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${text}. Ver detalles`}
        style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8 }}>
        <Row gap={8} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: bg }}>
          <Icon name={icon} size={18} color={fg} />
          <Grow><T v="b" size={13} color={fg}>{text}</T></Grow>
          <Icon name="next" size={18} color={fg} />
        </Row>
      </Pressable>

      <Sheet
        visible={open}
        title={online ? 'Cambios por enviar' : 'Sin conexión'}
        onClose={() => setOpen(false)}
        footer={n ? <Btn icon="sync" label="Enviar ahora" loading={sending} onPress={() => void useOutbox.getState().flush()} /> : undefined}>
        <T v="sub" size={15}>
          {online
            ? 'Esto se guardó en el teléfono y se está enviando.'
            : 'Puedes seguir trabajando. Lo que registres se guarda en el teléfono y se envía solo cuando vuelva la conexión.'}
        </T>
        {failed.length ? (
          <>
            <T v="h2" size={17} color={C.bad}>El servidor no aceptó</T>
            <List>
              {failed.map((o) => (
                <Li key={o.id} title={o.label} sub={o.error} right={<Btn small kind="g" label="Descartar" a11y={`Descartar: ${o.label}`} onPress={() => useOutbox.getState().discard(o.id)} />} />
              ))}
            </List>
          </>
        ) : null}
        {n ? (
          <>
            <T v="h2" size={17}>Esperando para enviarse · {n}</T>
            <List>
              {waiting.slice(0, 30).map((o) => (
                <Li key={o.id} title={o.label} sub={new Date(o.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} />
              ))}
            </List>
            {n > 30 ? <T v="sub">Y {n - 30} más.</T> : null}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
