export const C = {
  ink: '#1F2A1C',
  ink2: '#414A3A',
  mute: '#646B58',
  line: '#E4DFD0',
  line2: '#C9C2AE',
  bg: '#F6F3EA',
  card: '#FFFFFF',
  green: '#2F6B3A',
  green2: '#E3EFDD',
  forest: '#1E3B26',
  forestLine: '#3B5E43',
  forestText: '#CFE0CC',
  yolk: '#F2C14E',
  ok: '#1A5F7A',
  ok2: '#DCEEF3',
  warn: '#8A4B08',
  warn2: '#FBEBCB',
  warnBar: '#C77A12',
  bad: '#A8321F',
  bad2: '#FBE5DF',
  neutral: '#EFEBDD',
  track: '#EAE5D6',
} as const;

export const F = {
  r: 'Manrope_500Medium',
  m: 'Manrope_600SemiBold',
  b: 'Manrope_700Bold',
  x: 'Manrope_800ExtraBold',
  d: 'BricolageGrotesque_700Bold',
  dx: 'BricolageGrotesque_800ExtraBold',
} as const;

export type Tone = 'info' | 'k' | 'w' | 'd' | 'n';

/** [fondo, texto] por tono: info, completado, pendiente, alerta, neutro */
export const TONE: Record<Tone, readonly [string, string]> = {
  info: [C.green2, C.green],
  k: [C.ok2, C.ok],
  w: [C.warn2, C.warn],
  d: [C.bad2, C.bad],
  n: [C.neutral, C.ink2],
};
