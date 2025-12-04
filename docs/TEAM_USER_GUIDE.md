# Team User Guide - Cluster Catalogue

Welcome to the Cluster Catalogue! This guide shows you how to use the tool to view and annotate cluster data.

## Getting Started

### Accessing the Catalogue

1. Go to your cluster catalogue URL (e.g., `https://your-domain.com/cluster_catalogue`)
2. Enter the shared password when prompted
3. The catalogue will load automatically

### Password

Your team administrator will provide you with the shared password. Everyone uses the same password.

**Security note:** Don't share the password outside your team.

## Interface Overview

The interface has three main areas:

```
┌──────────────────────────────────────────────────────┐
│ Header: Dataset selector, navigation, sync status   │
├──────────────────┬────────────────────────────────────┤
│  Left Panel      │  Right Panel                       │
│  • Contexts      │  • Cluster name (editable)         │
│  • Statistics    │  • Good toggle (editable)          │
│  • Lists         │  • Observations (editable)         │
│                  │  • Charts                          │
└──────────────────┴────────────────────────────────────┘
```

### Header Controls

- **Dataset selector**: Choose which model to view (pythia-14m, pythia-31m, etc.)
- **Cluster navigation**: Browse clusters with prev/next buttons or dropdown
- **Google Docs sync**: Manually trigger document sync
- **Save status**: Shows "Saving...", "Saved ✓", or "Ready"

### Left Panel (Read-Only Data)

- **Context → Token Pairs**: Example contexts from this cluster
- **Statistics**: Cluster size, unique tokens
- **Lists**: Most common tokens, datasets, patterns

### Right Panel (Editable)

- **Cluster Name**: Give the cluster a memorable name
- **Good Toggle**: Mark interesting/important clusters
- **Observations**: Your analysis notes about this cluster
- **Charts**: Visualizations (susceptibilities, PCA)

## Basic Workflow

### 1. Browse Clusters

**Navigate by:**
- Click ← → buttons
- Select from dropdown
- Use keyboard shortcuts (coming soon)

**Switch datasets:**
- Use dataset selector in header
- All your observations are saved per dataset

### 2. View Cluster Data

Each cluster shows:
- **Contexts**: Real examples from the training data
- **Size**: How many instances are in this cluster
- **Common tokens**: What tokens appear most often
- **Charts**: Technical visualizations

### 3. Add Observations

To annotate a cluster:

1. Click in the "Observations" text area
2. Type your analysis
3. Changes auto-save (you'll see "Saving..." then "Saved ✓")

**Tips for good observations:**
- Describe what patterns you see
- Note interesting contexts
- Mention hypotheses about the cluster
- Link to related clusters if relevant

**Example:**
```
Cluster 127: Article determiners

Captures "the" tokens in formal writing contexts, especially academic
papers. High susceptibility in attention heads 3.4 and 3.5, suggesting
these heads specialize in identifying article usage.

Related to cluster 89 (prepositions before articles).
```

### 4. Mark Good Clusters

Use the "Good" checkbox to flag interesting clusters:

✅ **Mark as good when:**
- Cluster shows clear, interpretable pattern
- Useful for understanding model behavior
- Worth sharing with team
- Should be included in reports

❌ **Don't mark as good:**
- Unclear or noisy clusters
- Still analyzing/uncertain
- Technical artifacts

**Good clusters appear in:**
- Google Docs summary (with [GOOD] badge)
- Future filtered views
- Team reports

### 5. Name Clusters

Give clusters descriptive names instead of just numbers:

**Good names:**
- "Newline after punctuation"
- "The/a/an articles"
- "Function calls in Python"

**Not as helpful:**
- "Cluster 42"
- "Random stuff"
- "idk"

## Collaboration Features

### Real-Time Sync

- Your changes save immediately
- Other users see updates when they reload
- Conflicts are rare (per-cluster locking)

### Conflict Resolution

If someone else edits the same cluster while you're editing:

1. You'll see a conflict modal when saving
2. Choose how to resolve:
   - **Keep My Version**: Use your edits
   - **Use Their Version**: Discard your edits
   - **Merge Both**: Combine both edits (your text + theirs)

**Best practice:** Coordinate in Slack/chat if working on same clusters.

### Google Docs Integration

All clusters with observations are automatically synced to a Google Doc:

- **View the doc**: [Ask your admin for link]
- **Updates**: Auto-synced every time someone saves
- **Manual sync**: Click "Sync Now" button
- **Format**: Organized by model with [GOOD] badges

**Note:** The Google Doc is read-only. Make edits in the web interface.

## Tips & Best Practices

### Writing Good Observations

**Do:**
- ✅ Be specific about patterns you notice
- ✅ Include context examples that stand out
- ✅ Note connections to other clusters
- ✅ Mention uncertainties or questions

**Don't:**
- ❌ Copy-paste statistics (those are already shown)
- ❌ Leave empty observations if you noticed something
- ❌ Use jargon without explaining

### Efficient Navigation

- Start with "good" clusters from Google Doc
- Use cluster numbers in discussions with team
- Bookmark interesting clusters (browser bookmarks)
- Take notes in observations for your future self

### Team Coordination

- **Daily standup**: Share interesting clusters found
- **Cluster ID references**: "Hey check out cluster 127 in pythia-160m"
- **Good toggle**: Use consistently so team knows what's validated
- **Observations**: Write for future team members, not just yourself

## Keyboard Shortcuts (Future)

Coming soon:
- `←` `→` Navigate clusters
- `Cmd/Ctrl + S` Force save
- `Cmd/Ctrl + K` Jump to cluster

## Troubleshooting

### "Session expired" error

Your login expired (24 hours). Just reload the page and enter the password again.

### Observations not saving

1. Check save status indicator
2. Verify internet connection
3. Try reloading the page
4. Contact admin if persists

### Conflict on every save

Someone else is editing the same cluster. Coordinate to work on different clusters, or choose "Use Their Version" to sync up.

### Can't see my changes

- Reload the page (Ctrl+R or Cmd+R)
- Clear browser cache if needed
- Check you're on the right dataset

### Charts not showing

- Reload the page
- Try a different browser
- Contact admin if persists

## Getting Help

- **Technical issues**: Contact [admin name]
- **How to use**: Ask in [team Slack channel]
- **Report bugs**: [GitHub issues link or email]

## Frequently Asked Questions

### Can I work offline?

Not currently. The tool requires internet to save observations.

### Will my observations be lost if I close the tab?

No - observations auto-save as you type. Safe to close anytime after "Saved ✓" appears.

### Can I delete observations?

Yes - just clear the text and save. Empty observations are hidden from Google Doc.

### Can I export observations?

Yes - they're in the Google Doc and also accessible via API (ask admin).

### How do I see who wrote what?

Observations include author metadata (visible to admins). For now, coordinate in team chat.

### Can I attach images or files?

Not currently. Use URLs to link to external resources (Imgur, Google Drive, etc.)

### What happens if two people save at the exact same time?

One save succeeds, the other gets a conflict modal. Conflicts are rare due to per-cluster locking.

## Advanced Features

### URL Parameters

Jump directly to specific clusters:

```
?dataset=pythia-160m&cluster=127
```

### Browser DevTools

View detailed cluster data:
1. Press F12 (Developer Tools)
2. Console tab
3. Type: `window.clusterCatalogue.clustersData`

### Custom Filters (Coming Soon)

- Filter by "good" clusters
- Search observations
- Sort by cluster size
- Group by patterns

## Data Structure (For Reference)

Each cluster has:
- **Read-only fields**: Size, tokens, statistics, contexts (from dataset)
- **Editable fields**: Name, observations, good toggle (your annotations)

Your observations are stored separately from the analysis data, so you can't break anything!

## Contributing

Found a bug or have a feature request?
- Ask your admin to create a GitHub issue
- Or suggest in [team chat]

## Version History

- **v2.0** (2025-12): Complete overhaul with R2 backend, Google Docs sync
- **v1.0** (2025-10): Initial version with GitHub storage

---

Happy cluster analyzing! 🔬
