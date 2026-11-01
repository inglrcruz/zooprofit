import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Btn, Empty, go, Grid, Input, Li, List, Loading, Screen, T, TabBar, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { estadoDe } from '@/constants/eventos';
import { C } from '@/constants/tokens';
import { POR_SERVIR } from '@/data/repro';
import { useRepro } from '@/hooks/use-repro';
import type { Sow } from '@/types/data';
import { addDays, diffDays, plural, relDays, today } from '@/utilities/miscellaneous';

const FILTERS: [label: string, estados: string[]][] = [
  ['Servidas y preñadas', ['gestante', 'inseminada']],
  ['Lactando', ['lactando']],
  ['Por servir', POR_SERVIR],
  ['Todas', []],
];
const GESTACION = 114;
const PAGE = 60;

export default function Cerdas() {
  const { rol, lots, sows, registros, refresh, loading, first } = useRepro();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(3);
  const [limit, setLimit] = useState(PAGE);

  const activas = sows.filter((s) => s.estadoActual !== 'descarte');
  const en = (estados: string[]) => (estados.length ? sows.filter((s) => estados.includes(s.estadoActual)) : activas);
  const term = q.trim().toUpperCase();
  // Último servicio de cada cerda: de ahí sale cuánto le falta para parir.
  const servida = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of registros) {
      const key = r.sowId || r.cerdaCodigo;
      if (r.tipo === 'inseminacion' && r.fecha > (map.get(key) ?? '')) map.set(key, r.fecha);
    }
    return map;
  }, [registros]);
  const servicioDe = (s: Sow) => servida.get(s.id) ?? servida.get(s.arete);
  const dia = (s: Sow) => (s.estadoActual === 'gestante' || s.estadoActual === 'inseminada') && servicioDe(s) ? diffDays(servicioDe(s)!, today()) : null;
  const list = en(FILTERS[filter][1])
    .filter((s) => s.arete.toUpperCase().includes(term))
    // Las preñadas, primero la que pare antes; el resto, por arete.
    .sort((a, b) => (filter === 0 ? (dia(b) ?? -1) - (dia(a) ?? -1) : 0) || a.arete.localeCompare(b.arete, undefined, { numeric: true }));
  const lotCode = (id: string) => lots.find((l) => l.id === id)?.code;
  const sub = (s: Sow) => {
    const d = dia(s);
    const cuando = d !== null ? (d >= GESTACION ? 'Ya debería haber parido' : `Pare ${relDays(addDays(servicioDe(s)!, GESTACION))}`) : s.estadoActual === 'lactando' && s.fechaUltimoParto ? `Parió ${relDays(s.fechaUltimoParto)}` : plural(s.partosHistoricos, 'parto');
    return [cuando, lotCode(s.lotIdActual)].filter(Boolean).join(' · ');
  };

  return (
    <Screen
      tabs={<TabBar module="repro" active="cerdas" />}
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Top
          title="Cerdas"
          sub={`${activas.length} en la granja`}
          right={can.write(rol) ? <Btn small icon="plus" label="Nueva" a11y="Registrar una cerda nueva" onPress={() => go('/evento?tipo=entrada')} /> : null}
        />
      }>
      <View>
        <Input value={q} onChangeText={(t) => (setQ(t), setLimit(PAGE))} placeholder="Buscar por ID" accessibilityLabel="Buscar por ID" autoCapitalize="characters" autoCorrect={false} style={{ height: 56, paddingLeft: 48, fontSize: 17 }} />
        <View style={{ position: 'absolute', left: 16, top: 17 }} pointerEvents="none">
          <Icon name="search" color={C.mute} />
        </View>
      </View>
      <Grid cols={2} gap={8}>
        {FILTERS.map(([label, estados], i) => {
          const on = i === filter;
          return (
            <Pressable
              key={label}
              onPress={() => (setFilter(i), setLimit(PAGE))}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label}: ${en(estados).length}`}
              style={{ height: 60, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: on ? C.forest : C.card, borderWidth: on ? 0 : 1, borderColor: C.line }}>
              <T v="b" color={on ? '#fff' : C.ink} style={{ flex: 1 }}>{label}</T>
              <T v="h1" size={20} color={on ? '#fff' : label === 'Por servir' && en(estados).length ? C.warn : C.ink}>{en(estados).length}</T>
            </Pressable>
          );
        })}
      </Grid>

      {first ? <Loading /> : null}
      {list.length ? (
        <List>
          {list.slice(0, limit).map((s) => {
            const [label, tone] = estadoDe(s.estadoActual);
            return (
              <Li
                key={s.id}
                title={<T v="b" size={18}>{s.arete}</T>}
                sub={sub(s)}
                right={<Tag tone={dia(s) !== null && dia(s)! >= GESTACION - 7 ? 'w' : tone}>{dia(s) !== null ? `Día ${dia(s)}` : label}</Tag>}
                onPress={() => go(`/repro/cerda?id=${s.id}`)}
              />
            );
          })}
        </List>
      ) : first ? null : (
        <Empty icon="tag" title={sows.length ? 'No hay cerdas en esta búsqueda' : 'Aún no hay cerdas'} sub={sows.length ? undefined : 'Registra la primera con el botón Nueva.'} />
      )}
      {list.length > limit ? <Btn small kind="g" label={`Ver más (${list.length - limit})`} onPress={() => setLimit(limit + PAGE)} /> : null}
    </Screen>
  );
}
