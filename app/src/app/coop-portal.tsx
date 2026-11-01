import { rd } from '@/components/coop/sheets';
import type { IconName } from '@/components/icon';
import { Av, Bar, Btn, Card, Empty, Grow, Li, List, Loading, Note, Row, Screen, swap, T, Tag, Top } from '@/components/ui';
import { C, type Tone } from '@/constants/tokens';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useAuthStore } from '@/stores/auth.store';
import { cuotaDe, useAportanteStore, useCoopMoveStore, usePrestamoStore } from '@/stores/coop.store';
import { useFarmStore } from '@/stores/farm.store';
import { viewDate } from '@/utilities/miscellaneous';

const MOVE: Record<string, [IconName, Tone, string, string]> = {
  aporte: ['plus', 'k', 'Aporte de capital', '+'],
  retiro: ['arrowDown', 'n', 'Retiro de capital', '−'],
  ganancia: ['arrowUp', 'k', 'Ganancia repartida', '+'],
  cuota: ['check', 'info', 'Cuota pagada', ''],
  interes: ['check', 'info', 'Interés pagado', ''],
};

/**
 * Lo que ve un aportante o un prestatario: solo sus propias filas. El API
 * ya las filtra por su cuenta, así que aquí se muestra todo lo que llega.
 */
export default function CoopPortal() {
  const user = useAuthStore((s) => s.user);
  const farm = useFarmStore((s) => s.current);
  const aportantes = useAportanteStore((s) => s.list);
  const prestamos = usePrestamoStore((s) => s.list);
  const moves = useCoopMoveStore((s) => s.list);
  const refresh = useLoad(useAportanteStore, usePrestamoStore, useCoopMoveStore);
  const loading = useLoading('listAportante', 'listPrestamo', 'listCoopMove');

  const capital = aportantes.reduce((n, a) => n + a.capital, 0);
  const ganado = moves.filter((m) => m.tipo === 'ganancia').reduce((n, m) => n + m.monto, 0);
  const vacio = !aportantes.length && !prestamos.length;

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title={`Hola, ${user?.name.split(' ')[0] ?? ''}`} sub={farm?.name ?? 'CoopProfit'} subAbove right={<Btn small kind="g" label="Salir" onPress={() => swap('/modulos')} />} />}>
      {loading && vacio ? <Loading /> : null}
      {!loading && vacio ? <Empty icon="coin" title="Aún no tienes movimientos" sub="Cuando el administrador enlace tu cuenta con tu aporte o tu préstamo, lo verás aquí." /> : null}

      {aportantes.length ? (
        <Card dark gap={14}>
          <Grow>
            <T v="sub" color={C.forestText}>Tu capital</T>
            <T v="big" size={36} color="#fff">{rd(capital)}</T>
          </Grow>
          <Row style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: C.forestLine }}>
            <Grow>
              <T v="sub" color={C.forestText}>Ganancias recibidas</T>
              <T v="b" size={22} color="#fff">{rd(ganado)}</T>
            </Grow>
          </Row>
        </Card>
      ) : null}

      {prestamos.map((p) => {
        const paid = p.pagadas >= p.cuotas;
        return (
          <Card key={p.id}>
            <Row>
              <Grow><T v="h2">Tu préstamo</T></Grow>
              <Tag tone={paid ? 'k' : 'info'}>{paid ? 'Pagado' : 'Activo'}</Tag>
            </Row>
            <Row>
              <Grow><T v="b">{p.pagadas} de {p.cuotas} cuotas pagadas</T></Grow>
              <T v="sub">{p.tasa}% quincenal</T>
            </Row>
            <Bar pct={(p.pagadas / p.cuotas) * 100} tone="k" height={10} />
            {paid ? null : <Note icon="calendar">Cada cuota es de {rd(cuotaDe(p).total)}. Te faltan {p.cuotas - p.pagadas}.</Note>}
          </Card>
        );
      })}

      {moves.length ? (
        <>
          <T v="h2">Historial</T>
          <List>
            {moves
              .filter((m) => MOVE[m.tipo])
              .map((m) => {
                const [icon, tone, title, sign] = MOVE[m.tipo];
                return <Li key={m.id} left={<Av icon={icon} tone={tone} />} title={title} sub={[viewDate(m.fecha), m.nota].filter(Boolean).join(' · ')} right={<T v="b" color={sign === '+' ? C.ok : C.ink}>{sign ? `${sign} ` : ''}{rd(m.monto)}</T>} />;
              })}
          </List>
        </>
      ) : null}
      {vacio ? null : <T v="sub" style={{ textAlign: 'center' }}>Solo lectura. Para aportes o retiros, contacta al administrador.</T>}
    </Screen>
  );
}
