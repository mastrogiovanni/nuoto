# Authentication

Nuoto uses **OAuth 2.0 / OpenID Connect** to authenticate users via Google and Apple. The Go backend handles the full OAuth flow and issues short-lived, signed **JWT session tokens** (HS256, 7-day expiry). The React frontend stores the token in `localStorage` and sends it as a `Bearer` header on every API call.

---

## Architecture overview

```
Browser ──► Traefik (HTTPS) ──► frontend nginx ──► backend Go
                                   /api/* proxy
```

1. User visits the app → `AuthContext` checks `localStorage` for a token → calls `/api/auth/me` to validate.
2. If no valid token → redirected to `/login`.
3. User clicks "Sign in with Google" or "Sign in with Apple" → browser navigates to `/api/auth/google` or `/api/auth/apple`.
4. Backend redirects to the provider's OAuth endpoint.
5. Provider redirects back (Google: `GET`; Apple: `POST`) to the backend callback.
6. Backend verifies the identity, creates a JWT, and redirects to `/auth/callback?token=<jwt>`.
7. `AuthCallback` page stores the token and redirects to `/`.

---

## Environment variables

Set these before starting the stack (`export` or add to a `.env` file alongside `compose.nuoto.yml`).

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Random 32-byte hex string used to sign session JWTs |
| `GOOGLE_CLIENT_ID` | Google only | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google only | OAuth 2.0 Client Secret |
| `APPLE_SERVICE_ID` | Apple only | Web Service ID (e.g. `net.ddns.mastrogiovanni.nuoto`) |
| `APPLE_TEAM_ID` | Apple only | 10-character Apple Developer Team ID |
| `APPLE_KEY_ID` | Apple only | Key ID of the Sign in with Apple private key |
| `APPLE_PRIVATE_KEY_PATH` | Apple only | Path to the `.p8` key file inside the container (default: `/run/secrets/apple_key.p8`) |

Generate `JWT_SECRET`:
```bash
openssl rand -hex 32
```

---

## Google Sign In — setup steps

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or reuse an existing one).

### 2. Enable the Google+ / People API

1. In the project, navigate to **APIs & Services → Library**.
2. Search for **"Google People API"** and enable it.

### 3. Create an OAuth 2.0 Client ID

1. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: e.g. `Nuoto Web`.
4. **Authorised JavaScript origins**: `https://mastrogiovanni.ddns.net`
5. **Authorised redirect URIs**: `https://mastrogiovanni.ddns.net/api/auth/google/callback`
6. Click **Create**.
7. Copy the **Client ID** and **Client Secret**.

### 4. Configure the OAuth consent screen

1. Navigate to **APIs & Services → OAuth consent screen**.
2. Set **User type** to External (unless you have a Google Workspace org).
3. Fill in app name, support email, and developer email.
4. Add scopes: `openid`, `email`, `profile`.
5. Add test users if the app is still in testing mode.

### 5. Set environment variables

```bash
export GOOGLE_CLIENT_ID="123456789-xxxx.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"
```

---

## Apple Sign In — setup steps

Apple Sign In requires an **Apple Developer account** ($99/year).

### 1. Create an App ID with Sign In with Apple capability

1. Go to [developer.apple.com → Certificates, IDs & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Click **+** → **App IDs** → **App**.
3. Choose a Bundle ID (e.g. `net.ddns.mastrogiovanni.nuoto.app`) — this is for native apps, not the web.
4. Enable the **Sign In with Apple** capability → **Edit** → select **Enable as primary App ID**.
5. Save.

### 2. Create a Services ID (Web Service ID)

1. **Identifiers → +** → **Services IDs**.
2. Description: `Nuoto Web`.
3. Identifier: e.g. `net.ddns.mastrogiovanni.nuoto` — this becomes `APPLE_SERVICE_ID`.
4. Save, then click on the newly created Services ID.
5. Enable **Sign In with Apple** → **Configure**.
6. Primary App ID: select the App ID you created above.
7. **Domains and Subdomains**: `mastrogiovanni.ddns.net`
8. **Return URLs**: `https://mastrogiovanni.ddns.net/api/auth/apple/callback`
9. Save and Continue.

### 3. Create a private key

1. **Keys → +**.
2. Key Name: e.g. `Nuoto Sign In with Apple Key`.
3. Enable **Sign In with Apple** → **Configure** → select the primary App ID.
4. Register and **download the `.p8` file** (you can only download it once).
5. Note the **Key ID** shown on the key detail page — this is `APPLE_KEY_ID`.

### 4. Find your Team ID

Your **Team ID** is the 10-character string shown in the top-right of [developer.apple.com → Account](https://developer.apple.com/account) (e.g. `AB12CD34EF`).

### 5. Set environment variables

Convert the `.p8` file to a single-line env var (newlines become `\n`):

```bash
export APPLE_PRIVATE_KEY="$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' ~/Downloads/AuthKey_XXXXXXXXXX.p8)"
```

Then set the remaining variables:

```bash
export APPLE_SERVICE_ID="net.ddns.mastrogiovanni.nuoto"
export APPLE_TEAM_ID="AB12CD34EF"
export APPLE_KEY_ID="XXXXXXXXXX"
```

> **Never commit the private key or its content to git.**
> Store it only in environment variables or a secrets manager.

---

## Starting the stack

```bash
export ACME_EMAIL="you@example.com"
export JWT_SECRET="$(openssl rand -hex 32)"

# Google (omit if not using Google Sign In)
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."

# Apple (omit if not using Apple Sign In)
export APPLE_SERVICE_ID="net.ddns.mastrogiovanni.nuoto"
export APPLE_TEAM_ID="AB12CD34EF"
export APPLE_KEY_ID="XXXXXXXXXX"
export APPLE_PRIVATE_KEY="$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' AuthKey_XXXXXXXXXX.p8)"

docker compose -f compose.nuoto.yml up -d
```

You can also store these in a `.env` file next to `compose.nuoto.yml` — Docker Compose loads it automatically. Never commit `.env` to git.

Example `.env`:
```
ACME_EMAIL=you@example.com
JWT_SECRET=<output of openssl rand -hex 32>
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
APPLE_SERVICE_ID=net.ddns.mastrogiovanni.nuoto
APPLE_TEAM_ID=AB12CD34EF
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGHAgEA...\n-----END PRIVATE KEY-----\n
```

---

## Session tokens

- Algorithm: **HS256** (HMAC-SHA256), signed with `JWT_SECRET`.
- Expiry: **7 days**.
- Payload: `sub`, `email`, `name`, `picture` (Google only), `provider`.
- Stored in browser `localStorage` under the key `auth_token`.
- Sent as `Authorization: Bearer <token>` on every API request.
- The backend `/api/auth/me` endpoint validates the token and returns the user payload.

To rotate the secret (invalidates all existing sessions):
```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose -f compose.nuoto.yml up -d --force-recreate backend
```

---

## Local development

When developing locally (Vite dev server on port 5173), set `BASE_URL` so the backend builds the correct redirect URIs:

```bash
export BASE_URL="http://localhost:5173"
export JWT_SECRET="dev-secret-change-me"
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
go run ./cmd/backend
```

You also need to add `http://localhost:5173/api/auth/google/callback` as an authorised redirect URI in the Google Cloud Console (for the dev credentials).

Apple Sign In **requires HTTPS** and a publicly registered domain, so it cannot be tested on localhost. Use a staging environment or an HTTPS tunnel (e.g. `ngrok`) for Apple testing.

---

## Security notes

- The Apple `.p8` private key is passed as the `APPLE_PRIVATE_KEY` env var. Never commit it or the `.env` file to git (add `.env` to `.gitignore`).
- `JWT_SECRET` should be at least 32 random bytes. Use `openssl rand -hex 32`.
- The backend verifies Apple's ID token against Apple's published JWKS (`https://appleid.apple.com/auth/keys`) on every sign-in.
- CORS allows `Authorization` headers; the `Access-Control-Allow-Origin: *` policy is acceptable because the API is read-only public data.
