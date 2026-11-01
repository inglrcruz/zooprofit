const { chromium } = require('playwright');
const B = 'http://localhost:8098', API = 'http://localhost:8099';
const tag = Date.now() % 100000;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '-', e.message.split('\n').slice(0, 6).join('\n')); await page.screenshot({ path: `/tmp/farmprofit-e2e/fail-${name.replace(/\W+/g, '_')}.png` }); throw e; } };
  const settle = (ms = 500) => page.waitForTimeout(ms);
  const shot = async (n) => { await settle(); await page.screenshot({ path: `/tmp/farmprofit-e2e/${n}.png` }); };
  const vis = (l) => l.filter({ visible: true }).last();
  const ph = (...a) => vis(page.getByPlaceholder(...a)), tx = (...a) => vis(page.getByText(...a)), rl = (...a) => vis(page.getByRole(...a));
  const btn = (name) => rl('button', { name, exact: true });
  const times = async (label, n) => { for (let i = 0; i < n; i++) await rl('button', { name: label, exact: true }).click(); };
  let token;
  // Direct calls to the API, outside the browser: they work while the app is "offline".
  const api = async (method, path, body) => {
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return r.status === 204 ? null : r.json();
  };
  // "Sin conexión": el API deja de responder; la app (ya cargada) sigue abierta.
  const offline = () => page.route(API + '/**', (r) => r.abort('internetdisconnected'));
  const online = () => page.unroute(API + '/**');

  let farm;
  await step('con conexión: cuenta, granja y una cerda', async () => {
    await page.goto(B + '/registro');
    await ph('Nombre y apellido').fill('Rafael Cruz');
    await ph('809-555-0000 o correo@email.com').fill(`off${tag}@test.do`);
    await ph('4 dígitos').fill('1234');
    await btn('Crear cuenta').click();
    await btn('Nueva granja').click();
    await ph('Ej: Granja La Loma').fill('Granja La Loma');
    await btn('Crear granja').click();
    await tx('Granja La Loma', { exact: true }).click();
    await tx('No hay nada pendiente').waitFor();
    token = await page.evaluate(() => JSON.parse(localStorage.getItem('auth-store')).state.token);
    farm = (await api('GET', '/farms'))[0];
    await btn('Registrar').click();
    await ph('Escribe el ID…').fill('2301');
    await btn('Registrar cerda nueva').click();
    await btn('Primeriza').click();
    await btn('Guardar entrada').click();
    await tx('1 cerda por servir').waitFor();
    if (await page.getByText(/Sin conexión|por enviar|Enviando/).filter({ visible: true }).count()) throw new Error('con conexión no debe verse el aviso');
  });

  await step('sin conexión: se registra un servicio y se ve de inmediato', async () => {
    await offline();
    await rl('button', { name: 'Registrar: cerdas por servir' }).click();
    await tx(/Encontrada · Por servir/).waitFor();
    await btn('Guardar inseminación').click();
    await tx('Todo al día').waitFor();
    await tx(/Sin conexión · 3 cambios guardados en el teléfono/).waitFor();
    await shot('01-sin-conexion');
    const regs = await api('GET', `/farms/${farm.id}/registros?tipo=inseminacion`);
    if (regs.length) throw new Error('el servidor no debería tener el servicio todavía');
  });

  await step('sin conexión: otra pantalla muestra el cambio y la lista de pendientes', async () => {
    await rl('tab', { name: 'Cerdas' }).click();
    await rl('button', { name: 'Preñadas: 1' }).waitFor();
    await tx('Servida', { exact: true }).waitFor().catch(() => null);
    await rl('button', { name: /Sin conexión.*Ver detalles/ }).click();
    await tx('Esperando para enviarse · 3').waitFor();
    await tx('Nuevo: Inseminación · ID 2301').waitFor();
    await shot('02-pendientes');
    await rl('button', { name: 'Cerrar' }).click();
  });

  await step('sin conexión: se cierra y se vuelve a abrir la app, y todo sigue ahí', async () => {
    await settle(800); // deja que la lista se termine de guardar en el teléfono
    await page.reload();
    await tx(/Sin conexión · 3 cambios/).waitFor();
    await tx('2301', { exact: true }).waitFor();
    await rl('button', { name: 'Preñadas: 1' }).waitFor();
    await shot('03-reabierta');
  });

  await step('vuelve la conexión: se envía solo y el servidor queda igual', async () => {
    await online();
    await rl('button', { name: /Sin conexión.*Ver detalles/ }).click();
    await btn('Enviar ahora').click();
    await page.getByText(/Sin conexión|cambios guardados|Enviando/).filter({ visible: true }).first().waitFor({ state: 'hidden' });
    const regs = await api('GET', `/farms/${farm.id}/registros?tipo=inseminacion`);
    const sow = (await api('GET', `/farms/${farm.id}/cerdas?arete=2301`))[0];
    const lots = await api('GET', `/farms/${farm.id}/lots`);
    const banda = lots.find((l) => !l.esFijo);
    if (regs.length !== 1) throw new Error('servicios en el servidor: ' + regs.length);
    if (sow.estadoActual !== 'inseminada' || sow.lotIdActual !== banda?.id || regs[0].lotId !== banda.id) throw new Error('la cerda o el lote no coinciden: ' + JSON.stringify([sow.estadoActual, sow.lotIdActual, banda?.id, regs[0].lotId]));
    console.log('     servidor: 1 servicio, cerda', sow.estadoActual, 'en el lote', banda.code);
    await shot('04-enviado');
  });

  await step('enviar dos veces no duplica', async () => {
    // Lo mismo que hace la cola si la respuesta se pierde: repetir el POST con el mismo id.
    const reg = (await api('GET', `/farms/${farm.id}/registros?tipo=inseminacion`))[0];
    const r = await fetch(`${API}/farms/${farm.id}/lots/${reg.lotId}/registros`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reg.id, tipo: 'inseminacion', fecha: reg.fecha, cerdaCodigo: '2301' }) });
    if (r.status !== 409) throw new Error('esperaba 409, llegó ' + r.status);
    if ((await api('GET', `/farms/${farm.id}/registros?tipo=inseminacion`)).length !== 1) throw new Error('se duplicó');
  });

  await step('un cambio que el servidor rechaza queda a la vista para descartar', async () => {
    await page.goto(B + '/repro/verracos');
    await btn('Agregar').click();
    await settle();
    await ph('Ej: VR-02').fill('VR-09');
    await btn('Agregar verraco').click();
    await tx('VR-09').waitFor();
    const boar = (await api('GET', `/farms/${farm.id}/verracos`))[0];
    await offline();
    await settle();
    await tx('VR-09').click();
    await settle();
    await ph('Ej: Titan').fill('Bravo');
    await btn('Guardar cambios').click();
    await tx('VR-09 · Bravo').waitFor();
    await api('DELETE', `/farms/${farm.id}/verracos/${boar.id}`); // otra persona lo borró mientras tanto
    await online();
    await rl('button', { name: /Sin conexión.*Ver detalles/ }).click();
    await btn('Enviar ahora').click();
    await tx('El servidor no aceptó').waitFor();
    await tx('Cambio: verraco').waitFor();
    await shot('05-rechazado');
    await rl('button', { name: /^Descartar/ }).click();
    await tx('Aún no hay verracos').waitFor();
  });
  await browser.close();
})().catch((e) => { console.log('ABORT', e.message.split('\n')[0]); process.exit(1); });
