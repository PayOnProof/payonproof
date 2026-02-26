# POP Production Mainnet Checklist

## 1) Environment
- Set API env from `.env.production.example`.
- Set Web env from `services/web/.env.production.example`.
- Keep `POP_ENV=production` in both services.

## 2) Anchor policy (strict)
- Only expose/route anchors that pass all:
- `stellar.toml` reachable at `https://<domain>/.well-known/stellar.toml`
- `WEB_AUTH_ENDPOINT` present and HTTPS (SEP-10)
- `TRANSFER_SERVER_SEP0024` present and HTTPS (SEP-24)
- Anchor is marked `operational=true` after capability refresh

## 3) Route policy
- Keep `MAX_COMPARE_ROUTES=12` in API env.
- Never allow execution when `route.available=false`.

## 4) Vercel
- Deploy `services/api` and `services/web` as separate projects.
- Configure API envs in Vercel Project Settings.
- Configure Web envs in Vercel Project Settings.
- Set cron secret and call `/api/anchors/ops?action=sync&secret=<CRON_SECRET>` from scheduler.

## 5) Wallet and network
- Freighter must be connected to Public Network.
- User signs SEP-10 challenges from POP frontend.
- Backend exchanges signed challenge for JWT and starts SEP-24 interactive flow.

## 6) Go-live checks
- `/api/health` returns Stellar OK.
- `/api/anchors/countries` returns only operational countries.
- `/api/compare-routes` returns <= 12 routes.
- `/api/execute-transfer` prepare/authorize/status works with a real anchor corridor.
- `/api/generate-proof` resolves real Horizon transaction hash.
