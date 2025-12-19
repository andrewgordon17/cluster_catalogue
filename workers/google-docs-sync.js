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

  // Sign JWT with service account private key
  const jwt = await signJWT(header, claims, serviceAccount.private_key);

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Sign JWT using RS256 with service account private key
 */
async function signJWT(header, payload, privateKeyPem) {
  // Base64url encode header and payload
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKey = await importPrivateKey(privateKeyPem);

  // Sign the token
  const encoder = new TextEncoder();
  const data = encoder.encode(unsignedToken);
  const signature = await crypto.subtle.sign(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    privateKey,
    data
  );

  // Base64url encode signature
  const encodedSignature = base64urlEncode(signature);

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Import RSA private key from PEM format
 */
async function importPrivateKey(pem) {
  // Remove PEM header/footer and decode base64
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64Decode(pemContents);

  // Import the key
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

/**
 * Base64url encode (different from regular base64)
 */
function base64urlEncode(data) {
  let base64;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else if (data instanceof ArrayBuffer) {
    base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  } else {
    throw new Error('Unsupported data type for base64url encoding');
  }

  // Convert base64 to base64url
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64 decode to ArrayBuffer
 */
function base64Decode(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Get all model names from R2
 */
export async function getAllModelNames(env) {
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
export async function loadAllObservations(env, models) {
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
 * @param {Object} allObservations - Observations organized by model and cluster
 * @param {string|null} baseUrl - Base URL for hyperlinks (e.g., 'https://cluster-catalogue.example.com')
 */
export function buildDocumentContent(allObservations, baseUrl = null) {
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

      // Build cluster header with optional hyperlink
      if (baseUrl) {
        const clusterUrl = `${baseUrl}#model=${encodeURIComponent(model)}&cluster=${encodeURIComponent(clusterId)}`;
        // Format as markdown hyperlink for Google Docs
        lines.push(`Cluster ${clusterId}: ${obs.name}${goodBadge} [link](${clusterUrl})`);
      } else {
        lines.push(`Cluster ${clusterId}: ${obs.name}${goodBadge}`);
      }

      lines.push(`Observations: ${obs.observations}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Update the Google Doc with new content
 */
async function updateGoogleDoc(docId, content, accessToken) {
  // Use a two-step approach to avoid race conditions:
  // 1. Insert new content at the beginning
  // 2. Then delete the old content that comes after

  const updateEndpoint = `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`;

  // Step 1: Insert new content at index 1
  const insertResponse = await fetch(updateEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [{
        insertText: {
          location: { index: 1 },
          text: content
        }
      }]
    })
  });

  if (!insertResponse.ok) {
    const error = await insertResponse.text();
    throw new Error(`Failed to insert content: ${error}`);
  }

  // Step 2: Get the current document to find where old content starts
  const getEndpoint = `https://docs.googleapis.com/v1/documents/${docId}`;
  const getResponse = await fetch(getEndpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!getResponse.ok) {
    const error = await getResponse.text();
    throw new Error(`Failed to get Google Doc: ${error}`);
  }

  const doc = await getResponse.json();
  const totalLength = doc.body.content[doc.body.content.length - 1].endIndex - 1;
  const newContentLength = content.length;

  // Step 3: Delete old content (everything after the new content)
  // Only delete if there's old content to remove
  if (totalLength > newContentLength + 1) {
    const deleteResponse = await fetch(updateEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          deleteContentRange: {
            range: {
              startIndex: newContentLength + 1,
              endIndex: totalLength
            }
          }
        }]
      })
    });

    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      throw new Error(`Failed to delete old content: ${error}`);
    }

    return await deleteResponse.json();
  }

  return await insertResponse.json();
}

/**
 * Manual trigger for Google Docs sync
 * Can be called from a Cloudflare Cron Trigger or manually
 */
export async function scheduledSync(event, env, ctx) {
  ctx.waitUntil(syncToGoogleDocs(env));
}
