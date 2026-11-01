import { Sow } from '@/types/data';
import { createResourceStore } from './resource';

export const useSowStore = createResourceStore<Sow>('sow', 'cerdas', undefined, (s) => `cerda ${s?.arete ?? ''}`.trim());
