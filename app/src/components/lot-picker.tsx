import { Chip, Row, T } from '@/components/ui';
import { useLotStore } from '@/stores/lot.store';

/** Chips de los lotes activos de la granja, de selección múltiple. */
export function LotPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const lots = useLotStore((s) => s.list).filter((l) => !l.archivado);
  if (!lots.length) return <T v="sub">Esta granja aún no tiene lotes.</T>;
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {lots.map((l) => {
        const on = value.includes(l.id);
        return <Chip key={l.id} label={l.code} on={on} onPress={() => onChange(on ? value.filter((id) => id !== l.id) : [...value, l.id])} />;
      })}
    </Row>
  );
}
