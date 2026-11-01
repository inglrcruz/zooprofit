# FarmProfit API

API en Go + MySQL que reemplaza a Firebase (Auth + Firestore) para la app FarmProfit.

## Arrancar

```bash
cp .env.example .env          # y completa JWT_SECRET: openssl rand -hex 32
docker compose up -d          # MySQL 8.4
go run ./cmd                  # crea/actualiza las tablas al iniciar
API=http://localhost:8080 scripts/smoke.sh   # prueba de extremo a extremo (base vacía)
```

## Cargar los datos de Firebase

```bash
python3 scripts/firestore2sql.py ~/Desktop/PigProfit/firestore-export --password '1234' > import.sql
docker exec -i mysql_farmprofit sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < import.sql
```

Arranca el API una vez antes, para que existan las tablas. El archivo es una sola transacción: carga todo o nada,
y cargarlo dos veces falla en vez de duplicar. Firestore no guarda contraseñas, así que todas las cuentas importadas
entran con la de `--password`. El script informa por pantalla cuántas filas genera y qué omite.

## Arquitectura por capas

Cada capa solo conoce a la que tiene debajo.

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Presentación | `internal/routes`, `internal/controllers`, `internal/middleware` | HTTP: rutas, JSON, validación de forma, sesión |
| Negocio | `internal/services` | Reglas: permisos por rol, lotes permitidos, flujo pendiente → confirmado, inventario |
| Datos | `internal/repositories` | SQL (GORM). Toda consulta va atada a un `farm_id` |
| Dominio | `internal/models` | Entidades, roles y errores, compartidos por las tres capas |

`cmd/main.go` las conecta; `internal/config` lee el entorno; `internal/database` abre la conexión y migra.

Los recursos simples (cerdas, verracos, naves…) comparten una sola implementación genérica por capa
(`resource.go`). Los que tienen reglas propias la envuelven: `lot_service.go`, `registro_service.go`, `product_service.go`.

## Sesión

`POST /auth/login` devuelve `{ token, user }`. El resto de rutas exige `Authorization: Bearer <token>`.
Los errores llegan como `{ "error": "mensaje" }` con el código HTTP correspondiente.

| Ruta | |
|---|---|
| `POST /auth/register` | `{ name, email \| phone, password }` — la contraseña es una clave de 4 dígitos |
| `POST /auth/login` | `{ identifier, password }` — correo o teléfono |
| `GET /auth/invitations/:code` | Qué granja y rol trae un código de invitación |
| `POST /auth/join` | `{ code, password, phone? }` (clave de 4 dígitos) — crea la cuenta del trabajador dentro de la granja |
| `POST /invitations/:code/accept` | Une una cuenta que ya existe a la granja del código |
| `GET` `PATCH /me` | Perfil; `PATCH` acepta `name` y `pushToken` |
| `PATCH /me/password` | `{ current, password }` — cambia la clave (4 dígitos) comprobando la actual |

## Granjas (módulos)

| Ruta | |
|---|---|
| `GET /farms` | Las propias y aquellas donde soy miembro, con mi `rol` |
| `POST /farms` | `{ name, species, type }`. Cerdos · reproducción nace con los lotes Entradas, Destetadas, Atrasadas y Descarte |
| `GET` `PATCH` `DELETE /farms/:farmId` | `PATCH { name?, config? }`; `config` guarda metas, reglas, umbrales y catálogos |
| `GET /farms/:farmId/members` · `PATCH` `DELETE …/members/:userId` | `PATCH { rol?, allowedLotIds? }` |
| `GET` `POST /farms/:farmId/invitations` · `DELETE …/invitations/:id` | `POST { nombre, rol, lotIds?, telefono? }` → código de 6 dígitos, 48 h |

Roles: el dueño es `admin`. `veterinario` y `supervisor` registran y confirman. `asesor` y `auxiliar` registran.
`propietario`, `aportante` y `prestatario` solo leen; los dos últimos, únicamente sus propias filas de la cooperativa.
Un miembro con `allowedLotIds` solo ve esos lotes y sus registros.

## Datos de la granja

Todo cuelga de `/farms/:farmId`. Cada recurso responde a `GET` (lista), `POST`, `GET /:id`, `PATCH /:id` y `DELETE /:id`.

| Recurso | Filtros de la lista |
|---|---|
| `/lots` | `archivado`, `fase`, `parentLotId` |
| `/lots/:lotId/registros` (crear y listar) · `/registros` (toda la granja, y por id) | `lotId`, `tipo`, `status`, `sowId`, `creadoPor`, `from`, `to` |
| `/lots/:lotId/protocolos` (crear y listar) · `/protocolos` | `lotId`, `activo`, `from`, `to` |
| `/cerdas` | `estado`, `lotId`, `arete` |
| `/verracos` | `activo` |
| `/naves`, `/corrales` | `naveId`, `lotId` |
| `/productos` | `tipo`, `codigo` |
| `/conteos` | `status`, `from`, `to` |
| `/aportantes`, `/prestamos`, `/coop-movimientos` | `tipo`, `aportanteId`, `prestamoId`, `from`, `to` |
| `POST /productos/:id/movimientos` · `GET /movimientos` | `productId`, `lotId`, `tipo`, `from`, `to` |

- Las listas aceptan `limit` (1000 por defecto, máximo 5000) y `offset`.
- Las fechas son `YYYY-MM-DD`.
- `PATCH` es parcial: lo que no se envía no cambia, y los objetos JSON (`data`, `config`, `items`) se combinan clave por clave.
- El cliente puede enviar su propio `id` al crear (como hacía sin conexión); repetir el mismo `POST` responde `409` en lugar de duplicar.
- Un registro (`tipo`, `fecha`, `data` libre según el tipo) nace `pending`; solo quien puede auditar lo pasa a `confirmed`.
- `existencia` de un producto solo cambia mediante movimientos (`cantidad` positiva entra, negativa sale).
