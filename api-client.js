/**
 * API Client for Cluster Catalogue
 * Handles all communication with the Cloudflare Workers backend
 */

class ConflictError extends Error {
  constructor(conflictData) {
    super('Conflict detected');
    this.name = 'ConflictError';
    this.conflictData = conflictData;
  }
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

class APIClient {
  constructor(baseUrl) {
    // Default to same origin + /api, or use provided URL
    this.baseUrl = baseUrl || (window.location.origin + '/api');
    this.token = localStorage.getItem('auth_token');
    this.etags = {}; // Store ETags for optimistic locking
  }

  /**
   * Authenticate with password and get JWT token
   */
  async authenticate(password) {
    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      throw new AuthError('Invalid password');
    }

    const data = await response.json();
    this.token = data.token;
    localStorage.setItem('auth_token', this.token);
    localStorage.setItem('auth_expires', data.expires_at);

    return data;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    if (!this.token) return false;

    const expiresAt = localStorage.getItem('auth_expires');
    if (!expiresAt) return false;

    const now = new Date();
    const expires = new Date(expiresAt);

    return now < expires;
  }

  /**
   * Clear authentication
   */
  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_expires');
  }

  /**
   * Get list of available datasets
   */
  async getDatasets() {
    const response = await this.fetch('/datasets');
    return response.json();
  }

  /**
   * Get full dataset for a model
   */
  async getDataset(model) {
    const response = await this.fetch(`/datasets/${model}`);
    const etag = response.headers.get('ETag');
    if (etag) {
      this.etags[`dataset:${model}`] = etag;
    }
    return response.json();
  }

  /**
   * Get configuration file (display-fields or models)
   */
  async getConfig(type) {
    const response = await this.fetch(`/config/${type}`);
    const etag = response.headers.get('ETag');
    if (etag) {
      this.etags[`config:${type}`] = etag;
    }
    return response.json();
  }

  /**
   * Get all observations for a model
   */
  async getObservations(model) {
    const response = await this.fetch(`/observations/${model}`);
    return response.json();
  }

  /**
   * Get single cluster observation
   */
  async getObservation(model, clusterId) {
    const response = await this.fetch(`/observations/${model}/${clusterId}`);
    const etag = response.headers.get('ETag');
    if (etag) {
      this.etags[`obs:${model}:${clusterId}`] = etag;
    }
    return response.json();
  }

  /**
   * Save cluster observation with optimistic locking
   * @throws {ConflictError} if conflict detected (409)
   */
  async saveObservation(model, clusterId, data) {
    const headers = { 'Content-Type': 'application/json' };

    // Include ETag for optimistic locking if we have one
    const etagKey = `obs:${model}:${clusterId}`;
    if (this.etags[etagKey]) {
      headers['If-Match'] = this.etags[etagKey];
    }

    const response = await this.fetch(`/observations/${model}/${clusterId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });

    if (response.status === 409) {
      // Conflict detected
      const conflict = await response.json();
      throw new ConflictError(conflict);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save observation');
    }

    // Update ETag
    const newEtag = response.headers.get('ETag');
    if (newEtag) {
      this.etags[etagKey] = newEtag;
    }

    return response.json();
  }

  /**
   * Trigger Google Docs sync
   */
  async triggerGoogleDocsSync(model = null) {
    const response = await this.fetch('/google-docs/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    });

    return response.json();
  }

  /**
   * Internal fetch wrapper with authentication and error handling
   */
  async fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`;

    const headers = {
      ...options.headers
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Handle auth errors
    if (response.status === 401) {
      this.logout();
      throw new AuthError('Session expired - please log in again');
    }

    return response;
  }

  /**
   * Helper: Save observation with automatic conflict resolution
   * Calls onConflict callback if conflict detected
   */
  async saveObservationWithConflictHandling(model, clusterId, data, onConflict) {
    try {
      return await this.saveObservation(model, clusterId, data);
    } catch (error) {
      if (error instanceof ConflictError) {
        // Let the conflict resolver handle it
        if (onConflict) {
          return await onConflict(error.conflictData, data);
        }
        throw error;
      }
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIClient, ConflictError, AuthError };
}
