import * as vscode from 'vscode';
import { SprintBoardProvider, MyWorkItemsProvider } from '../views/sprintPanel';

/**
 * Register filter-related commands
 */
export function registerFilterCommands(
  context: vscode.ExtensionContext,
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): void {

  // Toggle Completed Items Filter
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.toggleCompletedItems', async () => {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const currentValue = config.get<boolean>('hideCompletedItems', true);
      const newValue = !currentValue;
      await config.update('hideCompletedItems', newValue, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `Completed items are now ${newValue ? 'hidden' : 'visible'}`
      );

      await refreshViews(sprintBoardProvider, myWorkItemsProvider);
    })
  );

  // Toggle Removed Items Filter
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.toggleRemovedItems', async () => {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const currentValue = config.get<boolean>('hideRemovedItems', true);
      const newValue = !currentValue;
      await config.update('hideRemovedItems', newValue, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `Removed items are now ${newValue ? 'hidden' : 'visible'}`
      );

      await refreshViews(sprintBoardProvider, myWorkItemsProvider);
    })
  );

  // Clear All Filters
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.clearAllFilters', async () => {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      await config.update('hideCompletedItems', false, vscode.ConfigurationTarget.Global);
      await config.update('hideRemovedItems', false, vscode.ConfigurationTarget.Global);
      await config.update('showOnlyAssignedToMe', false, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage('All filters cleared - showing all work items');

      await refreshViews(sprintBoardProvider, myWorkItemsProvider);
    })
  );
}

/**
 * Helper to refresh views
 */
async function refreshViews(
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): Promise<void> {
  await Promise.all([
    sprintBoardProvider.loadWorkItems(),
    myWorkItemsProvider.loadWorkItems()
  ]);
}
