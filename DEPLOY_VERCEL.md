# Deploy MiitVerse on Vercel with Docker (Container Images)

This project is **monolithic**: the Node.js/Express server already serves the
built React frontend (from `server/public`) **and** the `/api` routes. So we
deploy a **single OCI container** to Vercel using a `Dockerfile.vercel`. Vercel
auto-detects that file at the repo root, routes **all traffic** to the
container, and injects `$PORT` at runtime.

> No `vercel.json` is required for this setup. Rewrites/services are only needed
> when a project is split into multiple separately-built backends/frontends. Our
> single container handles the whole app on one origin, so relative `/api` calls
> just work.

---

## 1. Files in this repo (already created)

| File | Purpose |
|------|---------|
| `Dockerfile.vercel` | Multi-stage build: (1) build React/Vite frontend, (2) run the Express server serving `server/public` + `/api`. Listens on `$PORT` / `0.0.0.0`. |
| `server/src/server.js` | Updated to bind `0.0.0.0` and keep using `process.env.PORT` (default 3001). |
| `.dockerignore` / `.gitignore` | Exclude secrets (`*.env`, `atlas-credentials.*`) and runtime data (`server/data/uploads`) so they never reach git or the image. `server/atlas-credentials.env` has been untracked from git. |
| `server/.env.example` | Template of every environment variable the server reads. |

The frontend already calls the API relative to the same origin
(`import.meta.env.VITE_API_BASE_URL || '/api'` in `src/lib/api.js`, plus direct
`fetch('/api/...')`), so no frontend change is needed for Vercel.

---

## 2. Environment variables

**Do not bake secrets into the image.** Add them in Vercel:

1. Open the project in Vercel → **Settings → Environment Variables**.
2. Add each key for **Production** (and Preview/Development if you want them):

```
MONGODB_URI          # e.g. mongodb+srv://user:pass@cluster.mongodb.net/MiitVerse?...
JWT_SECRET           # long random string (REQUIRED)
NEO4J_URI            # neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER
NEO4J_PASSWORD
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
SENDGRID_FROM_NAME
```

Alternative (if you don't use a full `MONGODB_URI`):
`MONGODB_HOST`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_DATABASE`,
`MONGODB_PROTOCOL`, `MONGODB_OPTIONS`.

---

## 3. Deploy

### Option A — GitHub (recommended)
1. Commit and push (see **Security note** below), then in Vercel:
   **Add New → Project → Import** your repo.
2. Vercel detects `Dockerfile.vercel` automatically. Set the env vars above.
3. Deploy. Vercel builds the image, pushes to Vercel Container Registry (VCR),
   and runs it as a Function listening on `$PORT`.

### Option B — Vercel CLI (`vercel deploy`)
Requires Docker on your machine (Vercel runs the container build through it):
```bash
vercel link
vercel deploy --prod
```

### Option C — Build & push the image yourself (VCR)
```bash
vercel link
vercel vcr login docker
vercel vcr build docker . --push
```

---

## 4. Verify

- `https://<your-project>.vercel.app/api/health` → `{ "status": "ok" }`
- `https://<your-project>.vercel.app/` → loads the MiitVerse frontend.
- Register/login flow, email verification (SendGrid), and Neo4j/Mongo reads.

---

## ⚠️ Important limitations (Vercel containers are STATELESS)

1. **File uploads / feed writes are local-only.** The social feed reads from
   `server/data/social-posts.json` on the container's local filesystem
   (`socialStore.js`) and image uploads are written to `server/data/uploads/`.
   Container instances are ephemeral and may scale to zero — anything written to
   the local disk will **not** survive or be shared across instances. Auth users
   are safely stored in MongoDB/Neo4j; posts ARE also written to Mongo+Neo4j via
   `persistSocialPost`, but reads still come from the local JSON file.

   **To make the feed reliable on Vercel**, point reads at MongoDB (or Neo4j)
   instead of the local JSON file, and store uploaded images in cloud object
   storage (e.g. Vercel Blob / S3) rather than the container disk.

2. **Stateless perception.** Do not rely on any file or in-memory state persisting
   between requests or after a cold start.

3. **Keep the image lean.** The 250 MB function size limit can be hit; the
   `.dockerignore` already excludes `node_modules`, uploads, and build output.

---

## 🔐 Security note (important)

`server/atlas-credentials.env` contained **real MongoDB credentials** and was
previously committed to git. It has been **untracked** and added to
`.gitignore` / `.dockerignore`. If this repository is (or ever was) public, or
if you are unsure, **rotate those MongoDB credentials** and update them via the
Vercel env vars. Also, `node_modules` and `server/node_modules` have been
untracked from git — they are installed at build time.
