import { useState } from 'react';
import { View } from 'react-native';

import { back, Btn, Card, Col, DateField, Empty, Grow, Note, Row, Screen, StepRow, T, Top } from '@/components/ui';
import { C } from '@/constants/tokens';
import { avesVivas, semanaDeEdad } from '@/data/aves';
import { fmt, postura, totalHuevos } from '@/data/calc';
import { getDekalbStandard } from '@/data/dekalb';
import { useAves } from '@/hooks/use-aves';
import { useLoading } from '@/hooks/use-load';
import { registrar } from '@/stores/registro.store';
import { today } from '@/utilities/miscellaneous';

const ZERO = { pilas: 0, cartones: 0, unidades: 0, sucios: 0, muertes: 0, sacos: 0 };

export default function RegistroDiario() {
  const { lot, regs, registros } = useAves();
  const saving = useLoading('registro', 'lot');
  const [fecha, setFecha] = useState(today());
  const [v, setV] = useState(ZERO);
  const set = (k: keyof typeof v) => (n: number) => setV({ ...v, [k]: n });

  if (!lot) {
    return (
      <Screen top={<Top title="Registro del día" onBack={back} close />}>
        <Empty icon="egg" title="Crea primero un lote de aves" />
      </Screen>
    );
  }

  const aves = avesVivas(lot, registros);
  const std = getDekalbStandard(semanaDeEdad(lot, fecha)).posturaHenDay;
  const huevos = totalHuevos(v);
  const pct = postura(huevos, aves);
  const yaHay = regs.some((r) => r.fecha === fecha && r.tipo === 'postura');
  // Un registro por cada cosa que pasó: postura, muertes y alimento se consultan por separado.
  const save = async () => {
    try {
      const base = { lotId: lot.id, fecha };
      if (huevos) await registrar({ ...base, tipo: 'postura', data: { pilas: v.pilas, cartones: v.cartones, unidades: v.unidades, sucios: v.sucios } });
      if (v.muertes) await registrar({ ...base, tipo: 'muerte', data: { cantidad: v.muertes } });
      if (v.sacos) await registrar({ ...base, tipo: 'alimento', data: { sacos: v.sacos } });
      back();
    } catch {}
  };

  return (
    <Screen
      top={<Top title="Anotar el día" sub={`${lot.code} · ${fmt(aves)} gallinas`} onBack={back} close />}
      footer={<Btn icon="check" label="Guardar el día" disabled={!huevos && !v.muertes && !v.sacos} loading={saving} onPress={() => void save()} />}>
      <DateField value={fecha} onChange={setFecha} />
      {yaHay ? <Note tone="w" icon="alert">Ya hay huevos anotados ese día. Lo que guardes se suma.</Note> : null}

      <T v="h2" size={19}>1. ¿Cuántos huevos?</T>
      <Card gap={0} style={{ paddingVertical: 4, borderRadius: 22 }}>
        <StepRow label="Pilas" hint="de 12 cartones" value={v.pilas} onChange={set('pilas')} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <StepRow label="Cartones sueltos" hint="de 30 huevos" value={v.cartones} onChange={set('cartones')} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <StepRow label="Huevos sueltos" value={v.unidades} onChange={set('unidades')} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <StepRow label="Sucios o rotos" hint="no van al almacén" value={v.sucios} onChange={set('sucios')} />
      </Card>

      <T v="h2" size={19}>2. Muertes y alimento</T>
      <Card gap={0} style={{ paddingVertical: 4, borderRadius: 22 }}>
        <StepRow label="Gallinas muertas" value={v.muertes} onChange={set('muertes')} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <StepRow label="Sacos de alimento" value={v.sacos} onChange={set('sacos')} />
      </Card>

      <Card style={{ backgroundColor: C.green2, borderColor: C.green2 }}>
        <Row>
          <Grow style={{ gap: 2 }}>
            <T v="sub" color={C.forest}>Total del día</T>
            <T v="h1" size={26} color={C.forest}>{fmt(huevos)} huevos</T>
          </Grow>
          <Col gap={2} align="flex-end">
            <T v="b" size={16} color={C.forest}>{Math.round(pct)} de cada 100</T>
            {std && huevos ? <T v="sub" color={C.forest}>{pct >= std ? 'como se espera' : pct >= std - 3 ? 'un poco bajo lo esperado' : 'bajo lo esperado'}</T> : null}
          </Col>
        </Row>
      </Card>
    </Screen>
  );
}
