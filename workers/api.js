/**
 * Cloudflare Workers API for Cluster Catalogue
 *
 * Endpoints:
 * - POST /api/auth - Authentication
 * - GET /api/datasets - List datasets
 * - GET /api/datasets/{model} - Get dataset
 * - GET /api/config/{type} - Get config
 * - GET /api/observations/{model} - Get all observations for model
 * - GET /api/observations/{model}/{cluster_id} - Get single observation
 * - PUT /api/observations/{model}/{cluster_id} - Update observation
 * - POST /api/google-docs/trigger - Trigger Google Docs sync
 * - GET /api/export/text - Export all observations as text
 * - GET /api/export/text/{model} - Export observations for a single model as text
 * - GET /api/export/json - Export all observations as simple JSON (model -> cluster -> observation)
 */

import { syncToGoogleDocs, getAllModelNames, loadAllObservations, buildDocumentContent } from './google-docs-sync';

// Router class for handling requests
class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({ method, pattern: new RegExp(pattern), handler });
  }

  get(pattern, handler) {
    this.add('GET', pattern, handler);
  }

  post(pattern, handler) {
    this.add('POST', pattern, handler);
  }

  put(pattern, handler) {
    this.add('PUT', pattern, handler);
  }

  async route(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = url.pathname.match(route.pattern);
      if (match) {
        const params = match.groups || {};
        return await route.handler(request, env, ctx, params);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
}

// Helper functions
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
      ...headers
    }
  });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function generateJWT(payload, secret, expiresIn = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const claimsB64 = btoa(JSON.stringify(claims));
  const data = `${headerB64}.${claimsB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${signatureB64}`;
}

async function verifyJWT(token, secret) {
  try {
    const [headerB64, claimsB64, signatureB64] = token.split('.');
    const data = `${headerB64}.${claimsB64}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(data)
    );

    if (!valid) return null;

    const claims = JSON.parse(atob(claimsB64));
    const now = Math.floor(Date.now() / 1000);

    if (claims.exp && claims.exp < now) {
      return null; // Expired
    }

    return claims;
  } catch (e) {
    return null;
  }
}

function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

async function requireAuth(request, env) {
  // Authentication disabled - allow all requests
  return null; // Auth successful
}

function generateETag(data) {
  return `"${hashCode(JSON.stringify(data))}"`;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// API Handlers

async function handleAuth(request, env, ctx, params) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { password } = await request.json();

    // Hash the provided password and compare with stored hash
    const providedHash = await hashPassword(password);

    if (providedHash !== env.PASSWORD_HASH) {
      return jsonResponse({ error: 'Invalid password' }, 401);
    }

    // Generate JWT token
    const token = await generateJWT(
      { authenticated: true },
      env.SESSION_SECRET,
      86400 // 24 hours
    );

    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    return jsonResponse({
      success: true,
      token,
      expires_at: expiresAt
    });
  } catch (e) {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
}

async function handleGetDatasets(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    // List all dataset files in R2
    const prefix = 'datasets/';
    const list = await env.BUCKET.list({ prefix });

    const datasets = [];
    for (const object of list.objects) {
      const name = object.key.replace(prefix, '').replace('.json', '');
      if (name) {
        datasets.push({
          name,
          display_name: formatModelName(name),
          size_bytes: object.size,
          last_modified: object.uploaded.toISOString()
        });
      }
    }

    return jsonResponse({ datasets });
  } catch (e) {
    return jsonResponse({ error: 'Failed to list datasets' }, 500);
  }
}

async function handleGetDataset(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const { model } = params;
  const key = `datasets/${model}.json`;

  try {
    const object = await env.BUCKET.get(key);
    if (!object) {
      return jsonResponse({ error: 'Dataset not found' }, 404);
    }

    const data = await object.json();
    const etag = generateETag(data);

    return jsonResponse(data, 200, {
      'ETag': etag,
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (e) {
    return jsonResponse({ error: 'Failed to fetch dataset' }, 500);
  }
}

async function handleGetConfig(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const { type } = params;
  const key = `config/${type}.json`;

  try {
    const object = await env.BUCKET.get(key);
    if (!object) {
      return jsonResponse({ error: 'Config not found' }, 404);
    }

    const data = await object.json();
    const etag = generateETag(data);

    return jsonResponse(data, 200, {
      'ETag': etag,
      'Cache-Control': 'public, max-age=300'
    });
  } catch (e) {
    return jsonResponse({ error: 'Failed to fetch config' }, 500);
  }
}

async function handleGetAllObservations(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const { model } = params;
  const prefix = `observations/${model}/`;

  try {
    const list = await env.BUCKET.list({ prefix });
    const observations = {};

    // Fetch all observation files in parallel
    const fetchPromises = list.objects.map(object =>
      env.BUCKET.get(object.key)
        .then(clusterFile => clusterFile ? clusterFile.json() : null)
        .catch(err => {
          console.error(`Failed to fetch ${object.key}:`, err.message);
          return null;
        })
    );

    const results = await Promise.all(fetchPromises);

    // Build observations object
    for (const data of results) {
      if (data && data.cluster_id) {
        observations[data.cluster_id] = data;
      }
    }

    return jsonResponse({
      model,
      observations
    });
  } catch (e) {
    console.error('handleGetAllObservations error:', e.message, e.stack);
    return jsonResponse({ error: 'Failed to fetch observations', details: e.message }, 500);
  }
}

async function handleGetObservation(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const { model, cluster_id } = params;
  const key = `observations/${model}/cluster-${cluster_id}.json`;

  try {
    const object = await env.BUCKET.get(key);
    if (!object) {
      // Return empty observation if not found
      return jsonResponse({
        cluster_id,
        model,
        name: cluster_id,
        observations: '',
        good: false,
        metadata: {
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          version: 0
        }
      });
    }

    const data = await object.json();
    const etag = generateETag(data);

    return jsonResponse(data, 200, {
      'ETag': etag
    });
  } catch (e) {
    console.error('handleGetObservation error:', e.message, e.stack);
    return jsonResponse({ error: 'Failed to fetch observation', details: e.message }, 500);
  }
}

async function handlePutObservation(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const { model, cluster_id } = params;
  const key = `observations/${model}/cluster-${cluster_id}.json`;

  try {
    const body = await request.json();
    const { name, observations, good, humanVerified } = body;

    // Check If-Match header for optimistic locking
    const ifMatch = request.headers.get('If-Match');

    // Get current version
    const existingObject = await env.BUCKET.get(key);
    let currentData = null;
    let currentVersion = 0;

    if (existingObject) {
      currentData = await existingObject.json();
      currentVersion = currentData.metadata?.version || 0;

      // If If-Match header provided, verify ETag
      if (ifMatch) {
        const currentETag = generateETag(currentData);
        if (ifMatch !== currentETag) {
          return jsonResponse({
            success: false,
            error: 'Conflict: observation was modified by another user',
            current_data: currentData
          }, 409);
        }
      }
    }

    // Create updated observation
    const now = new Date().toISOString();

    // Determine default humanVerified based on model name
    const defaultHumanVerified = model.includes('NOPC1');

    const newData = {
      cluster_id,
      model,
      name: name || cluster_id,
      observations: observations || '',
      good: good !== undefined ? good : false,
      humanVerified: humanVerified !== undefined ? humanVerified : defaultHumanVerified,
      metadata: {
        created: currentData?.metadata?.created || now,
        last_modified: now,
        modified_by: 'user', // Could be enhanced with user sessions
        version: currentVersion + 1
      }
    };

    // Save to R2
    await env.BUCKET.put(key, JSON.stringify(newData), {
      httpMetadata: {
        contentType: 'application/json'
      }
    });

    const newETag = generateETag(newData);

    // Google Docs sync removed from automatic save flow
    // Use the manual sync endpoint (POST /api/google-docs/trigger) to update the doc

    return jsonResponse({
      success: true,
      cluster_id,
      metadata: newData.metadata
    }, 200, {
      'ETag': newETag
    });
  } catch (e) {
    console.error('handlePutObservation error:', e.message, e.stack);
    return jsonResponse({ error: 'Failed to update observation', details: e.message, stack: e.stack }, 500);
  }
}

async function handleGoogleDocsTrigger(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  if (!env.GOOGLE_DOC_ID) {
    return jsonResponse({ error: 'Google Docs integration not configured' }, 501);
  }

  try {
    // Sync all models (ignore model parameter if provided)
    await syncToGoogleDocs(env);

    return jsonResponse({
      success: true,
      message: 'Google Docs sync triggered for all models'
    });
  } catch (e) {
    return jsonResponse({ error: 'Failed to trigger sync', details: e.message }, 500);
  }
}

async function handleExportTextAll(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    // Load observations for all models
    const models = await getAllModelNames(env);
    const allObservations = await loadAllObservations(env, models);

    // Use GitHub Pages URL for the frontend
    const baseUrl = env.APP_BASE_URL || 'https://andrewgordon17.github.io/cluster_catalogue/';

    // Build text content with hyperlinks
    const textContent = buildDocumentContent(allObservations, baseUrl);

    // Return as plain text
    return new Response(textContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'attachment; filename="cluster-catalogue-all.txt"'
      }
    });
  } catch (e) {
    console.error('handleExportTextAll error:', e.message, e.stack);
    return jsonResponse({ error: 'Failed to export text', details: e.message }, 500);
  }
}

async function handleExportTextModel(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const { model } = params;

  try {
    // Load observations for single model
    const allObservations = await loadAllObservations(env, [model]);

    // Check if model has any observations
    if (!allObservations[model] || Object.keys(allObservations[model]).length === 0) {
      return new Response(`No observations found for model: ${model}`, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Use GitHub Pages URL for the frontend
    const baseUrl = env.APP_BASE_URL || 'https://andrewgordon17.github.io/cluster_catalogue/';

    // Build text content with hyperlinks
    const textContent = buildDocumentContent(allObservations, baseUrl);

    // Return as plain text
    return new Response(textContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename="cluster-catalogue-${model}.txt"`
      }
    });
  } catch (e) {
    console.error('handleExportTextModel error:', e.message, e.stack);
    return jsonResponse({ error: 'Failed to export text', details: e.message }, 500);
  }
}

async function handleExportJson(request, env, ctx, params) {
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    // Load observations for all models
    const models = await getAllModelNames(env);
    const allObservations = await loadAllObservations(env, models);

    // Transform to simple format: { model: { cluster_id: observation_text } }
    const result = {};

    for (const model of Object.keys(allObservations).sort()) {
      result[model] = {};

      for (const clusterId of Object.keys(allObservations[model]).sort((a, b) => parseInt(a) - parseInt(b))) {
        const obs = allObservations[model][clusterId];
        result[model][clusterId] = obs.observations || '';
      }
    }

    return jsonResponse(result, 200, {
      'Content-Disposition': 'attachment; filename="cluster-observations.json"'
    });
  } catch (e) {
    console.error('handleExportJson error:', e.message, e.stack);
    return jsonResponse({ error: 'Failed to export JSON', details: e.message }, 500);
  }
}

function formatModelName(model) {
  const parts = model.split('-');
  if (parts.length === 2) {
    const [name, size] = parts;
    return `${name.charAt(0).toUpperCase() + name.slice(1)} ${size.toUpperCase()}`;
  }
  return model;
}

// Main worker handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-Match',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const router = new Router();

    // Auth endpoint
    router.post('^/api/auth$', handleAuth);

    // Dataset endpoints
    router.get('^/api/datasets$', handleGetDatasets);
    router.get('^/api/datasets/(?<model>[^/]+)$', handleGetDataset);

    // Config endpoints
    router.get('^/api/config/(?<type>[^/]+)$', handleGetConfig);

    // Observation endpoints
    router.get('^/api/observations/(?<model>[^/]+)$', handleGetAllObservations);
    router.get('^/api/observations/(?<model>[^/]+)/(?<cluster_id>[^/]+)$', handleGetObservation);
    router.put('^/api/observations/(?<model>[^/]+)/(?<cluster_id>[^/]+)$', handlePutObservation);

    // Google Docs endpoints
    router.post('^/api/google-docs/trigger$', handleGoogleDocsTrigger);

    // Text export endpoints
    router.get('^/api/export/text/(?<model>[^/]+)$', handleExportTextModel);
    router.get('^/api/export/text$', handleExportTextAll);

    // JSON export endpoint
    router.get('^/api/export/json$', handleExportJson);

    try {
      return await router.route(request, env, ctx);
    } catch (e) {
      return jsonResponse({ error: 'Internal server error', details: e.message }, 500);
    }
  }
};
