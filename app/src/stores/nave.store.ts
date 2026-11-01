import { Corral, Nave } from '@/types/data';
import { createResourceStore } from './resource';

export const useNaveStore = createResourceStore<Nave>('nave', 'naves', undefined, 'nave');
export const useCorralStore = createResourceStore<Corral>('corral', 'corrales', undefined, 'corral');
