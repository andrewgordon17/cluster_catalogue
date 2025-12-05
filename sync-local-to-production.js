#!/usr/bin/env node
/**
 * Sync local observations to production
 *
 * Usage: node sync-local-to-production.js [model-name]
 *
 * This script:
 * 1. Reads observations from local R2 (wrangler dev storage)
 * 2. Uploads them to production API
 * 3. Auto-merge handles conflicts automatically
 */

const fs = require('fs');
const path = require('path');

const PRODUCTION_API = 'https://cluster-catalogue-api.rainbowserpent.workers.dev/api';
const LOCAL_R2_PATH = '.wrangler/state/v3/r2/cluster-catalogue/observations';

async function syncLocalToProduction(modelFilter = null) {
  console.log('🔄 Syncing local observations to production...\n');

  // Check if local R2 directory exists
  if (!fs.existsSync(LOCAL_R2_PATH)) {
    console.error(`❌ Local R2 directory not found: ${LOCAL_R2_PATH}`);
    console.error('Make sure you ran "wrangler dev" and made some observations first.');
    return;
  }

  // Find all model directories
  const modelDirs = fs.readdirSync(LOCAL_R2_PATH, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  // Filter by model if specified
  const modelsToSync = modelFilter
    ? modelDirs.filter(m => m === modelFilter)
    : modelDirs;

  if (modelsToSync.length === 0) {
    console.error(`❌ No models found to sync${modelFilter ? ` (looking for: ${modelFilter})` : ''}`);
    return;
  }

  console.log(`Found models: ${modelsToSync.join(', ')}\n`);

  let totalUploaded = 0;
  let totalErrors = 0;

  // Sync each model
  for (const model of modelsToSync) {
    console.log(`📦 Syncing ${model}...`);
    const modelPath = path.join(LOCAL_R2_PATH, model);

    // Find all cluster files
    const clusterFiles = fs.readdirSync(modelPath)
      .filter(f => f.startsWith('cluster-') && f.endsWith('.json'));

    console.log(`   Found ${clusterFiles.length} clusters`);

    // Upload each cluster
    for (const file of clusterFiles) {
      const clusterId = file.replace('cluster-', '').replace('.json', '');
      const filePath = path.join(modelPath, file);

      try {
        const observation = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Upload to production
        const response = await fetch(
          `${PRODUCTION_API}/observations/${model}/${clusterId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: observation.name,
              observations: observation.observations,
              good: observation.good
            })
          }
        );

        if (response.ok) {
          console.log(`   ✓ Cluster ${clusterId}`);
          totalUploaded++;
        } else {
          const error = await response.text();
          console.error(`   ✗ Cluster ${clusterId}: ${error}`);
          totalErrors++;
        }
      } catch (error) {
        console.error(`   ✗ Cluster ${clusterId}: ${error.message}`);
        totalErrors++;
      }
    }

    console.log('');
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   Uploaded: ${totalUploaded}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`\nAny conflicts were auto-merged (observations appended, good=OR)`);
}

// Run if called directly
if (require.main === module) {
  const modelFilter = process.argv[2];
  syncLocalToProduction(modelFilter).catch(console.error);
}

module.exports = { syncLocalToProduction };
