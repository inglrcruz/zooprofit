import { Chips } from '@/components/ui';
import type { Lot } from '@/types/data';

/** Selector del lote abierto; no se muestra si solo hay uno. */
export function LotChips({ lots, lot, onChange }: { lots: Lot[]; lot?: Lot; onChange: (id: string) => void }) {
  if (lots.length < 2) return null;
  return <Chips options={lots.map((l) => l.code)} value={Math.max(0, lots.findIndex((l) => l.id === lot?.id))} onChange={(i) => onChange(lots[i].id)} />;
}
