import { Aportante, CoopMove, Prestamo } from '@/types/data';
import { today } from '@/utilities/miscellaneous';
import { createResourceStore } from './resource';

export const useAportanteStore = createResourceStore<Aportante>('aportante', 'aportantes', undefined, 'socio');
export const usePrestamoStore = createResourceStore<Prestamo>('prestamo', 'prestamos', undefined, 'préstamo');
export const useCoopMoveStore = createResourceStore<CoopMove>('coopMove', 'coop-movimientos', undefined, 'movimiento de dinero');

/** Capital e interés de cada cuota quincenal de un préstamo. */
export const cuotaDe = (p: Pick<Prestamo, 'monto' | 'tasa' | 'cuotas'>) => {
  const capital = p.cuotas > 0 ? p.monto / p.cuotas : 0;
  const interes = p.monto * (p.tasa / 100);
  return { capital, interes, total: capital + interes };
};

/** Intereses cobrados que aún no se han repartido. */
export const interesesPorRepartir = (moves: CoopMove[]) =>
  moves.reduce((a, m) => a + (m.tipo === 'interes' ? m.monto : m.tipo === 'reparto' ? -m.monto : 0), 0);

/**
 * Registers a capital contribution (positive) or withdrawal (negative) of an
 * aportante: the ledger line first, then the new capital.
 */
export const moverCapital = async (a: Aportante, monto: number, nota = '') => {
  await useCoopMoveStore.getState().create({ tipo: monto >= 0 ? 'aporte' : 'retiro', monto: Math.abs(monto), fecha: today(), aportanteId: a.id, userId: a.userId, nota });
  return useAportanteStore.getState().update(a.id, { capital: a.capital + monto });
};

/**
 * Registers the payment of the next instalment of a loan: its capital and
 * its interest as two ledger lines, then one more paid instalment.
 */
export const pagarCuota = async (p: Prestamo) => {
  const { capital, interes } = cuotaDe(p);
  const line = { fecha: today(), prestamoId: p.id, userId: p.userId, nota: `Cuota ${p.pagadas + 1} de ${p.cuotas}` };
  const moves = useCoopMoveStore.getState();
  await moves.create({ ...line, tipo: 'cuota', monto: capital });
  if (interes > 0) await moves.create({ ...line, tipo: 'interes', monto: interes });
  return usePrestamoStore.getState().update(p.id, { pagadas: p.pagadas + 1 });
};

/**
 * Distributes the collected interest: half to the aportantes in proportion
 * to their capital, half stays in the cooperative.
 */
export const repartir = async () => {
  const moves = useCoopMoveStore.getState();
  const total = interesesPorRepartir(moves.list);
  const aportantes = useAportanteStore.getState().list.filter((a) => a.capital > 0);
  const capital = aportantes.reduce((s, a) => s + a.capital, 0);
  if (total <= 0 || capital <= 0) return;
  // The "reparto" line goes first: if a later line fails, the interest is
  // not offered for distribution a second time.
  await moves.create({ tipo: 'reparto', monto: total, fecha: today(), nota: '50% aportantes · 50% cooperativa' });
  for (const a of aportantes) {
    await moves.create({ tipo: 'ganancia', monto: Math.round((total / 2) * (a.capital / capital) * 100) / 100, fecha: today(), aportanteId: a.id, userId: a.userId });
  }
};
