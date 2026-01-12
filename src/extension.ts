import * as vscode from 'vscode';
import { AzureDevOpsAuth } from './azureDevOps/auth';
import { AzureDevOpsApi } from './azureDevOps/api';
import { SprintBoardProvider, MyWorkItemsProvider } from './views/sprintPanel';
import { ProjectManagerProvider } from './views/projectManagerPanel';
import { PullRequestsProvider } from './views/pullRequestsPanel';
import { ProjectPicker } from './azureDevOps/projectPicker';
import { registerCommands } from './commands';
import { trackRecentProject } from './commands/projectSwitcher';
import { PullRequest } from './models/pullRequest';

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: NodeJS.Timeout | undefined;
let projectManagerProvider: ProjectManagerProvider | undefined;
let pullRequestsProvider: PullRequestsProvider | undefined;

/**
 * Helper function to recursively expand all tree items
 */
async function expandRecursively(
  treeView: vscode.TreeView<any>,
  item: any,
  provider: any,
  depth: number = 0
): Promise<void> {
  try {
    // Reveal and expand this item
    await treeView.reveal(item, { expand: true, select: false, focus: false });

    // Get children and expand them recursively
    const children = await provider.getChildren(item);
    if (children && children.length > 0) {
      console.log(`  ${'  '.repeat(depth)}Expanding ${children.length} children at depth ${depth}`);
      for (const child of children) {
        await expandRecursively(treeView, child, provider, depth + 1);
      }
    }
  } catch (error) {
    console.log(`  ${'  '.repeat(depth)}Error at depth ${depth}:`, error);
    // Continue with other items even if one fails
  }
}

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

  // Conditionally create Project Manager provider if enabled
  const config = vscode.workspace.getConfiguration('azureDevOps');
  const enableProjectManager = config.get<boolean>('enableProjectManager', false);

  if (enableProjectManager) {
    projectManagerProvider = new ProjectManagerProvider();
    const projectManagerView = vscode.window.createTreeView('azureDevOpsProjectManager', {
      treeDataProvider: projectManagerProvider,
      showCollapseAll: true
    });
    context.subscriptions.push(projectManagerView);
  }

  // Conditionally create Pull Requests provider if enabled
  const enablePullRequests = config.get<boolean>('enablePullRequests', false);

  if (enablePullRequests) {
    pullRequestsProvider = new PullRequestsProvider();
    const pullRequestsView = vscode.window.createTreeView('azureDevOpsPullRequests', {
      treeDataProvider: pullRequestsProvider,
      showCollapseAll: true
    });
    context.subscriptions.push(pullRequestsView);
  }

  // Register expand all command for Sprint Board
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.expandAllSprintBoard', async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Expanding all Sprint Board items...',
            cancellable: false
          },
          async () => {
            const rootItems = await sprintBoardProvider.getChildren();
            console.log(`Expanding ${rootItems.length} root items`);

            for (const item of rootItems) {
              await expandRecursively(sprintBoardView, item, sprintBoardProvider);
            }

            vscode.window.showInformationMessage('All Sprint Board items expanded');
          }
        );
      } catch (error) {
        console.error('Error expanding items:', error);
        vscode.window.showErrorMessage(`Failed to expand items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
  );

  // Register all commands
  registerCommands(context, sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);

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
          await loadInitialData(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider, pullRequestsProvider);

          // Setup auto-refresh
          setupAutoRefresh(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider, pullRequestsProvider);
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
      await loadInitialData(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider, pullRequestsProvider);
      setupAutoRefresh(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider, pullRequestsProvider);
      statusBarItem.show();
    }
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('azureDevOps')) {
        console.log('Azure DevOps configuration changed');

        // Clear caches when critical configuration changes
        if (e.affectsConfiguration('azureDevOps.organization') ||
            e.affectsConfiguration('azureDevOps.pat') ||
            e.affectsConfiguration('azureDevOps.project')) {
          console.log('Clearing API caches due to configuration change');
          api.clearCache();
        }

        if (auth.isConfigured()) {
          statusBarItem.show();

          // Reload data
          await loadInitialData(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider, pullRequestsProvider);

          // Restart auto-refresh
          setupAutoRefresh(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider, pullRequestsProvider);
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

  // Project Manager commands
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.refreshProjectManager', async () => {
      if (projectManagerProvider) {
        await projectManagerProvider.loadWorkItems();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.changeProjectManagerGrouping', async () => {
      if (!projectManagerProvider) {
        vscode.window.showWarningMessage('Project Manager is not enabled. Enable it in settings.');
        return;
      }

      const options = [
        { label: 'State', value: 'state' },
        { label: 'Work Item Type', value: 'type' },
        { label: 'Iteration', value: 'iteration' },
        { label: 'Assigned To', value: 'assignedTo' },
        { label: 'Epic', value: 'epic' }
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select grouping option'
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('azureDevOps');
        await config.update('projectManagerGroupBy', selected.value, vscode.ConfigurationTarget.Global);
        projectManagerProvider.refresh();
      }
    })
  );

  // Pull Requests commands
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.refreshPullRequests', async () => {
      if (pullRequestsProvider) {
        await pullRequestsProvider.loadPullRequests();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.openPullRequest', async (pr: PullRequest) => {
      if (pullRequestsProvider) {
        pullRequestsProvider.openPullRequest(pr);
      }
    })
  );
}

/**
 * Load initial data
 */
async function loadInitialData(
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider,
  projectManagerProvider?: ProjectManagerProvider,
  pullRequestsProvider?: PullRequestsProvider
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Loading Azure DevOps data...',
      cancellable: false
    },
    async () => {
      try {
        const promises: Promise<void>[] = [
          sprintBoardProvider.loadWorkItems(),
          myWorkItemsProvider.loadWorkItems()
        ];

        if (projectManagerProvider) {
          promises.push(projectManagerProvider.loadWorkItems());
        }

        if (pullRequestsProvider) {
          promises.push(pullRequestsProvider.loadPullRequests());
        }

        await Promise.all(promises);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  myWorkItemsProvider: MyWorkItemsProvider,
  projectManagerProvider?: ProjectManagerProvider,
  pullRequestsProvider?: PullRequestsProvider
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
      console.log('Auto-refreshing Azure DevOps data...');

      try {
        const promises: Promise<void>[] = [
          sprintBoardProvider.loadWorkItems(),
          myWorkItemsProvider.loadWorkItems()
        ];

        if (projectManagerProvider) {
          promises.push(projectManagerProvider.loadWorkItems());
        }

        if (pullRequestsProvider) {
          promises.push(pullRequestsProvider.loadPullRequests());
        }

        await Promise.all(promises);
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
