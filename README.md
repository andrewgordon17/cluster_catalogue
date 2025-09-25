# Cluster Catalogue

A collaborative web application for exploring and cataloguing neural network cluster analysis data with interactive visualization and team-based observation recording.

## 🚀 Features

- **📊 Interactive Visualization**: Explore cluster data with dynamic charts and statistics
- **📝 Context Analysis**: View context → next token pairs with highlighted next tokens
- **📈 Susceptibility Plots**: Mean susceptibilities with error bars based on model architecture
- **👥 Collaborative Notes**: Team-based observations with GitHub integration
- **🔄 Multi-Dataset Support**: Seamlessly switch between different model analyses (Pythia 14M, 31M, etc.)
- **🎯 Smart Navigation**: Easy browsing with dropdown selectors and arrow navigation
- **💾 Persistent Storage**: Observations saved both locally and to GitHub for team collaboration
- **🔐 Access Control**: Password protection with GitHub token integration

## 📋 Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.x (for local development server)
- GitHub account (for collaborative features)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/andrewgordon17/cluster-catalogue.git
cd cluster-catalogue
```

### 2. Start Local Server

```bash
# Using Python (recommended)
python -m http.server 8000

# Alternative: using npm
npm run dev
```

### 3. Open in Browser

Navigate to `http://localhost:8000`

## 🔑 Access Methods

### Built-in Passwords
- `rainbowserpent`
- `cluster123`
- `research2024`
- `lang3`

### GitHub Integration (Recommended for Teams)
1. **Generate a Personal Access Token**:
   - Go to GitHub Settings → Developer Settings → Personal Access Tokens
   - Create new token with `repo` scope
   - Copy the token (starts with `ghp_`)

2. **Login Options**:
   - **Direct Entry**: Paste your GitHub token in the password field
   - **Pre-configured**: Add your token to `GITHUB_TOKENS` in `app.js`

## 📁 Repository Structure

```
cluster-catalogue/
├── index.html              # Main application interface
├── app.js                  # Core application logic
├── package.json           # Project configuration
├── model_cfg.json         # Model architecture definitions
├── datasets/              # Cluster analysis data
│   ├── pythia-14m.json   # 14M parameter model clusters
│   ├── pythia-31m.json   # 31M parameter model clusters
│   └── README.md         # Dataset documentation
├── observations/          # Team observations (auto-created)
│   ├── observations-pythia-14m.json
│   └── observations-pythia-31m.json
├── README.md             # This file
└── GITHUB_SETUP.md      # Detailed GitHub setup guide
```

## 🎯 Usage Guide

### Basic Navigation
1. **Select Dataset**: Use the first dropdown to choose your model (Pythia 14M, 31M, etc.)
2. **Browse Clusters**: Use the cluster dropdown or arrow buttons (← →) to navigate
3. **View Details**: Each cluster shows:
   - Context → next token examples (with highlighted tokens)
   - Statistical summaries (size, unique tokens, patterns)
   - Mean susceptibilities chart with error bars

### Recording Observations
1. **Edit Cluster Names**: Give meaningful names to interesting clusters
2. **Add Observations**: Record your analysis in the observations text area
3. **Auto-save**: Changes save automatically when you modify fields
4. **Team Sync**: With GitHub integration, observations sync across team members

### Dataset Management
- **Add New Datasets**: Drop properly formatted JSON files in the `datasets/` folder
- **File Naming**: Use pattern `model-name.json` (e.g., `pythia-70m.json`)
- **Auto-Detection**: New datasets appear automatically in the dropdown

## 📊 Data Format

Cluster data files should follow this structure:

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
  }
}
```

## ⚙️ Configuration

### Adding Team Members
Update the `GITHUB_TOKENS` object in `app.js`:

```javascript
const GITHUB_TOKENS = {
    'team_member_1': 'ghp_their_token_here',
    'team_member_2': 'ghp_another_token_here'
};
```

### Model Configurations
Add new models to `model_cfg.json`:

```json
{
    "your-model-name": {
        "n_heads": 8,
        "n_layers": 12,
        "checkpoint": 100000
    }
}
```

## 🚀 Deployment Options

### GitHub Pages
1. Enable GitHub Pages in repository settings
2. Set source to `main` branch
3. Access via `https://yourusername.github.io/cluster-catalogue`

### Netlify/Vercel
1. Connect repository to hosting service
2. Set build command to `echo "Static site"`
3. Deploy automatically on commits

### Self-Hosted
1. Copy files to web server
2. Serve static files from root directory
3. No backend server required

## 🤝 Collaboration Features

- **Real-time Observations**: Team members see each other's notes
- **Dataset Isolation**: Separate observations for each model/dataset
- **Version Control**: Full history of changes via GitHub
- **Conflict Resolution**: Last-write-wins with local backup
- **Access Control**: Token-based authentication

## 🛠️ Development

### Local Development
```bash
# Start development server
python -m http.server 8000

# Open in browser
open http://localhost:8000
```

### Adding New Features
1. Edit `app.js` for functionality
2. Update `index.html` for UI changes
3. Modify `package.json` for dependencies
4. Test across different browsers

## 📝 License

MIT License - see repository for details

## 🆘 Support

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: See `GITHUB_SETUP.md` for detailed setup
- **Contributing**: Pull requests welcome

## 🔧 Browser Compatibility

- ✅ Chrome 70+
- ✅ Firefox 65+
- ✅ Safari 12+
- ✅ Edge 79+
- ❌ Internet Explorer (not supported)