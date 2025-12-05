/**
 * Cluster Catalogue - Main Application
 * Refactored to use modular architecture with Cloudflare Workers backend
 */

class ClusterCatalogue {
    constructor() {
        // Core data
        this.clustersData = null;
        this.currentClusterId = null;
        this.clusterIds = [];
        this.currentIndex = 0;
        this.currentDataset = 'pythia-14m';
        this.observations = {};

        // Configuration
        this.modelConfig = null;
        this.displayFieldsConfig = null;

        // Modules (will be initialized after authentication)
        this.apiClient = null;
        this.fieldRenderer = null;
        this.conflictResolver = null;
        this.authManager = null;

        // Google Docs sync
        this.lastGoogleDocsSync = null;
    }

    async init() {
        try {
            // Initialize API client
            // For development, use localhost:8787 (wrangler dev port)
            // For production, use your deployed Workers URL
            const apiUrl = this.getAPIUrl();
            this.apiClient = new APIClient(apiUrl);

            // Initialize modules
            this.authManager = new AuthManager(this.apiClient);
            this.conflictResolver = new ConflictResolver(this.apiClient);

            // Ensure user is authenticated
            await this.authManager.ensureAuthenticated();

            // Load configurations
            await this.loadConfigs();

            // Initialize field renderer
            this.fieldRenderer = new FieldRenderer(this.displayFieldsConfig, this.modelConfig);

            // Load initial data
            await this.populateDatasetSelect();
            await this.loadClustersData();
            await this.loadObservations();

            // Initialize UI
            this.populateClusterSelect();
            await this.showCluster(this.clusterIds[0]);

            // Show main app
            document.getElementById('main-app').style.display = 'block';

            console.log('✓ Cluster Catalogue initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data: ' + error.message);
        }
    }

    /**
     * Get API URL based on environment
     */
    getAPIUrl() {
        // Check if we're in development (localhost)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Wrangler dev runs on port 8787
            return 'http://localhost:8787/api';
        }

        // Production: use deployed Workers URL
        return 'https://cluster-catalogue-api.rainbowserpent.workers.dev/api';
    }

    /**
     * Load model config and display fields config
     */
    async loadConfigs() {
        try {
            this.modelConfig = await this.apiClient.getConfig('models');
            this.displayFieldsConfig = await this.apiClient.getConfig('display-fields');
        } catch (error) {
            console.error('Failed to load configs:', error);
            // Fallback to local files if API not available yet
            try {
                const [modelResp, fieldsResp] = await Promise.all([
                    fetch('./config/models.json'),
                    fetch('./config/display-fields.json')
                ]);
                this.modelConfig = await modelResp.json();
                this.displayFieldsConfig = await fieldsResp.json();
            } catch (localError) {
                throw new Error('Failed to load configuration files');
            }
        }
    }

    /**
     * Populate dataset selector
     */
    async populateDatasetSelect() {
        const select = document.getElementById('dataset-select');

        try {
            const response = await this.apiClient.getDatasets();
            const datasets = response.datasets;

            select.innerHTML = datasets.map(ds =>
                `<option value="${ds.name}">${ds.display_name}</option>`
            ).join('');

            // Set current dataset
            if (datasets.length > 0) {
                this.currentDataset = datasets[0].name;
                select.value = this.currentDataset;
            }
        } catch (error) {
            console.error('Failed to load datasets:', error);
            // Fallback: use model config
            const models = Object.keys(this.modelConfig.models);
            select.innerHTML = models.map(model =>
                `<option value="${model}">${this.modelConfig.models[model].display_name}</option>`
            ).join('');
            this.currentDataset = models[0];
        }
    }

    /**
     * Load cluster data for current dataset
     */
    async loadClustersData(dataset = this.currentDataset) {
        try {
            this.clustersData = await this.apiClient.getDataset(dataset);

            // Remove metadata if present
            if (this.clustersData._metadata) {
                delete this.clustersData._metadata;
            }

            this.clusterIds = Object.keys(this.clustersData).sort((a, b) => parseInt(a) - parseInt(b));
            this.currentDataset = dataset;

            console.log(`✓ Loaded ${this.clusterIds.length} clusters for ${dataset}`);
        } catch (error) {
            throw new Error(`Failed to load clusters for ${dataset}: ${error.message}`);
        }
    }

    /**
     * Initialize observations cache (no longer loads all at once)
     */
    async loadObservations() {
        // Just initialize empty cache - observations will be loaded on-demand
        this.observations = {};
        console.log(`✓ Initialized observations cache for ${this.currentDataset}`);
    }

    /**
     * Load observation for a specific cluster (on-demand)
     */
    async loadObservationForCluster(clusterId) {
        // Check if already cached
        if (this.observations[clusterId]) {
            return this.observations[clusterId];
        }

        try {
            const observation = await this.apiClient.getObservation(this.currentDataset, clusterId);
            this.observations[clusterId] = observation;
            return observation;
        } catch (error) {
            console.error(`Failed to load observation for cluster ${clusterId}:`, error);
            // Return empty observation on error
            return {
                name: clusterId,
                observations: '',
                good: false
            };
        }
    }

    /**
     * Populate cluster selector dropdown
     */
    populateClusterSelect() {
        const select = document.getElementById('cluster-select');
        select.innerHTML = this.clusterIds.map(id =>
            `<option value="${id}">Cluster ${id}</option>`
        ).join('');

        if (this.clusterIds.length > 0) {
            this.currentIndex = 0;
            this.currentClusterId = this.clusterIds[0];
            select.value = this.currentClusterId;
        }

        this.updateNavigationButtons();
    }

    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
        document.getElementById('prev-btn').disabled = this.currentIndex === 0;
        document.getElementById('next-btn').disabled = this.currentIndex === this.clusterIds.length - 1;
    }

    /**
     * Show cluster data
     */
    async showCluster(clusterId) {
        this.currentClusterId = clusterId;
        this.currentIndex = this.clusterIds.indexOf(clusterId);

        const cluster = this.clustersData[clusterId];
        if (!cluster) {
            this.showError(`Cluster ${clusterId} not found`);
            return;
        }

        // Update cluster selector
        document.getElementById('cluster-select').value = clusterId;
        this.updateNavigationButtons();

        // Render all fields using field renderer
        this.fieldRenderer.renderAllFields(cluster, this.currentDataset);

        // Load observation on-demand before updating form fields
        await this.loadObservationForCluster(clusterId);

        // Update form fields (observations)
        this.updateFormFields();

        console.log(`✓ Showing cluster ${clusterId}`);
    }

    /**
     * Update form fields with saved observations
     */
    updateFormFields() {
        const saved = this.observations[this.currentClusterId] || {};

        document.getElementById('cluster-name').value = saved.name || this.currentClusterId;
        document.getElementById('observations').value = saved.observations || '';
        document.getElementById('good-toggle').checked = saved.good || false;
    }

    /**
     * Save current cluster data
     */
    async saveData() {
        const name = document.getElementById('cluster-name').value.trim();
        const observations = document.getElementById('observations').value.trim();
        const good = document.getElementById('good-toggle').checked;

        const data = { name, observations, good };

        // Update local cache
        this.observations[this.currentClusterId] = data;

        // Show saving status
        this.setSaveStatus('Saving...');

        try {
            // Save to API with conflict handling
            await this.conflictResolver.saveWithConflictHandling(
                this.currentDataset,
                this.currentClusterId,
                data
            );

            this.setSaveStatus('Saved ✓');
            setTimeout(() => this.setSaveStatus('Ready'), 2000);
        } catch (error) {
            console.error('Save error:', error);
            this.setSaveStatus('Error saving');

            if (error.name === 'AuthError') {
                // Session expired, re-authenticate
                await this.authManager.handleAuthError();
                // Retry save
                await this.saveData();
            } else {
                alert('Failed to save: ' + error.message);
            }
        }
    }

    /**
     * Set save status message
     */
    setSaveStatus(message) {
        document.getElementById('save-status').textContent = message;
    }

    /**
     * Navigate to previous/next cluster
     */
    async navigateCluster(direction) {
        const newIndex = this.currentIndex + direction;
        if (newIndex >= 0 && newIndex < this.clusterIds.length) {
            await this.showCluster(this.clusterIds[newIndex]);
        }
    }

    /**
     * Handle cluster selection from dropdown
     */
    async selectCluster() {
        const select = document.getElementById('cluster-select');
        await this.showCluster(select.value);
    }

    /**
     * Switch to different dataset
     */
    async switchDataset() {
        const select = document.getElementById('dataset-select');
        const newDataset = select.value;

        if (newDataset === this.currentDataset) return;

        try {
            // Destroy existing charts
            this.fieldRenderer.destroyCharts();

            // Load new dataset
            await this.loadClustersData(newDataset);
            await this.loadObservations();

            // Update UI
            this.populateClusterSelect();
            await this.showCluster(this.clusterIds[0]);

            console.log(`✓ Switched to ${newDataset}`);
        } catch (error) {
            console.error('Dataset switch error:', error);
            this.showError('Failed to switch dataset: ' + error.message);
            // Revert selection
            select.value = this.currentDataset;
        }
    }

    /**
     * Trigger Google Docs sync
     */
    async triggerGoogleDocsSync() {
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Syncing...';

        try {
            await this.apiClient.triggerGoogleDocsSync();
            this.lastGoogleDocsSync = new Date();
            this.updateGoogleDocsSyncStatus();

            setTimeout(() => {
                button.disabled = false;
                button.textContent = 'Sync Now';
            }, 2000);
        } catch (error) {
            console.error('Google Docs sync error:', error);
            alert('Failed to trigger sync: ' + error.message);
            button.disabled = false;
            button.textContent = 'Sync Now';
        }
    }

    /**
     * Update Google Docs sync status display
     */
    updateGoogleDocsSyncStatus() {
        const statusEl = document.getElementById('gdocs-last-sync');
        if (!statusEl) return;

        if (!this.lastGoogleDocsSync) {
            statusEl.textContent = 'Last synced: Never';
            return;
        }

        const now = new Date();
        const diff = Math.floor((now - this.lastGoogleDocsSync) / 1000 / 60); // minutes

        if (diff < 1) {
            statusEl.textContent = 'Last synced: Just now';
        } else if (diff < 60) {
            statusEl.textContent = `Last synced: ${diff} min ago`;
        } else {
            const hours = Math.floor(diff / 60);
            statusEl.textContent = `Last synced: ${hours}h ago`;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const mainApp = document.getElementById('main-app');
        mainApp.innerHTML = `
            <div class="error-message">
                <h2>Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()">Reload</button>
            </div>
        `;
        mainApp.style.display = 'block';
    }
}

// Global functions called from HTML
function navigateCluster(direction) {
    if (window.clusterCatalogue) {
        window.clusterCatalogue.navigateCluster(direction);
    }
}

function selectCluster() {
    if (window.clusterCatalogue) {
        window.clusterCatalogue.selectCluster();
    }
}

function switchDataset() {
    if (window.clusterCatalogue) {
        window.clusterCatalogue.switchDataset();
    }
}

function saveData() {
    if (window.clusterCatalogue) {
        window.clusterCatalogue.saveData();
    }
}

function triggerGoogleDocsSync() {
    if (window.clusterCatalogue) {
        window.clusterCatalogue.triggerGoogleDocsSync();
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
    window.clusterCatalogue = new ClusterCatalogue();
    await window.clusterCatalogue.init();

    // Make conflict resolver globally accessible for modal buttons
    window.conflictResolver = window.clusterCatalogue.conflictResolver;

    // Update Google Docs sync status every minute
    setInterval(() => {
        if (window.clusterCatalogue) {
            window.clusterCatalogue.updateGoogleDocsSyncStatus();
        }
    }, 60000);
});
