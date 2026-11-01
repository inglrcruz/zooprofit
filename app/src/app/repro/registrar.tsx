import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { findSow, SowInput } from '@/components/sow-input';
import { back, Bar, Btn, Card, Col, Grid, Grow, Row, Screen, T, Tag, Tile, Top } from '@/components/ui';
import { estadoDe, eventoDe, GRUPOS_REPRO } from '@/constants/eventos';
import { C } from '@/constants/tokens';
import { deCerda, POR_SERVIR } from '@/data/repro';
import { useRepro } from '@/hooks/use-repro';
import { useEsc } from '@/stores/escala.store';
import type { Registro, Sow } from '@/types/data';
import { addDays, diffDays, plural, relDays, today, viewDate } from '@/utilities/miscellaneous';

const GESTACION = 114;
const SIN_CERDA = ['alimento', 'pesada', 'venta'];

/** Lo que le toca a una cerda según su estado: el evento y por qué. */
function sugerencia(sow: Sow, historia: Registro[], edadDestete: number): { tipo: string; sub: string } | null {
  const ultimo = (tipo: string) => historia.filter((r) => r.tipo === tipo).pop();
  const hoy = today();
  if (POR_SERVIR.includes(sow.estadoActual)) return { tipo: 'inseminacion', sub: 'Está lista para servir' };
  if (sow.estadoActual === 'inseminada' || sow.estadoActual === 'gestante') {
    const ins = ultimo('inseminacion');
    if (!ins) return null;
    const dias = diffDays(ins.fecha, hoy);
    const parto = addDays(ins.fecha, GESTACION);
    if (dias >= GESTACION - 7) return { tipo: 'parto', sub: `Esperado ${relDays(parto)}, ${viewDate(parto)}` };
    if (sow.estadoActual === 'inseminada' && dias >= 18) return { tipo: 'diagnostico', sub: `Servida ${relDays(ins.fecha)}: toca revisar si quedó preñada` };
    return null;
  }
  if (sow.estadoActual === 'lactando') {
    const parto = ultimo('parto')?.fecha ?? sow.fechaUltimoParto;
    return parto ? { tipo: 'destete', sub: `Parió ${relDays(parto)} · destete hacia el ${viewDate(addDays(parto, edadDestete))}` } : { tipo: 'destete', sub: 'Tiene lechones' };
  }
  return null;
}

/** Otras cosas que suelen pasarle a una cerda en cada estado. */
const OTROS: Record<string, string[]> = {
  ...Object.fromEntries(POR_SERVIR.map((e) => [e, ['celo', 'medicacion', 'traslado', 'eliminar']])),
  inseminada: ['inseminacion', 'aborto', 'medicacion', 'muerte_cerda'],
  gestante: ['aborto', 'medicacion', 'traslado', 'muerte_cerda'],
  lactando: ['muerte_lactante', 'adopcion', 'medicacion', 'muerte_cerda'],
};

export default function Registrar() {
  const params = useLocalSearchParams<{ lotId?: string; arete?: string }>();
  const { lots, sows, registros, edadDestete } = useRepro();
  const [arete, setArete] = useState(params.arete ?? '');
  const [todos, setTodos] = useState(false);
  const [sinCerda, setSinCerda] = useState(false);
  const esc = useEsc();

  const lot = lots.find((l) => l.id === params.lotId);
  const sow = findSow(sows, arete);
  const historia = sow ? deCerda(registros, sow) : [];
  const toca = sow ? sugerencia(sow, historia, edadDestete) : null;
  const ins = historia.filter((r) => r.tipo === 'inseminacion').pop();
  const gestando = sow && (sow.estadoActual === 'gestante' || sow.estadoActual === 'inseminada') && ins;
  // La hoja se reemplaza por el formulario: al guardar se vuelve a donde se estaba.
  const open = (tipo: string, conCerda = true) =>
    router.replace({ pathname: '/evento', params: { tipo, ...(params.lotId ? { lotId: params.lotId } : {}), ...(conCerda && arete.trim() ? { arete: arete.trim() } : {}) } } as never);
  const boton = (tipo: string) => {
    const e = eventoDe(tipo);
    return (
      <Pressable
        key={tipo}
        onPress={() => open(tipo)}
        accessibilityRole="button"
        accessibilityLabel={e.label}
        style={{ height: esc(64), borderRadius: esc(18), borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: esc(14), flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={e.icon} size={esc(22)} color={e.tone === 'd' ? C.bad : C.green} />
        <T v="b" size={esc(15)} color={e.tone === 'd' ? C.bad : C.ink} numberOfLines={2} style={{ flex: 1 }}>{e.label}</T>
      </Pressable>
    );
  };

  return (
    <Screen
      top={<Top title="Registrar" sub={lot?.code} onBack={back} close />}
      footer={
        sinCerda ? undefined : <Btn kind="g" icon="box" label="No es de una cerda" onPress={() => setSinCerda(true)} />
      }>
      {sinCerda ? (
        <>
          <T v="b" size={15}>¿Qué vas a anotar?</T>
          <Grid cols={2}>{SIN_CERDA.map(boton)}</Grid>
          <Btn kind="g" label="Volver a buscar una cerda" onPress={() => setSinCerda(false)} />
        </>
      ) : (
        <>
          <SowInput value={arete} onChange={setArete} label="¿De qué cerda?" quiet />

          {sow ? (
            <Card style={{ padding: 14 }}>
              <Row>
                <Grow><T v="b" size={17}>ID {sow.arete}</T></Grow>
                <Tag tone={estadoDe(sow.estadoActual)[1]}>{estadoDe(sow.estadoActual)[0]}</Tag>
              </Row>
              {gestando ? <Bar pct={(diffDays(ins.fecha, today()) / GESTACION) * 100} height={10} /> : null}
              <Row>
                {gestando ? <Grow><T v="sub">Día {diffDays(ins.fecha, today())} de {GESTACION}</T></Grow> : <Grow />}
                <T v="sub">{plural(sow.partosHistoricos, 'parto')}{lots.find((l) => l.id === sow.lotIdActual) ? ` · ${lots.find((l) => l.id === sow.lotIdActual)!.code}` : ''}</T>
              </Row>
            </Card>
          ) : arete.trim() ? (
            <Card style={{ padding: 14, borderColor: C.line2 }}>
              <T v="b">No hay una cerda con el ID {arete.trim().toUpperCase()}</T>
              <T v="sub">Si es nueva en la granja, regístrala primero.</T>
              <Btn small icon="plus" label="Registrar cerda nueva" onPress={() => open('entrada')} />
            </Card>
          ) : (
            <T v="sub" size={15}>Escribe el ID y te digo qué le toca.</T>
          )}

          {sow && toca ? (
            <Col gap={8}>
              <T v="b" size={15}>Lo que le toca</T>
              <Pressable onPress={() => open(toca.tipo)} accessibilityRole="button" accessibilityLabel={`${eventoDe(toca.tipo).label}. ${toca.sub}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: C.forest }}>
                <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: C.yolk, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={eventoDe(toca.tipo).icon} size={26} />
                </View>
                <Grow style={{ gap: 2 }}>
                  <T v="h1" size={22} color="#fff">{eventoDe(toca.tipo).label}</T>
                  <T v="sub" size={14} color={C.forestText}>{toca.sub}</T>
                </Grow>
                <Icon name="next" color="#fff" />
              </Pressable>
            </Col>
          ) : null}

          {sow && !todos ? (
            <Col gap={8}>
              <T v="b" size={15}>{toca ? 'O registra otra cosa' : '¿Qué le pasó?'}</T>
              <Grid cols={2}>{(OTROS[sow.estadoActual] ?? ['medicacion', 'traslado']).filter((t) => t !== toca?.tipo).map(boton)}</Grid>
              <Pressable onPress={() => setTodos(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 12 }}>
                <T v="b" color={C.green}>Ver todos los tipos de evento</T>
              </Pressable>
            </Col>
          ) : null}

          {todos
            ? GRUPOS_REPRO.map((g) => (
                <Col key={g.title} gap={10}>
                  <T v="cap">{g.title}</T>
                  <Grid cols={4} gap={8}>
                    {g.tipos.map((tipo) => (
                      <Tile key={tipo} icon={eventoDe(tipo).icon} label={eventoDe(tipo).label} tone={g.tone} onPress={() => open(tipo)} />
                    ))}
                  </Grid>
                </Col>
              ))
            : null}
        </>
      )}
    </Screen>
  );
}
