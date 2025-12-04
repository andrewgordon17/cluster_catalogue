#!/usr/bin/env python3
"""
Merge two observation JSON files intelligently.
For clusters that exist in both files, use the one with the most recent lastModified date.
"""

import json
from datetime import datetime

# Read local version
with open('observations/observations-pythia-160m.json', 'r') as f:
    local = json.load(f)

# Read remote version
with open('/tmp/remote-160m.json', 'r') as f:
    remote = json.load(f)

# Merge strategy: for each cluster ID, keep the one with the latest lastModified
merged = {}

# Get all unique cluster IDs
all_ids = set(local.keys()) | set(remote.keys())

for cluster_id in all_ids:
    local_entry = local.get(cluster_id)
    remote_entry = remote.get(cluster_id)

    # If only in one, take that one
    if local_entry and not remote_entry:
        merged[cluster_id] = local_entry
        print(f"Cluster {cluster_id}: Only in local, using local")
    elif remote_entry and not local_entry:
        merged[cluster_id] = remote_entry
        print(f"Cluster {cluster_id}: Only in remote, using remote")
    else:
        # Both exist - compare timestamps
        local_time = datetime.fromisoformat(local_entry['lastModified'].replace('Z', '+00:00'))
        remote_time = datetime.fromisoformat(remote_entry['lastModified'].replace('Z', '+00:00'))

        if local_time >= remote_time:
            merged[cluster_id] = local_entry
            print(f"Cluster {cluster_id}: Local is newer ({local_entry['lastModified']} >= {remote_entry['lastModified']})")
        else:
            merged[cluster_id] = remote_entry
            print(f"Cluster {cluster_id}: Remote is newer ({remote_entry['lastModified']} > {local_entry['lastModified']})")

# Sort by cluster ID (as integers)
merged_sorted = dict(sorted(merged.items(), key=lambda x: int(x[0])))

# Write merged result
with open('observations/observations-pythia-160m.json', 'w') as f:
    json.dump(merged_sorted, f, indent=2)

print(f"\nMerge complete! Total clusters: {len(merged_sorted)}")
print(f"Local had: {len(local)} clusters")
print(f"Remote had: {len(remote)} clusters")
