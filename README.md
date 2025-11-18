# Azure DevOps Workflow

Manage your Azure DevOps work items, sprint boards, and task status directly from Visual Studio Code with AI-powered assistance from GitHub Copilot.

## Features

### Core Features
- **Setup Wizard**: Automatically fetches and displays your projects and teams - no manual typing required
- **Sprint Board View**: View your current sprint in a dedicated panel organized by state
- **My Work Items**: See all work items assigned to you in a separate view
- **Quick Project Switching**: Switch between projects instantly with `Ctrl+Alt+P`
- **Quick Open Work Items**: Search and open work items with keyboard shortcuts
- **Smart Filtering**: Hide completed/removed items by default (configurable)
- **Auto-refresh**: Keep your work items up to date automatically
- **Status Bar Integration**: See current project at a glance

### Work Item Management
- **Inline Actions**: Add/remove work items to/from sprint directly in work item view
- **Set Estimates**: Quick estimate dialog to set remaining work hours
- **Dynamic State Management**: State dropdown shows only valid transitions for your workflow
- **Parent Work Item Navigation**: Click on parent work items to view their details
- **Create Child Tasks**: Right-click any work item to add tasks underneath
- **Auto-Assignment**: New work items automatically assigned to you

### Comments & Collaboration
- **Add Comments**: Comment directly on work items from VS Code
- **Delete Comments**: Remove comments with confirmation
- **Real-time Updates**: Comments refresh automatically after changes

### Context Menus
- **Sprint Board**: Right-click work items to remove from sprint or change status
- **My Work Items**: Right-click to add to sprint, change status, or create child tasks
- **Quick Actions**: All common operations accessible via right-click

### AI-Powered Features
- **Generate Descriptions**: AI-powered generation using GitHub Copilot
- **Implementation Plans**: Get detailed implementation plans with technical guidance
- **Smart Context Awareness**: AI uses work item metadata for relevant suggestions

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
- Comments section with add/delete functionality
- Quick actions (at the top):
  - **State dropdown**: Change work item state with valid transitions only
  - **Add to Sprint**: Add work item to current sprint (if not already in it)
  - **Remove from Sprint**: Remove work item from current sprint (if in it)
  - **Set Estimate**: Quick dialog to set remaining work hours
  - **Refresh button**: Reload work item data
  - **Open in Browser**: View work item in Azure DevOps web portal
  - **Generate Description button**: Create AI-powered descriptions (if AI is enabled)
  - **Generate Plan button**: Create implementation plans (if AI is enabled)

### Switching Projects

Press `Ctrl+Alt+P` to quickly switch between projects:
- Shows your 10 most recently used projects
- One-click switching
- Automatically reloads work items
- Current project shown in status bar

### Changing Work Item Status

Three methods:
1. **Via webview**: Open a work item and use the state dropdown
2. **Via command**: Press `Ctrl+Alt+U` and select work item and new state
3. **Via context menu**: Right-click any work item and select "Change Status"

The state dropdown dynamically shows only valid state transitions for your Azure DevOps workflow configuration.

### Context Menu Actions

Right-click any work item in Sprint Board or My Work Items for quick actions:

**Sprint Board:**
- **Add Task**: Create a child task under the selected work item
- **Remove from Sprint**: Move work item to backlog (with confirmation)
- **Change Status**: Quick pick to select new state

**My Work Items:**
- **Add Task**: Create a child task under the selected work item
- **Add to Current Sprint**: Move work item to active sprint
- **Change Status**: Quick pick to select new state

### Creating Work Items

**From View Header:**
1. Click the **➕** button in Sprint Board or My Work Items view header
2. Select work item type
3. Enter title and description
4. Work item created and automatically assigned to you

**Creating Child Tasks:**
1. Right-click any work item (User Story, Bug, Feature, etc.)
2. Select "Add Task"
3. Enter task title and description
4. Task created with:
   - Parent relationship set automatically
   - Same sprint/iteration as parent
   - Assigned to you automatically

### Managing Work Item Estimates

1. Open a work item
2. Click "⏱️ Set Estimate" button
3. Enter hours in the dialog (supports decimals, e.g., 4.5)
4. Press Enter or click "Set Estimate"
5. Remaining work updated immediately

### Working with Comments

**Adding Comments:**
1. Open a work item
2. Scroll to Comments section
3. Type your comment in the text area
4. Click "Add Comment"

**Deleting Comments:**
1. Hover over a comment to see the delete button (🗑️)
2. Click the delete button
3. Confirm deletion
4. Comment removed immediately

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

### 0.2.0

**Major Feature Release:**
- **Sprint Management**: Add/remove work items to/from sprint directly in work item view
- **Estimate Work Items**: Quick dialog to set remaining work hours with modal interface
- **Work Item Comments**: Full comment support - add, view, and delete comments
- **Context Menus**: Right-click work items for quick actions:
  - Add to Current Sprint (My Work Items view)
  - Remove from Sprint (Sprint Board view)
  - Change Status with quick pick
  - Add Task (create child task under any work item)
- **Create Child Tasks**: Right-click any work item to create tasks underneath with automatic parent linking
- **Auto-Assignment**: New work items automatically assigned to creator
- **Create Work Item Button**: Quick access button in view headers
- **Improved UI**: Actions moved to top of work item view for better accessibility
- **Enhanced User Experience**: All operations provide progress feedback and confirmation dialogs

### 0.1.2

**Bug Fixes and Improvements:**
- Minor bug fixes and stability improvements
- Performance optimizations

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
