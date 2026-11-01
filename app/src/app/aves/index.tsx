import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';

import { LotChips } from '@/components/aves/lot-chips';
import { LotSheet } from '@/components/lotes/lot-sheet';
import { RegistroList } from '@/components/registro-list';
import { Btn, Card, Col, Empty, go, Grid, Grow, IconBtn, Loading, Row, Screen, swap, T, TabBar, Tile, Top } from '@/components/ui';
import { can, FARM_KIND } from '@/constants/config';
import { eventoDe, TIPOS_AVES } from '@/constants/eventos';
import { C } from '@/constants/tokens';
import { avesVivas, dias, semanaDeEdad } from '@/data/aves';
import { fmt } from '@/data/calc';
import { getDekalbStandard } from '@/data/dekalb';
import { useAves } from '@/hooks/use-aves';
import { useLoad } from '@/hooks/use-load';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { useProtocolStore } from '@/stores/protocol.store';
import { addDays, dayLabel, today, viewDate } from '@/utilities/miscellaneous';

export default function AvesInicio() {
  const { farm, rol, lots, lot, setLot, regs, registros, refresh, loading, first } = useAves();
  const protocols = useProtocolStore((s) => s.list);
  const refreshProtocols = useLoad(useProtocolStore);
  const [sheet, setSheet] = useState<'new' | 'edit' | null>(null);
  const write = can.write(rol);
  const hoy = today();

  const top = (
    <Top
      title={farm?.name ?? ''}
      sub={[FARM_KIND[farm?.type ?? 'ponedora'].label, lot ? `semana ${semanaDeEdad(lot, hoy)} de edad` : ''].filter(Boolean).join(' · ')}
      subAbove
      onTitle={() => swap('/modulos')}
      right={
        <>
          {write ? <IconBtn icon="plus" label="Nuevo lote" onPress={() => setSheet('new')} /> : null}
        </>
      }
    />
  );

  if (!lot) {
    return (
      <Screen tabs={<TabBar module="aves" active="inicio" />} top={top} refreshing={loading} onRefresh={refresh}>
        {first ? <Loading /> : <Empty icon="egg" title="Aún no hay lotes de aves" sub="Crea el primero con el botón + de arriba." />}
        <LotSheet visible={sheet === 'new'} onClose={() => setSheet(null)} />
      </Screen>
    );
  }

  const serie = dias(lot, registros);
  const ultimo = serie[serie.length - 1];
  const last7 = serie.filter((d) => d.huevos).slice(-7);
  const aves = avesVivas(lot, registros);
  const std = getDekalbStandard(semanaDeEdad(lot, ultimo?.fecha ?? hoy)).posturaHenDay;
  const [min, max] = [Math.min(...last7.map((d) => d.postura)) - 2, Math.max(...last7.map((d) => d.postura))];
  const retiros = protocols
    .filter((p) => p.lotId === lot.id && p.retiroDias > 0)
    .map((p) => ({ p, fin: addDays(p.fechaInicio, p.duracionDias - 1 + p.retiroDias) }))
    .filter((r) => r.fin >= hoy);

  const remove = () =>
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${lot.code}`,
      message: `Se borran el lote y sus ${regs.length} registros. No se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () => void useLotStore.getState().delete(lot.id).catch(() => null),
    });

  return (
    <Screen tabs={<TabBar module="aves" active="inicio" />} top={top} refreshing={loading} onRefresh={() => (refresh(), refreshProtocols())}>
      <LotChips lots={lots} lot={lot} onChange={setLot} />

      {retiros.map(({ p, fin }) => (
        <Pressable key={p.id} onPress={() => go('/aves/protocolos')} accessibilityRole="button" accessibilityLabel={`No vender huevos hasta el ${viewDate(fin)}. Ver el tratamiento`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.warn2 }}>
          <Icon name="alert" color={C.warn} />
          <Grow style={{ gap: 2 }}>
            <T v="b" color={C.warn}>No vender huevos hasta el {viewDate(fin)}</T>
            <T v="sub" color={C.warn}>Tratamiento con {p.medicamento || p.nombre}</T>
          </Grow>
        </Pressable>
      ))}

      <Card dark gap={14} style={{ borderRadius: 24, padding: 18 }}>
        <Row align="flex-end">
          <Grow style={{ gap: 4 }}>
            <T v="sub" size={14} color={C.forestText}>{ultimo?.huevos ? `Huevos · ${dayLabel(ultimo.fecha).split(' · ')[0].toLowerCase()}` : 'Huevos'}</T>
            <T v="h1" size={40} color="#fff">{ultimo?.huevos ? fmt(ultimo.huevos) : '—'}</T>
          </Grow>
          {ultimo?.huevos ? (
            <Col gap={2} align="flex-end">
              <T v="h1" size={22} color={C.yolk}>{Math.round(ultimo.postura)} de cada 100</T>
              <T v="sub" color={C.forestText}>gallinas pusieron</T>
            </Col>
          ) : null}
        </Row>
        {last7.length > 1 ? (
          <Row gap={8} align="flex-end" style={{ height: 52 }} accessibilityLabel={`Postura de los últimos días, entre ${min + 2} y ${max} por ciento`}>
            {last7.map((d, i) => (
              <View key={d.fecha} style={{ flex: 1, height: 12 + ((d.postura - min) / (max - min || 1)) * 40, borderRadius: 6, backgroundColor: i === last7.length - 1 ? C.yolk : C.forestLine }} />
            ))}
          </Row>
        ) : null}
        <Row>
          <Grow><T v="sub" color={C.forestText}>{last7.length > 1 ? `Últimos ${last7.length} días: ${last7[last7.length - 1].postura >= last7[0].postura ? 'subiendo' : 'bajando'}` : 'Aún sin días para comparar'}</T></Grow>
          {std ? <T v="sub" color={C.forestText}>Lo esperado: {Math.round(std)}</T> : null}
        </Row>
      </Card>

      <Grid cols={3}>
        {(
          [
            [fmt(aves), 'Gallinas vivas'],
            [String(ultimo?.muertes ?? 0), 'Muertes ese día'],
            [String(ultimo?.sacos ?? 0), 'Sacos de alimento'],
          ] as const
        ).map(([value, label]) => (
          <Card key={label} gap={2} style={{ padding: 12, borderRadius: 18, flex: 1 }}>
            <T v="h1" size={22}>{value}</T>
            <T v="sub" size={12}>{label}</T>
          </Card>
        ))}
      </Grid>

      {write ? (
        <>
          <Pressable onPress={() => go('/aves/registro')} accessibilityRole="button" accessibilityLabel="Anotar el día de hoy" style={{ height: 64, borderRadius: 22, backgroundColor: C.yolk, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="egg" />
            <T v="b" size={18}>Anotar el día de hoy</T>
          </Pressable>
          <Grid cols={4} gap={8}>
            <Tile icon="flask" label="Medicina" onPress={() => go('/aves/protocolos')} />
            {TIPOS_AVES.filter((t) => t !== 'alimento' && t !== 'muerte' && t !== 'iluminacion').map((tipo) => (
              <Tile key={tipo} icon={eventoDe(tipo).icon} label={eventoDe(tipo).label} tone={eventoDe(tipo).tone} onPress={() => go(`/evento?tipo=${tipo}&lotId=${lot.id}`)} />
            ))}
          </Grid>
          <Grid cols={3} gap={8}>
            {['alimento', 'muerte', 'iluminacion'].map((tipo) => (
              <Tile key={tipo} icon={eventoDe(tipo).icon} label={eventoDe(tipo).label} tone={eventoDe(tipo).tone} onPress={() => go(`/evento?tipo=${tipo}&lotId=${lot.id}`)} />
            ))}
          </Grid>
        </>
      ) : null}

      <T v="h2" size={19}>Lo último anotado</T>
      <RegistroList registros={regs} max={12} />

      {write ? (
        <>
          <Btn kind="g" label="Editar lote" onPress={() => setSheet('edit')} />
          <Btn kind="g" icon="trash" label="Eliminar lote" onPress={remove} />
        </>
      ) : null}
      <LotSheet visible={!!sheet} lot={sheet === 'edit' ? lot : null} onClose={() => setSheet(null)} />
    </Screen>
  );
}
