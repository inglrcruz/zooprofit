import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { EventFields, missing, toData } from '@/components/event-fields';
import { findSow, SowInput } from '@/components/sow-input';
import { Icon } from '@/components/icon';
import { back, Btn, Card, DateField, Field, Grow, Input, Note, Options, Row, Screen, T, Top } from '@/components/ui';
import { C } from '@/constants/tokens';
import { eventoDe } from '@/constants/eventos';
import { mergeReglas } from '@/data/reglas';
import { loteFijo } from '@/data/repro';
import { useLoad, useLoading } from '@/hooks/use-load';
import { useBoarStore } from '@/stores/boar.store';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { registrar, useRegistroStore } from '@/stores/registro.store';
import { useSowStore } from '@/stores/sow.store';
import { addDays, num, today, viewDate } from '@/utilities/miscellaneous';

/**
 * Formulario de cualquier evento: /evento?tipo=parto&lotId=…&arete=…
 * Los campos de cada tipo salen de constants/eventos.
 */
export default function EventoScreen() {
  const params = useLocalSearchParams<{ tipo: string; lotId?: string; arete?: string }>();
  const evento = eventoDe(params.tipo);
  const repro = useFarmStore((s) => s.current?.type === 'reproduccion');
  const lots = useLotStore((s) => s.list);
  const sows = useSowStore((s) => s.list);
  const saving = useLoading('registro', 'sow', 'lot');
  useLoad(useLotStore, useSowStore, useBoarStore, useRegistroStore);

  const [arete, setArete] = useState(params.arete ?? '');
  const [fecha, setFecha] = useState(today());
  const [values, setValues] = useState<Record<string, string>>({});
  const [nota, setNota] = useState('');
  const [lotId, setLotId] = useState(params.lotId ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [conNota, setConNota] = useState(false);

  const conCerda = repro && evento.cerda !== 'no';
  const sow = conCerda ? findSow(sows, arete) : undefined;
  const nueva = params.tipo === 'entrada';
  // Una cerda nueva siempre entra al lote Entradas.
  const entradas = nueva ? loteFijo(lots, 'entradas') : undefined;
  // El lote se pregunta cuando no viene dado ni lo determina la cerda.
  const pideLote = !nueva && !params.lotId && (!conCerda || (evento.cerda === 'opt' && !arete.trim()));
  const elegibles = lots.filter((l) => !l.archivado && !l.esFijo).slice(0, 12);
  const lot = nueva ? entradas : lots.find((l) => l.id === (lotId || sow?.lotIdActual));
  const listo = (!conCerda || evento.cerda === 'opt' || (nueva ? !!arete.trim() && (!sow || sow.estadoActual === 'descarte') && !!entradas : !!sow)) && (!pideLote || !!lotId);

  // Lo que el formulario ya puede decir con lo escrito, antes de guardar.
  const n = (k: string) => num(values[k]);
  const edadDestete = useFarmStore((s) => s.current?.config?.kpiConfig?.edadDestete) || 21;
  const resumen: [string, string] | null =
    params.tipo === 'parto' && n('lechonesVivos')
      ? [`${n('lechonesVivos') + n('lechonesMuertos') + n('momias')} lechones en total`, `${sow ? `Será su parto número ${sow.partosHistoricos + 1}. ` : ''}Destete hacia el ${viewDate(addDays(fecha, edadDestete))}.`]
      : params.tipo === 'destete' && n('lechonesDestetados') && n('pesoCamadaDestete')
        ? [`${(n('pesoCamadaDestete') / n('lechonesDestetados')).toFixed(1)} kg por lechón`, 'La cerda pasa a Destetadas para volver a servirla.']
        : params.tipo === 'pesada' && n('cantidadPesada') && n('pesoTotal')
          ? [`${(n('pesoTotal') / n('cantidadPesada')).toFixed(1)} kg de promedio`, `${n('cantidadPesada')} animales pesados`]
          : params.tipo === 'postura' && n('pilas') + n('cartones') + n('unidades') + n('sucios')
            ? [`${n('pilas') * 360 + n('cartones') * 30 + n('unidades') + n('sucios')} huevos`, 'Pilas de 12 cartones, cartones de 30 huevos.']
            : null;

  const reglaSigueLactando = !mergeReglas(useFarmStore.getState().current?.config?.reglas as any).finalizarLactanciaAlDestetar;

  const save = (another: boolean) => {
    const faltan = missing(evento.campos, values);
    setErrors(faltan);
    if (faltan.length) return;
    registrar({ tipo: params.tipo, lotId: lotId || (params.tipo === 'inseminacion' ? '' : sow?.lotIdActual ?? ''), fecha, arete: conCerda ? arete : '', nota, data: toData(evento.campos, values) })
      .then(() => {
        if (!another) return back();
        setArete('');
        setNota('');
        // Lo que cambia de una cerda a otra se limpia; verraco, técnico y hora se conservan.
        setValues(Object.fromEntries(Object.entries(values).filter(([k]) => ['verraco', 'tecnico', 'hora'].includes(k))));
      })
      .catch(() => null);
  };

  return (
    <Screen
      top={<Top title={evento.label} sub={params.tipo === 'inseminacion' && !lotId ? undefined : lot?.code} onBack={back} close />}
      footer={
        <>
          <Btn icon="check" label={`Guardar ${evento.label.toLowerCase()}`} disabled={!listo} loading={saving} onPress={() => save(false)} />
          {conCerda && evento.cerda === 'req' ? <Btn small kind="g" label="Guardar y registrar otra" disabled={!listo || saving} onPress={() => save(true)} /> : null}
        </>
      }>
      {conCerda ? <SowInput value={arete} onChange={setArete} nueva={nueva} /> : null}

      {pideLote ? (
        <Field label="Lote">
          {elegibles.length ? <Options options={elegibles.map((l) => [l.id, l.code] as const)} value={lotId} onChange={setLotId} /> : <Note tone="w" icon="alert">Crea primero un lote en la pestaña Lotes.</Note>}
        </Field>
      ) : null}

      <Field label="¿Cuándo fue?">
        <DateField value={fecha} onChange={setFecha} futuro={nueva} />
      </Field>

      <EventFields tipo={params.tipo} campos={evento.campos} values={values} onChange={setValues} errors={errors} />

      {resumen ? (
        <Card style={{ backgroundColor: C.green2, borderColor: C.green2 }}>
          <Row>
            <Icon name="check" color={C.forest} />
            <Grow style={{ gap: 2 }}>
              <T v="b" size={16} color={C.forest}>{resumen[0]}</T>
              <T v="sub" color={C.forest}>{resumen[1]}</T>
            </Grow>
          </Row>
        </Card>
      ) : null}

      {conNota || nota ? (
        <Field label="Nota">
          <Input value={nota} onChangeText={setNota} placeholder="Observaciones…" maxLength={2000} autoFocus={conNota && !nota} />
        </Field>
      ) : (
        <Btn kind="g" icon="plus" label="Agregar una nota" onPress={() => setConNota(true)} />
      )}

      {params.tipo === 'inseminacion' ? (
        <Note icon="calendar">
          {params.lotId ? '' : 'Queda en el lote de la semana del servicio. '}Diagnóstico el {viewDate(addDays(fecha, 21))} y parto esperado el {viewDate(addDays(fecha, 114))}.
        </Note>
      ) : null}
      {nueva ? <Note icon={entradas ? 'swap' : 'alert'} tone={entradas ? 'info' : 'w'}>{entradas ? 'La cerda entrará al lote Entradas.' : 'No se encontró el lote Entradas. Actualiza la pantalla o pide acceso a ese lote.'}</Note> : null}
      {evento.mover && !(params.tipo === 'destete' && reglaSigueLactando) ? <Note icon="swap">La cerda pasará al lote {evento.mover[0] === 'destetadas' ? 'Destetadas' : evento.mover[0] === 'atrasadas' ? 'Atrasadas' : 'Descarte'}.</Note> : null}
    </Screen>
  );
}
