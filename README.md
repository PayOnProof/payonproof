# PayOnProof (POP)

## Dev setup (front + back)

This repo now has two services:
- `services/web` (Next.js frontend)
- `services/api` (Vercel serverless REST API)

Local run (two terminals):
1. `cd services/web` then `npm install` and `npm run dev`
2. `cd services/api` then `npm install` and `npm run dev`

Env files:
- `services/web/.env.example` -> `.env.local`
- `services/api/.env.example` -> `.env`

Vercel deploy:
- Create two separate Vercel projects, one per service.
- `services/web` uses `NEXT_PUBLIC_API_BASE_URL` pointing to the API project URL.

## Project structure (recommended and active)

This repository is already split in two services:

- `services/web` -> Frontend (Next.js + React + TypeScript)
- `services/api` -> Backend (Vercel Functions + Node.js + TypeScript)

Conceptually:
- `front` = `services/web`
- `back` = `services/api`

### Directory map

```text
payonproof/
  services/
    web/                          # FRONT
      app/                        # Next.js routes/pages
      components/                 # UI and feature components
      hooks/                      # React hooks
      lib/                        # Front utility clients/helpers
      public/                     # Static assets

    api/                          # BACK
      api/                        # HTTP endpoints (route handlers)
        anchors/
        remittances/
        proofs/
      lib/
        modules/                  # Business/use-case layer
          anchors/
          remittances/
          proofs/
        providers/                # External integrations
          stellar/
        repositories/             # DB persistence (Supabase)
        http.ts
        stellar.ts
        supabase.ts
```

## Where to build each thing

### Backend (TypeScript)

Create new backend endpoint files in:
- `services/api/api/...`

Create business logic in:
- `services/api/lib/modules/...`

Create external API/blockchain integrations in:
- `services/api/lib/providers/stellar/...`

Create database access in:
- `services/api/lib/repositories/...`

Rule:
- Endpoint calls module
- Module calls provider/repository
- Provider talks to blockchain/anchor APIs
- Repository talks to Supabase

### Frontend (TypeScript + React)

Create new pages in:
- `services/web/app/.../page.tsx`

Create components in:
- `services/web/components/...`

Call backend APIs from:
- `services/web/lib/api.ts` (base URL + request helpers)

Rule:
- Front never uses service-role secrets
- Front never signs blockchain txs with backend secrets
- Front only calls backend REST endpoints

## API call flow (who calls who)

### Compare routes (anchors)
1. `web` calls `POST /api/anchors/compare-routes`
2. Endpoint: `services/api/api/anchors/compare-routes.ts`
3. Module: `services/api/lib/modules/anchors/service.ts`
4. Provider: `services/api/lib/providers/stellar/anchors.ts`
5. Provider calls Anchor SEP APIs and returns normalized routes

### Execute transfer
1. `web` calls `POST /api/remittances/execute-transfer`
2. Endpoint: `services/api/api/remittances/execute-transfer.ts`
3. Module: `services/api/lib/modules/remittances/service.ts`
4. Provider: `services/api/lib/providers/stellar/transactions.ts`
5. Repository: `services/api/lib/repositories/remittances.ts`
6. Response returns tx info + `stellarTxHash`

### Generate proof
1. `web` calls `POST /api/proofs/generate`
2. Endpoint: `services/api/api/proofs/generate.ts`
3. Module: `services/api/lib/modules/proofs/service.ts`
4. Provider + repository build and persist proof
5. Response returns proof payload + verification URL

## Blockchain and Anchor integrations

Use these files for Stellar/Anchor work:
- `services/api/lib/providers/stellar/anchors.ts`
- `services/api/lib/providers/stellar/transactions.ts`
- `services/api/lib/stellar.ts`

If you add SEP-specific modules, use:
- `services/api/lib/providers/stellar/sep1.ts`
- `services/api/lib/providers/stellar/sep24.ts`
- `services/api/lib/providers/stellar/sep31.ts`

## Security baseline (must keep)

- Keep private keys and service-role keys only in backend env (`services/api`).
- Do not expose backend secrets as `NEXT_PUBLIC_*`.
- Validate input in every endpoint before calling modules.
- Use allowlist for anchor domains/endpoints before external calls.
- Add rate limiting and request logging in backend before production scale.
- Use HTTPS only for all external APIs and wallet operations.
- Keep RLS enabled in Supabase for user-facing tables.

## Supabase anchors catalog

Production route discovery now reads anchors from Supabase table `anchors_catalog`.

Setup:
1. Run SQL file: `services/api/sql/001_anchors_catalog.sql`
2. Run SQL file: `services/api/sql/002_anchors_catalog_capabilities.sql`
3. Ensure backend env has:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

Behavior:
- If the corridor has no anchors in `anchors_catalog`, `/api/compare-routes` returns `routes: []`.
- `meta.noRouteReason` explains the missing coverage.

Anchor Directory ingestion (Stellar):
- `https://anchors.stellar.org/` is the official directory UI, but it is not a guaranteed machine-readable export endpoint.
- Endpoint: `POST /api/anchors/directory/import`
- Modes:
  - `dryRun: true` (default) validates and previews rows
  - `dryRun: false` writes/upserts into `anchors_catalog`

Example dry-run (with explicit JSON/CSV export URL):
```bash
curl -X POST http://localhost:3001/api/anchors/directory/import \
  -H "Content-Type: application/json" \
  -d '{
    "downloadUrl": "https://YOUR-ANCHOR-DIRECTORY-EXPORT.json",
    "dryRun": true
  }'
```

Example write:
```bash
curl -X POST http://localhost:3001/api/anchors/directory/import \
  -H "Content-Type: application/json" \
  -d '{
    "downloadUrl": "https://YOUR-ANCHOR-DIRECTORY-EXPORT.json",
    "dryRun": false
  }'
```

You can also omit `downloadUrl` if `STELLAR_ANCHOR_DIRECTORY_URL` is configured in `services/api/.env`.

Import from local export file (JSON/CSV):
```bash
cd services/api
npm run anchors:import:file -- --file ./anchors-export.json
npm run anchors:import:file -- --file ./anchors-export.json --apply
```

Fully automatic bootstrap (import + SEP refresh):
```bash
cd services/api
npm run anchors:bootstrap -- --download-url "https://YOUR-ANCHOR-SOURCE.json"
```

Automatic bootstrap from local JSON export:
```bash
cd services/api
npm run anchors:bootstrap -- --file ./anchors-export.json
```

Production-friendly seed flow (recommended):
- Keep a curated list of anchor domains + countries in a JSON file.
- Let the script auto-discover SEP capabilities and `/info` assets from each domain.
- Import normalized anchors and refresh capabilities.

Example:
```bash
cd services/api
cp scripts/anchor-seeds.example.json ./anchor-seeds.json

# Validate only (no writes)
npm run anchors:seed:import -- --file ./anchor-seeds.json

# Write + refresh capabilities
npm run anchors:seed:import -- --file ./anchor-seeds.json --apply
```

Zero-touch auto sync (best effort):
- This mode tries to auto-discover a machine-readable source from `https://anchors.stellar.org/` and common endpoint candidates.
- If discovered, it imports and refreshes capabilities automatically.
- If not discovered, it fails fast with a clear error so you can set one env var (`STELLAR_ANCHOR_DIRECTORY_URL`) and keep automation.

```bash
cd services/api

# Dry-run (no writes)
npm run anchors:auto:sync

# Apply + capability refresh
npm run anchors:auto:sync -- --apply
```

Production cron recommendation:
- Run `npm run anchors:auto:sync -- --apply` on a schedule (e.g. hourly).
- Keep alerting on failures.
- Keep a fallback env var `STELLAR_ANCHOR_DIRECTORY_URL` if directory UI changes.

Automatic export pipeline (GitHub Action):
- Workflow file: `.github/workflows/anchors-directory-export.yml`
- Runs every 30 minutes and generates `services/api/data/anchors-export.json`
- Uses headless browser fallback (Playwright) to extract anchors from `https://anchors.stellar.org/`
- Commits updated export file to the repo when changed

Use that export URL in API env:
```text
STELLAR_ANCHOR_DIRECTORY_URL=https://raw.githubusercontent.com/<ORG>/<REPO>/<BRANCH>/services/api/data/anchors-export.json
```

Then your API cron `/api/cron/anchors-sync` ingests it automatically.

Vercel cron (API project):
- Endpoint: `GET /api/cron/anchors-sync`
- Schedule: every 15 minutes (configured in `services/api/vercel.json`)
- If `STELLAR_ANCHOR_DIRECTORY_URL` is not set, cron auto-discovers from `https://anchors.stellar.org/` (best effort).
- Optional protection:
  - set `CRON_SECRET` in API env
  - call manual test with `?secret=YOUR_SECRET`
- Optional anchor hygiene:
  - set `ANCHOR_SEP1_404_DISABLE_THRESHOLD` (default `3`)
  - if an anchor fails `stellar.toml` with HTTP 404 repeatedly, it is auto-disabled (`active=false`)

Local testing of cron endpoint:
```bash
cd services/api
npm run dev

# If CRON_SECRET is set:
curl "http://localhost:3001/api/cron/anchors-sync?secret=YOUR_SECRET"

# Optional explicit source + limit:
curl "http://localhost:3001/api/cron/anchors-sync?secret=YOUR_SECRET&sourceUrl=https://YOUR-EXPORT.json&refreshLimit=200"

# Optional custom directory home for auto-discovery:
curl "http://localhost:3001/api/cron/anchors-sync?secret=YOUR_SECRET&directoryHome=https://anchors.stellar.org/"
```

Runtime endpoints for production operations:
- `GET /api/anchors/countries` -> countries currently supported by active anchors in catalog
- `GET /api/anchors/catalog?country=US&type=on-ramp&operationalOnly=true` -> inspect live catalog state
- `POST /api/anchors/capabilities/refresh` -> refresh SEP capabilities and operational status from `stellar.toml`
  - optional body: `{ "country": "US", "limit": 100 }`

Web app (`services/web/app/send/page.tsx`) now consumes real backend data:
- country options from `/api/anchors/countries`
- route comparison from `/api/compare-routes`
- transaction execution step is still simulated (by design for MVP)

## Naming note

If you want explicit folder names `front` and `back`, it is possible, but it requires:
- updating Vercel project root directories
- updating CI/deploy commands
- updating local scripts

Current `services/web` + `services/api` is production-friendly and already aligned with Vercel monorepo setup.

POP es una interfaz simple (KISS) que agrega múltiples Anchors de Stellar y enruta pagos transfronterizos por la mejor tasa disponible en tiempo real.

No es un banco.  
No es un marketplace.  
Es la capa que optimiza cómo las PYMEs pagan internacionalmente.

---

## 🌍 El problema

Las PYMEs y freelancers en LATAM pierden entre **3% y 8% por pago internacional** debido a:

- Spreads cambiarios ocultos  
- Fees acumulados por corresponsales  
- Tiempos impredecibles (3–5 días hábiles)  
- Falta de transparencia sobre el costo real  

Aunque existen Anchors en Stellar con mejores condiciones, integrarlos individualmente es técnicamente complejo para una PYME promedio.

Resultado:
- Márgenes erosionados  
- Menor competitividad  
- Fricción operativa constante  

---

## 💡 La solución

POP agrega múltiples Anchors de Stellar en una sola interfaz y:

- Consulta tasas en tiempo real  
- Normaliza fees y condiciones  
- Permite elegir manualmente o usar “Escoge por mí”  
- Ejecuta el pago por la ruta más económica  
- Registra un evento verificable on-chain  

El usuario solo ve:

Monto enviado → Monto recibido → Fee total → Tiempo estimado

Sin wallets complejas.  
Sin integraciones técnicas.  
Sin opacidad.

---

## 🧠 Cómo funciona

1. El usuario ingresa:
   - Monto
   - Moneda origen
   - Moneda destino
   - País origen/destino

2. POP consulta múltiples Anchors vía SEP-24 / SEP-31.

3. El sistema:
   - Calcula la mejor ruta
   - Muestra resumen transparente
   - Permite ejecución manual o automática

4. Se ejecuta el pago sobre Stellar.

5. Se registra un evento verificable con:
   - Hash de transacción
   - Anchor utilizado
   - Timestamp
   - Monto final liquidado

---

## 🏗 Arquitectura (alto nivel)

### Componentes

- Frontend (UI KISS)
- API Orquestadora
- Módulo de Enrutamiento
- Integración con Anchors
- Capa Blockchain (Stellar)
- Indexador Off-chain

---

## 🔐 On-chain vs Off-chain

### On-chain (Stellar)

- Hash de transacción
- Anchor utilizado
- Timestamp
- Monto final liquidado
- ID verificable del evento

### Off-chain

- Simulaciones previas
- Datos personales
- Configuración del usuario
- Analítica de ahorro

POP no custodia fondos a largo plazo.

---

## 📊 Beneficios medibles

- Reducción de 3%–8% por pago vs banca tradicional
- Liquidación en minutos en lugar de días
- Transparencia total antes de confirmar
- Historial verificable
- Ahorro acumulado visible

---

## 🎯 MVP (Impacta Bootcamp)

La demo prueba:

- Agregación multi-Anchor
- Enrutamiento automático
- Ejecución real sobre Stellar
- Registro verificable del resultado

Caso mostrado:

PYME paga a proveedor internacional →  
POP consulta Anchors →  
Selecciona mejor tasa →  
Ejecuta pago →  
Muestra confirmación verificable.

---

## ⚙️ Estándares utilizados

- Stellar SEP-24
- Stellar SEP-31
- Assets sobre Stellar (ej. USDC)
- APIs REST para integraciones B2B

---

## 🚨 Riesgos y mitigaciones

Indisponibilidad de Anchors  
→ Fallback automático multi-Anchor

Errores de normalización  
→ Validaciones y sanity checks

Riesgo regulatorio  
→ POP no custodia fondos  
→ KYC/AML recae en Anchors

---

## 📈 Métricas objetivo

- ≥ 3–8% ahorro promedio por pago
- Liquidación en minutos
- >99% éxito sin reprocesos





.
