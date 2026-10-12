# Sila Lite

Sila is a sovereign AI-agent marketplace: teams discover, build, vet and hire AI
agents, and everything runs on your own infrastructure.

**Sila Lite** is the edition that runs **before the GPU servers arrive**. The full
platform runs: accounts, workspaces, members and roles, the Bazaar (templates and
skills), settings, notifications and audit logging. Only the AI is switched off:

- **Chat** answers every message with: *"Sila's AI is waiting for its GPU
  servers. Once they are installed, chat, agent building and security reviews
  will switch on here automatically."*
- **Security reviews, skill imports and knowledge uploads** answer with the same
  message instead of starting.

No cloud AI provider is used, so no data leaves your infrastructure.

| Part | What it is |
|---|---|
| `apps/web` | The website (Next.js 15, React 19, TypeScript) |
| `apps/api` | The API (FastAPI, Python 3.13) |
| `infra/opa` | Permission rules (Open Policy Agent) |
| `infra/policies` | Classification and data-protection policies read by the API |
| `infra/supabase` | Database start-up scripts and the internal gateway config |
| `infra/openshift` | The OpenShift deployment (with `kustomization.yaml` at the root) |
| `docker-compose.yml` | The same stack on one machine, for a local check |

Lite runs six services: **sila-web, sila-api, opa, Postgres (Supabase), GoTrue
(sign-in) and Kong** (the internal gateway between the API and GoTrue). Only the
website and the API are reachable from outside, on one hostname:
`/` → website, `/v1` → API.

---

## Run it locally

Needs Docker with Compose, and Python 3 for the secret generator.

```bash
python scripts/gen_secrets.py > .env
docker compose up -d --build
```

Open **<http://localhost:8080>** and sign up with an `@omantel.om` address (change
`--allowed-domains` when generating `.env` for other domains). The API and
website run under a random non-root user ID, the way OpenShift runs them.

---

## Deploy to OpenShift

### 1. What the cluster administrator provides

- A project (namespace), for example `sila-dev`, with the **admin** role for you.
- Quota of about **4 vCPU, 8 GiB memory, 20 GiB storage** for the running
  services, plus **4 GiB memory** while the website image builds.
- The `anyuid` SCC for the database's service account. The Supabase Postgres
  image starts as root and drops to the `postgres` user itself:

  ```bash
  oc adm policy add-scc-to-user anyuid -z sila-db -n sila-dev
  ```

- DNS for the public hostname pointing at the cluster's router, and a TLS
  certificate for it. Add the certificate to the two Routes, or use the
  router's default if it already covers the hostname.
- Outbound HTTPS to `github.com` and the image registries while building.

### 2. Log in, choose the project, create the secrets

```bash
oc login --token=<token> --server=https://api.<cluster>:6443
oc project sila-dev

python scripts/gen_secrets.py --openshift > sila-secrets.env
oc create secret generic sila-secrets --from-env-file=sila-secrets.env
rm sila-secrets.env          # it is now in the cluster; don't keep a copy around
```

Every installation gets fresh keys. Never reuse another installation's.

### 3. Set the hostname, then apply

Edit `infra/openshift/config.yaml`: `PUBLIC_HOST`, `PUBLIC_URL` and the sign-up
domains. It is the only file to edit. Then:

```bash
oc apply -k .            # needs oc 4.10 or newer
```

### 4. Build the images

```bash
oc start-build sila-opa --follow
oc start-build sila-api --follow
oc start-build sila-web --follow
```

Deployments roll out on their own when each build finishes. If the cluster
refuses the `RUN --mount=type=cache` lines in `apps/web/Dockerfile` (older
builders), build the images on a machine with Docker and push them to the
project's registry instead.

### 5. Create the database tables

A Job can't pick up an image that didn't exist when it was created, so
(re)create the `sila-migrate` Job once the `sila-api` build has finished, then
follow its log. Do the same after every upgrade:

```bash
oc delete job sila-migrate --ignore-not-found && oc apply -k .
oc logs -f job/sila-migrate          # ends with the last migration applied
```

### 6. Check

```bash
oc get pods                      # all Running, sila-migrate Completed
curl -I https://<PUBLIC_HOST>/login
```

Sign up with an address in the allowed domain, then send a chat message. The
reply should be the "waiting for GPU servers" message.

---

## When the GPUs arrive

1. Deploy the model server (Ollama) with GPU access and pull the models.
2. Set `SILA_AI_ENABLED: "true"` in `infra/openshift/config.yaml`.
3. Run `oc apply -k .` and `oc rollout restart deployment/sila-api`.

---

## Security notes

- **Secrets** live only in the `sila-secrets` Secret. `.env` and `*.env` are
  git-ignored.
- **Exposure:** only `/` and `/v1` are routed. Postgres, GoTrue, Kong and OPA
  have no Route.
- **Accounts:** accounts are active on creation, because Lite sends no
  verification email. Sign-up is limited to the domains in
  `SILA_SIGNUP_ALLOWED_DOMAINS` and checked by the API before any account is
  created. GoTrue cannot be reached directly.
- **Passwords:** "Forgot password" needs email, so in Lite an administrator
  resets passwords.
- **Containers** run as non-root with a random UID; only the database needs
  `anyuid`.

## Licence

MIT. See `LICENSE`.
