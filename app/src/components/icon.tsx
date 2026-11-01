import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { C } from '@/constants/tokens';

type F = ComponentProps<typeof Feather>['name'];
type M = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Feather por defecto; MaterialCommunityIcons ('m:') para lo que Feather no tiene.
const P = {
  back: 'chevron-left',
  next: 'chevron-right',
  down: 'chevron-down',
  up: 'chevron-up',
  plus: 'plus',
  minus: 'minus',
  x: 'x',
  check: 'check',
  home: 'home',
  list: 'menu',
  grid: 'grid',
  calendar: 'calendar',
  tag: 'tag',
  user: 'user',
  logout: 'log-out',
  sync: 'refresh-cw',
  repeat: 'rotate-cw',
  sliders: 'sliders',
  clock: 'clock',
  info: 'info',
  box: 'box',
  scale: 'm:scale-balance',
  egg: 'm:egg-outline',
  factory: 'm:factory',
  coin: 'dollar-sign',
  drop: 'droplet',
  search: 'search',
  heart: 'heart',
  arrowRight: 'arrow-right',
  arrowUp: 'arrow-up',
  arrowDown: 'arrow-down',
  alert: 'alert-triangle',
  adopt: 'user-plus',
  swap: 'm:swap-horizontal',
  flask: 'm:flask-outline',
  bulb: 'm:lightbulb-outline',
  wrench: 'tool',
  trash: 'trash-2',
  chart: 'bar-chart-2',
  barn: 'm:barn',
  spark: 'm:creation',
  download: 'download',
  upload: 'upload',
  send: 'send',
  link: 'link',
  lock: 'lock',
  eye: 'eye',
  key: 'key',
  dots: 'more-horizontal',
  edit: 'edit-2',
  users: 'users',
  erase: 'delete',
  swapV: 'm:unfold-more-horizontal',
} as const satisfies Record<string, F | `m:${M}`>;

export type IconName = keyof typeof P;

export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const n: string = P[name];
  return n.startsWith('m:') ? (
    <MaterialCommunityIcons name={n.slice(2) as M} size={size} color={color} />
  ) : (
    <Feather name={n as F} size={size} color={color} />
  );
}
