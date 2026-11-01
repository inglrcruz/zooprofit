# ZooProfit

App para administrar granjas (lotes, registros, inventario, equipo y cooperativa), con funcionamiento sin conexión.

| Carpeta | Qué hay | Tecnología | Documentación |
|---|---|---|---|
| `app/` | App para iOS, Android y web | Expo, React Native, Zustand | [app/README.md](app/README.md) |
| `backend/` | API REST | Go, Gin, GORM, MySQL | [backend/README.md](backend/README.md) |

## Requisitos

- Go 1.27 o superior
- Docker con Docker Compose
- Node.js y Yarn

## Arrancar

Primero el backend, en una terminal:

```bash
cd backend
cp .env.example .env     # y completa JWT_SECRET: openssl rand -hex 32
docker compose up -d     # MySQL 8.4
go run ./cmd             # crea/actualiza las tablas al iniciar
```

Luego la app, en otra terminal:

```bash
cd app
echo 'EXPO_PUBLIC_API_URL=http://localhost:8080/' > .env     # con la barra final
yarn install
yarn start               # o: yarn web · yarn android · yarn ios
```

En un teléfono, usa la IP de tu máquina en la red local en lugar de `localhost`.

## Verificar

```bash
# backend, con el API corriendo y la base vacía
cd backend && API=http://localhost:8080 scripts/smoke.sh

# app
cd app
npx tsc --noEmit
node scripts/check-calc.mjs
yarn lint
```
