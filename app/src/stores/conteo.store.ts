import { Conteo } from '@/types/data';
import { createResourceStore } from './resource';

export const useConteoStore = createResourceStore<Conteo>('conteo', 'conteos', undefined, 'conteo');
