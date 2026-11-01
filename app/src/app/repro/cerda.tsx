import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { RegistroList } from '@/components/registro-list';
import { SowSheet } from '@/components/sow-sheet';
import { back, Bar, Btn, Card, Empty, go, Grid, Grow, IconBtn, Loading, Row, Screen, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { estadoDe, eventoDe, resumen } from '@/constants/eventos';
import { C } from '@/constants/tokens';
import { ciclos, deCerda } from '@/data/repro';
import { useRepro } from '@/hooks/use-repro';
import { addDays, diffDays, today, viewDate } from '@/utilities/miscellaneous';

const GESTACION = 114;

export default function Cerda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rol, lots, sows, registros, refresh, loading, first } = useRepro();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);

  const sow = sows.find((s) => s.id === id);
  const historia = useMemo(() => (sow ? deCerda(registros, sow) : []), [registros, sow]);
  const lista = useMemo(() => (sow ? ciclos(historia, sow.partosHistoricos) : []), [historia, sow]);

  if (!sow) {
    return (
      <Screen top={<Top title="Cerda" onBack={() => back('/repro/cerdas')} />}>
        {first || loading ? <Loading /> : <Empty icon="alert" title="No se encontró la cerda" />}
      </Screen>
    );
  }

  const [estado, tone] = estadoDe(sow.estadoActual);
  const servicio = historia.filter((r) => r.tipo === 'inseminacion').pop();
  const gestando = (sow.estadoActual === 'gestante' || sow.estadoActual === 'inseminada') && servicio;
  const dia = gestando ? diffDays(servicio.fecha, today()) : 0;
  const prom = (campo: string, de: 'parto' | 'destete') => {
    const con = lista.filter((c) => c[de]);
    return con.length ? (con.reduce((n, c) => n + (Number(c[de]!.data?.[campo]) || 0), 0) / con.length).toFixed(1) : '—';
  };
  const lot = lots.find((l) => l.id === sow.lotIdActual);

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={
        <Top
          title={`ID ${sow.arete}`}
          onBack={() => back('/repro/cerdas')}
          right={
            <>
              {gestando ? null : <Tag tone={tone}>{estado}</Tag>}
              {can.write(rol) ? <IconBtn icon="edit" label="Corregir datos de la cerda" onPress={() => setEditing(true)} /> : null}
            </>
          }
        />
      }
      footer={can.write(rol) && sow.estadoActual !== 'descarte' ? <Btn icon="plus" label="Registrar algo de esta cerda" onPress={() => go(`/repro/registrar?arete=${encodeURIComponent(sow.arete)}`)} /> : undefined}>
      {gestando ? (
        <Card dark gap={12} style={{ borderRadius: 24, padding: 18 }}>
          <Row>
            <Grow><T v="sub" size={14} color={C.forestText}>{estado}</T></Grow>
            <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.yolk }}>
              <T v="b" size={13}>{dia >= GESTACION ? 'Ya le toca' : `Faltan ${GESTACION - dia} días`}</T>
            </View>
          </Row>
          <T v="h1" size={28} color="#fff">Pare el {viewDate(addDays(servicio.fecha, GESTACION))}</T>
          <Bar pct={(dia / GESTACION) * 100} height={10} track={C.forestLine} fill={C.yolk} />
          <Row>
            <Grow><T v="sub" color={C.forestText}>Servida el {viewDate(servicio.fecha)}</T></Grow>
            <T v="sub" color={C.forestText}>Día {dia} de {GESTACION}</T>
          </Row>
        </Card>
      ) : (
        <Card dark gap={6} style={{ borderRadius: 24, padding: 18 }}>
          <T v="sub" size={14} color={C.forestText}>Ahora mismo</T>
          <T v="h1" size={26} color="#fff">{sow.estadoActual === 'lactando' && sow.fechaUltimoParto ? `Lactando · día ${diffDays(sow.fechaUltimoParto, today())}` : estado}</T>
        </Card>
      )}

      <Grid cols={3}>
        <Card gap={2} style={{ padding: 12, borderRadius: 18, flex: 1 }}><T v="h1" size={24}>{sow.partosHistoricos}</T><T v="sub" size={12}>Partos</T></Card>
        <Card gap={2} style={{ padding: 12, borderRadius: 18, flex: 1 }}><T v="h1" size={24}>{prom('lechonesVivos', 'parto')}</T><T v="sub" size={12}>Vivos por parto</T></Card>
        <Card gap={2} style={{ padding: 12, borderRadius: 18, flex: 1 }}><T v="h1" size={24}>{prom('lechonesDestetados', 'destete')}</T><T v="sub" size={12}>Destetados</T></Card>
      </Grid>

      <T v="sub">{[sow.genetica, lot?.code, sow.fechaEntrada ? `en la granja desde ${viewDate(sow.fechaEntrada)}` : '', sow.codigosAnteriores?.length ? `antes ${sow.codigosAnteriores.join(', ')}` : ''].filter(Boolean).join(' · ')}</T>

      <T v="h2" size={19}>Su historia</T>
      {historia.length ? (
        <Card gap={0} style={{ padding: 16 }}>
          {[...historia].reverse().slice(0, 5).map((r, i, arr) => (
            <Row key={r.id} align="stretch">
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i === 0 ? C.yolk : i === 1 ? C.green : C.line2, borderWidth: i === 0 ? 3 : 0, borderColor: C.forest }} />
                {i < arr.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: C.line }} /> : null}
              </View>
              <Grow style={{ gap: 2, paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
                <T v="b">{eventoDe(r.tipo).label}{resumen(r) ? `: ${resumen(r)}` : ''}</T>
                <T v="sub">{viewDate(r.fecha)}</T>
              </Grow>
            </Row>
          ))}
        </Card>
      ) : (
        <Empty icon="heart" title="Todavía no tiene historia" sub="Aparece al registrarle su primer evento." />
      )}

      <Btn kind="g" icon="clock" label={history ? 'Ocultar todos los registros' : `Ver todos sus registros (${historia.length})`} onPress={() => setHistory(!history)} />
      {history ? <RegistroList registros={historia} showLot /> : null}

      <SowSheet sow={sow} visible={editing} onClose={() => setEditing(false)} onDeleted={() => back('/repro/cerdas')} />
    </Screen>
  );
}
