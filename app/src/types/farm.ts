export type FarmSpecies = 'cerdos' | 'aves' | 'fabrica' | 'coopprofit';
export type FarmType = 'reproduccion' | 'produccion' | 'ponedora' | 'engorde' | 'fabrica' | 'coopprofit';
export type MemberRol = 'veterinario' | 'supervisor' | 'asesor' | 'auxiliar' | 'propietario' | 'aportante' | 'prestatario';
export type Rol = MemberRol | 'admin';

export type KpiConfig = { inventarioMadres?: number; edadDestete?: number; targets?: Record<string, number> };

/** Ajustes libres que el backend guarda por granja y combina clave por clave. */
export type FarmConfig = {
  kpiConfig?: KpiConfig;
  weekConfig?: { diaInicio?: number };
  reglas?: Record<string, boolean | number>;
  catalogos?: { porcino?: { catTecnicos?: string[]; catSemen?: string[] } };
  /** Producción: granja de reproducción de la que recibe los destetes. */
  reproFarmId?: string;
};

export type Farm = {
  id: string;
  name: string;
  species: FarmSpecies;
  type: FarmType;
  ownerId: string;
  config: FarmConfig | null;
  /** Solo en GET /farms: mi rol en la granja. */
  rol?: Rol;
  createdAt?: string;
};

export type Member = {
  farmId: string;
  userId: string;
  rol: MemberRol;
  allowedLotIds: string[] | null;
  addedAt: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type Invitation = {
  id: string;
  farmId: string;
  code: string;
  nombre: string;
  rol: MemberRol;
  lotIds: string[];
  telefono: string;
  expiresAt: string;
  usado: boolean;
  createdAt: string;
};
