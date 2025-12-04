#!/bin/bash

# Upload migrated data to Cloudflare R2
# Prerequisites:
# 1. Install wrangler: npm install -g wrangler
# 2. Authenticate: wrangler login
# 3. Create R2 bucket: wrangler r2 bucket create cluster-catalogue

set -e

BUCKET_NAME="cluster-catalogue"

echo "===================================================="
echo "Uploading data to Cloudflare R2"
echo "===================================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler CLI not found"
    echo "Please install: npm install -g wrangler"
    exit 1
fi

echo "Step 1: Uploading datasets (read-only cluster data)"
echo "----------------------------------------------------"

if [ -d "datasets" ]; then
    dataset_count=0
    for dataset in datasets/*.json; do
        if [ -f "$dataset" ]; then
            filename=$(basename "$dataset")
            echo "  Uploading $filename..."
            wrangler r2 object put "${BUCKET_NAME}/datasets/${filename}" \
                --file "$dataset" \
                --content-type "application/json" \
                --remote
            dataset_count=$((dataset_count + 1))
        fi
    done
    echo "✓ Uploaded $dataset_count dataset files"
else
    echo "Warning: datasets/ directory not found"
fi

echo ""
echo "Step 2: Uploading observations (per-cluster files)"
echo "----------------------------------------------------"

if [ -d "migrated/observations" ]; then
    cluster_count=0
    for model_dir in migrated/observations/*; do
        if [ -d "$model_dir" ]; then
            model=$(basename "$model_dir")
            echo "  Uploading observations for $model..."

            for cluster_file in "$model_dir"/*.json; do
                if [ -f "$cluster_file" ]; then
                    filename=$(basename "$cluster_file")
                    wrangler r2 object put "${BUCKET_NAME}/observations/${model}/${filename}" \
                        --file "$cluster_file" \
                        --content-type "application/json" \
                        --remote
                    cluster_count=$((cluster_count + 1))
                fi
            done
        fi
    done
    echo "✓ Uploaded $cluster_count observation files"
else
    echo "Error: migrated/observations/ directory not found"
    echo "Please run migrate.py first"
    exit 1
fi

echo ""
echo "Step 3: Uploading config files"
echo "----------------------------------------------------"

if [ -d "config" ]; then
    config_count=0
    for config_file in config/*.json; do
        if [ -f "$config_file" ]; then
            filename=$(basename "$config_file")
            echo "  Uploading $filename..."
            wrangler r2 object put "${BUCKET_NAME}/config/${filename}" \
                --file "$config_file" \
                --content-type "application/json" \
                --remote
            config_count=$((config_count + 1))
        fi
    done
    echo "✓ Uploaded $config_count config files"
else
    echo "Error: config/ directory not found"
    echo "Please run migrate.py first"
    exit 1
fi

echo ""
echo "===================================================="
echo "Upload Complete!"
echo "===================================================="
echo ""
echo "Summary:"
echo "  - Datasets: $dataset_count files"
echo "  - Observations: $cluster_count files"
echo "  - Config: $config_count files"
echo ""
echo "Next steps:"
echo "  1. Deploy Cloudflare Workers: wrangler deploy"
echo "  2. Set up secrets (see docs/WORKERS_SETUP.md)"
echo "  3. Update frontend API endpoint"
echo "  4. Test the application"
echo ""
