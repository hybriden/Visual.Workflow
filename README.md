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
- **Parent Status Sync**: When moving a child task to "In Progress", get prompted to update parent status automatically
- **Quick Assignment**: "Assign to Me" button for instant work item assignment
- **Bulk Assignment**: Assign all child work items to yourself with one click

### Comments & Collaboration
- **Add Comments**: Comment directly on work items from VS Code
- **Delete Comments**: Remove comments with confirmation
- **Real-time Updates**: Comments refresh automatically after changes

### Context Menus
- **Sprint Board**: Right-click work items to remove from sprint, change status, or assign all children
- **My Work Items**: Right-click to add to sprint, change status, create child tasks, or assign all children
- **Project Manager**: Right-click to change status, create child tasks, or assign all children
- **Quick Actions**: All common operations accessible via right-click

### Pull Requests View
- **View Your PRs**: See all pull requests you created or are assigned to review
- **AI-Powered Code Review**: Get AI analysis of PR changes including summary, key changes, and potential issues
- **PR Details Panel**: View full PR details with files changed, reviewers, and vote status
- **Quick Navigation**: Open PRs directly in Azure DevOps from VS Code
- **Review Status**: See who has approved, rejected, or is waiting on your PRs

### AI-Powered Features
- **Generate Descriptions**: AI-powered generation using GitHub Copilot
- **Implementation Plans**: Get detailed implementation plans with technical guidance
- **Smart Context Awareness**: AI uses work item metadata for relevant suggestions
- **AI Time Log Comments**: Generate contextual comments for time entries based on work item details
- **AI PR Code Review**: Analyze pull request changes with AI-powered insights
- **GitHub Copilot Agent Integration**: Create GitHub issues from implementation plans and automatically assign GitHub Copilot coding agent to work on them
  - Automatic GitHub authentication (no token setup needed)
  - Select organization and repository from dropdowns
  - One-click issue creation with plan
  - Copilot agent automatically assigned to implement the plan

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
  - **Assign to Me**: Instantly assign the work item to yourself
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

### Parent Status Synchronization

When you move a child task (e.g., a Task under a User Story) to "In Progress", "Active", or "Committed", the extension will automatically check if the parent is still in a "not started" state (New, To Do, or Proposed).

If the parent needs updating, you'll see a **modal dialog** asking if you want to move the parent to "In Progress" as well. This helps keep your work item hierarchy in sync and ensures parent items accurately reflect that work has started.

**Example:**
1. You have a User Story in "New" state
2. You move one of its child Tasks to "In Progress"
3. A dialog appears: *"Child task #12345 is now 'In Progress'. Do you want to move parent #67890 (User Story Title) from 'New' to 'In Progress'?"*
4. Click "Yes, Update Parent" to sync both, or "No, Keep As Is" to only update the child

### Assigning Work Items

**Assign to Me (Single Work Item):**
1. Open a work item details view
2. Click the **"👤 Assign to Me"** button
3. Work item is instantly assigned to you

**Assign All Children to Me (Bulk Assignment):**
1. Right-click a parent work item (User Story, Bug, Feature, etc.) in any view
2. Select **"Assign All Children to Me"**
3. Confirm the action
4. All child work items are assigned to you with progress tracking
5. View shows success/failure count

This is perfect for when you're taking ownership of a User Story and want to assign all its Tasks to yourself at once.

### Context Menu Actions

Right-click any work item in Sprint Board or My Work Items for quick actions:

**Sprint Board:**
- **Add Task**: Create a child task under the selected work item
- **Remove from Sprint**: Move work item to backlog (with confirmation)
- **Change Status**: Quick pick to select new state
- **Assign All Children to Me**: Assign all child work items to yourself

**My Work Items:**
- **Add Task**: Create a child task under the selected work item
- **Add to Current Sprint**: Move work item to active sprint
- **Change Status**: Quick pick to select new state
- **Assign All Children to Me**: Assign all child work items to yourself

**Project Manager:**
- **Add Task**: Create a child task under the selected work item
- **Change Status**: Quick pick to select new state
- **Assign All Children to Me**: Assign all child work items to yourself

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

### Using GitHub Copilot Agent Integration

Turn implementation plans into action by assigning them to GitHub Copilot's coding agent:

**Setup:**
1. Open Settings (Ctrl+,)
2. Search for "Azure DevOps: Enable Copilot Agent"
3. Enable the feature

**Usage:**
1. Generate an implementation plan for a work item (click "Plan" button)
2. **(Optional)** Click "✏️ Edit Plan" to customize the AI-generated plan
3. In the plan view, you'll see the "🤖 GitHub Copilot Agent Integration" section
4. VS Code will automatically prompt you to sign in to GitHub (first time only)
5. Select your GitHub organization from the dropdown
6. Select the target repository
7. Click "🚀 Create Issue & Assign to Copilot"

**What happens:**
- A GitHub issue is created in the selected repository with the full implementation plan
- The issue is labeled with `copilot-agent` and `implementation-plan`
- GitHub Copilot's coding agent is automatically assigned via comment
- The agent will autonomously work on implementing the plan
- You get a direct link to track the issue and agent's progress

**Benefits:**
- Seamless workflow from planning to implementation
- Automatic GitHub authentication (no token setup required)
- One-click deployment to GitHub Copilot agent
- Track agent progress directly in GitHub
- Agent can open PRs, make code changes, and iterate autonomously

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
- `azureDevOps.enableCopilotAgent`: Enable GitHub Copilot coding agent integration to create issues from implementation plans (default: `false`)
- `azureDevOps.githubDefaultOrg`: Default GitHub organization for Copilot agent integration (optional)

### Project Manager Settings

- `azureDevOps.enableProjectManager`: Enable Project Manager view showing all work items in the project (default: `false`)
- `azureDevOps.projectManagerGroupBy`: How to group work items in Project Manager view (default: `state`)
  - Options: `state`, `type`, `iteration`, `assignedTo`, `epic`
- `azureDevOps.showOverEstimateAlerts`: Show visual alerts for work items that exceed their original estimates (default: `true`)
- `azureDevOps.overEstimateThreshold`: Percentage threshold for over-estimate alerts (default: `0` - any over-estimate)

### Pull Requests Settings

- `azureDevOps.enablePullRequests`: Enable Pull Requests view showing PRs you're assigned to review or have created (default: `false`)

**Note**:
- Project and team settings are managed via the Setup Wizard and Quick Switch commands, not manually in settings.
- GitHub authentication for Copilot agent is automatic via VS Code - no manual token setup required.

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

### 0.3.7

**New Features:**
- **Pull Requests View**: New view showing all PRs you created or are assigned to review
  - Enable via setting: `azureDevOps.enablePullRequests`
  - Shows PR title, status, reviewers, and vote status
  - Click to open detailed PR panel with full description and file changes
  - Open PRs directly in Azure DevOps browser
- **AI-Powered PR Code Review**: Click "Analyze with AI" in PR details to get:
  - Summary of changes
  - Key modifications highlighted
  - Potential issues and concerns
  - Suggestions for review focus areas
- **AI Time Log Comments**: When logging time, optionally generate contextual comments based on work item details
  - Click "Generate with AI" when adding a time log comment
  - AI analyzes work item title, type, state, and description
  - Creates professional, relevant comments automatically

**Technical Improvements:**
- **Enhanced Security**: New whitelist-based HTML sanitization prevents XSS attacks
- **Code Architecture**: Refactored views to use template builder pattern for maintainability
- **Unit Tests**: Added comprehensive test suite with 99+ tests covering utilities and models
- **Integration Tests**: Added VS Code extension integration test infrastructure
- **Cache Management**: Improved cache invalidation when switching organizations or projects
- **Architecture Documentation**: Added ARCHITECTURE.md describing codebase structure and patterns

### 0.3.6

**New Features:**
- **Time Logging Extension Integration (Premium)**: Log hours directly from VS Code using the [Time Logging Extension for Azure DevOps](https://marketplace.visualstudio.com/items?itemName=TimeLog.time-logging-extension)
  - Requires Premium version of the Time Logging Extension
  - Enable via setting: `azureDevOps.useTimeLoggingExtension`
  - Organization ID and time types are automatically detected
  - Right-click any work item and select "Log Time"
  - Or use the "Log Time" button in the work item detail panel
  - Select time type, enter minutes, and add optional comment
  - Time entries appear in the "Time Log" tab in Azure DevOps

### 0.3.5

**Bug Fixes:**
- **Fixed Duplicate Work Items in Sprint Board**: Resolved issue where work items appeared in multiple state categories simultaneously
  - Root cause: When a work item's state changed (e.g., Task moved from "In Progress" to "Done"), stale cache data caused it to appear in both categories
  - Added optimistic cache updates that immediately reflect state changes locally before server refresh
  - Enhanced buildHierarchy to prevent showing parent items as context when they already appear as top-level items in the same category
  - Each tree item instance gets a globally unique ID using an instance counter to prevent registration conflicts
  - Applies to Sprint Board, My Work Items, and Project Manager views

### 0.3.4

**New Features:**
- **Assignment Indicators**: Visual indicator (👤 icon) shows which work items are assigned to you
  - Appears in Sprint Board, My Work Items, and Project Manager views
  - Makes it easy to spot your assignments at a glance
  - Automatically detects current user from assigned work items
- **Epic Grouping in Project Manager**: New grouping option to organize work items by their parent Epic
  - Accessible via the grouping button in Project Manager view
  - Shows all work items grouped under their Epic with full hierarchy
  - Items without an Epic appear in a "No Epic" category
  - Epic groups display as "#ID: Title" for easy identification
- **Expand All Button**: Added expand all button to Sprint Board view
  - Click the expand-all icon (⊞) in Sprint Board toolbar
  - Recursively expands all work items and their children
  - Shows complete hierarchy (Epic → Feature → Story → Task, etc.)
  - Progress notification shows expansion status

**Bug Fixes:**
- **Fixed Multi-Level Hierarchy Expansion**: Resolved issue where only 2 levels were expandable in tree views
  - Sprint Board now supports unlimited hierarchy depth
  - Project Manager now supports unlimited hierarchy depth for all grouping options
  - Dynamic child discovery ensures all levels are properly expandable

### 0.3.3

**New Features:**
- **Parent Status Synchronization**: When moving a child task to "In Progress", get prompted to automatically update parent status
  - Modal dialog prompts you to move parent from "Not Started" states (New, To Do, Proposed) to "In Progress"
  - Works for all status change methods: webview, command palette, and context menu
  - Helps keep work item hierarchy in sync automatically
- **Assign to Me Button**: Added quick "Assign to Me" button in work item details view
  - Instant one-click assignment without navigation
  - Removed automatic assignment on work item creation for more explicit control
- **Assign All Children to Me**: New context menu option to bulk assign all child work items
  - Available in Sprint Board, My Work Items, and Project Manager views
  - Shows progress tracking with success/failure counts
  - Perfect for taking ownership of an entire User Story with all its Tasks

**Improvements:**
- Enhanced work item assignment workflow with better user feedback
- Improved modal dialog UX for parent status updates (prevents auto-dismissal)
- Better handling of background operations during status changes

### 0.3.2

**Bug Fixes:**
- **Fixed Project Manager 404 Errors**: Corrected WIQL query syntax to properly load all project work items
- **Added Hierarchical Structure in Project Manager**: Work items now display in parent-child tree structure for better organization
  - Parent items are collapsible to show/hide child tasks
  - Orphaned items (parent not in current view) display parent ID for reference
  - Three-level tree hierarchy: Category → Parent → Children
- **Improved GitHub Copilot Agent Assignment**: Fixed Copilot agent assignment using correct GraphQL API approach
  - Now uses `suggestedActors` with `capabilities: [CAN_BE_ASSIGNED]` filter
  - Uses `replaceActorsForAssignable` mutation instead of deprecated methods
  - Added REST API fallback for additional reliability
  - Enhanced authentication with proper `write:org` scope
- **Better Error Handling**: Added detection for archived repositories and clearer error messages for GitHub integration
- **Enhanced Debugging**: Added detailed console logging for troubleshooting Copilot agent assignment

### 0.3.1

**Enhancements:**
- **Edit AI-Generated Plans**: Added ability to edit and customize AI-generated implementation plans
  - Click "Edit Plan" button to enter edit mode
  - Edit the plan in a large, resizable textarea
  - Save changes or cancel to discard edits
  - Editor automatically closes after saving
  - Edited plans are used for all subsequent actions (copy, GitHub issue creation)
- **Project Switcher in Sprint Board**: Added quick project switcher button in Sprint Board title bar for easier project navigation
- **Security Improvement**: Azure DevOps PAT now displayed as password (masked) in settings UI

### 0.3.0

**Major Feature: GitHub Copilot Agent Integration**
- **Create GitHub Issues from Plans**: Turn implementation plans into GitHub issues with one click
- **Automatic Copilot Agent Assignment**: GitHub Copilot coding agent is automatically assigned to implement the plan
- **Automatic GitHub Authentication**: No manual token setup - uses VS Code's built-in GitHub OAuth
- **Organization & Repository Selection**: Easy dropdowns to select target organization and repository
- **Seamless Workflow**: From work item → AI plan → GitHub issue → Copilot agent implementation
- **Smart Issue Creation**: Issues are created with proper labels (`copilot-agent`, `implementation-plan`) and formatted with the full plan
- **Real-time Feedback**: Progress indicators, error messages, and success notifications with direct links to created issues

**Technical Improvements:**
- New GitHub API client with automatic authentication
- Enhanced plan view with Copilot integration section
- OAuth-based authentication flow (more secure than PAT)
- Support for personal and organization repositories

### 0.2.1

**Bug Fixes:**
- **Child Task Creation**: Fixed issue where child tasks would fail to be assigned to the creator
- **Improved Error Handling**: Better error handling for child task creation - tasks are now created successfully even if individual field updates fail
- **Better User Feedback**: Clear warning messages if specific operations (like assignment or parent linking) fail during task creation
- **Reliability**: Refactored child task creation flow to ensure work item is fully created before applying updates

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
- **Performance**: Implemented esbuild bundling reducing extension from 231 files to 9 files (405KB → 87KB)

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

For developers interested in contributing, see [ARCHITECTURE.md](ARCHITECTURE.md) for codebase structure and patterns. Run `npm test` to execute the unit test suite.

## License

MIT

---

**Enjoy managing your Azure DevOps workflow from VS Code!**
