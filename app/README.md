# ZooProfit · app

App Expo (iOS, Android y web) de ZooProfit. Todos los datos vienen del API propio en `../backend`.

## Arrancar

```bash
cp .env.example .env     # EXPO_PUBLIC_API_URL: en un teléfono, la IP de tu máquina, no "localhost"
yarn install
yarn start               # o: yarn web · yarn android · yarn ios
```

El backend debe estar corriendo (`../backend/README.md`).

## Cómo está organizada

| Carpeta | Qué hay |
|---|---|
| `src/app` | Pantallas (expo-router): una por archivo, solo presentación e interacción |
| `src/components` | `ui.tsx` (piezas reutilizables) y componentes por funcionalidad (`lotes/`, `inventario/`, `coop/`, `miembros/`, `aves/`) |
| `src/stores` | Zustand. `auth` y `farm` a mano; los recursos de una granja salen de `resource.ts` (lista, crear, editar, eliminar). `registro.store` aplica lo que un evento significa para la cerda y el lote |
| `src/utilities/requests.ts` | Único punto de salida HTTP (axios) y manejo de errores |
| `src/data` | Cálculos puros: KPIs de reproducción, aves y engorde, reglas, tabla Dekalb |
| `src/constants` | `config.ts` (URL del API, roles), `eventos.ts` (campos y efecto de cada tipo de evento) |
| `src/types` | Contratos del API |
| `src/hooks` | `use-load` (leer al enfocar la pantalla), `use-repro`, `use-lotes`, `use-aves` |

Las banderas de carga viven en `global.store` (`loading.listSow`, `loading.registro`…) y los errores del API se muestran con el diálogo global.

## Sin conexión

La app sigue funcionando sin internet y se pone al día sola al volver la conexión.

- **Lectura:** cada lista de la granja abierta (`stores/resource.ts`) se guarda en el teléfono (`utilities/storage.ts`) y se muestra desde ahí.
- **Escritura:** crear, editar y eliminar se ven al instante y esperan en una cola (`stores/outbox.store.ts`) que se envía en orden. La app pone el `id` de lo que crea; el API responde 409 a un envío repetido, así que reintentar no duplica.
- **Reintentos:** `hooks/use-sync.ts` envía la cola al abrir la app, al volver a ella y cada 20 s mientras haya algo pendiente.
- **Aviso:** `SyncBar` (en `ui.tsx`, arriba de cada pantalla) dice cuántos cambios faltan y muestra los que el servidor rechazó, para descartarlos.

Necesitan conexión: iniciar sesión por primera vez, crear o cambiar de granja, equipo e invitaciones, metas y reglas, y cambiar la clave.

## Verificar

```bash
npx tsc --noEmit
node scripts/check-calc.mjs     # cálculos y reglas, sin dependencias
yarn lint
```

Pruebas de extremo a extremo en navegador (necesitan Playwright, que no es dependencia del proyecto, y un API con base de datos vacía):

```bash
EXPO_PUBLIC_API_URL=http://localhost:8099/ npx expo export --platform web --output-dir /tmp/fp-web
node scripts/e2e/serve.mjs /tmp/fp-web &          # sirve en :8098
mkdir -p /tmp/zooprofit-e2e
NODE_PATH=$(npm root -g) node scripts/e2e/app.cjs
NODE_PATH=$(npm root -g) node scripts/e2e/offline.cjs    # corta el API, registra, reabre, reconecta
```

---

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
