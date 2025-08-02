# Step by step guide for hosting on gcloud
_Exported on 29/07/2025 at 14:50:14 EEST from Cursor (1.2.4)_

---

**User**

create step by step instructionsf or hosting on gcloud

+ how to set up Secre Manager, nginx file (CORS) etc



---

**Cursor**

Below is a pragmatic “cheapest-but-still-reliable” path to get your music-game running on Google Cloud, plus opt-in instructions for the single-VM (+ NGINX) route.  
Everything is written as copy-pasteable commands, but **don’t run anything until you have reviewed / adapted project-IDs, region names, and secret values.**

⚠️  I sometimes mention flags or options (`--set-secrets`, `cors-json`) that come from Google’s official docs, not from your repo. Double-check spelling and availability in your gcloud version.

────────────────────────── 1 . Prerequisites ──────────────────────────
1. Google Cloud account with billing enabled.  
2. Local tools:  
   • gcloud CLI (≥ 446.0.0 for `--set-secrets`)  
   • Docker or Cloud Build’s remote builder  
   • Node 18+ (for local builds)  
3. Set your project & default region once:  
   ```bash
   gcloud auth login               # opens browser
   gcloud config set project  MUSIC-GAME-PROJ
   gcloud config set run/region  europe-west1  # pick a near region
   ```

────────────────────────── 2 . Enable APIs ────────────────────────────
```bash
gcloud services enable run.googleapis.com \
    artifactregistry.googleapis.com cloudbuild.googleapis.com \
    secretmanager.googleapis.com storage.googleapis.com
```

────────────────────────── 3 . Backend container (Cloud Run path) ─────
A minimal `server/Dockerfile` (adapt if you already have one):

```dockerfile
# --------  build  --------
FROM node:20-bullseye AS build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server .
RUN npm run build          # outputs dist/index.js

# --------  runtime --------
FROM node:20-bullseye
WORKDIR /app
COPY --from=build /app .
ENV PORT=8080
CMD ["node", "dist/index.js"]
```
Build & push to Artifact Registry:
```bash
gcloud artifacts repositories create music-game --repository-format=docker --location=europe-west1
docker build -t europe-west1-docker.pkg.dev/$(gcloud config get-value project)/music-game/api:latest -f server/Dockerfile .
docker push europe-west1-docker.pkg.dev/$(gcloud config get-value project)/music-game/api:latest
```

────────────────────────── 4 . Secret Manager ─────────────────────────
Create one secret per value; the `latest` version is referenced automatically.

```bash
gcloud secrets create SPOTIFY_CLIENT_ID     --data-file=- <<<"xxxxxxxx"
gcloud secrets create SPOTIFY_CLIENT_SECRET --data-file=- <<<"yyyyyyyy"
gcloud secrets create FIREBASE_PRIVATE_KEY  --data-file=- <<<"$FIREBASE_PRIVATE_KEY"
gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=- <<<"$FIREBASE_CLIENT_EMAIL"
gcloud secrets create FIREBASE_PROJECT_ID   --data-file=- <<<"music-game-prod"
```
Grant Cloud Run’s service-account read access:

```bash
SA="$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding  SPOTIFY_CLIENT_ID     --member="serviceAccount:$SA" --role='roles/secretmanager.secretAccessor'
# repeat for each secret or loop
```

────────────────────────── 5 . Deploy to Cloud Run ────────────────────
```bash
gcloud run deploy music-game-api \
  --image=europe-west1-docker.pkg.dev/$(gcloud config get-value project)/music-game/api:latest \
  --concurrency=20 --memory=256Mi --timeout=60 \
  --min-instances=0 --max-instances=3 \
  --update-secrets=\
SPOTIFY_CLIENT_ID=SPOTIFY_CLIENT_ID:latest,\
SPOTIFY_CLIENT_SECRET=SPOTIFY_CLIENT_SECRET:latest,\
FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,\
FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,\
FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest \
  --allow-unauthenticated   # remove if you add Firebase auth in future
```
• Cloud Run automatically injects each secret as an environment variable with the same name.  
• Your code already references `process.env.SPOTIFY_CLIENT_ID` etc., so no change needed.

────────────────────────── 6 . Front-end (Cloud Storage + CDN) ───────
1. Build SPA:
   ```bash
   npm install
   npm run build          # Vite outputs to dist/
   ```
2. Create bucket & upload:
   ```bash
   gsutil mb -l europe-west1 -b on gs://music-game-static
   gsutil rsync -r dist gs://music-game-static
   ```
3. Make the bucket publicly readable (simplest dev path):
   ```bash
   gsutil iam ch allUsers:objectViewer gs://music-game-static
   ```
4. Set website config & basic CORS:
   ```bash
   gsutil web set -m index.html -e index.html gs://music-game-static
   gsutil cors set - <<'JSON' gs://music-game-static
   [
     { "origin": ["*"], "responseHeader": ["Content-Type"], "method": ["GET","HEAD"], "maxAgeSeconds": 3600 }
   ]
   JSON
   ```

5. Turn on Cloud CDN (free TLS):  
   GUI → Cloud CDN → “Enable Cloud CDN” → Backend bucket = `music-game-static`.

────────────────────────── 7 . Custom domain (optional) ───────────────
Cloud Run gives you `https://music-game-api-xxxxx.run.app`; Cloud CDN gives another HTTPS URL.  
Add a Cloud DNS A/AAAA record to point `api.music-game.com` and/or `play.music-game.com` at the provided endpoints. Certificates are managed automatically.

────────────────────────── 8 . CORS for the API ───────────────────────
Your Express server can already use `cors` middleware:

```ts
import cors from 'cors';
app.use(
  cors({
    origin: ['https://play.music-game.com'], // add dev URL too
    credentials: true,
  })
);
```
Nothing else is needed; Cloud Run passes the headers through.  
If you deploy behind NGINX (next section) you may let NGINX handle it instead.

────────────────────────── 9 . Single-VM alternative (e2-micro) ───────
1. Create a Debian 12 VM in `us-west1` (free-tier zone) with 30 GB disk.  
2. SSH in, install Docker + NGINX:
   ```bash
   sudo apt update && sudo apt install docker.io nginx -y
   ```
3. Copy your **same container** and a static build:
   ```bash
   docker run -d --name music-game-api -p 8080:8080 \
     -e SPOTIFY_CLIENT_ID="$SPOTIFY_CLIENT_ID" \
     -e SPOTIFY_CLIENT_SECRET="$SPOTIFY_CLIENT_SECRET" \
     -e FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
     -e FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
     -e FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
     europe-west1-docker.pkg.dev/<PROJECT>/music-game/api:latest
   scp -r dist/* vm:/var/www/music-game
   ```
4. `/etc/nginx/conf.d/music-game.conf`
   ```nginx
   server {
     listen 80;
     server_name play.music-game.com;

     root /var/www/music-game;
     index index.html;

     # Static SPA
     location / {
       try_files $uri /index.html;
       add_header Cache-Control "public, max-age=300"; # 5 min
       add_header Access-Control-Allow-Origin "$http_origin" always;
       add_header Access-Control-Allow-Credentials "true" always;
     }

     # API  →  Docker container port 8080
     location /api/ {
       proxy_pass http://127.0.0.1:8080$request_uri;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       add_header Access-Control-Allow-Origin "$http_origin" always;
       add_header Access-Control-Allow-Credentials "true" always;
     }
   }
   ```
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. Use Certbot (`snap install certbot`) for a free Let’s Encrypt cert.

────────────────────────── 10 . Cost check (≈ 5 concurrent games) ─────
• Cloud Run (request-CPU) 0.1 vCPU-h/day  →  ~ $0.09/mo  
• Cloud Storage 10 GB + CDN egress 20 GB  →  ~ $1.50/mo  
• Secret Manager ≤10,000 access/month     →  $0.00  
Total ≈ $2–3/month unless traffic spikes.

────────────────────────── 11 . Security sanity list ──────────────────
✓ Secrets live in Secret Manager, never baked into images or pushed to Git.  
✓ CORS locked to your production origin(s) before launch.  
✓ Cloud Run’s default TLS covers `*.run.app`; Cloud CDN or Certbot cover custom domains.  
✓ No Firebase service-account JSON files are stored on disk; the private key stays in Secret Manager.  
✓ Public bucket read-access is fine for a hobby project; use signed URLs if you need restrictions later.

You now have a reproducible, low-cost deployment pipeline.  
Feel free to ask if any step needs deeper detail, and **double-check** all project IDs, secret names, and region choices before running the commands.

```shellscript
   gcloud auth login               # opens browser
   gcloud config set project  MUSIC-GAME-PROJ
   gcloud config set run/region  europe-west1  # pick a near region
```

```shellscript
gcloud services enable run.googleapis.com \
    artifactregistry.googleapis.com cloudbuild.googleapis.com \
    secretmanager.googleapis.com storage.googleapis.com
```

```dockerfile
# --------  build  --------
FROM node:20-bullseye AS build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server .
RUN npm run build          # outputs dist/index.js

# --------  runtime --------
FROM node:20-bullseye
WORKDIR /app
COPY --from=build /app .
ENV PORT=8080
CMD ["node", "dist/index.js"]
```

```shellscript
gcloud artifacts repositories create music-game --repository-format=docker --location=europe-west1
docker build -t europe-west1-docker.pkg.dev/$(gcloud config get-value project)/music-game/api:latest -f server/Dockerfile .
docker push europe-west1-docker.pkg.dev/$(gcloud config get-value project)/music-game/api:latest
```

```shellscript
gcloud secrets create SPOTIFY_CLIENT_ID     --data-file=- <<<"xxxxxxxx"
gcloud secrets create SPOTIFY_CLIENT_SECRET --data-file=- <<<"yyyyyyyy"
gcloud secrets create FIREBASE_PRIVATE_KEY  --data-file=- <<<"$FIREBASE_PRIVATE_KEY"
gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=- <<<"$FIREBASE_CLIENT_EMAIL"
gcloud secrets create FIREBASE_PROJECT_ID   --data-file=- <<<"music-game-prod"
```

```shellscript
SA="$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding  SPOTIFY_CLIENT_ID     --member="serviceAccount:$SA" --role='roles/secretmanager.secretAccessor'
# repeat for each secret or loop
```

```shellscript
gcloud run deploy music-game-api \
  --image=europe-west1-docker.pkg.dev/$(gcloud config get-value project)/music-game/api:latest \
  --concurrency=20 --memory=256Mi --timeout=60 \
  --min-instances=0 --max-instances=3 \
  --update-secrets=\
SPOTIFY_CLIENT_ID=SPOTIFY_CLIENT_ID:latest,\
SPOTIFY_CLIENT_SECRET=SPOTIFY_CLIENT_SECRET:latest,\
FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,\
FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,\
FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest \
  --allow-unauthenticated   # remove if you add Firebase auth in future
```

```shellscript
   npm install
   npm run build          # Vite outputs to dist/
```

```shellscript
   gsutil mb -l europe-west1 -b on gs://music-game-static
   gsutil rsync -r dist gs://music-game-static
```

```shellscript
   gsutil iam ch allUsers:objectViewer gs://music-game-static
```

```shellscript
   gsutil web set -m index.html -e index.html gs://music-game-static
   gsutil cors set - <<'JSON' gs://music-game-static
   [
     { "origin": ["*"], "responseHeader": ["Content-Type"], "method": ["GET","HEAD"], "maxAgeSeconds": 3600 }
   ]
   JSON
```

```typescript
import cors from 'cors';
app.use(
  cors({
    origin: ['https://play.music-game.com'], // add dev URL too
    credentials: true,
  })
);
```

```shellscript
   sudo apt update && sudo apt install docker.io nginx -y
```

```shellscript
   docker run -d --name music-game-api -p 8080:8080 \
     -e SPOTIFY_CLIENT_ID="$SPOTIFY_CLIENT_ID" \
     -e SPOTIFY_CLIENT_SECRET="$SPOTIFY_CLIENT_SECRET" \
     -e FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
     -e FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
     -e FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
     europe-west1-docker.pkg.dev/<PROJECT>/music-game/api:latest
   scp -r dist/* vm:/var/www/music-game
```

```plaintext
   server {
     listen 80;
     server_name play.music-game.com;

     root /var/www/music-game;
     index index.html;

     # Static SPA
     location / {
       try_files $uri /index.html;
       add_header Cache-Control "public, max-age=300"; # 5 min
       add_header Access-Control-Allow-Origin "$http_origin" always;
       add_header Access-Control-Allow-Credentials "true" always;
     }

     # API  →  Docker container port 8080
     location /api/ {
       proxy_pass http://127.0.0.1:8080$request_uri;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       add_header Access-Control-Allow-Origin "$http_origin" always;
       add_header Access-Control-Allow-Credentials "true" always;
     }
   }
```

```shellscript
   sudo nginx -t && sudo systemctl reload nginx
```

