import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { faseLabel, LotSheet } from '@/components/lotes/lot-sheet';
import { RegistroList } from '@/components/registro-list';
import { back, Btn, Card, Empty, go, Grid, Grow, Input, Li, List, Loading, Row, Screen, Seg, Stat, T, Tag, Top } from '@/components/ui';
import { can } from '@/constants/config';
import { estadoDe } from '@/constants/eventos';
import { C } from '@/constants/tokens';
import { useLoading } from '@/hooks/use-load';
import { useRepro } from '@/hooks/use-repro';
import { useGlobalStore } from '@/stores/global.store';
import { useLotStore } from '@/stores/lot.store';
import { registrar } from '@/stores/registro.store';
import { plural, today } from '@/utilities/miscellaneous';

export default function Lote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rol, lots, sows, registros, refresh, loading, first } = useRepro();
  const saving = useLoading('registro');
  const [tab, setTab] = useState(0);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);

  const lot = lots.find((l) => l.id === id);
  const regs = registros.filter((r) => r.lotId === id);
  const cerdas = sows.filter((s) => s.lotIdActual === id);
  const cuenta = (tipo: string) => regs.filter((r) => r.tipo === tipo).length;
  const write = can.write(rol);

  const send = () => {
    if (!note.trim() || !lot) return;
    registrar({ tipo: 'nota', lotId: lot.id, fecha: today(), nota: note })
      .then(() => setNote(''))
      .catch(() => null);
  };
  const archive = () => lot && void useLotStore.getState().update(lot.id, { archivado: !lot.archivado }).catch(() => null);
  const remove = () =>
    lot &&
    useGlobalStore.getState().showConfirm({
      title: `Eliminar ${lot.code}`,
      message: `Se borran el lote y sus ${regs.length} registros. No se puede deshacer; si solo quieres ocultarlo, archívalo.`,
      confirmText: 'Eliminar',
      destructive: true,
      onConfirm: () =>
        void useLotStore
          .getState()
          .delete(lot.id)
          .then(() => back('/repro/lotes'))
          .catch(() => null),
    });

  if (!lot) {
    return (
      <Screen top={<Top title="Lote" onBack={() => back('/repro/lotes')} />}>
        {first || loading ? <Loading /> : <Empty icon="alert" title="No se encontró el lote" sub="Puede que lo hayan eliminado o que no tengas acceso." />}
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      top={<Top title={lot.code} sub={[lot.fase ? faseLabel(lot.fase) : '', plural(cerdas.length, 'cerda'), plural(regs.length, 'registro')].filter(Boolean).join(' · ')} onBack={() => back('/repro/lotes')} right={lot.archivado ? <Tag tone="n">Archivado</Tag> : null} />}
      footer={
        write ? (
          <Row gap={10}>
            <Grow>
              <Input value={note} onChangeText={setNote} onSubmitEditing={send} returnKeyType="send" placeholder="Escribe una nota…" accessibilityLabel="Escribe una nota" maxLength={2000} style={{ backgroundColor: C.bg, borderColor: C.line }} />
            </Grow>
            {note.trim() ? <Btn icon="send" a11y="Enviar nota" loading={saving} onPress={send} /> : <Btn icon="plus" label="Registrar" onPress={() => go(`/repro/registrar?lotId=${lot.id}`)} />}
          </Row>
        ) : undefined
      }>
      <Seg options={['Actividad', 'Cerdas', 'Resumen']} value={tab} onChange={setTab} />

      {tab === 0 ? <RegistroList registros={regs} /> : null}

      {tab === 1 ? (
        cerdas.length ? (
          <List>
            {cerdas.map((s) => {
              const [label, tone] = estadoDe(s.estadoActual);
              return <Li key={s.id} title={`ID ${s.arete}`} sub={`${plural(s.partosHistoricos, 'parto')}${s.motivoSalida ? ` · llegó por ${s.motivoSalida}` : ''}`} right={<Tag tone={tone}>{label}</Tag>} onPress={() => go(`/repro/cerda?id=${s.id}`)} />;
            })}
          </List>
        ) : (
          <Empty icon="tag" title="Sin cerdas en este lote" sub="Llegan al registrarles un evento aquí o al trasladarlas." />
        )
      ) : null}

      {tab === 2 ? (
        <>
          <Card>
            <Grid cols={3}>
              <Stat value={String(cerdas.length)} label={cerdas.length === 1 ? 'cerda' : 'cerdas'} />
              <Stat value={String(cuenta('inseminacion'))} label={cuenta('inseminacion') === 1 ? 'servicio' : 'servicios'} />
              <Stat value={String(cuenta('parto'))} label={cuenta('parto') === 1 ? 'parto' : 'partos'} />
            </Grid>
            <Grid cols={3}>
              <Stat value={String(regs.filter((r) => r.tipo === 'parto').reduce((n, r) => n + (Number(r.data?.lechonesVivos) || 0), 0))} label="nacidos vivos" />
              <Stat value={String(regs.filter((r) => r.tipo === 'destete').reduce((n, r) => n + (Number(r.data?.lechonesDestetados) || 0), 0))} label="destetados" />
              <Stat value={String(regs.filter((r) => r.status === 'pending' && r.tipo !== 'nota').length)} label="por confirmar" />
            </Grid>
            {lot.fechaInicio ? <T v="sub">Banda del {lot.fechaInicio} al {lot.fechaFin}</T> : null}
          </Card>
          {write && !lot.esFijo ? (
            <>
              <Btn kind="g" label="Editar lote" onPress={() => setEditing(true)} />
              <Btn kind="g" label={lot.archivado ? 'Reactivar lote' : 'Archivar lote'} onPress={archive} />
              <Btn kind="g" icon="trash" label="Eliminar lote" onPress={remove} />
            </>
          ) : null}
          {lot.esFijo ? <T v="sub">Este es un lote del sistema: no se puede editar ni eliminar.</T> : null}
        </>
      ) : null}

      <LotSheet visible={editing} lot={lot} onClose={() => setEditing(false)} />
    </Screen>
  );
}
