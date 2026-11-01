import { Protocol } from '@/types/data';
import { createResourceStore } from './resource';

// A protocol is created under its lot and reached by id from the farm.
export const useProtocolStore = createResourceStore<Protocol>('protocol', 'protocolos', (p) => `lots/${p.lotId}/protocolos`, 'protocolo');
