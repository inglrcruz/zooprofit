import { LotChips } from '@/components/aves/lot-chips';
import { Av, Card, Empty, Grid, Grow, Loading, Note, Row, Screen, Stat, T, TabBar, Top } from '@/components/ui';
import { C } from '@/constants/tokens';
import { avesVivas, dias, semanaDeEdad, semanas } from '@/data/aves';
import { fmt, signed } from '@/data/calc';
import { getDekalbStandard } from '@/data/dekalb';
import { useAves } from '@/hooks/use-aves';
import { useLoad } from '@/hooks/use-load';
import { useProtocolStore } from '@/stores/protocol.store';
import { addDays, today, viewDate } from '@/utilities/miscellaneous';

/**
 * Resumen del lote calculado con sus registros. El chat con un modelo de IA
 * de la app anterior llamaba al proveedor desde el teléfono con la clave
 * dentro de la app; aquí queda pendiente hasta que el API lo ofrezca.
 */
export default function Asistente() {
  const { lots, lot, setLot, registros, refresh, loading, first } = useAves();
  const protocols = useProtocolStore((s) => s.list);
  useLoad(useProtocolStore);
  const hoy = today();

  if (!lot) {
    return (
      <Screen tabs={<TabBar module="aves" active="asistente" />} top={<Top title="Asistente" subAbove />} refreshing={loading} onRefresh={refresh}>
        {first ? <Loading /> : <Empty icon="spark" title="Crea primero un lote de aves" />}
      </Screen>
    );
  }

  const serie = dias(lot, registros).filter((d) => d.huevos);
  const last = serie[serie.length - 1];
  const prev = serie[serie.length - 8];
  const tendencia = last && prev ? last.postura - prev.postura : null;
  const porSemana = semanas(lot, registros);
  const actual = porSemana[porSemana.length - 1];
  const std = getDekalbStandard(actual?.semana ?? semanaDeEdad(lot, hoy));
  const retiro = protocols
    .filter((p) => p.lotId === lot.id && p.retiroDias > 0)
    .map((p) => ({ p, fin: addDays(p.fechaInicio, p.duracionDias - 1 + p.retiroDias) }))
    .filter((r) => r.fin >= hoy)
    .sort((a, b) => b.fin.localeCompare(a.fin))[0];

  const answers: [title: string, text: string][] = [
    ['¿Cuándo termina el retiro actual?', retiro ? `El retiro de ${retiro.p.medicamento || retiro.p.nombre} termina el ${viewDate(retiro.fin)}. Hasta entonces no se deben vender huevos.` : 'No hay ningún retiro activo en este lote.'],
    [
      'Consumo frente al estándar',
      actual?.consumo && std.consumo ? `En la semana ${actual.semana} el consumo es de ${actual.consumo} g por ave al día; la tabla Dekalb indica ${Math.round(std.consumo)} g (${signed(actual.consumo - std.consumo, 0)} g).` : 'Faltan registros de alimento para comparar el consumo.',
    ],
    [
      'Resumen de la semana',
      actual?.postura != null
        ? `Semana ${actual.semana}: postura promedio de ${actual.postura}%${std.posturaHenDay ? `, ${signed(actual.postura - std.posturaHenDay)} puntos frente al estándar` : ''}. Mortalidad acumulada ${actual.mortAcum ?? 0}%.`
        : 'Aún no hay postura registrada esta semana.',
    ],
  ];

  return (
    <Screen tabs={<TabBar module="aves" active="asistente" />} top={<Top title="Asistente" sub={`Lee los datos de ${lot.code}`} subAbove />} refreshing={loading} onRefresh={refresh}>
      <LotChips lots={lots} lot={lot} onChange={setLot} />
      <Card style={{ paddingVertical: 12, paddingHorizontal: 6 }}>
        <Grid cols={4} gap={8}>
          <Stat value={fmt(avesVivas(lot, registros))} label="Aves vivas" size={15} center />
          <Stat value={last ? `${last.postura.toFixed(1)}%` : '—'} label="Postura" size={15} center />
          <Stat value={tendencia === null ? '—' : tendencia >= 0 ? 'Subiendo' : 'Bajando'} label="7 días" size={15} color={tendencia === null ? undefined : tendencia >= 0 ? C.ok : C.warn} center />
          <Stat value={retiro ? 'Activo' : 'No'} label="Retiro" size={15} color={retiro ? C.warn : undefined} center />
        </Grid>
      </Card>

      {answers.map(([title, text]) => (
        <Card key={title}>
          <Row align="flex-start">
            <Av icon="spark" round />
            <Grow style={{ gap: 4 }}>
              <T v="b">{title}</T>
              <T v="sub" size={15} color={C.ink2}>{text}</T>
            </Grow>
          </Row>
        </Card>
      ))}

      <Note>Estas respuestas se calculan con los registros del lote. Las preguntas libres a un modelo de IA aún no están disponibles en esta versión.</Note>
    </Screen>
  );
}
