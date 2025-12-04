/**
 * Google Docs Sync Module
 *
 * Generates and updates a Google Doc with all clusters that have non-empty observations.
 * Organized by model with [GOOD] badges for marked clusters.
 */

/**
 * Sync observations to Google Docs
 * @param {Object} env - Cloudflare Workers environment with secrets
 * @param {string|null} model - Specific model to sync, or null for all models
 */
export async function syncToGoogleDocs(env, model = null) {
  if (!env.GOOGLE_DOC_ID || !env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('Google Docs not configured');
    return;
  }

  try {
    // Get access token
    const accessToken = await getAccessToken(env.GOOGLE_SERVICE_ACCOUNT_KEY);

    // Load observations from R2
    const modelsToSync = model ? [model] : await getAllModelNames(env);
    const allObservations = await loadAllObservations(env, modelsToSync);

    // Build document content
    const docContent = buildDocumentContent(allObservations);

    // Update Google Doc
    await updateGoogleDoc(env.GOOGLE_DOC_ID, docContent, accessToken);

    console.log(`Successfully synced ${modelsToSync.length} models to Google Docs`);
  } catch (error) {
    console.error('Failed to sync to Google Docs:', error);
    throw error;
  }
}

/**
 * Get OAuth2 access token for service account
 */
async function getAccessToken(serviceAccountKey) {
  const serviceAccount = JSON.parse(serviceAccountKey);

  // Create JWT for Google OAuth2
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/documents',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Note: This is a simplified version. In production, you'd need to:
  // 1. Import the private key properly
  // 2. Use crypto.subtle to sign the JWT with RS256
  // 3. Exchange JWT for access token
  //
  // For now, this is a placeholder that shows the structure.
  // The actual implementation would require the full OAuth2 flow.

  // In a real implementation, you would:
  // const jwt = await signJWT(header, claims, serviceAccount.private_key);
  // const response = await fetch('https://oauth2.googleapis.com/token', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  // });
  // const data = await response.json();
  // return data.access_token;

  // For simplicity in this example, we'll note this needs implementation
  throw new Error('Google OAuth2 implementation needed - see comments in code');
}

/**
 * Get all model names from R2
 */
async function getAllModelNames(env) {
  const prefix = 'observations/';
  const list = await env.BUCKET.list({ prefix, delimiter: '/' });

  const models = [];
  for (const prefix of list.delimitedPrefixes) {
    const model = prefix.replace('observations/', '').replace('/', '');
    if (model) models.push(model);
  }

  return models.sort();
}

/**
 * Load all observations for specified models
 */
async function loadAllObservations(env, models) {
  const allObservations = {};

  for (const model of models) {
    const prefix = `observations/${model}/`;
    const list = await env.BUCKET.list({ prefix });

    const observations = {};
    for (const object of list.objects) {
      const clusterFile = await env.BUCKET.get(object.key);
      if (clusterFile) {
        const data = await clusterFile.json();
        // Only include clusters with non-empty observations
        if (data.observations && data.observations.trim().length > 0) {
          observations[data.cluster_id] = data;
        }
      }
    }

    if (Object.keys(observations).length > 0) {
      allObservations[model] = observations;
    }
  }

  return allObservations;
}

/**
 * Build the document content as plain text
 */
function buildDocumentContent(allObservations) {
  const lines = [];

  // Header
  lines.push('Cluster Catalogue');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Auto-updated when observations change');
  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('');

  // For each model
  const sortedModels = Object.keys(allObservations).sort();

  for (const model of sortedModels) {
    const observations = allObservations[model];

    // Model header
    lines.push('');
    lines.push(model.toUpperCase());
    lines.push('─'.repeat(60));
    lines.push('');

    // Sort clusters by ID (numeric)
    const sortedClusterIds = Object.keys(observations).sort((a, b) => {
      return parseInt(a) - parseInt(b);
    });

    // For each cluster
    for (const clusterId of sortedClusterIds) {
      const obs = observations[clusterId];
      const goodBadge = obs.good ? ' [GOOD]' : '';

      lines.push(`Cluster ${clusterId}: ${obs.name}${goodBadge}`);
      lines.push(`Observations: ${obs.observations}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Update the Google Doc with new content
 *
 * Note: This is a simplified version showing the API structure.
 * In production, you would use the Google Docs API to:
 * 1. Clear the document
 * 2. Insert the new content with proper formatting
 */
async function updateGoogleDoc(docId, content, accessToken) {
  const endpoint = `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`;

  // Google Docs API request to replace all content
  const requests = [
    {
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: 1000000 // Large number to delete all content
        }
      }
    },
    {
      insertText: {
        location: { index: 1 },
        text: content
      }
    }
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update Google Doc: ${error}`);
  }

  return await response.json();
}

/**
 * Manual trigger for Google Docs sync
 * Can be called from a Cloudflare Cron Trigger or manually
 */
export async function scheduledSync(event, env, ctx) {
  ctx.waitUntil(syncToGoogleDocs(env));
}
