#!/usr/bin/env python3
"""
Migration script to convert cluster catalogue data from GitHub-based format
to new R2-compatible format.

Changes:
1. Split observations from single file per model -> per-cluster files
2. Add "good" field (default: false) to all observations
3. Create config/display-fields.json from hardcoded field definitions
4. Convert model_cfg.json -> config/models.json with enhanced metadata
"""

import json
import os
from pathlib import Path
from typing import Dict, Any


def migrate_observations(old_dir: str = 'observations', new_dir: str = 'migrated/observations'):
    """
    Convert observations from single file per model to per-cluster files.

    OLD: observations/observations-pythia-14m.json
         (single file with all clusters)

    NEW: migrated/observations/pythia-14m/cluster-0.json
         (one file per cluster)
    """
    old_path = Path(old_dir)
    new_path = Path(new_dir)

    if not old_path.exists():
        print(f"Error: {old_dir} directory not found")
        return

    print("=" * 60)
    print("MIGRATING OBSERVATIONS")
    print("=" * 60)

    total_clusters = 0

    for obs_file in sorted(old_path.glob('observations-*.json')):
        # Extract model name (e.g., "pythia-14m" from "observations-pythia-14m.json")
        model = obs_file.stem.replace('observations-', '')
        print(f"\nMigrating {model}...")

        try:
            with open(obs_file, 'r') as f:
                old_data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"  ERROR: Failed to parse {obs_file}: {e}")
            continue

        # Create model directory
        model_dir = new_path / model
        model_dir.mkdir(parents=True, exist_ok=True)

        # Split into per-cluster files
        cluster_count = 0
        for cluster_id, obs in old_data.items():
            new_obs = {
                "cluster_id": cluster_id,
                "model": model,
                "name": obs.get("name", cluster_id),
                "observations": obs.get("observations", ""),
                "good": False,  # NEW field, default false
                "metadata": {
                    "created": obs.get("lastModified", "2025-12-03T00:00:00Z"),
                    "last_modified": obs.get("lastModified", "2025-12-03T00:00:00Z"),
                    "modified_by": obs.get("author", "unknown"),
                    "version": 1
                }
            }

            output_file = model_dir / f"cluster-{cluster_id}.json"
            with open(output_file, 'w') as f:
                json.dump(new_obs, f, indent=2)

            cluster_count += 1

        total_clusters += cluster_count
        print(f"  ✓ Created {cluster_count} cluster files in {model_dir}")

    print(f"\n✓ Successfully migrated {total_clusters} total clusters")


def create_display_fields_config(output_dir: str = 'config'):
    """
    Create display-fields.json configuration from hardcoded UI field definitions.
    This enables config-driven rendering without code changes.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("\n" + "=" * 60)
    print("CREATING DISPLAY FIELDS CONFIG")
    print("=" * 60)

    config = {
        "version": "1.0",
        "fields": [
            # Statistics section
            {
                "key": "Size",
                "type": "stat",
                "label": "Size",
                "format": "number",
                "display_section": "statistics"
            },
            {
                "key": "Number of Unique Next Tokens",
                "type": "stat",
                "label": "Unique Next Tokens",
                "format": "number",
                "display_section": "statistics"
            },

            # Lists section
            {
                "key": "Most Common Next Tokens",
                "type": "list",
                "label": "Most Common Next Tokens",
                "display_section": "lists",
                "limit": 10,
                "format": "token_count"
            },
            {
                "key": "Most Common Datasets",
                "type": "list",
                "label": "Most Common Datasets",
                "display_section": "lists",
                "limit": 10,
                "format": "name_count"
            },
            {
                "key": "Pattern Counts",
                "type": "list",
                "label": "Pattern Counts",
                "display_section": "lists",
                "format": "name_count"
            },

            # Charts section
            {
                "key": "Mean Susceptibilities",
                "type": "chart",
                "chart_type": "bar_with_error",
                "label": "Mean Susceptibilities",
                "display_section": "charts",
                "config": {
                    "x_label": "Model Component",
                    "y_label": "Mean Susceptibility",
                    "title": "Mean Susceptibilities Across Components",
                    "error_bars": True,
                    "error_field": "Std Susceptibilities",
                    "label_generator": "model_components",
                    "color_scheme": "by_layer"
                }
            },
            {
                "key": "Mean Susceptibilities PCA",
                "type": "chart",
                "chart_type": "bar",
                "label": "PCA Components",
                "display_section": "charts",
                "config": {
                    "x_label": "Principal Component",
                    "y_label": "Value",
                    "title": "PCA of Mean Susceptibilities",
                    "label_generator": "pca_components",
                    "color_scheme": "single"
                }
            },

            # Contexts section
            {
                "key": "Context Pairs",
                "type": "context_list",
                "label": "Context → Next Token Pairs",
                "display_section": "contexts",
                "limit": 20
            }
        ]
    }

    output_file = output_path / 'display-fields.json'
    with open(output_file, 'w') as f:
        json.dump(config, f, indent=2)

    print(f"✓ Created {output_file} with {len(config['fields'])} field definitions")


def format_model_name(model: str) -> str:
    """Convert model ID to display name (e.g., 'pythia-14m' -> 'Pythia 14M')"""
    parts = model.split('-')
    if len(parts) == 2:
        name, size = parts
        return f"{name.capitalize()} {size.upper()}"
    return model


def migrate_model_config(input_file: str = 'model_cfg.json', output_dir: str = 'config'):
    """
    Convert model_cfg.json to config/models.json with enhanced metadata.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print("\n" + "=" * 60)
    print("MIGRATING MODEL CONFIG")
    print("=" * 60)

    try:
        with open(input_file, 'r') as f:
            old_config = json.load(f)
    except FileNotFoundError:
        print(f"Warning: {input_file} not found, skipping model config migration")
        return

    new_config = {
        "version": "1.0",
        "models": {}
    }

    for model, cfg in old_config.items():
        new_config["models"][model] = {
            **cfg,
            "display_name": format_model_name(model),
            "dataset_file": f"{model}.json"
        }

    output_file = output_path / 'models.json'
    with open(output_file, 'w') as f:
        json.dump(new_config, f, indent=2)

    print(f"✓ Created {output_file} with {len(new_config['models'])} model configurations")


def create_summary_report(observations_dir: str = 'migrated/observations',
                         config_dir: str = 'config'):
    """
    Create a summary report of the migration.
    """
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)

    obs_path = Path(observations_dir)
    if obs_path.exists():
        total_files = 0
        print("\nObservations by model:")
        for model_dir in sorted(obs_path.iterdir()):
            if model_dir.is_dir():
                cluster_files = list(model_dir.glob('cluster-*.json'))
                total_files += len(cluster_files)
                print(f"  {model_dir.name}: {len(cluster_files)} clusters")
        print(f"\nTotal observation files: {total_files}")

    config_path = Path(config_dir)
    if config_path.exists():
        print("\nConfig files created:")
        for config_file in sorted(config_path.glob('*.json')):
            size_kb = config_file.stat().st_size / 1024
            print(f"  {config_file.name}: {size_kb:.1f} KB")

    print("\n" + "=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    print("""
1. Review migrated data in 'migrated/' directory
2. Set up Cloudflare R2 bucket
3. Run upload-to-r2.sh to upload data to R2
4. Deploy Cloudflare Workers API
5. Update frontend to use new API
6. Test with team

For detailed instructions, see:
- docs/R2_SETUP.md
- docs/WORKERS_SETUP.md
- docs/DEPLOYMENT.md
""")


def main():
    """Run all migration steps"""
    print("\n" + "=" * 60)
    print("CLUSTER CATALOGUE DATA MIGRATION")
    print("=" * 60)
    print("\nThis script will:")
    print("  1. Convert observations to per-cluster files")
    print("  2. Create display-fields.json config")
    print("  3. Create enhanced models.json config")
    print()

    # Phase 1: Migrate observations
    migrate_observations()

    # Phase 2: Create config files
    create_display_fields_config()
    migrate_model_config()

    # Phase 3: Summary report
    create_summary_report()

    print("\n✓ Migration complete!")


if __name__ == '__main__':
    main()
