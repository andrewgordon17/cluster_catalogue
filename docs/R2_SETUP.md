# Cloudflare R2 Setup Guide

This guide walks you through setting up Cloudflare R2 storage for the Cluster Catalogue.

## Prerequisites

- Cloudflare account (free tier works)
- Wrangler CLI installed: `npm install -g wrangler`

## Step 1: Create Cloudflare Account

1. Go to https://cloudflare.com
2. Sign up for a free account
3. Verify your email

## Step 2: Install Wrangler CLI

```bash
npm install -g wrangler

# Verify installation
wrangler --version
```

## Step 3: Authenticate Wrangler

```bash
wrangler login
```

This will open a browser window to authenticate. Click "Allow" to give Wrangler access to your account.

## Step 4: Create R2 Bucket

```bash
# Create production bucket
wrangler r2 bucket create cluster-catalogue

# Create development bucket (optional)
wrangler r2 bucket create cluster-catalogue-dev
```

Verify creation:
```bash
wrangler r2 bucket list
```

## Step 5: Configure CORS (Optional)

If you need to access R2 directly from the browser (not recommended for production), configure CORS:

```bash
wrangler r2 bucket cors put cluster-catalogue --config cors.json
```

`cors.json`:
```json
{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

**Note:** For production, access R2 through Cloudflare Workers (already configured in this project).

## Step 6: Upload Data

After running the migration script:

```bash
# Run migration first
python3 migrate.py

# Upload to R2
./upload-to-r2.sh
```

The upload script will:
- Upload all dataset files (datasets/*.json)
- Upload all observation files (migrated/observations/**/*.json)
- Upload config files (config/*.json)

## Step 7: Verify Upload

List files in bucket:
```bash
# List all files
wrangler r2 object list cluster-catalogue

# List specific directory
wrangler r2 object list cluster-catalogue --prefix "datasets/"
```

Check a specific file:
```bash
wrangler r2 object get cluster-catalogue/config/models.json
```

## Bucket Structure

Your R2 bucket should have this structure:

```
cluster-catalogue/
├── datasets/
│   ├── pythia-14m.json
│   ├── pythia-31m.json
│   └── ...
├── observations/
│   ├── pythia-14m/
│   │   ├── cluster-0.json
│   │   ├── cluster-1.json
│   │   └── ...
│   ├── pythia-31m/
│   │   └── ...
└── config/
    ├── display-fields.json
    └── models.json
```

## Costs

Cloudflare R2 Pricing (as of 2024):
- Storage: $0.015/GB per month
- Class A operations (writes): $4.50 per million
- Class B operations (reads): $0.36 per million
- No egress fees!

For this project (assuming ~100MB total, 1000 requests/day):
- Storage: $0.00 (under free tier)
- Operations: $0.00 (under free tier)

R2 includes 10GB storage and 1 million Class A operations free per month.

## Troubleshooting

### Error: "bucket already exists"
If the bucket name is taken, choose a different name and update `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-unique-bucket-name"
```

### Error: "unauthorized"
Re-authenticate:
```bash
wrangler logout
wrangler login
```

### Upload fails
Check your Wrangler version:
```bash
wrangler --version
# Should be 3.x or higher
```

## Next Steps

- [Deploy Cloudflare Workers](./WORKERS_SETUP.md)
- [Set up Google Docs integration](./GOOGLE_DOCS_SETUP.md)
