# Azure DevOps Workflow

Manage your Azure DevOps work items, sprint boards, and task status directly from Visual Studio Code with AI-powered assistance from GitHub Copilot.

## Features

- **Setup Wizard**: Automatically fetches and displays your projects and teams - no manual typing required
- **Sprint Board View**: View your current sprint in a dedicated panel organized by state
- **My Work Items**: See all work items assigned to you in a separate view
- **Quick Project Switching**: Switch between projects instantly with `Ctrl+Alt+P`
- **Quick Open Work Items**: Search and open work items with keyboard shortcuts
- **AI-Powered Features**: Generate descriptions and implementation plans using GitHub Copilot
- **Dynamic State Management**: State dropdown shows only valid transitions for your workflow
- **Smart Filtering**: Hide completed/removed items by default (configurable)
- **Auto-refresh**: Keep your work items up to date automatically
- **Status Bar Integration**: See current project at a glance
- **Parent Work Item Navigation**: Click on parent work items to view their details

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

### Optional: AI-Powered Features

This extension supports AI-powered work item descriptions and implementation plans using **GitHub Copilot**.

#### Setting Up GitHub Copilot

1. Install the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
2. Sign in to your GitHub account with an active Copilot subscription
3. The extension will automatically detect and use Copilot

#### AI Features Available:

- **✨ Generate Description**: AI-powered generation of clear, concise work item descriptions
  - Click the "Generate with AI" button in the work item details view
  - AI analyzes the title, type, area path, iteration, and tags to create contextual descriptions
  - Review and accept, edit, or cancel the generated description

- **🎯 Generate Implementation Plan**: Get detailed implementation plans with:
  - Analysis of requirements and considerations
  - Step-by-step implementation guide with technical details
  - Testing strategy and approach
  - Potential challenges and gotchas
  - Complexity estimation (Simple/Medium/Complex)

- **💡 Smart Context Awareness**: AI uses your work item metadata to generate relevant suggestions:
  - Work item title and type (Task, User Story, Bug, Feature, etc.)
  - Area path (team/feature context)
  - Iteration path (sprint context)
  - Tags and existing description (for improvements)

#### Managing AI Features:

Use the Command Palette to manage AI settings:
- **"Azure DevOps: Show AI Status"** - Check if Copilot is installed and available
- **"Azure DevOps: Toggle AI Suggestions"** - Enable or disable AI features

## Keyboard Shortcuts

- `Ctrl+Alt+S` (Mac: `Cmd+Alt+S`): Open Sprint Board
- `Ctrl+Alt+O` (Mac: `Cmd+Alt+O`): Quick Open Work Item
- `Ctrl+Alt+U` (Mac: `Cmd+Alt+U`): Change Work Item Status
- `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`): Quick Switch Project

## Usage

### Viewing Work Items

1. Open the Azure DevOps panel from the Activity Bar (look for the Azure DevOps icon)
2. View your sprint board organized by state:
   - **To Do**: Work items not yet started
   - **In Progress**: Work items currently being worked on
   - **Done**: Completed work items (hidden by default)
   - **Removed**: Removed or cut work items (hidden by default)
3. View your assigned work items in the "My Work Items" section
4. Click on any work item to view full details in a webview panel

### Work Item Details View

When you click on a work item, you'll see:
- Work item ID, title, type, and state
- Assigned to, created date, and last changed date
- Area path and iteration path
- Tags and remaining work hours
- Full description with HTML rendering
- Parent work item link (if applicable)
- Quick actions:
  - **State dropdown**: Change work item state with valid transitions only
  - **Refresh button**: Reload work item data
  - **Generate Description button**: Create AI-powered descriptions (if AI is enabled)
  - **Generate Plan button**: Create implementation plans (if AI is enabled)
  - **Open in Browser**: View work item in Azure DevOps web portal

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

### Generating Descriptions with AI

When viewing a work item:
1. Click the "Generate Description with AI" button (sparkle icon)
2. If AI is disabled, you'll be prompted to enable it
3. If Copilot is not available, you'll be prompted to install it
4. Wait 2-3 seconds while Copilot generates a context-aware description
5. Review the generated description
6. Choose to Accept, Edit, or Cancel

**AI uses the following context:**
- Work item title
- Work item type (Task, User Story, Bug, Feature, etc.)
- Area path (team/feature context)
- Iteration path (sprint context)
- Tags
- Existing description (for improvement suggestions)

**Benefits of AI-Generated Descriptions:**
- Consistent, professional descriptions across all work items
- Saves time on documentation
- Ensures all team members understand work item requirements
- Contextual suggestions based on your project metadata

### Generating Implementation Plans with AI

1. Open a work item in the details view
2. Click the "Plan" button
3. Copilot analyzes the work item and generates a comprehensive plan
4. The plan opens in a dedicated view with formatted markdown
5. Use the plan to guide your implementation

**Implementation plans include:**
- **Analysis**: Understanding of requirements and key considerations
- **Implementation Steps**: Numbered, actionable steps with technical details
- **Testing Strategy**: How to validate the changes
- **Potential Challenges**: Things to watch out for and gotchas
- **Estimated Complexity**: Simple, Medium, or Complex rating

### Filtering Work Items

Use the Command Palette (`F1`):
- **"Toggle Show/Hide Completed Items"** - Show/hide Done, Closed, and Resolved items
- **"Toggle Show/Hide Removed Items"** - Show/hide Removed and Cut items
- **"Clear All Filters"** - Show all work items regardless of state

Default behavior:
- Completed items are hidden (configurable via `azureDevOps.hideCompletedItems`)
- Removed items are hidden (configurable via `azureDevOps.hideRemovedItems`)

### Auto-Refresh

Work items automatically refresh every 5 minutes by default. You can:
- Change the interval in settings (`azureDevOps.refreshInterval`)
- Disable auto-refresh (`azureDevOps.autoRefresh`)
- Manually refresh using the refresh button or command

## Extension Settings

This extension contributes the following settings:

### Azure DevOps Settings

- `azureDevOps.organization`: Your Azure DevOps organization name
- `azureDevOps.pat`: Personal Access Token (stored securely)
- `azureDevOps.project`: Current project name (managed by Setup Wizard and Quick Switch)
- `azureDevOps.team`: Current team name (managed by Setup Wizard)
- `azureDevOps.autoRefresh`: Enable/disable auto-refresh (default: `true`)
- `azureDevOps.refreshInterval`: Refresh interval in seconds (default: `300`)
- `azureDevOps.hideCompletedItems`: Hide completed work items (default: `true`)
- `azureDevOps.hideRemovedItems`: Hide removed work items (default: `true`)
- `azureDevOps.showOnlyAssignedToMe`: In Sprint Board, show only items assigned to me (default: `false`)

### AI Settings

- `azureDevOps.enableAiSuggestions`: Enable AI-powered suggestions for work item descriptions using GitHub Copilot (default: `true`)

**Note**: Project and team settings are managed via the Setup Wizard and Quick Switch commands, not manually in settings.

## Requirements

- Visual Studio Code 1.85.0 or higher
- Azure DevOps account
- Personal Access Token with Work Items (Read & Write) permissions
- (Optional) GitHub Copilot subscription for AI features

## Privacy & Security

- Your Personal Access Token is stored securely in VS Code's configuration
- AI features use GitHub Copilot's Language Model API (vscode.lm)
- Work item data is sent to GitHub Copilot only when you explicitly request AI features
- No data is stored or logged by this extension beyond VS Code's standard configuration

## Known Issues

None currently. Please report issues on the [GitHub repository](https://github.com/hybriden/Visual.Workflow/issues).

## Release Notes

### 0.1.1

**AI Integration Updates:**
- Removed experimental Claude Code support (Language Model API only supports Copilot)
- Simplified AI integration to focus exclusively on GitHub Copilot
- Improved error messages for Copilot availability
- Better detection of Copilot installation status
- Fixed "plugin not installed" errors
- Updated all AI-related commands and views

### 0.1.0

**Major AI Features Release:**
- Added GitHub Copilot integration for AI-powered work item descriptions
- Added implementation plan generation with detailed technical guidance
- Added AI-powered field suggestions
- Enhanced work item details view with AI buttons
- Added dedicated plan view panel with markdown rendering
- Added AI status and configuration commands
- Enabled Language Model API proposal for Copilot access

### 0.0.1

**Initial Release:**
- Sprint board and My Work Items views
- Setup wizard with automatic project fetching
- Quick project switching
- Dynamic state transitions from Azure DevOps API
- Smart filtering for completed and removed items
- Keyboard shortcuts for all major actions
- Auto-refresh functionality
- Status bar integration

## Feedback & Contributing

Found a bug or have a feature request? Please open an issue on the [GitHub repository](https://github.com/hybriden/Visual.Workflow/issues).

## License

MIT

---

**Enjoy managing your Azure DevOps workflow from VS Code!**
