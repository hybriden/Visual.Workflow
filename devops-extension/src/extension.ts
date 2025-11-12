import * as vscode from 'vscode';
import { AzureDevOpsAuth } from './azureDevOps/auth';
import { AzureDevOpsApi } from './azureDevOps/api';
import { SprintBoardProvider, MyWorkItemsProvider } from './views/sprintPanel';
import { ProjectPicker } from './azureDevOps/projectPicker';
import { registerCommands } from './commands';
import { trackRecentProject } from './commands/projectSwitcher';

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: NodeJS.Timeout | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Azure DevOps Workflow extension is now active!');

  const auth = AzureDevOpsAuth.getInstance();
  const api = AzureDevOpsApi.getInstance();

  // Create tree data providers
  const sprintBoardProvider = new SprintBoardProvider();
  const myWorkItemsProvider = new MyWorkItemsProvider();

  // Register tree views
  const sprintBoardView = vscode.window.createTreeView('azureDevOpsSprintBoard', {
    treeDataProvider: sprintBoardProvider,
    showCollapseAll: true
  });

  const myWorkItemsView = vscode.window.createTreeView('azureDevOpsMyWorkItems', {
    treeDataProvider: myWorkItemsProvider,
    showCollapseAll: false
  });

  context.subscriptions.push(sprintBoardView, myWorkItemsView);

  // Register all commands
  registerCommands(context, sprintBoardProvider, myWorkItemsProvider);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'azureDevOps.openSprintBoard';
  statusBarItem.text = '$(project) Azure DevOps';
  statusBarItem.tooltip = 'Open Azure DevOps Sprint Board';
  context.subscriptions.push(statusBarItem);

  // Check configuration on startup
  if (auth.isConfigured()) {
    statusBarItem.show();

    // Validate configuration
    const isValid = await auth.validateConfiguration();

    if (isValid) {
      // Test connection
      try {
        const connected = await api.testConnection();
        if (connected) {
          vscode.window.showInformationMessage('Connected to Azure DevOps!');

          // Load initial data
          await loadInitialData(sprintBoardProvider, myWorkItemsProvider);

          // Setup auto-refresh
          setupAutoRefresh(sprintBoardProvider, myWorkItemsProvider);
        } else {
          vscode.window.showWarningMessage(
            'Could not connect to Azure DevOps. Please check your configuration.'
          );
        }
      } catch (error) {
        console.error('Connection test failed:', error);
      }
    }
  } else {
    // Prompt user to configure using setup wizard
    const projectPicker = new ProjectPicker();
    const configured = await projectPicker.runSetupWizard();

    if (configured) {
      // Reload after configuration
      await loadInitialData(sprintBoardProvider, myWorkItemsProvider);
      setupAutoRefresh(sprintBoardProvider, myWorkItemsProvider);
      statusBarItem.show();
    }
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('azureDevOps')) {
        console.log('Azure DevOps configuration changed');

        if (auth.isConfigured()) {
          statusBarItem.show();

          // Reload data
          await loadInitialData(sprintBoardProvider, myWorkItemsProvider);

          // Restart auto-refresh
          setupAutoRefresh(sprintBoardProvider, myWorkItemsProvider);
        } else {
          statusBarItem.hide();
          if (refreshTimer) {
            clearInterval(refreshTimer);
          }
        }
      }
    })
  );

  // Add refresh command to tree view title
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.sprintBoard.refresh', async () => {
      await sprintBoardProvider.loadWorkItems();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.myWorkItems.refresh', async () => {
      await myWorkItemsProvider.loadWorkItems();
    })
  );
}

/**
 * Load initial data
 */
async function loadInitialData(
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Loading Azure DevOps work items...',
      cancellable: false
    },
    async () => {
      try {
        await Promise.all([
          sprintBoardProvider.loadWorkItems(),
          myWorkItemsProvider.loadWorkItems()
        ]);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to load work items: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

/**
 * Setup auto-refresh timer
 */
function setupAutoRefresh(
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): void {
  // Clear existing timer
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  const config = vscode.workspace.getConfiguration('azureDevOps');
  const autoRefresh = config.get<boolean>('autoRefresh', true);
  const refreshInterval = config.get<number>('refreshInterval', 300); // Default 5 minutes

  if (autoRefresh && refreshInterval > 0) {
    refreshTimer = setInterval(async () => {
      console.log('Auto-refreshing Azure DevOps work items...');

      try {
        await Promise.all([
          sprintBoardProvider.loadWorkItems(),
          myWorkItemsProvider.loadWorkItems()
        ]);
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, refreshInterval * 1000);
  }
}

/**
 * Extension deactivation
 */
export function deactivate() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  console.log('Azure DevOps Workflow extension deactivated');
}
