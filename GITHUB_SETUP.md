# GitHub Integration Setup Guide

This guide will help you set up GitHub as a backend for collaborative observations in the Cluster Catalogue.

## Why GitHub Integration?

- **Collaborative**: Multiple researchers can share observations
- **Version Controlled**: Track changes and history
- **Persistent**: Data survives browser clearing
- **Free**: Public repositories are free
- **Accessible**: View/edit observations directly on GitHub

## Setup Steps

### 1. Create a GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `cluster-observations` (or any name you prefer)
3. Make it **public** for easy sharing, or **private** for restricted access
4. Initialize with a README (optional)

### 2. Generate a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "Cluster Catalogue"
4. Set expiration (recommend 90 days or No expiration for convenience)
5. Select these scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `public_repo` (Access public repositories)
6. Click "Generate token"
7. **Copy the token immediately** (you won't see it again!)

### 3. Configure the Application

Edit `app.js` and update these values:

```javascript
this.githubConfig = {
    owner: 'YOUR_GITHUB_USERNAME',    // Replace with your GitHub username
    repo: 'cluster-observations',     // Replace with your repo name
    token: null,
    branch: 'main',
    filePath: 'observations.json'
};
```

### 4. Add Tokens for Team Members

Update the `GITHUB_TOKENS` object in `app.js`:

```javascript
const GITHUB_TOKENS = {
    'cluster123': 'ghp_your_token_here',           // Your token
    'research2024': 'ghp_collaborator_token_here', // Collaborator's token
    'lang3': 'ghp_another_token_here'              // Another collaborator's token
};
```

## Usage Options

### Option 1: Pre-configured Passwords (Recommended)
- Configure tokens in the code for specific passwords
- Share passwords with team members
- Simple login experience

### Option 2: Direct Token Entry
- Users paste their GitHub token directly in the password field
- No need to pre-configure tokens
- More secure (tokens not stored in code)

## File Structure

The application will create this structure in your GitHub repository:

```
your-repo/
└── observations.json
```

The observation files in the `observations/` folder contain dataset-specific cluster observations:

**observations/observations-pythia-14m.json**:
```json
{
  "0": {
    "name": "Spacing Cluster",
    "observations": "This cluster primarily contains newline characters in 14M model...",
    "lastModified": "2024-01-15T10:30:00.000Z",
    "author": "research2024"
  }
}
```

**observations/observations-pythia-31m.json**:
```json
{
  "5": {
    "name": "Code Functions",
    "observations": "31M model shows different clustering for function calls...",
    "lastModified": "2024-01-15T11:45:00.000Z",
    "author": "cluster123"
  }
}
```

## Collaboration Workflow

1. **First Setup**: One team member creates the repository and shares access
2. **Token Generation**: Each collaborator generates their own GitHub token
3. **Access**: Team members use their assigned password or paste their token
4. **Work**: Add observations to clusters - they're automatically saved to GitHub
5. **Sync**: Changes from other team members are loaded when you refresh/restart
6. **Backup**: Local storage always maintains a backup copy

## Security Considerations

### For Public Repositories:
- Observations will be publicly visible
- Anyone can see the data (but only token holders can edit)
- Good for open research projects

### For Private Repositories:
- Only repository collaborators can see observations
- More secure for sensitive research
- Requires GitHub Pro for multiple private collaborators

### Token Security:
- Never share tokens publicly
- Use separate tokens for each person
- Regularly rotate tokens (every 90 days recommended)
- Revoke tokens when team members leave

## Troubleshooting

### "Failed to save to GitHub"
- Check your GitHub token is valid
- Verify repository name and username in config
- Ensure token has correct permissions (`repo` scope)

### "403 Forbidden"
- Token may be expired or invalid
- Check repository permissions
- Verify token scopes include `repo`

### "404 Not Found"
- Repository name or username incorrect in config
- Repository may be private but token lacks access

### Fallback Mode
- If GitHub fails, observations save locally
- App will show "Saved locally (GitHub failed)"
- Try refreshing or checking your connection

## Advanced Features

### View Changes on GitHub
Visit your repository to see:
- Commit history of observation changes
- Who made what changes when
- Raw JSON data
- File edit history

### Manual Editing
You can edit `observations.json` directly on GitHub:
1. Go to your repository
2. Click on `observations.json`
3. Click the pencil icon to edit
4. Make changes and commit

### Backup
The observations file serves as a complete backup:
- Download the JSON file
- Import into other tools
- Archive for long-term storage

## Cost
- **Public repositories**: Completely free
- **Private repositories**: Free for personal use, paid for organizations
- **GitHub tokens**: Free
- **API calls**: Generous free tier (5000 requests/hour)

This setup provides a robust, free solution for collaborative research data collection!