# Quick Start - Testing in 5 Minutes

## Step 1: Open the Project (30 seconds)

```bash
cd e:/visual.workflow/devops-extension
code .
```

## Step 2: Launch Extension (10 seconds)

Press **`F5`** on your keyboard

→ A new window opens with "[Extension Development Host]" in the title

## Step 3: Configure (2 minutes) - NEW EASY SETUP WIZARD!

**🎉 A Setup Wizard appears automatically!**

Just follow the prompts:

1. Click **"Start Setup"**
2. **Enter organization name** (e.g., "mycompany" from dev.azure.com/mycompany)
3. **Paste your Personal Access Token (PAT)**
4. **Pick your project from dropdown** - No typing needed!
5. **Choose team** (or skip it) - From a dropdown list!
6. **Done!** - Work items load automatically

**That's it! No manual configuration needed!**

---

<details>
<summary>📋 Alternative: Manual Setup (if you prefer to use Settings)</summary>

1. Press **`Ctrl+,`** (opens Settings)
2. Search for: **"Azure DevOps"**
3. Fill in:
   - Organization: your-org-name
   - Project: your-project-name  
   - Team: your-team-name (optional)
   - Pat: your-personal-access-token
</details>


### Getting Your PAT (Personal Access Token)

1. Go to: `https://dev.azure.com/YOUR-ORG`
2. Click: **User Settings** (gear icon) → **Personal Access Tokens**
3. Click: **+ New Token**
4. Name: `VS Code Extension`
5. Scopes: Check **"Work Items (Read, Write, & Manage)"**
6. Click: **Create**
7. **Copy the token** (you won't see it again!)
8. Paste into VS Code settings

## Step 4: Test! (2 minutes)

### View Your Sprint Board

- Look at the **left sidebar** (Activity Bar)
- Click the **Azure DevOps shield icon**
- See your work items organized by status!

### Try Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+S` | Open Sprint Board |
| `Ctrl+Alt+O` | Quick search work items |
| `Ctrl+Alt+U` | Change work item status |

### Try Commands

Press **`Ctrl+Shift+P`** and type:

- `Azure DevOps: Open Sprint Board`
- `Azure DevOps: Create Work Item`
- `Azure DevOps: Refresh Work Items`

## Visual Guide

```
┌─────────────────────────────────────────────────────┐
│ VS Code (Your Development Window)                  │
│                                                     │
│  1. Open: e:/visual.workflow/devops-extension      │
│  2. Press F5                                        │
│     ↓                                               │
└─────────────────────────────────────────────────────┘
              ↓ Opens ↓
┌─────────────────────────────────────────────────────┐
│ [Extension Development Host] - New Window           │
│                                                     │
│  ┌──────────┐                                      │
│  │ Activity │  ┌─────────────────────────────────┐ │
│  │   Bar    │  │ Azure DevOps Panel              │ │
│  │          │  │                                 │ │
│  │  📁 Files│  │ ┌─ Sprint Board ──────────────┐│ │
│  │  🔍 Search│ │ │                              ││ │
│  │  🐛 Debug │  │ │ ▼ To Do                     ││ │
│  │  🧩 Ext   │  │ │   #123 - Fix login bug      ││ │
│  │          │  │ │   #124 - Add feature X      ││ │
│  │  🛡️ DevOps│ │ │                              ││ │
│  │    ↑     │  │ │ ▼ In Progress               ││ │
│  │  Click!  │  │ │   #125 - Update docs        ││ │
│  │          │  │ │                              ││ │
│  └──────────┘  │ │ ▼ Done                       ││ │
│                │ │   #126 - Deploy v1.0        ││ │
│                │ └──────────────────────────────┘│ │
│                │                                 │ │
│                │ ┌─ My Work Items ─────────────┐│ │
│                │ │  #123 - Fix login bug       ││ │
│                │ │  #125 - Update docs         ││ │
│                │ └─────────────────────────────┘│ │
│                └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Troubleshooting

### Can't See Azure DevOps Icon?

1. Check terminal for errors
2. Press **`Ctrl+R`** to reload
3. Or stop debugging and press **`F5`** again

### "401 Unauthorized" Error?

- Check your PAT is correct
- Verify PAT hasn't expired
- Make sure PAT has "Work Items" permissions

### No Work Items Showing?

- Click the **refresh button** (🔄) in the panel header
- Verify you have items in your current sprint
- Check settings are correct (org, project)

### Extension Not Working After Code Changes?

1. Press **`Ctrl+R`** in Extension Development Host window
2. Or restart debugging: **`Shift+F5`** then **`F5`**

## Pro Tips

### Watch Mode (Auto-Compile)

Instead of running `npm run compile` every time:

```bash
npm run watch
```

Now your TypeScript auto-compiles on save! Just press `Ctrl+R` to reload.

### Debug Console

In your development window (not Extension Development Host):
- View → Debug Console
- See all console.log() outputs and errors

### Developer Tools

In Extension Development Host:
- Press **`Ctrl+Shift+I`**
- View console logs, network requests, etc.

### Breakpoints

1. In your development window, click in the margin next to any line
2. Red dot appears = breakpoint set
3. Code execution pauses there when reached
4. Inspect variables, step through code

## Next Steps

Once everything works:

1. **Customize** - Modify the code to fit your needs
2. **Package** - Create a .vsix file: `npm install -g @vsce/vsce && vsce package`
3. **Share** - Share the .vsix with your team
4. **Publish** - Publish to VS Code Marketplace: `vsce publish`

## Reference

Full documentation: See [TESTING.md](./TESTING.md)

---

**That's it! You should now see your Azure DevOps work items in VS Code!**
