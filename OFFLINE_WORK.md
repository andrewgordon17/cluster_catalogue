# Working Offline (Plane Mode)

## On the Plane

**1. Start local Worker:**
```bash
wrangler dev
```
Keep this running. It starts a local API with local R2 storage.

**2. Open the app:**
Open `index.html` directly in your browser (File > Open, or double-click it).

The app auto-detects you're running locally and uses `http://localhost:8787/api`.

**3. Work normally:**
- Browse clusters
- Make observations
- Click save
- Everything saves to LOCAL R2 (in `.wrangler/state/` directory)

## After Landing

**1. Stop wrangler dev** (Ctrl+C)

**2. Upload your local observations to production:**
```bash
node sync-local-to-production.js
```

Or sync just one model:
```bash
node sync-local-to-production.js pythia-14m
```

**3. Conflict handling:**
If someone edited the same cluster while you were offline, it auto-merges:
- **Observations**: Appended together with separator
- **Good flag**: True if either yours OR server's is true
- **Names**: One is picked (doesn't matter which)

No manual conflict resolution needed!

## Testing Before Your Flight

```bash
# Start local worker
wrangler dev

# In another terminal, check it's working
curl http://localhost:8787/api/datasets
```

Open `index.html` and try editing an observation. Should work perfectly!

## Troubleshooting

**"Local R2 directory not found"**
- Make sure you ran `wrangler dev` first
- Make at least one observation edit and save
- This creates the local R2 storage

**Upload script errors**
- Make sure you're online
- Check the production API is accessible
- Look at specific error messages for each cluster
