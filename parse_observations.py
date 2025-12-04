#!/usr/bin/env python3
"""
Parse observations from message.txt and format them into JSON files.

Format:
- Lines starting with '# <model>' indicate the model for following observations
- Lines starting with an integer contain observations for that cluster
- Other lines are logged as errors
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path

# Configuration
MESSAGE_FILE = "message.txt"
OBSERVATIONS_DIR = "observations"
ERROR_LOG = "parsing_errors.txt"

def load_or_create_json(filepath):
    """Load existing JSON file or create empty structure."""
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return {}

def save_json(filepath, data):
    """Save data to JSON file with proper formatting."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {filepath}")

def parse_observation_line(line):
    """
    Parse a line that should contain an observation.
    
    Returns:
        tuple: (cluster_id, observation_text) or (None, None) if invalid
    """
    # Try to match lines starting with an integer
    match = re.match(r'^(\d+)[:\s]+(.+)', line)
    if match:
        cluster_id = match.group(1)
        observation = match.group(2).strip()
        return cluster_id, observation
    
    # Also try to match lines where integer is at the end (like "the in dm math but also some commas, maybe the hint needed to discover the origin of the wing 259")
    match = re.search(r'^(.+?)\s+(\d+)$', line)
    if match:
        observation = match.group(1).strip()
        cluster_id = match.group(2)
        return cluster_id, observation
    
    return None, None

def model_name_to_filename(model_name):
    """Convert model name from message.txt to JSON filename."""
    # Clean up the model name
    model_clean = model_name.strip().replace('(incomplete)', '').strip()
    
    # Map to proper filename format
    return f"observations-pythia-{model_clean}.json"

def main():
    script_dir = Path(__file__).parent
    message_path = script_dir / MESSAGE_FILE
    observations_dir = script_dir / OBSERVATIONS_DIR
    error_log_path = script_dir / ERROR_LOG
    
    # Create observations directory if it doesn't exist
    observations_dir.mkdir(exist_ok=True)
    
    # Read the message file
    if not message_path.exists():
        print(f"Error: {message_path} not found!")
        return
    
    with open(message_path, 'r') as f:
        lines = f.readlines()
    
    # State tracking
    current_model = None
    current_json_file = None
    current_data = None
    last_valid_line_idx = -1
    errors = []
    stats = {
        'total_lines': len(lines),
        'processed': 0,
        'errors': 0,
        'added': 0,
        'appended': 0
    }
    
    print(f"Processing {len(lines)} lines from {message_path}...")
    print()
    
    for idx, line in enumerate(lines):
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # Check for model header (# <model>)
        if line.startswith('#'):
            # Save current data before switching models
            if current_json_file and current_data is not None:
                save_json(current_json_file, current_data)
            
            # Extract model name
            model_name = line[1:].strip()
            current_model = model_name
            
            # Determine JSON filename
            json_filename = model_name_to_filename(model_name)
            current_json_file = observations_dir / json_filename
            
            # Load or create JSON
            current_data = load_or_create_json(current_json_file)
            
            print(f"Section: {model_name} -> {json_filename}")
            last_valid_line_idx = idx
            continue
        
        # We must be in a model section at this point
        if current_model is None:
            errors.append({
                'line_number': idx + 1,
                'line': line,
                'section': 'NONE',
                'last_valid_line': last_valid_line_idx + 1,
                'error': 'Line appears before any model section header'
            })
            stats['errors'] += 1
            continue
        
        # Try to parse as observation
        cluster_id, observation = parse_observation_line(line)
        
        if cluster_id is None:
            # This line doesn't match expected format
            errors.append({
                'line_number': idx + 1,
                'line': line,
                'section': current_model,
                'last_valid_line': last_valid_line_idx + 1,
                'error': 'Does not match observation format (should start with integer)'
            })
            stats['errors'] += 1
            continue
        
        # Valid observation line
        timestamp = datetime.now().isoformat() + 'Z'
        
        if cluster_id in current_data:
            # Append to existing observation
            existing_obs = current_data[cluster_id]['observations']
            current_data[cluster_id]['observations'] = existing_obs + "; " + observation
            current_data[cluster_id]['lastModified'] = timestamp
            stats['appended'] += 1
            print(f"  Appended to cluster {cluster_id}: {observation[:50]}...")
        else:
            # Create new observation entry
            current_data[cluster_id] = {
                'name': cluster_id,
                'observations': observation,
                'lastModified': timestamp,
                'author': 'script-import'
            }
            stats['added'] += 1
            print(f"  Added cluster {cluster_id}: {observation[:50]}...")
        
        last_valid_line_idx = idx
        stats['processed'] += 1
    
    # Save final model data
    if current_json_file and current_data is not None:
        save_json(current_json_file, current_data)
    
    # Write error log
    if errors:
        print(f"\n{len(errors)} errors found. Writing to {error_log_path}...")
        with open(error_log_path, 'w') as f:
            f.write("PARSING ERRORS LOG\n")
            f.write("=" * 80 + "\n\n")
            
            for error in errors:
                f.write(f"Line {error['line_number']}:\n")
                f.write(f"  Section: {error['section']}\n")
                f.write(f"  Last valid line: {error['last_valid_line']}\n")
                f.write(f"  Error: {error['error']}\n")
                f.write(f"  Content: {error['line']}\n")
                f.write("-" * 80 + "\n\n")
    
    # Print summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total lines: {stats['total_lines']}")
    print(f"Processed successfully: {stats['processed']}")
    print(f"New observations added: {stats['added']}")
    print(f"Existing observations appended: {stats['appended']}")
    print(f"Errors: {stats['errors']}")
    
    if errors:
        print(f"\nErrors logged to: {error_log_path}")
    
    print("\nDone!")

if __name__ == '__main__':
    main()

