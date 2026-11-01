// Estándares Dekalb White (Hendrix Genetics / ISA, versión norteamericana) por semana de edad.

export interface DekalbStandard {
  semana: number;
  pesoAve: number | null;       // g
  posturaHenDay: number | null; // %
  pesoHuevo: number | null;     // g
  mortAcum: number | null;      // % acumulada
  consumo: number | null;       // g/día
}

const PESO_AVE: Record<number, number> = {
  1:62,  2:115, 3:175, 4:240, 5:305, 6:375, 7:450,
  8:525, 9:600, 10:675,11:750,12:830,13:910,14:990,
  15:1070,16:1150,17:1240,
  18:1312,19:1370,20:1420,21:1460,22:1490,23:1510,24:1530,
  25:1550,26:1565,27:1580,28:1590,30:1630,35:1660,40:1680,
  45:1695,50:1705,60:1715,70:1720,80:1723,90:1725,
};

const POSTURA: Record<number, number> = {
  18:5,  19:30, 20:65, 21:86, 22:92, 23:95, 24:96, 25:96,
  26:96, 27:95.5,28:95,29:95,30:95,31:94.5,32:94,33:94,
  34:93.5,35:93,36:93,37:92.5,38:92,39:92,40:91.5,41:91,
  42:91,43:90.5,44:90,45:90,46:89.5,47:89,48:89,49:88.5,
  50:88,51:88,52:87.5,53:87,54:87,55:86.5,56:86,57:86,
  58:85.5,59:85,60:85,61:84.5,62:84,63:84,64:83.5,65:83,
  66:83,67:82.5,68:82,69:82,70:81.5,71:81,72:81,73:80.5,
  74:80,75:80,76:79.5,77:79,78:79,79:78.5,80:78,81:78,
  82:77.5,83:77,84:77,85:76.5,86:76,87:76,88:75.5,89:75,90:75,
};

const PESO_HUEVO: Record<number, number> = {
  18:46,19:48,20:50,21:52,22:53.5,23:55,24:56,25:57,
  26:57.5,27:58,28:58.5,29:59,30:59.5,31:60,32:60,33:60.5,
  34:61,35:61,36:61.5,37:62,38:62,39:62.5,40:63,41:63,
  42:63,43:63.5,44:63.5,45:64,46:64,47:64,48:64.5,49:64.5,
  50:65,55:65,60:65,65:65,70:65,75:65,80:65,85:65,90:65,
};

const MORT_ACUM: Record<number, number> = {
  1:0.05,2:0.1,3:0.15,4:0.2,5:0.25,6:0.35,7:0.45,
  8:0.55,9:0.7,10:0.85,11:1.0,12:1.1,13:1.2,14:1.3,
  15:1.4,16:1.5,17:1.6,
  18:1.7,20:1.9,22:2.1,24:2.2,26:2.3,28:2.4,30:2.5,
  32:2.65,34:2.8,36:2.95,38:3.1,40:3.25,42:3.4,44:3.55,
  46:3.7,48:3.85,50:4.0,52:4.15,54:4.3,56:4.45,58:4.6,
  60:4.75,62:4.9,64:5.0,66:5.1,68:5.2,70:5.3,72:5.4,
  74:5.5,76:5.6,78:5.7,80:5.8,82:5.85,84:5.9,86:5.93,
  88:5.96,90:6.0,
};

const CONSUMO: Record<number, number> = {
  1:10,2:17,3:24,4:30,5:36,6:41,7:45,
  8:48,9:51,10:54,11:57,12:60,13:63,14:66,
  15:69,16:72,17:76,
  18:80,19:85,20:90,21:95,22:98,23:100,24:102,25:103,
  26:104,27:105,28:106,30:107,32:108,34:108,36:108,
  38:109,40:109,42:110,44:110,46:110,48:111,50:111,
  52:111,54:112,56:112,58:112,60:113,65:113,
  70:114,75:114,80:115,85:115,90:115,
};

function interp(table: Record<number, number>, week: number): number | null {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (week < keys[0] || week > keys[keys.length - 1]) return null;
  const lo = keys.filter(k => k <= week).pop()!;
  const hi = keys.find(k => k >= week)!;
  if (lo === hi) return table[lo];
  return table[lo] + ((week - lo) / (hi - lo)) * (table[hi] - table[lo]);
}

export function getDekalbStandard(semana: number): DekalbStandard {
  return {
    semana,
    pesoAve:       interp(PESO_AVE,   semana),
    posturaHenDay: interp(POSTURA,    semana),
    pesoHuevo:     interp(PESO_HUEVO, semana),
    mortAcum:      interp(MORT_ACUM,  semana),
    consumo:       interp(CONSUMO,    semana),
  };
}

export function getDekalbRangeByWeeks(desde: number, hasta: number): DekalbStandard[] {
  const result: DekalbStandard[] = [];
  for (let s = desde; s <= hasta; s++) {
    result.push(getDekalbStandard(s));
  }
  return result;
}
