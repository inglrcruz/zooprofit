// Entidades que cuelgan de una granja (backend: internal/models/farm_data.go).

type Base = { id: string; farmId: string; createdAt?: string; updatedAt?: string };

export type Lot = Base & {
  code: string;
  /** "__entradas__", "__destetadas__", "__atrasadas__", "__descarte__" en los lotes del sistema. */
  codeInterno: string;
  esFijo: boolean;
  nave: string;
  fase: string;
  subLabel: string;
  archivado: boolean;
  sortOrder: number;
  parentLotId: string;
  origenLotId: string;
  entryDate: string;
  birthDate: string;
  fechaInicio: string;
  fechaFin: string;
  fechaCierre: string;
  initialAnimals: number;
  activeAnimals: number;
  entryWeight: number;
  data: Record<string, any> | null;
};

export type RegistroStatus = 'pending' | 'confirmed';

export type Registro = Base & {
  lotId: string;
  tipo: string;
  fecha: string;
  status: RegistroStatus;
  sowId: string;
  cerdaCodigo: string;
  nota: string;
  /** Depende del tipo: verraco, lechonesVivos, pilas, pesoTotal… */
  data: Record<string, any> | null;
  creadoPor: string;
  confirmedBy: string;
  confirmedAt: string | null;
};

export type EstadoCerda = 'vacia' | 'inseminada' | 'gestante' | 'lactando' | 'celo' | 'destetada' | 'abortada' | 'descarte';

export type Sow = Base & {
  arete: string;
  tipo: string;
  genetica: string;
  estadoActual: EstadoCerda | string;
  lotIdActual: string;
  lotOrigenId: string;
  fechaEntrada: string;
  fechaNacimiento: string;
  fechaUltimoParto: string;
  partosHistoricos: number;
  numRepeticiones: number;
  motivoSalida: string;
  codigosAnteriores: string[] | null;
  data: Record<string, any> | null;
};

export type Boar = Base & { codigo: string; nombre: string; genetica: string; fechaEntrada: string; activo: boolean };

export type Nave = Base & { nombre: string; tipo: string; orden: number };

export type Corral = Base & {
  naveId: string;
  numero: string;
  largo: number;
  ancho: number;
  capacidad: number;
  animalesActivos: number;
  lotId: string;
};

export type Product = Base & {
  codigo: string;
  descripcion: string;
  tipo: string;
  unidad: string;
  minimo: number;
  costo: number;
  /** Solo cambia mediante movimientos. */
  existencia: number;
};

export type ProductMove = Base & {
  productId: string;
  /** Con signo: positivo entra, negativo sale. */
  cantidad: number;
  tipo: string;
  fecha: string;
  lotId: string;
  nota: string;
};

export type Protocol = Base & {
  lotId: string;
  nombre: string;
  medicamento: string;
  categoria: string;
  via: string;
  dosis: string;
  fechaInicio: string;
  duracionDias: number;
  retiroDias: number;
  activo: boolean;
};

export type ConteoItem = { bultos?: number; librasSueltas?: number };
export type Conteo = Base & { fecha: string; status: 'abierto' | 'cerrado'; items: Record<string, ConteoItem> | null };

export type Aportante = Base & { userId: string; nombre: string; capital: number };
export type Prestamo = Base & { userId: string; nombre: string; monto: number; tasa: number; cuotas: number; pagadas: number; fecha: string };

/** aporte · retiro · cuota (capital) · interes · ganancia (a un aportante) · reparto (total repartido) */
export type CoopMove = Base & { userId: string; aportanteId: string; prestamoId: string; tipo: string; monto: number; fecha: string; nota: string };
