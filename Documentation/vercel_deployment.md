# Vercel Deployment — GroundLevel (POView V5) Frontend

> **Audience**: Developer onboarding to the project, or any engineer modifying the deployment pipeline.

---

## TL;DR

The Next.js frontend is deployed on Vercel, which handles building, hosting, and CDN distribution automatically on every push to `main`. The backend (FastAPI) runs separately on Render. The two halves communicate through Next.js URL rewrites — all `/api/*` calls from the browser hit the Next.js server first, which proxies them transparently to the Render backend URL defined in `NEXT_PUBLIC_BACKEND_URL`.

---

## 1. Why Vercel for the Frontend

Vercel is the natural deployment target for Next.js applications — the framework and the platform are developed by the same company. Specific reasons it fits this project:

- **Zero-config Next.js support**: Vercel detects the framework automatically and applies optimal build settings without manual configuration.
- **Instant preview deployments**: Every pull request gets its own isolated preview URL, enabling easy review of UI changes before merging.
- **Global CDN edge network**: Static assets (JS bundles, the CesiumJS static files copied into `public/cesium/`) are served from the edge, reducing load time for the 3D globe experience which is asset-heavy.
- **Environment variable management UI**: Secret values (API keys) can be injected per-environment (Production, Preview, Development) without committing them to the repository.
- **Build log visibility**: Build failures are immediately visible in the Vercel dashboard with full `npm run build` output, which is useful for catching TypeScript errors and Next.js compilation issues.

The backend was not placed on Vercel because it is a long-running Python/FastAPI process with WebSocket support (the voice assistant) and stateful Redis connections — Vercel's serverless function model does not accommodate persistent connections or long-lived processes.

---

## 2. Configuration Files

### `frontend/vercel.json`

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

This file lives at `frontend/vercel.json`. It explicitly declares the framework and build commands. Because the repository root contains both `frontend/` and `backend/` subdirectories, this file ensures Vercel targets the correct build system when the **root directory** is set to `frontend/` in the Vercel project settings (see Section 3).

Without the `framework: "nextjs"` declaration, Vercel would attempt to auto-detect the framework from the directory it's pointed at — which works, but making it explicit prevents surprises if the project structure changes.

### `frontend/next.config.ts`

This is the primary configuration file for Next.js behavior. Two sections are directly relevant to deployment:

**Backend proxy rewrite:**

```typescript
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: `${BACKEND}/api/:path*`,
    },
  ];
},
```

Every browser request to `/api/anything` is rewritten server-side to the backend URL. This means:
1. The browser never directly calls the Render backend domain — all traffic goes through `your-app.vercel.app/api/...`.
2. API keys stored on the backend are never exposed to the browser.
3. CORS is simpler: the browser sees requests going to the same origin (the Vercel domain).

**Permissions Policy header:**

```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "Permissions-Policy", value: "geolocation=(self)" },
      ],
    },
  ];
},
```

This header is required for the "Use My Location" feature. It explicitly permits the browser geolocation API to be called from the app's own origin. Without it, some browsers block geolocation access on deployed sites.

### `frontend/package.json` — `postinstall` script

```json
"postinstall": "mkdir -p public/cesium && cp -R node_modules/cesium/Build/Cesium/* public/cesium/"
```

This runs automatically after `npm install` during every Vercel build. CesiumJS requires its compiled static assets (workers, WASM, imagery providers) to be available at `public/cesium/` as a static file tree — they cannot be bundled by webpack. The `postinstall` hook copies them there as part of the install step, so Vercel's build pipeline picks them up without any manual intervention.

This is critical: **if `postinstall` is skipped or fails, the 3D globe will not load** in production. The copy produces roughly 30–50 MB of static files that Vercel serves from the CDN.

---

## 3. Deployment Flow

### First-Time Project Setup (One-Time)

1. Go to [vercel.com](https://vercel.com) and create a new project.
2. Import the `gods_eye` GitHub repository.
3. **Set the root directory to `frontend/`** — this is the most important setup step. Vercel must build from the `frontend/` subdirectory, not the repo root.
4. Vercel detects `framework: "nextjs"` from `vercel.json` and configures build settings automatically.
5. Add environment variables (see Section 4).
6. Deploy.

### Ongoing Deployments (Automatic)

```
Developer pushes to main
        |
        v
Vercel webhook triggers
        |
        v
npm install (runs postinstall → copies CesiumJS static files)
        |
        v
npm run build (next build — TypeScript check + optimization)
        |
        v
Deploy to Production (global CDN)
        |
        v
Preview URL for non-main branches (auto-generated per PR)
```

Vercel deploys happen on every push. Production deployments (accessible at the primary domain) only occur on pushes to the `main` branch. All other branches get a unique preview URL of the form `gods-eye-git-<branch-name>-<team>.vercel.app`.

### Manual Redeploy

From the Vercel dashboard, any previous deployment can be promoted to production without a new commit. This is useful for rolling back a bad deploy.

---

## 4. Environment Variables

All environment variables for the frontend must be set in the **Vercel project dashboard** under Settings > Environment Variables. They are never committed to the repository — both `.env` files are listed in `.gitignore` and the root `.gitignore`.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | **Yes** | Full URL of the Render-deployed FastAPI backend (e.g., `https://gods-eye-backend.onrender.com`). Used in `next.config.ts` to proxy `/api/*` requests. If unset, defaults to `http://localhost:8000` — the app will appear to work locally but all API calls will fail in production. |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | **Yes** | Cesium Ion access token for globe terrain and base imagery. Set in `frontend/.env` locally. Required for the CesiumJS viewer to initialize. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **Yes** | Google Maps Platform API key used client-side for loading Google Photorealistic 3D Tiles (`tile.googleapis.com`) in `Map3D.tsx` and for geocoding calls in `VoiceAssistant.tsx`. |

### Variable Prefix Convention

All three variables use the `NEXT_PUBLIC_` prefix. In Next.js, only variables with this prefix are embedded into the client-side JavaScript bundle at build time. Variables without this prefix are only available server-side (in API routes or middleware), and would be `undefined` in the browser.

For `NEXT_PUBLIC_BACKEND_URL` specifically: the value is read at build time in `next.config.ts`, which runs on the Node.js side during compilation. The resulting rewrite rules are baked into the Next.js server config, not into the browser bundle. However, using the `NEXT_PUBLIC_` prefix here is consistent with the other variables and does not cause harm.

### Setting Variables for Preview vs. Production

In the Vercel dashboard, each variable can be scoped to:
- **Production** — only the `main` branch deployment
- **Preview** — all non-main branch deployments
- **Development** — `vercel dev` local simulation

For this project, set all three variables for both Production and Preview, so PR preview deployments function correctly. The `NEXT_PUBLIC_BACKEND_URL` in Preview should still point to the same Render backend URL unless a separate staging backend exists.

---

## 5. Integration with the Render Backend

The two deployed services communicate as follows:

```
Browser (user on vercel.app domain)
    |
    | GET /api/autocomplete?input=williamsburg
    v
Vercel Edge Network (Next.js server)
    |
    | Rewrite: GET https://gods-eye-backend.onrender.com/api/autocomplete?input=williamsburg
    v
Render (FastAPI + Uvicorn on port 8000)
    |
    | Response: { "suggestions": [...] }
    v
Vercel (passes response back to browser)
    |
    v
Browser receives JSON
```

The rewrite in `next.config.ts` acts as a server-side reverse proxy. From the browser's perspective, every request stays on the Vercel domain — there are no cross-origin requests issued by the browser for API calls.

### WebSocket Connection (Voice Assistant)

The voice assistant (`VoiceAssistant.tsx`) opens a WebSocket connection to `/ws/live/{session_id}`. This path is **not** handled by the Next.js rewrites — `next.config.ts` only rewrites `/api/:path*`.

WebSocket connections from Vercel deployments to an external backend require the browser to connect directly to the backend WebSocket URL. Check `VoiceAssistant.tsx` and `useLiveWebSocket.ts` for how the WebSocket URL is constructed — if it uses a relative path, it will attempt to connect to the Vercel domain (which cannot proxy WebSocket connections to Render) and the voice pipeline will fail.

> This is a known deployment gap that requires verification before the voice feature is considered production-ready.

---

## 6. Known Considerations and Gotchas

### CORS Must Include the Vercel Domain

The FastAPI backend reads allowed origins from the `ALLOWED_ORIGINS` environment variable (`backend/main.py`, lines 49-52):

```python
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
```

The default value (`localhost:3000`) works locally but will **reject all requests from the production Vercel domain** unless `ALLOWED_ORIGINS` is updated in Render's environment variables.

In `render.yaml`, `ALLOWED_ORIGINS` is declared with `sync: false` — meaning it must be set manually in the Render dashboard. The value must include the Vercel production URL and any preview domains:

```
https://your-app.vercel.app,https://your-app-git-*.vercel.app
```

Because the Next.js rewrite proxy makes API calls server-to-server (Vercel server → Render), the browser itself does not issue cross-origin requests for `/api/*` routes. CORS is technically only relevant for direct browser connections (i.e., WebSocket). However, it is still correct practice to configure `ALLOWED_ORIGINS` to include the Vercel domain in case the proxying behavior changes.

### `NEXT_PUBLIC_BACKEND_URL` Has No Fallback in Production

In `next.config.ts`:

```typescript
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
```

If `NEXT_PUBLIC_BACKEND_URL` is missing from Vercel's environment variables, the build will succeed silently but all API calls will fail at runtime because `http://localhost:8000` is unreachable from Vercel's servers. There is no build-time validation that this variable is set.

Add a validation check or at minimum add a build step comment so this failure mode is caught during onboarding rather than at runtime.

### CesiumJS Static Files and Build Size

The `postinstall` script copies the full CesiumJS static build (~30-50 MB) into `public/cesium/`. Vercel has a deployment size limit (currently 100 MB for the deployment artifact). If this limit is approached as the project grows, the CesiumJS static files will be the first candidate to optimize — either by hosting them on a CDN separately or by enabling selective CesiumJS builds.

Currently the `public/cesium/` directory is not in `.gitignore` within the frontend, which means it may be committed to git. Committing generated build artifacts is not recommended and can cause conflicts or inflate repository size significantly. Verify that `public/cesium/` is excluded from the repository and that the `postinstall` script generates it fresh on every deployment.

### Preview Deployments and API Keys

Vercel preview deployments share the same environment variables as production by default if set to both environments. This means preview builds will hit the live Render backend with real API keys. For a project in alpha/MVP stage this is acceptable, but be aware that automated preview builds triggered by pull requests from forks could expose the backend to untrusted code.

### No Rate Limiting

The backend has no rate limiting. Once the Vercel domain and backend URL are public, anyone who discovers the `/api/*` paths can hit the Render backend directly (bypassing the proxy). The Render backend's `ALLOWED_ORIGINS` provides no protection against direct HTTP clients (non-browser). Consider adding API key authentication or IP-based rate limiting on Render if the endpoints are sensitive.

### Vercel Function Timeout

If any Next.js API route (not the proxy rewrites) is added in the future, Vercel's default function timeout is 10 seconds (Hobby plan) or 60 seconds (Pro). The current architecture uses only rewrites — no Next.js API routes — so this limit does not apply today, but it is a constraint to be aware of if server-side logic is added to the Next.js layer.

---

## 7. Local Development vs. Production Parity

| Aspect | Local | Vercel Production |
|---|---|---|
| Backend URL | `http://localhost:8000` (hardcoded fallback) | `NEXT_PUBLIC_BACKEND_URL` env var |
| API proxy | Next.js dev server rewrite | Vercel Edge rewrite |
| CesiumJS static files | `postinstall` copies on `npm install` | `postinstall` runs during Vercel build |
| Environment variables | `frontend/.env` (gitignored) | Vercel dashboard → Settings → Env Vars |
| CORS | Backend defaults to `localhost:3000` | Backend `ALLOWED_ORIGINS` must include Vercel domain |
| WebSocket | `ws://localhost:8000/ws/live/{id}` | Direct WSS connection to Render backend required |

---

## 8. Deployment Checklist

Use this checklist when deploying a new environment or validating an existing one:

- [ ] Vercel project root directory is set to `frontend/`
- [ ] `NEXT_PUBLIC_BACKEND_URL` is set to the Render backend URL in Vercel dashboard (Production + Preview)
- [ ] `NEXT_PUBLIC_CESIUM_ION_TOKEN` is set in Vercel dashboard
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in Vercel dashboard
- [ ] `ALLOWED_ORIGINS` on Render includes the Vercel production URL
- [ ] Build log confirms `postinstall` ran and CesiumJS files were copied
- [ ] `/api/autocomplete?input=test` returns suggestions after deployment
- [ ] Globe renders 3D tiles in the browser (confirms Google Maps API key and Cesium Ion token work)
- [ ] Voice assistant WebSocket URL resolves correctly to the Render backend

---

_Last updated: 2026-03-21 — Initial Vercel deployment documentation for GroundLevel/POView V5_
