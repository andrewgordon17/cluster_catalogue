class ClusterCatalogue {
    constructor() {
        this.clustersData = null;
        this.currentClusterId = null;
        this.clusterIds = [];
        this.currentIndex = 0;
        this.chart = null;
        this.modelConfig = null;
        this.userPassword = null;
        this.currentDataset = 'pythia-14m'; // Default dataset

        // GitHub configuration
        this.githubConfig = {
            owner: 'andrewgordon17',  // Your GitHub username
            repo: 'cluster_catalogue',    // Repository name
            token: null,  // Will be set during password authentication
            branch: 'main',
            filePath: null  // Will be set dynamically based on current dataset
        };

        // Stored observations
        this.observations = {};
        this.isOnlineMode = false;

        this.init();
    }

    async init() {
        try {
            await this.loadModelConfig();
            await this.populateDatasetSelect(); // Do this first to set currentDataset
            await this.loadClustersData();
            await this.loadObservationsFromGitHub();
            this.setupChart();
            this.populateClusterSelect();
            this.showCluster(this.clusterIds[0]);
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data: ' + error.message);
        }
    }

    async loadModelConfig() {
        try {
            const response = await fetch('./model_cfg.json');
            if (!response.ok) throw new Error('Failed to load model config');
            this.modelConfig = await response.json();
        } catch (error) {
            console.warn('Could not load model config, using defaults');
            this.modelConfig = {
                'pythia-14m': { n_heads: 4, n_layers: 6 }
            };
        }
    }

    async getAvailableDatasets() {
        // Try to get a list of available datasets
        // Since we can't list directory contents via fetch, we'll try common dataset names
        const possibleDatasets = [
            'pythia-14m',
            'pythia-31m',
            'pythia-70m',
            'pythia-160m',
            'pythia-1b',
            'pythia-1.4b',
            'pythia-2.8b',
            'pythia-6.9b',
            'pythia-12b'
        ];

        const availableDatasets = [];

        for (const dataset of possibleDatasets) {
            try {
                const response = await fetch(`./datasets/${dataset}.json`, { method: 'HEAD' });
                if (response.ok) {
                    availableDatasets.push(dataset);
                }
            } catch (error) {
                // Dataset doesn't exist, skip it
            }
        }

        return availableDatasets;
    }

    async loadClustersData(dataset = this.currentDataset) {
        const filePath = `./datasets/${dataset}.json`;

        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load clusters data for ${dataset}. Make sure ${dataset}.json exists in the datasets/ folder.`);
        }

        this.clustersData = await response.json();
        this.clusterIds = Object.keys(this.clustersData).sort((a, b) => parseInt(a) - parseInt(b));
        this.currentDataset = dataset;
        console.log(`Loaded ${this.clusterIds.length} clusters from ${dataset}`);
    }

    populateClusterSelect() {
        const select = document.getElementById('cluster-select');
        select.innerHTML = '';

        this.clusterIds.forEach((id, index) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `Cluster ${id}`;
            select.appendChild(option);
        });
    }

    async populateDatasetSelect() {
        const select = document.getElementById('dataset-select');
        const availableDatasets = await this.getAvailableDatasets();

        if (availableDatasets.length === 0) {
            select.innerHTML = '<option>No datasets found</option>';
            return;
        }

        // If current dataset is not available, switch to first available
        if (!availableDatasets.includes(this.currentDataset)) {
            this.currentDataset = availableDatasets[0];
        }

        select.innerHTML = '';
        availableDatasets.forEach(dataset => {
            const option = document.createElement('option');
            option.value = dataset;
            // Convert 'pythia-14m' to 'Pythia 14M' for display
            option.textContent = dataset.replace(/pythia-(\d+(?:\.\d+)?)([bmk])?/i, (match, size, unit) => {
                const units = { 'b': 'B', 'm': 'M', 'k': 'K' };
                const displayUnit = unit ? units[unit.toLowerCase()] || unit.toUpperCase() : 'M';
                return `Pythia ${size}${displayUnit}`;
            });
            if (dataset === this.currentDataset) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        console.log(`Found ${availableDatasets.length} datasets:`, availableDatasets);
    }

    async switchDataset(dataset) {
        if (dataset === this.currentDataset) return;

        // Show loading state
        document.getElementById('save-status').textContent = 'Loading dataset...';

        try {
            console.log(`Switching to dataset: ${dataset}`);

            // First, save current observations if any changes exist
            if (Object.keys(this.observations).length > 0) {
                console.log(`Saving observations for ${this.currentDataset} before switching`);
                this.saveObservationsLocally(); // Always save locally as backup
                if (this.isOnlineMode && this.githubConfig.token) {
                    try {
                        await this.saveObservationsToGitHub();
                    } catch (error) {
                        console.warn('Failed to save to GitHub before switching:', error);
                    }
                }
            }

            // Switch to new dataset
            await this.loadClustersData(dataset);
            console.log(`Loaded ${this.clusterIds.length} clusters, setting up chart`);

            // Load observations for the new dataset
            await this.loadObservationsFromGitHub();

            // Destroy existing chart before creating new one
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }

            this.setupChart(); // Reinitialize chart for new model config
            console.log('Chart setup complete, populating selects');

            this.populateClusterSelect();
            this.showCluster(this.clusterIds[0]); // Show first cluster of new dataset
            document.getElementById('save-status').textContent = `Loaded ${dataset}`;

            setTimeout(() => {
                document.getElementById('save-status').textContent = 'Ready';
            }, 2000);
        } catch (error) {
            console.error('Failed to switch dataset:', error);
            console.error('Error details:', error);
            document.getElementById('save-status').textContent = `Dataset load failed: ${error.message}`;
            setTimeout(() => {
                document.getElementById('save-status').textContent = 'Ready';
            }, 5000);
        }
    }

    showCluster(clusterId) {
        this.currentClusterId = clusterId;
        this.currentIndex = this.clusterIds.indexOf(clusterId);

        // Update navigation
        document.getElementById('cluster-select').value = clusterId;
        document.getElementById('prev-btn').disabled = this.currentIndex === 0;
        document.getElementById('next-btn').disabled = this.currentIndex === this.clusterIds.length - 1;

        const cluster = this.clustersData[clusterId];

        // Update statistics
        this.updateStatistics(cluster);

        // Update context examples
        this.updateContexts(cluster);

        // Update form fields
        this.updateFormFields(clusterId, cluster);

        // Update chart
        this.updateChart(cluster);
    }

    updateStatistics(cluster) {
        document.getElementById('stat-size').textContent = cluster.Size.toLocaleString();
        document.getElementById('stat-tokens').textContent = cluster["Number of Unique Next Tokens"];

        // Most common next tokens
        const tokensContainer = document.getElementById('common-tokens');
        tokensContainer.innerHTML = '';
        cluster["Most Common Next Tokens"].slice(0, 10).forEach(([token, count]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span><code>${this.escapeHtml(this.formatToken(token))}</code></span>
                <span>${count}</span>
            `;
            tokensContainer.appendChild(item);
        });

        // Most common datasets
        const datasetsContainer = document.getElementById('common-datasets');
        datasetsContainer.innerHTML = '';
        cluster["Most Common Datasets"].slice(0, 10).forEach(([dataset, count]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span>${this.escapeHtml(dataset)}</span>
                <span>${count}</span>
            `;
            datasetsContainer.appendChild(item);
        });

        // Pattern counts
        const patternsContainer = document.getElementById('pattern-counts');
        patternsContainer.innerHTML = '';
        cluster["Pattern Counts"].forEach(([pattern, count]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span>${this.escapeHtml(pattern.replace('is_', ''))}</span>
                <span>${count}</span>
            `;
            patternsContainer.appendChild(item);
        });
    }

    updateContexts(cluster) {
        const container = document.getElementById('context-examples');
        container.innerHTML = '';

        if (!cluster["Context Pairs"] || cluster["Context Pairs"].length === 0) {
            container.innerHTML = '<div class="loading">No context pairs available</div>';
            return;
        }

        // Show first 20 context pairs
        cluster["Context Pairs"].slice(0, 20).forEach(pair => {
            const item = document.createElement('div');
            item.className = 'context-item';

            const contextText = this.escapeHtml(pair.context);
            const nextToken = this.escapeHtml(this.formatToken(pair.token));

            item.innerHTML = `${contextText}<span class="next-token">${nextToken}</span>`;
            container.appendChild(item);
        });
    }

    updateFormFields(clusterId, cluster) {
        const saved = this.observations[clusterId] || {};

        // Set cluster name (use saved name or default to cluster ID)
        document.getElementById('cluster-name').value = saved.name || clusterId;

        // Set observations
        document.getElementById('observations').value = saved.observations || '';
    }

    updateChart(cluster) {
        if (!this.chart) return;

        const means = cluster["Mean Susceptibilities"];
        const stds = cluster["Std Susceptibilities"];

        // Get model config for current dataset
        const config = this.modelConfig[this.currentDataset];
        if (!config) {
            console.warn(`No model config found for ${this.currentDataset}`);
            return;
        }

        // Debug logging
        console.log(`Updating chart for ${this.currentDataset}:`, {
            meanLength: means ? means.length : 'undefined',
            stdLength: stds ? stds.length : 'undefined',
            config: config,
            firstFewMeans: means ? means.slice(0, 5) : 'undefined'
        });

        // Generate labels based on plot_vector_means.py structure
        const labels = this.generateLabels(config.n_layers, config.n_heads);
        console.log(`Generated ${labels.length} labels for chart`);

        if (!means || means.length === 0) {
            console.error('No mean susceptibilities data found');
            return;
        }

        // Create error bars data
        const data = means.map((mean, i) => ({
            x: i,
            y: mean,
            error: stds && stds[i] ? stds[i] : 0
        }));

        console.log(`Created ${data.length} data points for chart`);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }

    generateLabels(nLayers, nHeads) {
        const labels = [];

        // Embedding
        labels.push('Embed');

        // Attention heads (grouped by layer)
        for (let layer = 0; layer < nLayers; layer++) {
            for (let head = 0; head < nHeads; head++) {
                labels.push(`A${layer}.${head}`);
            }
        }

        // MLP layers
        for (let layer = 0; layer < nLayers; layer++) {
            labels.push(`MLP${layer}`);
        }

        // Unembedding
        labels.push('Unembed');

        console.log(`Generated labels for ${nLayers} layers, ${nHeads} heads:`, {
            totalLabels: labels.length,
            expectedTotal: 1 + (nLayers * nHeads) + nLayers + 1,
            labels: labels
        });

        return labels;
    }

    generateColors(nLayers) {
        // Generate rainbow colors similar to plot_vector_means.py
        const colors = [];
        for (let i = 0; i < nLayers; i++) {
            const hue = (0.8 * i) / Math.max(nLayers - 1, 1);
            const rgb = this.hsvToRgb(hue, 0.65, 0.85);
            colors.push(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
        }
        return colors;
    }

    hsvToRgb(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    setupChart() {
        const ctx = document.getElementById('susceptibility-chart').getContext('2d');

        // Get model config for coloring
        const config = this.modelConfig[this.currentDataset] || { n_layers: 6, n_heads: 4 };
        const layerColors = this.generateColors(config.n_layers);
        const darkGray = 'rgb(85, 85, 85)';
        const lightGray = 'rgb(221, 221, 221)';

        // Build colors array matching the structure from plot_vector_means.py
        const colors = [];

        // Embedding
        colors.push(darkGray);

        // Attention heads (colored by layer)
        for (let i = 0; i < config.n_layers * config.n_heads; i++) {
            const layerIdx = Math.floor(i / config.n_heads);
            colors.push(layerColors[layerIdx % layerColors.length]);
        }

        // MLP layers
        for (let i = 0; i < config.n_layers; i++) {
            colors.push(layerColors[i % layerColors.length]);
        }

        // Unembedding
        colors.push(lightGray);

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Mean Susceptibility',
                    data: [],
                    backgroundColor: colors,
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    borderWidth: 0.5,
                    errorBars: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.8)',
                        width: 1
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            color: '#ccc',
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#ccc'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.3)'
                        }
                    }
                },
                elements: {
                    bar: {
                        backgroundColor: function(context) {
                            return colors[context.dataIndex] || '#666';
                        }
                    }
                }
            },
            plugins: [{
                // Custom plugin to draw error bars
                afterDatasetsDraw: function(chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach(function(dataset, i) {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach(function(bar, index) {
                            const data = dataset.data[index];
                            if (data.error) {
                                const x = bar.x;
                                const yTop = bar.y - data.error * (bar.base - bar.y) / data.y;
                                const yBottom = bar.y + data.error * (bar.base - bar.y) / data.y;

                                ctx.save();
                                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                                ctx.lineWidth = 1;

                                // Vertical line
                                ctx.beginPath();
                                ctx.moveTo(x, yTop);
                                ctx.lineTo(x, yBottom);
                                ctx.stroke();

                                // Top cap
                                ctx.beginPath();
                                ctx.moveTo(x - 3, yTop);
                                ctx.lineTo(x + 3, yTop);
                                ctx.stroke();

                                // Bottom cap
                                ctx.beginPath();
                                ctx.moveTo(x - 3, yBottom);
                                ctx.lineTo(x + 3, yBottom);
                                ctx.stroke();

                                ctx.restore();
                            }
                        });
                    });
                }
            }]
        });
    }

    formatToken(token) {
        return token
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')
            .replace(/\r/g, '\\r')
            .replace(/ /g, '·');  // Show spaces as middle dots
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    navigateCluster(direction) {
        const newIndex = this.currentIndex + direction;
        if (newIndex >= 0 && newIndex < this.clusterIds.length) {
            this.showCluster(this.clusterIds[newIndex]);
        }
    }

    selectCluster() {
        const select = document.getElementById('cluster-select');
        this.showCluster(select.value);
    }

    async saveData() {
        const clusterId = this.currentClusterId;
        if (!clusterId) return;

        const name = document.getElementById('cluster-name').value;
        const observations = document.getElementById('observations').value;

        // Update local observations
        this.observations[clusterId] = {
            name: name,
            observations: observations,
            lastModified: new Date().toISOString(),
            author: this.userPassword || 'anonymous'
        };

        // Update save status
        document.getElementById('save-status').textContent = 'Saving...';

        try {
            if (this.isOnlineMode && this.githubConfig.token) {
                await this.saveObservationsToGitHub();
                document.getElementById('save-status').textContent = 'Saved to GitHub';
            } else {
                this.saveObservationsLocally();
                document.getElementById('save-status').textContent = 'Saved locally';
            }
        } catch (error) {
            console.error('Failed to save to GitHub:', error);
            // Show the specific error to help debug
            document.getElementById('save-status').textContent = `GitHub failed: ${error.message}`;
            // Fallback to local save
            this.saveObservationsLocally();
        }

        setTimeout(() => {
            document.getElementById('save-status').textContent = 'Ready';
        }, 3000);
    }

    getObservationsFilePath() {
        return `observations/observations-${this.currentDataset}.json`;
    }

    async loadObservationsFromGitHub() {
        if (!this.githubConfig.token) {
            console.log('No GitHub token, loading from localStorage');
            this.loadObservationsLocally();
            return;
        }

        const filePath = this.getObservationsFilePath();
        console.log(`Loading observations for ${this.currentDataset} from ${filePath}`);

        try {
            const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const content = JSON.parse(atob(data.content));
                this.observations = content;
                this.isOnlineMode = true;
                console.log('Loaded observations from GitHub');
            } else if (response.status === 404) {
                console.log('No observations file found in GitHub, starting fresh');
                this.observations = {};
                this.isOnlineMode = true;
            } else {
                throw new Error(`GitHub API error: ${response.status}`);
            }
        } catch (error) {
            console.warn('Failed to load from GitHub, falling back to localStorage:', error);
            this.loadObservationsLocally();
        }
    }

    getLocalStorageKey() {
        return `cluster-observations-${this.currentDataset}`;
    }

    loadObservationsLocally() {
        try {
            const storageKey = this.getLocalStorageKey();
            const saved = localStorage.getItem(storageKey);
            this.observations = saved ? JSON.parse(saved) : {};
            this.isOnlineMode = false;
            console.log(`Loaded local observations for ${this.currentDataset}`);
        } catch (error) {
            console.error('Failed to load observations from localStorage:', error);
            this.observations = {};
            this.isOnlineMode = false;
        }
    }

    saveObservationsLocally() {
        try {
            const storageKey = this.getLocalStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(this.observations));
            console.log(`Saved local observations for ${this.currentDataset}`);
        } catch (error) {
            console.error('Failed to save observations to localStorage:', error);
        }
    }

    async saveObservationsToGitHub() {
        if (!this.githubConfig.token) {
            throw new Error('No GitHub token available');
        }

        const filePath = this.getObservationsFilePath();
        const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}`;
        console.log(`Attempting to save observations for ${this.currentDataset} to GitHub URL:`, url);

        // First, get the current file to get its SHA (required for updates)
        let sha = null;
        try {
            console.log('Checking if file exists...');
            const getResponse = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            console.log('File check response status:', getResponse.status);

            if (getResponse.ok) {
                const existingFile = await getResponse.json();
                sha = existingFile.sha;
                console.log('Found existing file with SHA:', sha);
            } else if (getResponse.status === 404) {
                console.log('File does not exist yet, will create new file');
            } else {
                const errorText = await getResponse.text();
                console.error('Unexpected response:', getResponse.status, errorText);
            }
        } catch (error) {
            console.log('Error checking file existence:', error);
        }

        // Prepare the content
        const content = btoa(JSON.stringify(this.observations, null, 2));
        const message = `Update cluster observations - ${new Date().toISOString()}`;

        const payload = {
            message: message,
            content: content,
            branch: this.githubConfig.branch
        };

        if (sha) {
            payload.sha = sha; // Required for updates
        }

        console.log('Sending PUT request with payload:', payload);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('PUT response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub API error response:', errorText);

            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
                console.error('Parsed error data:', errorData);
            } catch (e) {
                console.error('Could not parse error response as JSON');
            }

            throw new Error(`GitHub save failed: ${errorMessage}`);
        }

        console.log('Successfully saved observations to GitHub');

        // Also save locally as backup
        this.saveObservationsLocally();
    }

    showError(message) {
        document.getElementById('main-app').innerHTML = `
            <div class="error-message">
                <h2>Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()">Reload</button>
            </div>
        `;
    }
}

// Password protection and GitHub token mapping
const VALID_PASSWORDS = ['rainbowserpent'];

// GitHub Personal Access Tokens for collaborative access
// To add GitHub integration, replace these with real tokens
const GITHUB_TOKENS = {
    'rainbowserpent': null,  // Add your token here
    // Add team member tokens like:
    // 'team_member_1': 'ghp_their_token_here',
    // 'research_assistant': 'ghp_their_token_here',
};

function checkPassword() {
    const password = document.getElementById('password-input').value;

    if (VALID_PASSWORDS.includes(password)) {
        document.getElementById('password-modal').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';

        // Initialize the app
        window.app = new ClusterCatalogue();
        window.app.userPassword = password;

        // Set GitHub token if available
        if (GITHUB_TOKENS[password]) {
            window.app.githubConfig.token = GITHUB_TOKENS[password];
            console.log('GitHub integration enabled');
        } else {
            console.log('No GitHub token for this password, using local storage only');
        }
    } else if (password.startsWith('ghp_') && password.length >= 40) {
        // Allow direct GitHub token entry
        document.getElementById('password-modal').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';

        window.app = new ClusterCatalogue();
        window.app.userPassword = 'github-user';
        window.app.githubConfig.token = password;
        console.log('GitHub token provided directly');
    } else {
        alert('Invalid password or GitHub token. Please try again.');
        document.getElementById('password-input').value = '';
    }
}

// Navigation functions (called from HTML)
function navigateCluster(direction) {
    if (window.app) {
        window.app.navigateCluster(direction);
    }
}

function selectCluster() {
    if (window.app) {
        window.app.selectCluster();
    }
}

function switchDataset() {
    if (window.app) {
        const select = document.getElementById('dataset-select');
        window.app.switchDataset(select.value);
    }
}

function saveData() {
    if (window.app) {
        window.app.saveData();
    }
}

// Auto-focus password input
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('password-input').focus();

    // Allow enter key to submit password
    document.getElementById('password-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
});