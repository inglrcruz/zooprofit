import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon } from '@/components/icon';

import { faseLabel, LotSheet } from '@/components/lotes/lot-sheet';
import { RegistroList } from '@/components/registro-list';
import { back, Btn, Card, Empty, go, Grid, Hero, Loading, Screen, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { eventoDe, TIPOS_PROD } from '@/constants/eventos';
import { C, type Tone } from '@/constants/tokens';
import { engorde } from '@/data/aves';
import { fmt } from '@/data/calc';
import { useLotes } from '@/hooks/use-lotes';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { diffDays, relDays, today } from '@/utilities/miscellaneous';

const W = 318;
const H = 90;

export default function ProdLote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rol, lots, registros, refresh, loading, first } = useLotes();
  const [editing, setEditing] = useState(false);
  const lot = lots.find((l) => l.id === id);

  if (!lot) {
    return (
      <Screen top={<Top title="Lote" onBack={() => back('/prod')} />}>
        {first || loading ? <Loading /> : <Empty icon="alert" title="No se encontró el lote" />}
      </Screen>
    );
  }

  const e = engorde(lot, registros);
  const regs = registros.filter((r) => r.lotId === lot.id);
  const pesos = e.pesadas.map((p) => p[1]);
  const max = Math.max(...pesos, 1);
  const pts = pesos.map((kg, i) => [pesos.length > 1 ? (i / (pesos.length - 1)) * (W - 8) + 4 : W / 2, H - 6 - (kg / max) * (H - 14)] as const);
  const last = pts[pts.length - 1];
  const ultima = e.pesadas[e.pesadas.length - 1];
  const inicio = lot.entryDate || lot.fechaInicio;
  const write = can.write(rol);
  /** Bien / atención según un umbral razonable; sin dato no se opina. */
  const chip = (ok: boolean | null): [string, Tone] | null => (ok === null ? null : ok ? ['Bien', 'k'] : ['Atención', 'w']);
  const kpis: { label: string; value: string; chip?: [string, Tone] | null; foot?: string }[] = [
    { label: 'Engorda por día', value: e.gananciaDiaria !== null ? `${e.gananciaDiaria.toFixed(2)} kg` : '—', chip: chip(e.gananciaDiaria === null ? null : e.gananciaDiaria >= 0.6) },
    { label: 'Alimento por kilo ganado', value: e.conversion !== null ? `${e.conversion.toFixed(2)} kg` : '—', chip: chip(e.conversion === null ? null : e.conversion <= 2.8) },
    { label: 'Se han muerto', value: `${e.muertes} ${e.muertes === 1 ? 'cerdo' : 'cerdos'}`, foot: e.mortalidad !== null ? `${e.mortalidad} de cada 100` : undefined },
    { label: 'Alimento usado', value: `${fmt(Math.round((e.alimentoKg * 2.20462) / 100))} sacos`, foot: `${(e.alimentoKg / 1000).toFixed(1)} toneladas` },
  ];

  const remove = () =>
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${lot.code}`,
      message: `Se borran el lote y sus ${regs.length} registros. No se puede deshacer; si el lote terminó, ciérralo.`,
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void useLotStore.getState().delete(lot.id).then(() => back('/prod')).catch(() => null),
    });

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Top
          title={lot.code}
          sub={[inicio ? `Día ${diffDays(inicio, today())}` : '', lot.nave, lot.data?.esCompra ? 'comprado' : lot.origenLotId ? 'nacido en la granja' : ''].filter(Boolean).join(' · ')}
          onBack={() => back('/prod')}
          right={lot.archivado ? <Tag tone="n">Cerrado</Tag> : lot.fase ? <Tag>{faseLabel(lot.fase)}</Tag> : null}
        />
      }>
      <Hero
        label="Peso promedio"
        value={ultima ? String(ultima[1]) : '—'}
        unit={ultima ? 'kg' : undefined}
        side={String(e.activos)}
        sideLabel={`cerdos, de ${lot.initialAnimals}`}
        foot={[lot.entryWeight ? `Entró con ${lot.entryWeight} kg` : 'Sin peso de entrada', ultima && pesos.length > 1 ? `Última pesada ${relDays(ultima[0])}` : 'Sin pesadas']}>
        {pts.length > 1 ? (
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`Curva de peso por pesada, de ${pesos[0]} a ${pesos[pesos.length - 1]} kg`}>
            <Path d={`M0 ${H - 4}H${W}M0 ${H / 2}H${W}`} stroke={C.forestLine} strokeWidth={1} />
            <Path d={`M${pts.map((p) => p.join(' ')).join('L')}`} fill="none" stroke={C.yolk} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={last[0]} cy={last[1]} r={5} fill="#fff" />
          </Svg>
        ) : null}
      </Hero>

      <Grid cols={2}>
        {kpis.map((k) => (
          <Card key={k.label} gap={2} style={{ padding: 12, paddingHorizontal: 14, borderRadius: 18, flex: 1 }}>
            <T v="sub">{k.label}</T>
            <T v="h1" size={22}>{k.value}</T>
            {k.chip ? <View style={{ alignSelf: 'flex-start' }}><Tag tone={k.chip[1]}>{k.chip[0]}</Tag></View> : k.foot ? <T v="sub">{k.foot}</T> : null}
          </Card>
        ))}
      </Grid>

      {write && !lot.archivado ? (
        <>
          <T v="h2" size={19}>Anotar en este lote</T>
          <Grid cols={2}>
            {TIPOS_PROD.map((tipo) => {
              const ev = eventoDe(tipo);
              const main = tipo === 'pesada';
              return (
                <Pressable
                  key={tipo}
                  onPress={() => go(main ? `/prod/pesada?lotId=${lot.id}` : `/evento?tipo=${tipo}&lotId=${lot.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={ev.label}
                  style={{ height: 60, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: main ? C.yolk : C.card, borderWidth: main ? 0 : 1, borderColor: C.line }}>
                  <Icon name={ev.icon} color={main ? C.ink : ev.tone === 'd' ? C.bad : C.green} />
                  <T v="b" size={16} color={ev.tone === 'd' ? C.bad : C.ink}>{ev.label}</T>
                </Pressable>
              );
            })}
          </Grid>
        </>
      ) : null}

      <T v="h2" size={19}>Lo anotado en el lote</T>
      <RegistroList registros={regs} max={15} />

      {write ? (
        <>
          <Btn kind="g" label="Editar lote" onPress={() => setEditing(true)} />
          <Btn kind="g" label={lot.archivado ? 'Reabrir lote' : 'Cerrar lote'} onPress={() => void useLotStore.getState().update(lot.id, { archivado: !lot.archivado, fechaCierre: lot.archivado ? '' : today() }).catch(() => null)} />
          <Btn kind="g" icon="trash" label="Eliminar lote" onPress={remove} />
        </>
      ) : null}

      <LotSheet visible={editing} lot={lot} onClose={() => setEditing(false)} />
    </Screen>
  );
}
