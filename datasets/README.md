# Datasets Directory

This directory contains cluster analysis JSON files that can be loaded by the Cluster Catalogue application.

## File Format

Each dataset should be a JSON file with the following structure:

```json
{
  "0": {
    "Size": 2091,
    "Number of Unique Next Tokens": 69,
    "Most Common Next Tokens": [["\\n", 1765], [".", 58]],
    "Most Common Datasets": [["github-all", 607]],
    "Mean Susceptibilities": [-1.28, -1.51, ...],
    "Std Susceptibilities": [1.92, 1.66, ...],
    "Pattern Counts": [["is_induction", 69]],
    "Context Pairs": [
      {
        "context": "example context text",
        "token": "next_token"
      }
    ]
  },
  "1": { ... }
}
```

## Naming Convention

Files should be named using the pattern: `{model-name}.json`

Examples:
- `pythia-14m.json`
- `pythia-31m.json`
- `pythia-70m.json`
- `gpt-2-small.json`

## Adding New Datasets

1. **Generate your cluster analysis** in the correct JSON format
2. **Save the file** in this `datasets/` directory with an appropriate name
3. **Refresh the application** - it will automatically detect the new dataset
4. **Select the dataset** from the dropdown in the application header

## Currently Available Datasets

- **Pythia 14M** (`pythia-14m.json`) - 1.4M parameter model analysis
- **Pythia 31M** (`pythia-31m.json`) - 31M parameter model analysis

## Model Configuration

Make sure the model name in your filename matches an entry in `model_cfg.json` for proper chart visualization with the correct number of layers and attention heads.