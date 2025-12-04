# Cluster Catalogue v2.0

A collaborative web application for viewing and annotating cluster data from language model analysis.

## ✨ What's New in v2.0

- ✅ **Cloudflare R2 backend** - Fast, reliable cloud storage
- ✅ **Per-cluster storage** - Eliminates concurrency conflicts
- ✅ **"Good" cluster toggle** - Flag interesting clusters
- ✅ **Google Docs integration** - Auto-sync observations
- ✅ **Config-driven fields** - Add statistics without code changes
- ✅ **Optimistic locking** - Conflict detection and resolution
- ✅ **Modular architecture** - Clean, maintainable code

## Quick Start

### For Team Members

1. Go to your cluster catalogue URL
2. Enter the shared password (ask admin)
3. Browse clusters and add observations
4. Mark interesting clusters with "Good" toggle
5. Changes auto-save!

📖 **Full guide:** [Team User Guide](./docs/TEAM_USER_GUIDE.md)

### For Administrators

**One-time setup (30 minutes):**

1. **Migrate data:**
   ```bash
   python3 migrate.py
   ```

2. **Set up R2:**
   ```bash
   npm install -g wrangler
   wrangler r2 bucket create cluster-catalogue
   ./upload-to-r2.sh
   ```

3. **Deploy Workers:**
   ```bash
   wrangler secret put PASSWORD_HASH
   wrangler secret put SESSION_SECRET
   wrangler deploy
   ```

📖 **Detailed guides:**
- [R2 Setup](./docs/R2_SETUP.md)
- [Workers Setup](./docs/WORKERS_SETUP.md)
- [Google Docs Setup](./docs/GOOGLE_DOCS_SETUP.md) (optional)

## Documentation

### 📚 Setup Guides
- **[R2 Storage Setup](./docs/R2_SETUP.md)** - Configure Cloudflare R2
- **[Cloudflare Workers Setup](./docs/WORKERS_SETUP.md)** - Deploy backend API
- **[Google Docs Integration](./docs/GOOGLE_DOCS_SETUP.md)** - Auto-sync observations

### 📖 Usage Guides
- **[Team User Guide](./docs/TEAM_USER_GUIDE.md)** - How to use the catalogue
- **[Adding New Fields](./docs/ADDING_FIELDS.md)** - Add statistics without coding

## Key Features

### 🔐 Single Shared Password
Simple team access - everyone uses the same password. No GitHub tokens to manage.

### 🎯 "Good" Cluster Toggle
Mark clusters that show clear, interpretable patterns. These appear with [GOOD] badges in reports.

### 📝 Google Docs Integration
All clusters with observations automatically sync to a Google Doc, organized by model.

### 🔧 Config-Driven Fields
Add new statistics by editing a JSON file - no code changes required!

**Example:** Add coherence score
```json
{
  "key": "coherence_score",
  "type": "stat",
  "label": "Coherence Score"
}
```

Upload config → Field appears automatically!

### 🤝 Conflict Resolution
If two people edit the same cluster simultaneously:
- System detects conflict
- Shows both versions
- User chooses: Keep Mine | Use Theirs | Merge

## Architecture

### Data Storage (Cloudflare R2)
```
cluster-catalogue/
├── datasets/              # Read-only cluster data
│   └── pythia-*.json
├── observations/          # Per-cluster editable files
│   └── pythia-*/cluster-*.json
└── config/               # Field definitions
```

**Key improvement:** Per-cluster files eliminate most conflicts!

### Backend (Cloudflare Workers)
- REST API with JWT authentication
- Optimistic locking with ETags
- Google Docs sync

### Frontend (Pure JavaScript)
- Modular architecture (5 separate modules)
- Config-driven rendering
- Conflict resolution UI

## Adding New Fields

Want to add a new statistic or chart? Just 3 steps:

1. **Add data** to dataset JSON
2. **Update** `config/display-fields.json`
3. **Upload** both files to R2

No code changes needed! See [Adding Fields Guide](./docs/ADDING_FIELDS.md).

## Costs

**Free tier covers typical usage:**
- R2: 10GB storage free/month
- Workers: 100k requests/day free
- Google Docs API: Free

**Typical monthly cost: $0**

## Migration from v1

Have existing GitHub-based data? Migration is easy:

```bash
python3 migrate.py          # Convert data format
./upload-to-r2.sh           # Upload to R2
wrangler deploy             # Deploy backend
```

All existing observations are preserved!

## Development

### Local Development
```bash
# Terminal 1: Start Workers
wrangler dev

# Terminal 2: Serve frontend
python -m http.server 8080

# Open http://localhost:8080
```

### Project Structure
- `app.js` - Main controller (400 lines)
- `api-client.js` - API communication
- `field-renderer.js` - Config-driven rendering
- `conflict-resolver.js` - Conflict handling
- `auth.js` - Authentication
- `workers/api.js` - Backend API

## API Endpoints

```
POST   /api/auth                               # Login
GET    /api/datasets                           # List datasets
GET    /api/datasets/{model}                   # Get clusters
GET    /api/observations/{model}               # Get observations
PUT    /api/observations/{model}/{cluster}     # Update observation
POST   /api/google-docs/trigger                # Sync to Docs
```

## Security

- Password hashed (SHA-256) in Workers secrets
- JWT tokens (24hr expiry)
- Per-cluster ETags for conflict detection
- CORS same-origin only
- Service account for Google Docs

## Support

- **Setup help:** See documentation guides above
- **Bug reports:** [Create GitHub issue or contact admin]
- **Questions:** [Team Slack channel]

## Credits

Built for language model interpretability research.

**Version 2.0** - December 2025

---

**Need help?** Start with the [Team User Guide](./docs/TEAM_USER_GUIDE.md)!
