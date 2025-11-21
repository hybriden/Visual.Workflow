import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { AzureDevOpsAuth } from '../azureDevOps/auth';
import { WorkItem } from '../models/workItem';
import { WorkItemViewPanel } from '../views/workItemView';
import { SprintBoardProvider, MyWorkItemsProvider } from '../views/sprintPanel';
import { ProjectManagerProvider } from '../views/projectManagerPanel';
import { registerFilterCommands } from './filterCommands';
import { registerProjectSwitcher } from './projectSwitcher';
import { registerAiCommands } from './aiCommands';

/**
 * Register all extension commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider,
  projectManagerProvider?: ProjectManagerProvider
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
            // Get current user to auto-assign
            let currentUserEmail: string | undefined;
            try {
              const currentUser = await api.getCurrentUserConnection();
              currentUserEmail = currentUser.providerDisplayName || currentUser.displayName;
            } catch (error) {
              console.error('Could not get current user for auto-assignment:', error);
              // Continue without auto-assignment if user lookup fails
            }

            const newWorkItem = await api.createWorkItem(
              workItemType,
              title,
              description,
              currentUserEmail
            );

            vscode.window.showInformationMessage(
              `Work item #${newWorkItem.id} created and assigned to you!`
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

  // Context Menu: Add to Current Sprint
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.contextAddToSprint', async (treeItem: any) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        const workItem = treeItem.workItem;
        const currentSprint = await api.getCurrentIteration();

        if (!currentSprint) {
          vscode.window.showErrorMessage('No current sprint found.');
          return;
        }

        // Check if already in current sprint
        if (workItem.fields['System.IterationPath'] === currentSprint.path) {
          vscode.window.showInformationMessage(
            `Work item #${workItem.id} is already in "${currentSprint.name}"`
          );
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Adding work item #${workItem.id} to ${currentSprint.name}...`,
            cancellable: false
          },
          async () => {
            const updates = [
              {
                op: 'add',
                path: '/fields/System.IterationPath',
                value: currentSprint.path
              }
            ];

            await api.updateWorkItem(workItem.id, updates);

            vscode.window.showInformationMessage(
              `Work item #${workItem.id} added to sprint "${currentSprint.name}"`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to add work item to sprint: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // Context Menu: Remove from Sprint
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.contextRemoveFromSprint', async (treeItem: any) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        const workItem = treeItem.workItem;
        const currentSprint = await api.getCurrentIteration();

        if (!currentSprint) {
          vscode.window.showErrorMessage('No current sprint found.');
          return;
        }

        // Confirm the action
        const confirm = await vscode.window.showWarningMessage(
          `Remove work item #${workItem.id} from sprint?`,
          'Remove',
          'Cancel'
        );

        if (confirm !== 'Remove') {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Removing work item #${workItem.id} from sprint...`,
            cancellable: false
          },
          async () => {
            const projectName = workItem.fields['System.TeamProject'];

            const updates = [
              {
                op: 'add',
                path: '/fields/System.IterationPath',
                value: projectName
              }
            ];

            await api.updateWorkItem(workItem.id, updates);

            vscode.window.showInformationMessage(
              `Work item #${workItem.id} removed from sprint`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to remove work item from sprint: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // Context Menu: Change Status
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.contextChangeStatus', async (treeItem: any) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        const workItem = treeItem.workItem;
        const workItemType = workItem.fields['System.WorkItemType'];
        const currentState = workItem.fields['System.State'];

        // Get valid states for this work item type
        const validStates = await api.getWorkItemStates(workItemType);
        const availableStates = validStates.filter(state => state !== currentState);

        if (availableStates.length === 0) {
          vscode.window.showInformationMessage('No other states available for this work item.');
          return;
        }

        // Show quick pick for state selection
        const newState = await vscode.window.showQuickPick(availableStates, {
          placeHolder: `Select new state for work item #${workItem.id} (Current: ${currentState})`
        });

        if (!newState) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Changing work item #${workItem.id} state to "${newState}"...`,
            cancellable: false
          },
          async () => {
            await api.changeWorkItemState(workItem.id, newState);

            vscode.window.showInformationMessage(
              `Work item #${workItem.id} state changed to "${newState}"`
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

  // Context Menu: Create Child Task
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.contextCreateChildTask', async (treeItem: any) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        const parentWorkItem = treeItem.workItem;
        const parentId = parentWorkItem.id;
        const parentTitle = parentWorkItem.fields['System.Title'];

        // Get task title
        const title = await vscode.window.showInputBox({
          prompt: `Enter task title (parent: #${parentId} - ${parentTitle})`,
          placeHolder: 'Task title...',
          validateInput: (value) => {
            return value.trim() === '' ? 'Title cannot be empty' : null;
          }
        });

        if (!title) {
          return;
        }

        // Get description (optional)
        const description = await vscode.window.showInputBox({
          prompt: 'Enter task description (optional)',
          placeHolder: 'Description...',
        });

        // Create task
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating task under #${parentId}...`,
            cancellable: false
          },
          async () => {
            // Create the task (without assignment initially)
            const newTask = await api.createWorkItem(
              'Task',
              title,
              description
            );

            // Set parent link first
            try {
              await api.addParentLink(newTask.id, parentId);
            } catch (error) {
              console.error('Failed to add parent link:', error);
              vscode.window.showWarningMessage('Task created but failed to link to parent.');
            }

            // Get current user for auto-assignment
            let currentUserEmail: string | undefined;
            try {
              const currentUser = await api.getCurrentUserConnection();
              currentUserEmail = currentUser.providerDisplayName || currentUser.displayName;
            } catch (error) {
              console.error('Could not get current user for auto-assignment:', error);
            }

            // Prepare updates for iteration path and assignment
            const updates: Array<{ op: string; path: string; value: any }> = [];

            // Add iteration path from parent
            const parentIteration = parentWorkItem.fields['System.IterationPath'];
            if (parentIteration) {
              updates.push({
                op: 'add',
                path: '/fields/System.IterationPath',
                value: parentIteration
              });
            }

            // Add assignment if we got the current user
            if (currentUserEmail) {
              updates.push({
                op: 'add',
                path: '/fields/System.AssignedTo',
                value: currentUserEmail
              });
            }

            // Apply field updates
            if (updates.length > 0) {
              try {
                await api.updateWorkItem(newTask.id, updates);
              } catch (error) {
                console.error('Failed to update task fields:', error);
                vscode.window.showWarningMessage('Task created but some fields could not be set.');
              }
            }

            vscode.window.showInformationMessage(
              `Task #${newTask.id} created under #${parentId}${currentUserEmail && updates.length > 0 ? ' and assigned to you' : ''}!`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider);

            // Refresh the updated work item to show the new child
            const updatedWorkItem = await api.getWorkItem(newTask.id);
            WorkItemViewPanel.createOrShow(updatedWorkItem);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );

  // Register filter commands
  registerFilterCommands(context, sprintBoardProvider, myWorkItemsProvider);
  // Register project switcher
  registerProjectSwitcher(context, sprintBoardProvider, myWorkItemsProvider);
  // Register AI commands
  registerAiCommands(context, sprintBoardProvider, myWorkItemsProvider);
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
