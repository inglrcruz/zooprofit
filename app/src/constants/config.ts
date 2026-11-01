import Constants from 'expo-constants';

import type { FarmSpecies, FarmType, MemberRol } from '@/types/farm';
import type { IconName } from '@/components/icon';

/** Base del API; termina en "/" porque las rutas de los stores no la llevan. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/*$/, '/');
export const VERSION = Constants.expoConfig?.version || '';

export const ROLE_LABEL: Record<MemberRol | 'admin', string> = {
  admin: 'Dueño',
  veterinario: 'Veterinario',
  supervisor: 'Supervisor',
  asesor: 'Asesor',
  auxiliar: 'Ayudante',
  propietario: 'Solo mira',
  aportante: 'Socio',
  prestatario: 'Con préstamo',
};

/** Lo que puede hacer cada rol, en palabras de todos los días. */
export const ROLE_CAN: Record<MemberRol | 'admin', string> = {
  admin: 'puede hacer todo',
  veterinario: 'registra y confirma',
  supervisor: 'registra y confirma',
  asesor: 'registra',
  auxiliar: 'registra',
  propietario: 'solo puede ver',
  aportante: 've su dinero',
  prestatario: 've su préstamo',
};

/** Lo mismo que decide el backend (models.Role): aquí solo oculta lo que respondería 403. */
export const can = {
  members: (rol?: string | null) => rol === 'admin',
  audit: (rol?: string | null) => rol === 'admin' || rol === 'veterinario' || rol === 'supervisor',
  write: (rol?: string | null) => !!rol && !['propietario', 'aportante', 'prestatario'].includes(rol),
};

/** Roles que se pueden invitar según el tipo de módulo. */
export const INVITE_ROLES: Record<'coop' | 'farm', MemberRol[]> = {
  farm: ['auxiliar', 'supervisor', 'veterinario', 'asesor', 'propietario'],
  coop: ['aportante', 'prestatario', 'supervisor'],
};

export const MODULE_TYPES: { label: string; icon: IconName; species: FarmSpecies; types: FarmType[]; modes?: string[]; note?: string }[] = [
  { label: 'Cerdos', icon: 'tag', species: 'cerdos', types: ['reproduccion', 'produccion'], modes: ['Reproducción', 'Producción'], note: 'Se crearán automáticamente los lotes Entradas, Destetadas, Atrasadas y Descarte.' },
  { label: 'Aves', icon: 'egg', species: 'aves', types: ['ponedora', 'engorde'], modes: ['Ponedora', 'Engorde'] },
  { label: 'Fábrica', icon: 'factory', species: 'fabrica', types: ['fabrica'], note: 'Gestiona el inventario y los conteos de la fábrica de alimentos.' },
  { label: 'CoopProfit', icon: 'coin', species: 'coopprofit', types: ['coopprofit'], note: 'Gestiona aportantes, préstamos y el reparto de ganancias de tu cooperativa.' },
];

/** Cómo se presenta cada tipo de módulo y a qué pantalla entra. */
export const FARM_KIND: Record<FarmType, { label: string; icon: IconName; href: string }> = {
  reproduccion: { label: 'Cerdas de cría', icon: 'tag', href: '/repro' },
  produccion: { label: 'Cerdos de engorde', icon: 'scale', href: '/prod' },
  ponedora: { label: 'Gallinas ponedoras', icon: 'egg', href: '/aves' },
  engorde: { label: 'Pollos de engorde', icon: 'egg', href: '/aves' },
  fabrica: { label: 'Fábrica de alimento', icon: 'factory', href: '/fabrica' },
  coopprofit: { label: 'Cooperativa', icon: 'coin', href: '/coop' },
};
