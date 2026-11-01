import { Lot } from '@/types/data';
import { createResourceStore } from './resource';

export const useLotStore = createResourceStore<Lot>('lot', 'lots', undefined, (l) => `lote ${l?.code ?? ''}`.trim());
