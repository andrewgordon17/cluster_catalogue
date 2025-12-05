/**
 * Conflict Resolver - Handle concurrent edit conflicts
 * Shows UI for resolving conflicts when 409 response received
 */

class ConflictResolver {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.currentConflict = null;
    this.resolveCallback = null;
    this.autoMerge = true; // Auto-merge conflicts by default (for offline work)
  }

  /**
   * Show conflict resolution modal
   * @returns {Promise} Resolves with the resolution strategy chosen
   */
  showConflictModal(localData, remoteData) {
    return new Promise((resolve) => {
      this.currentConflict = { localData, remoteData };
      this.resolveCallback = resolve;

      // Populate modal content
      document.getElementById('conflict-your-version').textContent =
        this.formatObservationSummary(localData);
      document.getElementById('conflict-current-version').textContent =
        this.formatObservationSummary(remoteData);

      // Show modal
      document.getElementById('conflict-modal').style.display = 'flex';
    });
  }

  /**
   * Hide conflict resolution modal
   */
  hideConflictModal() {
    document.getElementById('conflict-modal').style.display = 'none';
    this.currentConflict = null;
    this.resolveCallback = null;
  }

  /**
   * Handle conflict resolution choice
   */
  async resolveConflict(strategy) {
    if (!this.currentConflict || !this.resolveCallback) {
      console.error('No active conflict to resolve');
      return;
    }

    const { localData, remoteData } = this.currentConflict;
    let resolvedData;

    switch (strategy) {
      case 'keep-mine':
        resolvedData = localData;
        break;

      case 'use-theirs':
        resolvedData = remoteData;
        // Update UI with their version
        if (window.clusterCatalogue) {
          document.getElementById('cluster-name').value = remoteData.name || '';
          document.getElementById('observations').value = remoteData.observations || '';
          document.getElementById('good-toggle').checked = remoteData.good || false;
        }
        break;

      case 'merge':
        resolvedData = this.mergeObservations(localData, remoteData);
        break;

      default:
        console.error('Unknown resolution strategy:', strategy);
        this.hideConflictModal();
        this.resolveCallback(null);
        return;
    }

    this.hideConflictModal();
    this.resolveCallback(resolvedData);
  }

  /**
   * Merge two observations (simple text append strategy)
   */
  mergeObservations(local, remote) {
    return {
      name: local.name || remote.name,
      observations: this.mergeText(local.observations, remote.observations),
      good: local.good || remote.good // If either marked as good, keep it
    };
  }

  /**
   * Merge two text fields (append with separator)
   */
  mergeText(localText, remoteText) {
    if (!localText) return remoteText;
    if (!remoteText) return localText;
    if (localText === remoteText) return localText;

    return `${remoteText}\n\n--- Merged with concurrent edit ---\n${localText}`;
  }

  /**
   * Format observation for display in conflict modal
   */
  formatObservationSummary(data) {
    const parts = [];

    if (data.name) {
      parts.push(`Name: ${data.name}`);
    }

    if (data.observations) {
      const preview = data.observations.length > 200
        ? data.observations.substring(0, 200) + '...'
        : data.observations;
      parts.push(`Observations: ${preview}`);
    } else {
      parts.push('Observations: (empty)');
    }

    parts.push(`Good: ${data.good ? 'Yes' : 'No'}`);

    if (data.metadata) {
      parts.push(`Last modified: ${data.metadata.last_modified || 'Unknown'}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Auto-save with conflict handling
   * Wraps the apiClient.saveObservation with automatic conflict resolution
   */
  async saveWithConflictHandling(model, clusterId, data) {
    try {
      return await this.apiClient.saveObservation(model, clusterId, data);
    } catch (error) {
      if (error.name === 'ConflictError') {
        const remoteData = error.conflictData.current_data;
        let resolvedData;

        if (this.autoMerge) {
          // Auto-merge conflicts without user interaction
          resolvedData = this.mergeObservations(data, remoteData);
          console.log('Auto-merged conflict:', { local: data, remote: remoteData, resolved: resolvedData });
        } else {
          // Show conflict modal and wait for user decision
          resolvedData = await this.showConflictModal(data, remoteData);

          if (!resolvedData) {
            // User cancelled
            throw new Error('Conflict resolution cancelled');
          }
        }

        // Retry save with resolved data (without ETag to force overwrite)
        const etagKey = `obs:${model}:${clusterId}`;
        delete this.apiClient.etags[etagKey];

        return await this.apiClient.saveObservation(model, clusterId, resolvedData);
      }

      // Re-throw other errors
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConflictResolver };
}
