import { Boar } from '@/types/data';
import { createResourceStore } from './resource';

export const useBoarStore = createResourceStore<Boar>('boar', 'verracos', undefined, 'verraco');
