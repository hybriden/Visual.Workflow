import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { AzureDevOpsAuth } from '../azureDevOps/auth';
import { WorkItem } from '../models/workItem';
import { WorkItemViewPanel } from '../views/workItemView';
import { SprintBoardProvider, MyWorkItemsProvider } from '../views/sprintPanel';
import { registerFilterCommands } from './filterCommands';
import { registerProjectSwitcher } from './projectSwitcher';

/**
 * Register all extension commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): void {
  const api = AzureDevOpsApi.getInstance();
  const auth = AzureDevOpsAuth.getInstance();

  // Open Sprint Board
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.openSprintBoard', async () => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      vscode.commands.executeCommand('azureDevOpsSprintBoard.focus');
    })
  );

  // Open Work Item (Quick Pick)
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.openWorkItem', async () => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        // Get all work items from both views
        const sprintItems = sprintBoardProvider.getWorkItems();
        const myItems = myWorkItemsProvider.getWorkItems();

        // Combine and deduplicate
        const allItemsMap = new Map<number, WorkItem>();
        [...sprintItems, ...myItems].forEach(item => {
          allItemsMap.set(item.id, item);
        });

        const allItems = Array.from(allItemsMap.values());

        if (allItems.length === 0) {
          vscode.window.showInformationMessage('No work items found.');
          return;
        }

        // Create quick pick items
        const quickPickItems = allItems.map(wi => ({
          label: `#${wi.fields['System.Id']} ${wi.fields['System.Title']}`,
          description: `${wi.fields['System.WorkItemType']} - ${wi.fields['System.State']}`,
          detail: wi.fields['System.AssignedTo']?.displayName || 'Unassigned',
          workItem: wi
        }));

        // Show quick pick
        const selected = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: 'Search for a work item...',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          WorkItemViewPanel.createOrShow(selected.workItem);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to load work items: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // Create Work Item
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.createWorkItem', async () => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        // Select work item type
        const workItemType = await vscode.window.showQuickPick(
          ['Task', 'User Story', 'Bug', 'Feature'],
          {
            placeHolder: 'Select work item type'
          }
        );

        if (!workItemType) {
          return;
        }

        // Get title
        const title = await vscode.window.showInputBox({
          prompt: 'Enter work item title',
          placeHolder: 'Work item title...',
          validateInput: (value) => {
            return value.trim() === '' ? 'Title cannot be empty' : null;
          }
        });

        if (!title) {
          return;
        }

        // Get description (optional)
        const description = await vscode.window.showInputBox({
          prompt: 'Enter work item description (optional)',
          placeHolder: 'Description...',
        });

        // Create work item
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Creating work item...',
            cancellable: false
          },
          async () => {
            const newWorkItem = await api.createWorkItem(
              workItemType,
              title,
              description
            );

            vscode.window.showInformationMessage(
              `Work item #${newWorkItem.id} created successfully!`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider);

            // Open the new work item
            WorkItemViewPanel.createOrShow(newWorkItem);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create work item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // Refresh Work Items
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.refreshWorkItems', async () => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Refreshing work items...',
          cancellable: false
        },
        async () => {
          await refreshAllViews(sprintBoardProvider, myWorkItemsProvider);
        }
      );

      vscode.window.showInformationMessage('Work items refreshed!');
    })
  );

  // Change Work Item Status
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.changeWorkItemStatus', async () => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        // Get all work items
        const sprintItems = sprintBoardProvider.getWorkItems();
        const myItems = myWorkItemsProvider.getWorkItems();

        const allItemsMap = new Map<number, WorkItem>();
        [...sprintItems, ...myItems].forEach(item => {
          allItemsMap.set(item.id, item);
        });

        const allItems = Array.from(allItemsMap.values());

        if (allItems.length === 0) {
          vscode.window.showInformationMessage('No work items found.');
          return;
        }

        // Select work item
        const quickPickItems = allItems.map(wi => ({
          label: `#${wi.fields['System.Id']} ${wi.fields['System.Title']}`,
          description: `${wi.fields['System.WorkItemType']} - ${wi.fields['System.State']}`,
          workItem: wi
        }));

        const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: 'Select work item to update...'
        });

        if (!selectedItem) {
          return;
        }

        // Get available states
        const currentState = selectedItem.workItem.fields['System.State'];
        const workItemType = selectedItem.workItem.fields['System.WorkItemType'];

        const states = await api.getWorkItemStates(workItemType);

        // Filter out current state
        const availableStates = states.filter(s => s !== currentState);

        // Select new state
        const newState = await vscode.window.showQuickPick(availableStates, {
          placeHolder: `Current state: ${currentState}. Select new state...`
        });

        if (!newState) {
          return;
        }

        // Update state
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Updating work item #${selectedItem.workItem.id}...`,
            cancellable: false
          },
          async () => {
            await api.changeWorkItemState(selectedItem.workItem.id, newState);

            vscode.window.showInformationMessage(
              `Work item #${selectedItem.workItem.id} state changed to "${newState}"`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to change work item status: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // View Work Item Details
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.viewWorkItemDetails', (workItem: WorkItem) => {
      WorkItemViewPanel.createOrShow(workItem);
    })
  );
  // Register filter commands
  registerFilterCommands(context, sprintBoardProvider, myWorkItemsProvider);
  // Register project switcher
  registerProjectSwitcher(context, sprintBoardProvider, myWorkItemsProvider);
}

/**
 * Helper to refresh all views
 */
async function refreshAllViews(
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): Promise<void> {
  await Promise.all([
    sprintBoardProvider.loadWorkItems(),
    myWorkItemsProvider.loadWorkItems()
  ]);
}
