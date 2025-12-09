/**
 * Field Renderer - Config-driven UI rendering
 * Dynamically generates UI based on display-fields.json configuration
 */

class FieldRenderer {
  constructor(config, modelConfig) {
    this.config = config; // display-fields.json
    this.modelConfig = modelConfig; // models.json
    this.charts = {}; // Store Chart.js instances
    this.currentModel = null;
  }

  /**
   * Render all fields for a cluster
   */
  renderAllFields(cluster, model) {
    this.currentModel = model;

    // Group fields by display section
    const sections = this.groupFieldsBySection();

    // Render each section
    if (sections.statistics) {
      this.renderStatistics(cluster, sections.statistics);
    }
    if (sections.lists) {
      this.renderLists(cluster, sections.lists);
    }
    if (sections.charts) {
      this.renderCharts(cluster, sections.charts);
    }
    if (sections.contexts) {
      this.renderContexts(cluster, sections.contexts);
    }
  }

  /**
   * Group fields by display_section
   */
  groupFieldsBySection() {
    const sections = {};

    for (const field of this.config.fields) {
      const section = field.display_section || 'other';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(field);
    }

    return sections;
  }

  /**
   * Render statistics (Size, Unique Tokens, etc.)
   */
  renderStatistics(cluster, fields) {
    for (const field of fields) {
      const value = cluster[field.key];
      const formattedValue = this.formatValue(value, field.format);

      // Map to existing HTML elements
      if (field.key === 'Size') {
        const el = document.getElementById('stat-size');
        if (el) el.textContent = formattedValue;
      } else if (field.key === 'Number of Unique Next Tokens') {
        const el = document.getElementById('stat-tokens');
        if (el) el.textContent = formattedValue;
      }
    }
  }

  /**
   * Render lists (Top Tokens, Top Datasets, Pattern Counts)
   */
  renderLists(cluster, fields) {
    for (const field of fields) {
      // Map to existing HTML elements
      let containerId = null;
      if (field.key === 'Most Common Next Tokens') {
        containerId = 'common-tokens';
      } else if (field.key === 'Most Common Previous Tokens') {
        containerId = 'common-previous-tokens';
      } else if (field.key === 'Most Common Datasets') {
        containerId = 'common-datasets';
      } else if (field.key === 'Pattern Counts') {
        containerId = 'pattern-counts';
      }

      const container = document.getElementById(containerId);
      if (!container) continue;

      const data = cluster[field.key] || [];
      const limit = field.limit || 10;
      const limitedData = data.slice(0, limit);

      const html = limitedData.map(item => {
        if (field.format === 'token_count' || field.format === 'name_count') {
          const [name, count] = item;
          return `<div class="list-item"><span>${this.escapeHtml(String(name))}</span> <span class="count">${count}</span></div>`;
        }
        return `<div class="list-item">${this.escapeHtml(String(item))}</div>`;
      }).join('');

      container.innerHTML = html;
    }
  }

  /**
   * Render charts (Mean Susceptibilities, PCA, etc.)
   */
  renderCharts(cluster, fields) {
    for (const field of fields) {
      this.renderChart(cluster, field);
    }
  }

  /**
   * Render a single chart
   */
  renderChart(cluster, fieldConfig) {
    // Map to existing canvas elements
    let canvasId = null;
    if (fieldConfig.key === 'Mean Susceptibilities') {
      canvasId = 'susceptibility-chart';
    } else if (fieldConfig.key === 'Mean Susceptibilities PCA') {
      canvasId = 'pca-chart';
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const data = cluster[fieldConfig.key];
    if (!data) return;

    const config = fieldConfig.config || {};

    // Destroy existing chart if it exists
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    // Generate labels
    const labels = this.generateLabels(config.label_generator, cluster, data.length);

    // Prepare dataset
    const dataset = {
      label: fieldConfig.label,
      data: data,
      backgroundColor: this.getColors(config.color_scheme, data.length),
      borderColor: this.getColors(config.color_scheme, data.length),
      borderWidth: 1
    };

    // Add error bars if specified
    const errorPlugin = config.error_bars && cluster[config.error_field]
      ? this.createErrorBarPlugin(cluster[config.error_field])
      : null;

    // Create chart
    const chartConfig = {
      type: fieldConfig.chart_type.replace('_with_error', ''),
      data: {
        labels: labels,
        datasets: [dataset]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: !!config.x_label,
              text: config.x_label || ''
            }
          },
          y: {
            title: {
              display: !!config.y_label,
              text: config.y_label || ''
            }
          }
        },
        plugins: {
          title: {
            display: !!config.title,
            text: config.title || ''
          },
          legend: {
            display: false
          }
        }
      },
      plugins: errorPlugin ? [errorPlugin] : []
    };

    this.charts[canvasId] = new Chart(canvas, chartConfig);
  }

  /**
   * Render context pairs (Context → Token)
   */
  renderContexts(cluster, fields) {
    for (const field of fields) {
      const container = document.getElementById('context-examples');
      if (!container) continue;

      const contexts = cluster[field.key] || [];
      const limit = field.limit || 20;
      const limitedContexts = contexts.slice(0, limit);

      const html = limitedContexts.map(pair => {
        const context = this.escapeHtml(pair.context);
        const token = this.escapeHtml(pair.token);
        return `<div class="context-example">${context}<span class="next-token">${token}</span></div>`;
      }).join('');

      container.innerHTML = html;
    }
  }

  /**
   * Generate labels based on label_generator type
   */
  generateLabels(generator, cluster, length) {
    switch (generator) {
      case 'model_components':
        return this.generateModelComponentLabels();
      case 'pca_components':
        return this.generatePCALabels(length);
      case 'custom':
        return cluster._labels || Array.from({ length }, (_, i) => `${i}`);
      default:
        return Array.from({ length }, (_, i) => `${i}`);
    }
  }

  /**
   * Generate model component labels (Embed, A0.0, A0.1, ..., MLP0, ...)
   */
  generateModelComponentLabels() {
    if (!this.currentModel || !this.modelConfig.models[this.currentModel]) {
      return [];
    }

    const { n_heads, n_layers } = this.modelConfig.models[this.currentModel];
    const labels = ['Embed'];

    // Attention heads
    for (let layer = 0; layer < n_layers; layer++) {
      for (let head = 0; head < n_heads; head++) {
        labels.push(`A${layer}.${head}`);
      }
    }

    // MLPs
    for (let layer = 0; layer < n_layers; layer++) {
      labels.push(`MLP${layer}`);
    }

    labels.push('Unembed');
    return labels;
  }

  /**
   * Generate PCA component labels (PC1, PC2, ...)
   */
  generatePCALabels(count) {
    return Array.from({ length: count }, (_, i) => `PC${i + 1}`);
  }

  /**
   * Get colors based on color scheme
   */
  getColors(scheme, count) {
    switch (scheme) {
      case 'by_layer':
        return this.getLayerColors(count);
      case 'rainbow':
        return this.getRainbowColors(count);
      case 'single':
        return Array(count).fill('rgba(54, 162, 235, 0.8)');
      default:
        return Array(count).fill('rgba(54, 162, 235, 0.8)');
    }
  }

  /**
   * Generate rainbow colors for different layers
   */
  getLayerColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i / count) * 360;
      colors.push(`hsla(${hue}, 70%, 60%, 0.8)`);
    }
    return colors;
  }

  /**
   * Generate rainbow colors
   */
  getRainbowColors(count) {
    return this.getLayerColors(count);
  }

  /**
   * Create error bar plugin for Chart.js
   */
  createErrorBarPlugin(stdData) {
    return {
      id: 'errorBars',
      afterDatasetsDraw: (chart) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);

        meta.data.forEach((bar, index) => {
          const std = stdData[index];
          if (std === undefined) return;

          const x = bar.x;
          const y = bar.y;
          const scale = chart.scales.y;
          const errorTop = scale.getPixelForValue(chart.data.datasets[0].data[index] + std);
          const errorBottom = scale.getPixelForValue(chart.data.datasets[0].data[index] - std);

          ctx.save();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.lineWidth = 1;

          // Vertical line
          ctx.beginPath();
          ctx.moveTo(x, errorTop);
          ctx.lineTo(x, errorBottom);
          ctx.stroke();

          // Top cap
          ctx.beginPath();
          ctx.moveTo(x - 3, errorTop);
          ctx.lineTo(x + 3, errorTop);
          ctx.stroke();

          // Bottom cap
          ctx.beginPath();
          ctx.moveTo(x - 3, errorBottom);
          ctx.lineTo(x + 3, errorBottom);
          ctx.stroke();

          ctx.restore();
        });
      }
    };
  }

  /**
   * Format value based on format type
   */
  formatValue(value, format) {
    if (value === null || value === undefined) return 'N/A';

    switch (format) {
      case 'number':
        return Number(value).toLocaleString();
      case 'decimal':
        return Number(value).toFixed(2);
      default:
        return String(value);
    }
  }

  /**
   * Sanitize field key for use as HTML ID
   */
  sanitizeId(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy all charts (call before switching datasets)
   */
  destroyCharts() {
    for (const chartId in this.charts) {
      if (this.charts[chartId]) {
        this.charts[chartId].destroy();
      }
    }
    this.charts = {};
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FieldRenderer };
}
