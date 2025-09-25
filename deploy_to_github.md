# Deploy to GitHub Repository

This guide shows how to set up your `andrewgordon17/cluster-catalogue` repository with all necessary files.

## 📋 Files to Upload to Repository

### Core Application Files
```
andrewgordon17/cluster-catalogue/
├── index.html              # Copy from cluster_catalogue/index.html
├── app.js                  # Copy from cluster_catalogue/app.js
├── package.json           # Copy from cluster_catalogue/package.json
├── model_cfg.json         # Copy from cluster_catalogue/model_cfg.json
├── README.md              # Copy from cluster_catalogue/README.md
└── GITHUB_SETUP.md        # Copy from cluster_catalogue/GITHUB_SETUP.md
```

### Dataset Directory
```
datasets/
├── README.md              # Copy from cluster_catalogue/datasets/README.md
├── pythia-14m.json       # Copy from cluster_catalogue/datasets/pythia-14m.json
└── pythia-31m.json       # Copy from cluster_catalogue/datasets/pythia-31m.json
```

### Observations Directory (Auto-created)
```
observations/
├── observations-pythia-14m.json    # Auto-created by application
└── observations-pythia-31m.json    # Auto-created by application
```

## 🚀 Quick Setup Commands

If you have git command line access:

```bash
# Navigate to your local cluster_catalogue directory
cd /Users/andrewgordon/Documents/Lang3/cluster_catalogue

# Initialize git repository
git init
git remote add origin https://github.com/andrewgordon17/cluster-catalogue.git

# Add all files
git add .

# Commit files
git commit -m "Initial cluster catalogue setup

🚀 Features:
- Interactive cluster visualization
- Multi-dataset support (Pythia 14M, 31M)
- Collaborative observations via GitHub
- Automatic chart generation
- Context analysis tools

📊 Generated with Claude Code"

# Push to GitHub
git push -u origin main
```

## 📁 Manual Upload Steps

If you prefer manual upload via GitHub web interface:

1. **Go to**: https://github.com/andrewgordon17/cluster-catalogue

2. **Upload Core Files**:
   - Click "Add file" → "Upload files"
   - Drag and drop: `index.html`, `app.js`, `package.json`, `model_cfg.json`, `README.md`, `GITHUB_SETUP.md`

3. **Create datasets/ folder**:
   - Click "Create new file"
   - Type: `datasets/README.md`
   - Copy content from your local `datasets/README.md`
   - Commit

4. **Upload dataset files**:
   - Navigate to `datasets/` folder
   - Upload: `pythia-14m.json`, `pythia-31m.json`

5. **Create observations/ folder** (optional - will be auto-created):
   - Click "Create new file"
   - Type: `observations/.gitkeep`
   - Add comment: "Folder for team observations"
   - Commit

## ✅ Verification

After setup, your repository should have this structure:

```
andrewgordon17/cluster-catalogue/
├── index.html
├── app.js
├── package.json
├── model_cfg.json
├── README.md
├── GITHUB_SETUP.md
├── datasets/
│   ├── README.md
│   ├── pythia-14m.json
│   └── pythia-31m.json
└── observations/
    └── .gitkeep (optional)
```

## 🌐 Access Your Application

Once deployed, anyone can:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/andrewgordon17/cluster-catalogue.git
   cd cluster-catalogue
   python -m http.server 8000
   ```

2. **Or use GitHub Pages** (if enabled):
   - Go to repository Settings → Pages
   - Enable Pages from `main` branch
   - Access at: `https://andrewgordon17.github.io/cluster-catalogue`

## 🔐 Team Access

Share with collaborators:
1. **Repository URL**: https://github.com/andrewgordon17/cluster-catalogue
2. **Setup Instructions**: Point them to the README.md
3. **GitHub Tokens**: Help them generate tokens for collaborative observations
4. **Passwords**: Share the login passwords or tokens

Your repository will now be a complete, runnable project that anyone can clone and use!