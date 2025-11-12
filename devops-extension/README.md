# Azure DevOps Workflow

Manage your Azure DevOps work items, sprint boards, and task status directly from Visual Studio Code.

## Features

- **Setup Wizard**: Automatically fetches and displays your projects and teams - no manual typing required
- **Sprint Board View**: View your current sprint in a dedicated panel organized by state
- **My Work Items**: See all work items assigned to you in a separate view
- **Quick Project Switching**: Switch between projects instantly with `Ctrl+Alt+P`
- **Quick Open Work Items**: Search and open work items with keyboard shortcuts
- **Dynamic State Management**: State dropdown shows only valid transitions for your workflow
- **Smart Filtering**: Hide completed/removed items by default (configurable)
- **Auto-refresh**: Keep your work items up to date automatically
- **Status Bar Integration**: See current project at a glance

## Setup

### First Time Setup

1. Install the extension
2. Run the Setup Wizard:
   - Press `F1` and type "Azure DevOps: Setup Wizard"
   - Enter your organization name (e.g., "myorg" from dev.azure.com/myorg)
   - Enter your Personal Access Token
   - **Select your project from the dropdown** (fetched automatically)
   - Select your team (optional)

That's it! No need to manually type project names.

### Getting a Personal Access Token

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create a new token with **"Work Items (Read & Write)"** permissions
3. Copy the token and paste it in the setup wizard

## Keyboard Shortcuts

- `Ctrl+Alt+S` (Mac: `Cmd+Alt+S`): Open Sprint Board
- `Ctrl+Alt+O` (Mac: `Cmd+Alt+O`): Quick Open Work Item
- `Ctrl+Alt+U` (Mac: `Cmd+Alt+U`): Change Work Item Status
- `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`): **Quick Switch Project**

## Usage

### Viewing Work Items

1. Open the Azure DevOps panel from the Activity Bar
2. View your sprint board organized by state (To Do, In Progress, Done, Removed)
3. View your assigned work items in the "My Work Items" section
4. Click on any work item to view full details in a webview panel

### Switching Projects

Press `Ctrl+Alt+P` to quickly switch between projects:
- Shows your 10 most recently used projects
- One-click switching
- Automatically reloads work items
- Current project shown in status bar

### Changing Work Item Status

Two methods:
1. **Via webview**: Open a work item and use the state dropdown
2. **Via command**: Press `Ctrl+Alt+U` and select work item and new state

The state dropdown dynamically shows only valid state transitions for your Azure DevOps workflow configuration.

### Filtering Work Items

Use the Command Palette:
- "Toggle Show/Hide Completed Items" - Hide/show Done/Closed/Resolved items
- "Toggle Show/Hide Removed Items" - Hide/show Removed/Cut items
- "Clear All Filters" - Show all work items

## Extension Settings

This extension contributes the following settings:

- `azureDevOps.organization`: Your Azure DevOps organization name
- `azureDevOps.pat`: Personal Access Token (stored securely)
- `azureDevOps.autoRefresh`: Enable/disable auto-refresh (default: true)
- `azureDevOps.refreshInterval`: Refresh interval in seconds (default: 300)
- `azureDevOps.hideCompletedItems`: Hide completed work items (default: true)
- `azureDevOps.hideRemovedItems`: Hide removed work items (default: true)
- `azureDevOps.showOnlyAssignedToMe`: In Sprint Board, show only items assigned to me (default: false)

**Note**: Project and team are managed via the Setup Wizard and Quick Switch, not manually in settings.

## Requirements

- Azure DevOps account
- Personal Access Token with Work Items (Read & Write) permissions

## Known Issues

None currently. Please report issues on GitHub.

## Release Notes

### 0.0.1

Initial release with:
- Sprint board and My Work Items views
- Setup wizard with automatic project fetching
- Quick project switching
- Dynamic state transitions from Azure DevOps API
- Smart filtering for completed and removed items
- Keyboard shortcuts for all major actions
- Auto-refresh functionality
