# shopclock-admin

Backend API and admin panel for ShopClock. Deploys together on a single server via Docker Compose.

```
src/      backend (Express/TS), including src/admin/ - the admin API routes (auth, student management)
admin/    the admin panel frontend - a separate Vue 3 + Vite app, NOT the same thing as src/admin/
```

## Running with Docker Compose

```
cp .env.example .env
# edit .env - fill in ADMIN_JWT_SECRET, DB_PASSWORD, API_BEARER_TOKEN, and (once you have one) the FLUXER_* values
docker compose up --build
```

This brings up three containers: `postgres`, `backend` (port 3000), and `admin` (port 8080, nginx serving the built Vue app).

Once the containers are healthy, bootstrap a local-admin fallback account (works even if Fluxer is down):

```
docker compose exec backend yarn create-admin <username> <password>
```

### HTTPS is required in production

The backend runs with `NODE_ENV=production`, which makes the admin session cookie `secure: true` - browsers will refuse to store or send it over plain HTTP. Put a TLS-terminating reverse proxy (e.g. Caddy, nginx, Traefik) in front of both the `admin` (8080) and `backend` (3000) ports before exposing this to anything other than `localhost`. Local testing over `http://localhost` works fine during development (`NODE_ENV` unset / not `production`).

### `ADMIN_API_BASE_URL` vs `ADMIN_FRONTEND_URL`

- `ADMIN_API_BASE_URL` is baked into the admin app's JS **at build time** - it must be the backend's public-facing URL (what the browser can reach), not the internal Docker network hostname `backend`.
- `ADMIN_FRONTEND_URL` is read by the backend at runtime for CORS and as the Fluxer OAuth redirect target - it must be the admin app's public-facing URL.

## Admin panel env vars (backend)

```
ADMIN_JWT_SECRET=                 # required, no default
ADMIN_SESSION_TTL_SECONDS=28800
ADMIN_FRONTEND_URL=http://localhost:8080

FLUXER_CLIENT_ID=
FLUXER_CLIENT_SECRET=
FLUXER_AUTHORIZE_URL=
FLUXER_TOKEN_URL=
FLUXER_USER_URL=
FLUXER_REDIRECT_URI=http://localhost:3000/admin/auth/fluxer/callback
FLUXER_SCOPES=identify
ADMIN_FLUXER_ALLOWED_IDS=         # comma-separated Fluxer user IDs allowed as admins

FLUXER_STUB_MODE=false            # non-production only; fakes the whole OAuth round trip for local testing
```

Create a local-admin fallback account with `yarn create-admin <username> <password>` (or, in Docker, `docker compose exec backend yarn create-admin <username> <password>`).
