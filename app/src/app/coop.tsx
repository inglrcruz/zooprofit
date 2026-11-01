import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AportanteSheet, NuevoSheet, PrestamoSheet, rd } from '@/components/coop/sheets';
import { Av, back, Bar, Btn, Card, Empty, Hero, MenuBtn, Li, List, Loading, Row, Screen, Seg, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { C } from '@/constants/tokens';
import { useLoad, useLoading } from '@/hooks/use-load';
import { interesesPorRepartir, repartir, useAportanteStore, useCoopMoveStore, usePrestamoStore } from '@/stores/coop.store';
import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';
import type { Aportante, Prestamo } from '@/types/data';
import { getUserInitials, viewDate } from '@/utilities/miscellaneous';

export default function Coop() {
  const farm = useFarmStore((s) => s.current);
  const rol = useFarmStore((s) => s.rol);
  const aportantes = useAportanteStore((s) => s.list);
  const prestamos = usePrestamoStore((s) => s.list);
  const moves = useCoopMoveStore((s) => s.list);
  const refresh = useLoad(useAportanteStore, usePrestamoStore, useCoopMoveStore);
  const loading = useLoading('listAportante', 'listPrestamo', 'listCoopMove');
  const saving = useLoading('coopMove');
  const [tab, setTab] = useState(0);
  const [creating, setCreating] = useState(false);
  const [aportante, setAportante] = useState<Aportante | null>(null);
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const write = can.write(rol);
  // Quien administra enlaza filas con cuentas: necesita la lista de miembros.
  useFocusEffect(useCallback(() => void (can.members(rol) && useFarmStore.getState().findMembers().catch(() => null)), [rol]));

  const capital = aportantes.reduce((n, a) => n + a.capital, 0);
  const prestado = prestamos.reduce((n, p) => n + (p.monto / p.cuotas) * (p.cuotas - p.pagadas), 0);
  const intereses = interesesPorRepartir(moves);
  const mitad = intereses / 2;
  const repartos = moves.filter((m) => m.tipo === 'reparto');

  const distribute = () =>
    useGlobalStore.getState().showConfirm({
      title: 'Repartir ganancias',
      message: `Se repartirán ${rd(mitad)} entre ${aportantes.filter((a) => a.capital > 0).length} socios, según lo que aportó cada uno. Los otros ${rd(mitad)} quedan en la cooperativa.`,
      confirmText: 'Repartir',
      icon: 'coin',
      onConfirm: () => void repartir().catch(() => null),
    });

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Top
          title="Cooperativa"
          sub={farm?.name}
          onBack={() => back('/modulos')}
          right={
            <>
              <MenuBtn />
              {write ? <Btn small icon="plus" label="Nuevo" onPress={() => setCreating(true)} /> : null}
            </>
          }
        />
      }>
      {loading && !aportantes.length && !prestamos.length ? <Loading /> : null}

      <Hero label="Dinero de la cooperativa" value={rd(capital)} foot={[`Prestado ${rd(prestado)}`, `Disponible para prestar ${rd(capital - prestado)}`]}>
        <Bar pct={capital ? (prestado / capital) * 100 : 0} track={C.forestLine} fill={C.yolk} />
      </Hero>

      <Card style={{ borderColor: intereses > 0 ? C.yolk : C.line, borderWidth: intereses > 0 ? 2 : 1, borderRadius: 22 }}>
        <T v="sub" size={14}>Ganancias por repartir</T>
        <T v="h1" size={28}>{rd(intereses)}</T>
        {intereses > 0 ? (
          <>
            <Row gap={10}>
              <View style={{ flex: 1, gap: 2, padding: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.green2 }}>
                <T v="sub" size={12} color={C.forest}>La mitad para los socios</T>
                <T v="b" size={16} color={C.forest}>{rd(mitad)}</T>
              </View>
              <View style={{ flex: 1, gap: 2, padding: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.neutral }}>
                <T v="sub" size={12} color={C.ink2}>La mitad se queda</T>
                <T v="b" size={16}>{rd(mitad)}</T>
              </View>
            </Row>
            {write ? <Btn label="Repartir ahora" disabled={capital <= 0} loading={saving} onPress={distribute} /> : null}
          </>
        ) : (
          <T v="sub">Aparecen aquí cuando se cobra el interés de una cuota.</T>
        )}
      </Card>

      <Seg options={[`Socios · ${aportantes.length}`, `Préstamos · ${prestamos.length}`, 'Repartos']} value={tab} onChange={setTab} />

      {tab === 0 ? (
        aportantes.length ? (
          <>
            <List>
              {aportantes.map((a) => {
                const share = capital ? a.capital / capital : 0;
                return (
                  <Li
                    key={a.id}
                    left={<Av text={getUserInitials(a.nombre)} />}
                    title={a.nombre}
                    sub={`${mitad > 0 ? `Le tocan ${rd(mitad * share)}` : `${Math.round(share * 100)}% del dinero`}${a.userId ? ' · con acceso' : ''}`}
                    right={<T v="b">{rd(a.capital)}</T>}
                    chevron={false}
                    onPress={write ? () => setAportante(a) : undefined}
                  />
                );
              })}
            </List>
            {write ? <T v="sub">Toca a un socio para anotar un aporte o un retiro.</T> : null}
          </>
        ) : loading ? null : (
          <Empty icon="coin" title="Aún no hay socios" sub="Agrégalos con el botón Nuevo." />
        )
      ) : null}

      {tab === 1 ? (
        prestamos.length ? (
          <List>
            {prestamos.map((p) => {
              const paid = p.pagadas >= p.cuotas;
              return (
                <Li
                  key={p.id}
                  title={p.nombre}
                  sub={`${rd(p.monto)} · ${p.tasa}% quincenal · cuota ${p.pagadas} de ${p.cuotas}`}
                  right={<Tag tone={paid ? 'k' : 'info'}>{paid ? 'Pagado' : 'Activo'}</Tag>}
                  chevron={false}
                  onPress={write ? () => setPrestamo(p) : undefined}
                />
              );
            })}
          </List>
        ) : loading ? null : (
          <Empty icon="coin" title="Aún no hay préstamos" sub="Créalos con el botón Nuevo." />
        )
      ) : null}

      {tab === 2 ? (
        repartos.length ? (
          <List>
            {repartos.map((r) => (
              <Li key={r.id} left={<Av icon="check" tone="k" />} title={`Reparto de ${rd(r.monto)}`} sub={`${viewDate(r.fecha)} · 50% aportantes, 50% cooperativa`} />
            ))}
          </List>
        ) : (
          <T v="sub" style={{ textAlign: 'center', paddingVertical: 24 }}>Sin repartos aún</T>
        )
      ) : null}

      <NuevoSheet visible={creating} onClose={() => setCreating(false)} />
      <AportanteSheet aportante={aportante} onClose={() => setAportante(null)} />
      <PrestamoSheet prestamo={prestamo} onClose={() => setPrestamo(null)} />
    </Screen>
  );
}
