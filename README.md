# Tropera Marketing OS — Codebase real

Este es el Paso 8 del roadmap: la migración del prototipo (artifact React con
`window.storage`) a una aplicación real con base de datos, autenticación y
backend persistente.

**Importante — esto no corre dentro de este chat.** El chat de Claude no
tiene un servidor persistente ni una base de datos real; solo puede generar
y validar el código. Para que la aplicación funcione de verdad necesitas
correrla en un entorno con ejecución continua: tu máquina, o **Claude Code**
(terminal, VS Code o la app de escritorio), donde sí hay una terminal real,
git, y puedes conectar una base de datos.

## Qué incluye este codebase

- **Prisma schema** (`prisma/schema.prisma`) — mapea 1:1 las entidades del
  documento de arquitectura: Region, BusinessUnit, Location, Campaign,
  ProductionProject, Task, Budget, Expense, Vendor, Idea, Product, Order,
  Metric (procesada) / AdMetricRaw (cruda), IntegrationLog, etc.
- **Seed** (`prisma/seed.ts`) — carga los mismos datos demo del prototipo
  (mismas campañas TRP-2026-000N, mismos montos) para que al levantarlo
  veas exactamente lo que ya validamos.
- **Next.js App Router** con el mismo design system del prototipo (colores,
  Chelsea Market en títulos, Fraunces en cifras).
- **Páginas conectadas a datos reales**: Dashboard, Campaign Hub, detalle de
  campaña y Budget (con filtro de fechas por querystring).
- **Auth** con NextAuth (credenciales) y los mismos roles de sistema
  (Admin / Marketing Manager / Team Member / Viewer).
- El resto de los módulos del sidebar (Today, Calendar, Production,
  Advertising, Analytics, Locations, Team, Ideas, Reports, Settings) están
  como stubs navegables — ya están terminados y validados en el prototipo;
  falta portarlos a Prisma uno por uno, con el mismo patrón que Budget y
  Campaigns.

## Cómo correrlo

### 1. Base de datos
Necesitas un PostgreSQL real. La forma más rápida sin instalar nada local:
- [Neon](https://neon.tech) o [Supabase](https://supabase.com) — plan gratis, te dan un `DATABASE_URL` en 1 minuto.

### 2. Configura el entorno
```bash
cp .env.example .env
# Edita .env con tu DATABASE_URL real y un NEXTAUTH_SECRET
# (genera uno con: openssl rand -base64 32)
```

### 3. Instala y migra
```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Levanta el proyecto
```bash
npm run dev
```
Abre `http://localhost:3000` — debería redirigirte a `/dashboard` con los
datos demo ya cargados.

### 5. Login
El seed crea 6 usuarios con la misma contraseña de prueba: **`tropera2026`**

| Email | Rol |
|---|---|
| admin@tropera.cl | Admin |
| leo@tropera.cl | Marketing Manager |
| vale@tropera.cl / fran@tropera.cl / cote@tropera.cl | Team Member |
| viewer@tropera.cl | Viewer (no ve montos de presupuesto — pruébalo) |

**Cambia esta contraseña antes de invitar a tu equipo real** — es solo para
que puedas probar el sistema de roles hoy mismo. El middleware
(`src/middleware.ts`) ya protege todas las rutas internas: sin sesión,
te redirige a `/login`.

## Conectar Meta Ads y Google Ads (Admin → Configuración)

El código OAuth ya está completo (`src/lib/meta.ts`, `src/lib/googleAds.ts`,
y las rutas en `src/app/api/integrations/`), pero cada plataforma exige que
**tú** completes un proceso de aprobación externo antes de poder conectar
datos reales — esto no depende del código, depende de Meta y Google:

### Meta Ads
1. Crea una app en [developers.facebook.com](https://developers.facebook.com) (tipo "Business").
2. Agrega el producto "Marketing API" y solicita el permiso `ads_read` — Meta
   revisa esto manualmente, puede tardar unos días.
3. Copia el App ID y App Secret a tu `.env` (`META_APP_ID`, `META_APP_SECRET`).
4. En Configuración → Conectar Meta Ads, elige la unidad de negocio y sigue
   el flujo OAuth.

### Google Ads
1. Pide un Developer Token desde tu cuenta de Google Ads (Herramientas →
   Centro de API). Empieza en nivel "Test" (solo cuentas de prueba); pide
   nivel "Basic" para cuentas reales — Google también revisa esto.
2. Crea credenciales OAuth 2.0 en [Google Cloud Console](https://console.cloud.google.com)
   (tipo "Web application"), con `{NEXTAUTH_URL}/api/integrations/google/callback`
   como URI de redirección autorizado.
3. Copia Client ID, Client Secret y Developer Token a tu `.env`.
4. En Configuración → Conectar Google Ads, elige la unidad de negocio y
   sigue el flujo OAuth.

### Una vez conectado
Cada `AdAccount` conectado queda visible en Configuración. La sincronización
(`POST /api/integrations/meta/sync` y `/google/sync`) trae los datos y los
guarda primero en `AdMetricRaw` (crudo, tal como llega) y luego procesados
en `Metric` — exactamente la separación RAW/PROCESSED del documento de
arquitectura (§11). Por ahora esa sincronización se dispara manualmente
(vía `fetch` o Postman); programarla con un cron (Vercel Cron o similar)
es el paso siguiente natural.

**Nota sobre el matching de campañas**: el scaffold busca la campaña interna
por coincidencia de nombre (`campaign.name.includes(...)`). En producción,
la forma correcta es que el nombre de la campaña en Meta/Google incluya el
`campaignCode` (ej. "TRP-2026-0001 — Lanzamiento IPA"), como se definió en
la convención de nomenclatura del documento de arquitectura (§7).

## Qué falta antes de que esto sea "producción" de verdad

1. **Portar los módulos stub** — Today, Calendar, Production (con Kanban y
   asignación editable), Advertising, Analytics (con las 27 columnas de
   Google Ads y 21 de Meta), Locations, Team, Ideas, Reports.
2. **Selector de cuenta al conectar Meta/Google** — hoy el callback conecta
   automáticamente la primera cuenta que encuentra; si el Business Manager
   tiene varias, falta una pantalla intermedia para elegir.
3. **Cifrar los tokens OAuth** — `AdAccount.accessToken` / `refreshToken` se
   guardan en texto plano en este scaffold. Antes de producción, cifra esos
   campos (ej. con `@47ng/cloak`) o usa un secret manager.
4. **Programar la sincronización** — hoy `/api/integrations/*/sync` se
   dispara a mano. Súmale un cron (Vercel Cron, por ejemplo) que la llame
   cada noche.
5. **Subir el logo real** — copia el isotipo a `public/logo.png` y
   reemplaza el placeholder en `src/components/Sidebar.tsx`.
6. **Desplegar** — Vercel es lo más directo para Next.js; conecta el mismo
   `DATABASE_URL` de Neon/Supabase en las variables de entorno del proyecto
   en Vercel, y agrega ahí también las variables de Meta/Google.

## Estructura de carpetas

```
prisma/
  schema.prisma      ← modelo de datos completo
  seed.ts            ← datos demo (mismos que el prototipo)
src/
  app/
    (app)/           ← rutas internas, todas con Sidebar
      dashboard/
      campaigns/
        [code]/      ← detalle de campaña
      budget/
      today/ calendar/ production/ advertising/ analytics/
      locations/ team/ ideas/ reports/ settings/  ← stubs
    api/auth/[...nextauth]/
    layout.tsx       ← layout raíz
    globals.css      ← design tokens (mismos del prototipo)
  components/
    Sidebar.tsx
    ui.tsx           ← KPICard, Badge, ProgressBar, execState
  lib/
    prisma.ts
    auth.ts
```
