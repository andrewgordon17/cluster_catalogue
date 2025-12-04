# Adding New Display Fields Guide

This guide shows you how to add new fields to the cluster catalogue without writing any code!

## Overview

The cluster catalogue uses **config-driven rendering** - all field definitions are in `config/display-fields.json`. To add a new field:

1. Add data to your dataset JSON
2. Update `config/display-fields.json`
3. Upload both files to R2
4. Reload the web interface

That's it - no code changes needed!

## Field Types

The system supports 4 field types:

### 1. Stat (Simple Text/Number)
Display a single statistic

### 2. List
Display a list of items (tokens, datasets, patterns)

### 3. Chart
Display a bar chart with optional error bars

### 4. Context List
Display context → token pairs

## Adding a Text Statistic

### Example: Add "Coherence Score"

**Step 1:** Add data to dataset JSON (`datasets/pythia-14m.json`):

```json
{
  "0": {
    "Size": 655402,
    "Number of Unique Next Tokens": 37949,
    "coherence_score": 0.87,  // NEW FIELD
    ...
  },
  "1": {
    "Size": 421332,
    "coherence_score": 0.92,  // NEW FIELD
    ...
  }
}
```

**Step 2:** Update `config/display-fields.json`:

```json
{
  "version": "1.0",
  "fields": [
    // ... existing fields ...
    {
      "key": "coherence_score",
      "type": "stat",
      "label": "Coherence Score",
      "format": "decimal",
      "display_section": "statistics"
    }
  ]
}
```

Field configuration:
- `key`: Must match the key in dataset JSON
- `type`: "stat" for simple values
- `label`: Display name shown in UI
- `format`: "number", "decimal", or "text"
- `display_section`: "statistics", "lists", "charts", or "contexts"

**Step 3:** Upload to R2:

```bash
wrangler r2 object put cluster-catalogue/datasets/pythia-14m.json --file datasets/pythia-14m.json
wrangler r2 object put cluster-catalogue/config/display-fields.json --file config/display-fields.json
```

**Step 4:** Reload the web interface - the new field appears automatically!

## Adding a Bar Chart

### Example: Add "Token Distribution"

**Step 1:** Add data to dataset JSON:

```json
{
  "0": {
    "Size": 655402,
    "token_distribution": [120, 340, 256, 189, 412],
    "token_distribution_std": [12, 34, 25, 18, 41],
    "_field_metadata": {
      "token_distribution": {
        "x_labels": ["Punctuation", "Articles", "Verbs", "Nouns", "Other"]
      }
    },
    ...
  }
}
```

**Step 2:** Update `config/display-fields.json`:

```json
{
  "fields": [
    {
      "key": "token_distribution",
      "type": "chart",
      "chart_type": "bar_with_error",
      "label": "Token Distribution",
      "display_section": "charts",
      "config": {
        "x_label": "Token Category",
        "y_label": "Frequency",
        "title": "Token Distribution by Category",
        "error_bars": true,
        "error_field": "token_distribution_std",
        "label_generator": "custom",
        "color_scheme": "rainbow"
      }
    }
  ]
}
```

Chart configuration options:
- `chart_type`: "bar" or "bar_with_error"
- `x_label`: X-axis label
- `y_label`: Y-axis label
- `title`: Chart title
- `error_bars`: Show error bars (true/false)
- `error_field`: Key for error bar data
- `label_generator`: How to generate X-axis labels:
  - `"model_components"`: Auto-generate (Embed, A0.0, MLP0, ...)
  - `"pca_components"`: Auto-generate (PC1, PC2, ...)
  - `"custom"`: Use labels from `_field_metadata`
- `color_scheme`: "rainbow", "single", or "by_layer"

## Adding a List Field

### Example: Add "Top Bigrams"

**Step 1:** Add data to dataset JSON:

```json
{
  "0": {
    "Size": 655402,
    "top_bigrams": [
      ["the the", 1234],
      ["of the", 892],
      ["in the", 756]
    ],
    ...
  }
}
```

**Step 2:** Update `config/display-fields.json`:

```json
{
  "fields": [
    {
      "key": "top_bigrams",
      "type": "list",
      "label": "Most Common Bigrams",
      "display_section": "lists",
      "limit": 10,
      "format": "name_count"
    }
  ]
}
```

List configuration:
- `limit`: How many items to show
- `format`:
  - `"token_count"`: For tokens with counts
  - `"name_count"`: For names with counts

## Complete Field Configuration Reference

### Stat Field
```json
{
  "key": "field_name_in_json",
  "type": "stat",
  "label": "Display Name",
  "format": "number" | "decimal" | "text",
  "display_section": "statistics"
}
```

### List Field
```json
{
  "key": "field_name_in_json",
  "type": "list",
  "label": "Display Name",
  "display_section": "lists",
  "limit": 10,
  "format": "token_count" | "name_count"
}
```

### Chart Field
```json
{
  "key": "field_name_in_json",
  "type": "chart",
  "chart_type": "bar" | "bar_with_error",
  "label": "Display Name",
  "display_section": "charts",
  "config": {
    "x_label": "X Axis Label",
    "y_label": "Y Axis Label",
    "title": "Chart Title",
    "error_bars": true,
    "error_field": "std_field_name",
    "label_generator": "model_components" | "pca_components" | "custom",
    "color_scheme": "rainbow" | "single" | "by_layer"
  }
}
```

### Context List Field
```json
{
  "key": "Context Pairs",
  "type": "context_list",
  "label": "Context → Token Pairs",
  "display_section": "contexts",
  "limit": 20
}
```

## Workflow for Adding Multiple Fields

### Scenario: Adding 3 new statistics to all models

**Step 1:** Update your data generation pipeline to include new fields:

```python
# In your data generation script
cluster_data = {
    "Size": size,
    "Number of Unique Next Tokens": unique_tokens,
    # NEW FIELDS
    "coherence_score": calculate_coherence(cluster),
    "entropy": calculate_entropy(cluster),
    "diversity_index": calculate_diversity(cluster),
    ...
}
```

**Step 2:** Generate updated datasets:

```bash
python your_analysis_script.py
# Outputs updated datasets/*.json files
```

**Step 3:** Update `config/display-fields.json` with all 3 fields:

```json
{
  "fields": [
    // ... existing fields ...
    {
      "key": "coherence_score",
      "type": "stat",
      "label": "Coherence Score",
      "format": "decimal",
      "display_section": "statistics"
    },
    {
      "key": "entropy",
      "type": "stat",
      "label": "Entropy",
      "format": "decimal",
      "display_section": "statistics"
    },
    {
      "key": "diversity_index",
      "type": "stat",
      "label": "Diversity Index",
      "format": "decimal",
      "display_section": "statistics"
    }
  ]
}
```

**Step 4:** Upload all files:

```bash
# Upload all datasets
for dataset in datasets/*.json; do
  filename=$(basename "$dataset")
  wrangler r2 object put "cluster-catalogue/datasets/${filename}" --file "$dataset"
done

# Upload updated config
wrangler r2 object put cluster-catalogue/config/display-fields.json --file config/display-fields.json
```

**Step 5:** Reload web interface - all 3 fields appear!

## UI Layout

The display sections map to these UI areas:

- **statistics**: Top left panel, stats grid
- **lists**: Top left panel, below stats
- **charts**: Right panel, below observations
- **contexts**: Top left panel, at the very top

## Removing Fields

To remove a field from display (without deleting data):

Simply remove it from `config/display-fields.json` and re-upload.

The data remains in the dataset JSON but won't be displayed.

## Tips

### Keep JSON organized
Order fields in display-fields.json the way you want them displayed:
- Stats appear in order defined
- Lists appear in order defined
- Charts appear in order defined

### Use consistent naming
- Use snake_case for JSON keys: `coherence_score`
- Use Title Case for labels: "Coherence Score"

### Test with one model first
Before updating all models:
1. Update just pythia-14m
2. Upload and test
3. Once confirmed, update all models

### Version your configs
Add version numbers to config filenames when making major changes:
- `display-fields-v1.json`
- `display-fields-v2.json`

## Troubleshooting

### Field not appearing
1. Check key in display-fields.json matches dataset JSON exactly
2. Verify file was uploaded to R2
3. Clear browser cache (Ctrl+Shift+R)
4. Check browser console for errors

### Chart not rendering
1. Verify data is an array of numbers
2. Check error_field exists if error_bars is true
3. Ensure label_generator is valid

### Wrong format
Check the format option matches your data type:
- "number": Integers (1,234,567)
- "decimal": Decimals (0.87)
- "text": Strings

## Next Steps

- [Share with your team](./TEAM_USER_GUIDE.md)
- [Set up Google Docs integration](./GOOGLE_DOCS_SETUP.md)
