# Cloudflare Workers Setup Guide

This guide walks you through deploying the Cloudflare Workers API for the Cluster Catalogue.

## Prerequisites

- Cloudflare account with R2 bucket created
- Wrangler CLI installed and authenticated
- Data uploaded to R2 bucket

## Step 1: Review Configuration

Check `wrangler.toml` in your project root:

```toml
name = "cluster-catalogue-api"
main = "workers/api.js"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "cluster-catalogue"  # Must match your R2 bucket name
```

## Step 2: Set Up Secrets

The Workers API requires several secrets for authentication and Google Docs integration.

### Generate Password Hash

Choose a shared password for your team and generate its hash:

```bash
# On macOS/Linux
echo -n "your-password-here" | shasum -a 256

# Example output: abc123def456...
```

Set the password hash:
```bash
wrangler secret put PASSWORD_HASH
# Paste the hash when prompted
```

### Generate Session Secret

Create a random secret for JWT signing:

```bash
# Generate random string
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set the session secret:
```bash
wrangler secret put SESSION_SECRET
# Paste the generated secret
```

### Set Google Service Account Key (Optional)

If you want Google Docs integration:

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# Paste the entire JSON key file content
```

See [Google Docs Setup Guide](./GOOGLE_DOCS_SETUP.md) for details.

### Set Google Doc ID (Optional)

```bash
wrangler secret put GOOGLE_DOC_ID
# Paste the Google Doc ID (from the URL)
```

## Step 3: Test Locally

Run the Workers API locally:

```bash
wrangler dev
```

This starts a local server at http://localhost:8787

Test the API:

```bash
# Test auth endpoint
curl -X POST http://localhost:8787/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password-here"}'

# Should return: {"success":true,"token":"...","expires_at":"..."}
```

Get a token and test data endpoints:

```bash
# Save token from auth response
TOKEN="your-jwt-token-here"

# Test datasets endpoint
curl http://localhost:8787/api/datasets \
  -H "Authorization: Bearer $TOKEN"

# Test config endpoint
curl http://localhost:8787/api/config/models \
  -H "Authorization: Bearer $TOKEN"
```

## Step 4: Deploy to Production

Deploy the Workers:

```bash
wrangler deploy
```

This will:
1. Bundle your Workers code
2. Upload to Cloudflare
3. Return your Workers URL (e.g., `https://cluster-catalogue-api.your-subdomain.workers.dev`)

Example output:
```
✨ Built successfully
🌍 Deploying to Cloudflare...
✨ Success! Published cluster-catalogue-api
   https://cluster-catalogue-api.your-subdomain.workers.dev
```

## Step 5: Test Production Deployment

Test your deployed API:

```bash
WORKERS_URL="https://cluster-catalogue-api.your-subdomain.workers.dev"

# Test auth
curl -X POST $WORKERS_URL/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password-here"}'

# Get token
TOKEN="..."

# Test endpoints
curl $WORKERS_URL/api/datasets \
  -H "Authorization: Bearer $TOKEN"
```

## Step 6: Update Frontend Configuration

The frontend automatically detects the API URL:
- **Development** (localhost): Uses `http://localhost:8787/api`
- **Production**: Uses same origin + `/api`

If you need to use a custom Workers URL, update `app.js`:

```javascript
getAPIUrl() {
    // Production: use custom Workers URL
    return 'https://cluster-catalogue-api.your-subdomain.workers.dev/api';
}
```

## Step 7: Deploy Frontend

### Option A: GitHub Pages

1. Commit and push your code:
```bash
git add .
git commit -m "Update cluster catalogue with Workers backend"
git push
```

2. Enable GitHub Pages in repository settings
3. Your site will be at: `https://your-username.github.io/cluster_catalogue`

### Option B: Cloudflare Pages

```bash
# Install Pages CLI
npm install -g @cloudflare/pages-cli

# Deploy
wrangler pages deploy . --project-name=cluster-catalogue
```

## API Endpoints Reference

### POST /api/auth
Authenticate and get JWT token

**Request:**
```json
{
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJ...",
  "expires_at": "2025-12-04T00:00:00Z"
}
```

### GET /api/datasets
List available datasets

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "datasets": [
    {
      "name": "pythia-14m",
      "display_name": "Pythia 14M",
      "size_bytes": 16777216,
      "last_modified": "2025-12-03T00:00:00Z"
    }
  ]
}
```

### GET /api/datasets/{model}
Get full dataset

**Headers:** `Authorization: Bearer <token>`

### GET /api/observations/{model}
Get all observations for model

**Headers:** `Authorization: Bearer <token>`

### PUT /api/observations/{model}/{cluster_id}
Update observation

**Headers:**
- `Authorization: Bearer <token>`
- `If-Match: <etag>` (optional, for conflict detection)

**Request:**
```json
{
  "name": "Cluster name",
  "observations": "Analysis notes...",
  "good": false
}
```

## Monitoring

View Workers logs:
```bash
wrangler tail
```

View metrics in Cloudflare dashboard:
1. Go to Workers & Pages
2. Click your Worker
3. View Analytics tab

## Troubleshooting

### Error: "R2 bucket not found"
Verify bucket name in `wrangler.toml` matches your R2 bucket:
```bash
wrangler r2 bucket list
```

### Error: "Secret not found"
List secrets:
```bash
wrangler secret list
```

Re-add missing secrets:
```bash
wrangler secret put SECRET_NAME
```

### CORS errors
Add CORS headers in `workers/api.js` (already included in this project).

### 401 Unauthorized
- Check password hash is correct
- Verify token hasn't expired (24 hour expiry)
- Re-authenticate to get new token

## Costs

Cloudflare Workers Pricing:
- Free tier: 100,000 requests/day
- Paid: $5/month + $0.50 per million requests

For this project: Free tier is sufficient for small teams.

## Next Steps

- [Set up Google Docs integration](./GOOGLE_DOCS_SETUP.md)
- [Learn how to add new fields](./ADDING_FIELDS.md)
- [Share with your team](./TEAM_USER_GUIDE.md)
