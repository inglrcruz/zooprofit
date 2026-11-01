import { useState } from 'react';

import { EntradaSheet } from '@/components/entrada-sheet';
import { Av, Btn, Col, Empty, Li, List, Sheet, T, Tag } from '@/components/ui';
import { can } from '@/constants/config';
import { eventoDe, resumen } from '@/constants/eventos';
import { useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { confirmarRegistro, eliminarRegistro } from '@/stores/registro.store';
import type { Registro } from '@/types/data';
import { dayLabel } from '@/utilities/miscellaneous';

const titulo = (r: Registro) => `${eventoDe(r.tipo).label}${r.cerdaCodigo ? ` · ID ${r.cerdaCodigo}` : ''}`;

/**
 * Registros agrupados por día, del más reciente al más antiguo. Al tocar uno
 * se puede confirmar o eliminar, según el rol.
 */
export function RegistroList({ registros, showLot, max = 60 }: { registros: Registro[]; showLot?: boolean; max?: number }) {
  const [open, setOpen] = useState<Registro | null>(null);
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<Registro | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const rol = useFarmStore((s) => s.rol);
  const lots = useLotStore((s) => s.list);
  const saving = useLoading('registro');
  const sorted = [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const shown = all ? sorted : sorted.slice(0, max);
  const days = [...new Set(shown.map((r) => r.fecha))];
  const lotCode = (id: string) => lots.find((l) => l.id === id)?.code;
  // Lo mismo que exige el API: quien audita cambia todo; el resto, sus pendientes.
  const mine = !!open && (can.audit(rol) || (open.creadoPor === userId && open.status === 'pending'));

  if (!registros.length) return <Empty icon="clock" title="Sin registros todavía" sub="Lo que se registre en este lote aparecerá aquí." />;

  const remove = (r: Registro) => {
    setOpen(null);
    useGlobalStore.getState().showConfirm({
      title: 'Eliminar registro',
      message: `Se eliminará "${titulo(r)}" del ${dayLabel(r.fecha)}.${r.cerdaCodigo ? ' El estado de la cerda no cambia: corrígelo desde su ficha si hace falta.' : ''}`,
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void eliminarRegistro(r).catch(() => null),
    });
  };

  return (
    <>
      {days.map((day) => (
        <Col key={day} gap={14}>
          <T v="cap">{dayLabel(day)}</T>
          <List>
            {shown
              .filter((r) => r.fecha === day)
              .map((r) => {
                const e = eventoDe(r.tipo);
                return (
                  <Li
                    key={r.id}
                    left={<Av icon={e.icon} tone={e.tone} />}
                    title={titulo(r)}
                    sub={[showLot ? lotCode(r.lotId) : '', resumen(r)].filter(Boolean).join(' · ') || undefined}
                    right={r.tipo === 'nota' ? null : <Tag tone={r.status === 'confirmed' ? 'k' : 'w'}>{r.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}</Tag>}
                    chevron={false}
                    onPress={() => setOpen(r)}
                  />
                );
              })}
          </List>
        </Col>
      ))}
      {sorted.length > shown.length ? <Btn small kind="g" label={`Ver los ${sorted.length - shown.length} anteriores`} onPress={() => setAll(true)} /> : null}

      <Sheet
        visible={!!open}
        title={open ? titulo(open) : ''}
        onClose={() => setOpen(null)}
        footer={
          open && mine ? (
            <>
              {open.status === 'pending' && open.tipo !== 'nota' && can.audit(rol) ? (
                <Btn icon="check" label="Confirmar registro" loading={saving} onPress={() => void confirmarRegistro(open).then(() => setOpen(null)).catch(() => null)} />
              ) : null}
              {open.tipo === 'entrada' && open.cerdaCodigo ? <Btn kind="g" icon="edit" label="Editar entrada" onPress={() => (setEditing(open), setOpen(null))} /> : null}
              <Btn kind="g" icon="trash" label="Eliminar" onPress={() => remove(open)} />
            </>
          ) : undefined
        }>
        {open ? (
          <>
            <T v="sub">{[dayLabel(open.fecha), lotCode(open.lotId)].filter(Boolean).join(' · ')}</T>
            {resumen(open) ? <T>{resumen(open)}</T> : null}
            {mine ? null : <T v="sub">Solo quien lo registró (mientras esté pendiente) o un supervisor puede cambiarlo.</T>}
          </>
        ) : null}
      </Sheet>
      {editing ? <EntradaSheet registro={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
