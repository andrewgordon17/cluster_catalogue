# Google Docs Integration Setup Guide

This guide walks you through setting up automatic Google Docs synchronization for cluster observations.

## Overview

The Google Docs integration automatically generates and updates a document containing all clusters with non-empty observations. The document is organized by model and includes [GOOD] badges for marked clusters.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing):
   - Click "Select a project" → "New Project"
   - Name: "Cluster Catalogue"
   - Click "Create"

## Step 2: Enable Google Docs API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Docs API"
3. Click "Google Docs API"
4. Click "Enable"

## Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in details:
   - **Service account name**: cluster-catalogue-sync
   - **Service account ID**: cluster-catalogue-sync
   - **Description**: Service account for syncing cluster observations to Google Docs
4. Click "Create and Continue"
5. Skip "Grant this service account access" (click "Continue")
6. Skip "Grant users access" (click "Done")

## Step 4: Generate Service Account Key

1. In "Credentials", find your service account
2. Click the service account email
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Choose "JSON" format
6. Click "Create"

A JSON file will download. It looks like:
```json
{
  "type": "service_account",
  "project_id": "cluster-catalogue-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "cluster-catalogue-sync@cluster-catalogue-123456.iam.gserviceaccount.com",
  "client_id": "123456789...",
  ...
}
```

**⚠️ Important:** Keep this file secure! It provides full access to your service account.

## Step 5: Create Google Doc

1. Go to [Google Docs](https://docs.google.com)
2. Create a new blank document
3. Title it: "Cluster Catalogue - All Models"
4. Copy the document ID from the URL:
   ```
   https://docs.google.com/document/d/[DOCUMENT-ID]/edit
                                      ^^^^^^^^^^^^^^^^
   ```

## Step 6: Share Doc with Service Account

1. In the Google Doc, click "Share" (top right)
2. Paste the service account email (from the JSON file):
   ```
   cluster-catalogue-sync@cluster-catalogue-123456.iam.gserviceaccount.com
   ```
3. Give it "Editor" permissions
4. Uncheck "Notify people" (it's a service account, not a person)
5. Click "Share"

## Step 7: Add Secrets to Cloudflare Workers

Set the service account key:
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

When prompted, paste the **entire contents** of the JSON file.

Set the document ID:
```bash
wrangler secret put GOOGLE_DOC_ID
```

When prompted, paste just the document ID (not the full URL).

## Step 8: Test Integration

### Option A: Test Locally

```bash
# Start Workers dev server
wrangler dev
```

In another terminal:
```bash
# Authenticate
TOKEN=$(curl -s -X POST http://localhost:8787/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}' | jq -r .token)

# Trigger sync
curl -X POST http://localhost:8787/api/google-docs/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Check your Google Doc - it should be updated with cluster observations!

### Option B: Test in UI

1. Open the cluster catalogue web interface
2. Make sure you have some observations saved
3. Click "Sync Now" button in the header
4. Check the Google Doc

## Document Format

The generated document will look like:

```
Cluster Catalogue
Generated: 2025-12-03 13:00 UTC
Auto-updated when observations change

═══════════════════════════════════════
PYTHIA-14M
═══════════════════════════════════════

Cluster 0: Newline cluster [GOOD]
Observations: Captures newline tokens across multiple contexts. High susceptibility in early layers.

Cluster 15: Article determiners
Observations: Mostly "the" tokens in formal writing contexts.

═══════════════════════════════════════
PYTHIA-31M
═══════════════════════════════════════

Cluster 3: Mathematical operators [GOOD]
Observations: Arithmetic symbols in equations...
```

## Sync Triggers

The document syncs automatically in these scenarios:

### 1. After Each Save (Recommended)
When a user saves an observation, the Workers API triggers a sync (debounced 30 seconds).

**Already implemented in:** `workers/api.js` line 350

### 2. Manual Trigger
Click "Sync Now" button in the web interface.

### 3. Scheduled Sync (Optional)
Set up a Cloudflare Cron Trigger:

Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

Add to `workers/api.js`:
```javascript
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncToGoogleDocs(env));
  },
  async fetch(request, env) {
    // ... existing code
  }
}
```

## Troubleshooting

### Error: "Failed to update Google Doc: 403"
- Verify service account has "Editor" access to the document
- Check you shared with the correct email address
- The email must be from the JSON key file

### Error: "Failed to update Google Doc: 404"
- Verify GOOGLE_DOC_ID is correct
- Check document still exists
- Ensure you copied just the ID, not the full URL

### Error: "OAuth2 implementation needed"
The provided `google-docs-sync.js` has a placeholder for OAuth2 signing. For production use, you need to implement RS256 JWT signing or use the Google Auth Library.

**Quick fix:** Use the Google Auth Library in Workers:

```bash
npm install @google-cloud/common
```

Update `workers/google-docs-sync.js` with proper OAuth2 implementation.

### Document not updating
1. Check Workers logs:
   ```bash
   wrangler tail
   ```
2. Look for errors in Google Docs API calls
3. Verify service account key is valid (not expired)

### Rate Limits
Google Docs API limits:
- 300 requests per minute per user
- 600 requests per minute per project

For this use case (batch sync every few minutes), limits are not a concern.

## Security Notes

- **Never commit** the service account JSON file to git
- Store it only in Cloudflare Workers secrets
- Rotate keys periodically (every 90 days recommended)
- Use principle of least privilege (only Docs API access)

## Advanced: Two-Way Sync

The current implementation is **one-way** (app → Google Docs). For two-way sync (allowing edits in both places):

1. Implement Google Docs API webhooks (requires public endpoint)
2. Parse document changes
3. Map back to observation structure
4. Handle conflicts

This is complex and not recommended for most use cases.

## Costs

Google Docs API:
- Free for most use cases
- No per-request charges
- Subject to quotas (300/min)

## Next Steps

- [Learn how to add new fields](./ADDING_FIELDS.md)
- [Share with your team](./TEAM_USER_GUIDE.md)
