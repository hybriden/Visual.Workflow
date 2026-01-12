# Architecture Overview

This document describes the architecture of the Azure DevOps Workflow VS Code extension.

## Directory Structure

```
src/
├── extension.ts          # Extension entry point and activation
├── ai/                   # AI/Copilot integration
│   ├── aiServiceManager.ts   # AI service orchestration
│   └── copilotService.ts     # GitHub Copilot integration
├── azureDevOps/          # Azure DevOps API clients
│   ├── api.ts               # Main Azure DevOps REST API client
│   ├── auth.ts              # Authentication handling
│   └── timeLogApi.ts        # Time Logging Extension API client
├── commands/             # VS Code command handlers
│   ├── index.ts             # Main command registration
│   ├── aiCommands.ts        # AI-related commands
│   ├── filterCommands.ts    # Filter/view commands
│   └── projectSwitcher.ts   # Project switching logic
├── models/               # TypeScript interfaces and types
│   ├── workItem.ts          # Work item types
│   └── pullRequest.ts       # Pull request types
├── utils/                # Shared utilities
│   ├── htmlSanitizer.ts     # HTML sanitization for webviews
│   ├── timeUtils.ts         # Time formatting utilities
│   ├── timeLogHelper.ts     # Time logging shared logic
│   ├── estimateChecker.ts   # Work estimate calculations
│   └── parentStatusHelper.ts # Parent work item status logic
├── views/                # VS Code UI components
│   ├── sprintPanel.ts       # Sprint Board tree view
│   ├── projectManagerPanel.ts # Project Manager tree view
│   ├── pullRequestsPanel.ts  # Pull Requests tree view
│   ├── pullRequestView.ts    # PR detail webview
│   ├── workItemView.ts       # Work item detail webview
│   └── planView.ts           # AI implementation plan webview
└── test/                 # Test files
    └── unit/                # Unit tests (Mocha/Chai)
```

## Core Components

### 1. Extension Entry Point (`extension.ts`)

The extension activates on VS Code startup (`onStartupFinished`) and:
- Initializes API clients as singletons
- Registers tree view providers
- Registers commands
- Sets up auto-refresh timers
- Handles configuration changes

### 2. API Layer (`azureDevOps/`)

#### `api.ts` - AzureDevOpsApi
Singleton class that handles all Azure DevOps REST API communication:
- Work item CRUD operations
- Sprint/iteration queries
- Pull request operations
- Project/team management
- Uses axios with interceptors for error handling

#### `auth.ts` - AzureDevOpsAuth
Handles authentication configuration:
- PAT (Personal Access Token) management
- Configuration validation
- Setup wizard prompts

#### `timeLogApi.ts` - TimeLogApi
Client for the BozNet Time Logging Extension:
- Time entry CRUD
- Time type fetching
- API key authentication

### 3. View Layer (`views/`)

#### Tree View Providers
Implement `vscode.TreeDataProvider` for sidebar panels:

| Provider | Purpose |
|----------|---------|
| `SprintBoardProvider` | Current sprint work items grouped by state |
| `MyWorkItemsProvider` | Work items assigned to current user |
| `ProjectManagerProvider` | All project work items with grouping options |
| `PullRequestsProvider` | Pull requests for review |

#### Webview Panels
Rich detail views using VS Code's Webview API:

| Panel | Purpose |
|-------|---------|
| `WorkItemViewPanel` | Full work item details, editing, comments |
| `PullRequestViewPanel` | PR details, diff viewing, AI review |
| `PlanViewPanel` | AI-generated implementation plans |

### 4. Command Layer (`commands/`)

Commands are registered in `commands/index.ts` and handle user actions:
- Work item operations (create, update, assign)
- View operations (refresh, filter, expand)
- Time logging
- Project switching

### 5. AI Integration (`ai/`)

#### `aiServiceManager.ts`
Orchestrates AI features:
- Checks Copilot availability
- Manages AI enable/disable settings
- Delegates to specific AI services

#### `copilotService.ts`
GitHub Copilot integration via VS Code's Language Model API:
- Description generation
- Implementation plan generation
- Time log comment generation
- PR code review

### 6. Utilities (`utils/`)

Pure utility functions with no VS Code dependencies (where possible):

| Utility | Purpose |
|---------|---------|
| `htmlSanitizer.ts` | XSS-safe HTML sanitization for webviews |
| `timeUtils.ts` | Time formatting and parsing |
| `timeLogHelper.ts` | Shared time logging workflow |
| `estimateChecker.ts` | Work estimate calculations |

## Data Flow

```
┌─────────────────┐
│   VS Code UI    │
│  (Tree Views,   │
│   Webviews)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Commands     │
│  (User Actions) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  API Clients    │────▶│  Azure DevOps   │
│  (Singletons)   │◀────│    REST API     │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│    Models       │
│  (TypeScript    │
│   Interfaces)   │
└─────────────────┘
```

## Key Patterns

### Singleton Pattern
API clients use singleton pattern for shared state and connection reuse:
```typescript
class AzureDevOpsApi {
  private static instance: AzureDevOpsApi;

  public static getInstance(): AzureDevOpsApi {
    if (!AzureDevOpsApi.instance) {
      AzureDevOpsApi.instance = new AzureDevOpsApi();
    }
    return AzureDevOpsApi.instance;
  }
}
```

### TreeDataProvider Pattern
Sidebar views implement VS Code's tree data pattern:
```typescript
class MyProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<...>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: TreeItem): vscode.TreeItem { ... }
  getChildren(element?: TreeItem): Promise<TreeItem[]> { ... }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
```

### Webview Communication
Webviews communicate with extension via message passing:
```typescript
// Extension side
panel.webview.onDidReceiveMessage(message => {
  switch (message.command) {
    case 'save': handleSave(message.data); break;
  }
});

// Webview side (JavaScript)
vscode.postMessage({ command: 'save', data: formData });
```

## Configuration

Settings are defined in `package.json` under `contributes.configuration`:

| Setting | Purpose |
|---------|---------|
| `azureDevOps.organization` | Azure DevOps org name |
| `azureDevOps.pat` | Personal Access Token |
| `azureDevOps.project` | Current project |
| `azureDevOps.enableAiSuggestions` | Toggle AI features |
| `azureDevOps.useTimeLoggingExtension` | Enable time logging |

## Security Considerations

1. **HTML Sanitization**: All user-provided HTML (PR descriptions, comments) is sanitized using `htmlSanitizer.ts` before rendering in webviews.

2. **API Keys**: Stored in VS Code settings with `format: "password"` for secure storage.

3. **Link Security**: External links in webviews use `target="_blank"` with `rel="noopener noreferrer"`.

4. **Input Validation**: User inputs are validated before API calls.

## Testing

### Unit Tests
Located in `src/test/unit/`, run with:
```bash
npm run test:unit
```

Tests cover:
- HTML sanitization (XSS prevention)
- Time utilities
- Estimate calculations
- Model helper functions

### Integration Tests
VS Code extension integration tests (not yet implemented).

## Build & Package

```bash
npm run compile      # Development build
npm run package      # Production build
npm run watch        # Watch mode
npm run lint         # ESLint
npm run test:unit    # Unit tests
```

## Adding New Features

### Adding a New Command
1. Define command in `package.json` under `contributes.commands`
2. Register handler in `commands/index.ts`
3. Add menu items if needed in `contributes.menus`

### Adding a New View
1. Define view in `package.json` under `contributes.views`
2. Create provider in `views/`
3. Register provider in `extension.ts`

### Adding a New API Endpoint
1. Add method to `AzureDevOpsApi` class
2. Define response types in `models/`
3. Handle errors appropriately

## Dependencies

- **axios**: HTTP client for REST API calls
- **vscode**: VS Code extension API (dev dependency)

No runtime dependencies on heavy frameworks - keeps extension lightweight.
