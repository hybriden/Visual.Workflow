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
import { shouldPromptParentUpdate, promptAndUpdateParent } from '../utils/parentStatusHelper';
import { TimeLogApi, TimeLogEntry, TimeType } from '../azureDevOps/timeLogApi';

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
            const newWorkItem = await api.createWorkItem(
              workItemType,
              title,
              description
            );

            vscode.window.showInformationMessage(
              `Work item #${newWorkItem.id} created!`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);

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
          await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
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
            const updatedWorkItem = await api.changeWorkItemState(selectedItem.workItem.id, newState);

            // Optimistically update local cache to prevent showing duplicates
            sprintBoardProvider.updateWorkItemInCache(updatedWorkItem);
            myWorkItemsProvider.updateWorkItemInCache(updatedWorkItem);
            if (projectManagerProvider) {
              projectManagerProvider.updateWorkItemInCache(updatedWorkItem);
            }

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
          }
        );

        // Check if we should prompt to update parent
        const parent = await shouldPromptParentUpdate(selectedItem.workItem, newState);
        if (parent) {
          await promptAndUpdateParent(parent, selectedItem.workItem.id, newState);
          // Refresh views again if parent was updated
          await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
        } else {
          // Only show success message if we're not prompting for parent
          vscode.window.showInformationMessage(
            `Work item #${selectedItem.workItem.id} state changed to "${newState}"`
          );
        }
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
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
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
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
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
            const updatedWorkItem = await api.changeWorkItemState(workItem.id, newState);

            // Optimistically update local cache to prevent showing duplicates
            sprintBoardProvider.updateWorkItemInCache(updatedWorkItem);
            myWorkItemsProvider.updateWorkItemInCache(updatedWorkItem);
            if (projectManagerProvider) {
              projectManagerProvider.updateWorkItemInCache(updatedWorkItem);
            }

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
          }
        );

        // Check if we should prompt to update parent
        const parent = await shouldPromptParentUpdate(workItem, newState);
        if (parent) {
          await promptAndUpdateParent(parent, workItem.id, newState);
          // Refresh views again if parent was updated
          await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
        } else {
          // Only show success message if we're not prompting for parent
          vscode.window.showInformationMessage(
            `Work item #${workItem.id} state changed to "${newState}"`
          );
        }
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

            // Set iteration path from parent
            const parentIteration = parentWorkItem.fields['System.IterationPath'];
            if (parentIteration) {
              try {
                await api.updateWorkItem(newTask.id, [{
                  op: 'add',
                  path: '/fields/System.IterationPath',
                  value: parentIteration
                }]);
              } catch (error) {
                console.error('Failed to set iteration path:', error);
              }
            }

            vscode.window.showInformationMessage(
              `Task #${newTask.id} created under #${parentId}!`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);

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

  // Helper function to get current user identity
  async function getCurrentUserIdentity(): Promise<any> {
    // First, check if we already have work items assigned to us
    const myWorkItems = myWorkItemsProvider.getWorkItems();
    if (myWorkItems.length > 0) {
      const assignedToField = myWorkItems[0].fields['System.AssignedTo'];
      if (assignedToField) {
        console.log('[Assignment] Using identity from existing work item:', assignedToField);
        return assignedToField;
      }
    }

    // If we couldn't get identity from existing items, query for one
    const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me ORDER BY [System.ChangedDate] DESC`;
    const ids = await api.queryWorkItems(wiql);

    if (ids.length > 0) {
      const items = await api.getWorkItems([ids[0]]);
      if (items.length > 0) {
        const identity = items[0].fields['System.AssignedTo'];
        console.log('[Assignment] Using identity from queried work item:', identity);
        return identity;
      }
    }

    return null;
  }

  // Assign Work Item to Me
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.assignToMe', async (workItem: WorkItem) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        const currentUserIdentity = await getCurrentUserIdentity();

        if (!currentUserIdentity) {
          vscode.window.showErrorMessage('Could not determine your user identity. Try assigning a work item to yourself manually first, then try again.');
          return;
        }

        // Update assignment
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Assigning work item #${workItem.id} to you...`,
            cancellable: false
          },
          async () => {
            await api.updateWorkItem(workItem.id, [{
              op: 'add',
              path: '/fields/System.AssignedTo',
              value: currentUserIdentity
            }]);

            vscode.window.showInformationMessage(
              `Work item #${workItem.id} assigned to you!`
            );

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);

            // Refresh the work item view if it's open
            vscode.commands.executeCommand('azureDevOps.refreshWorkItems');
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to assign work item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        console.error('Assignment error:', error);
      }
    })
  );

  // Assign All Children to Me
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.contextAssignChildrenToMe', async (treeItem: any) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      try {
        const parentWorkItem = treeItem.workItem;
        const parentId = parentWorkItem.id;
        const parentTitle = parentWorkItem.fields['System.Title'];

        // Get current user identity
        const currentUserIdentity = await getCurrentUserIdentity();

        if (!currentUserIdentity) {
          vscode.window.showErrorMessage('Could not determine your user identity. Try assigning a work item to yourself manually first, then try again.');
          return;
        }

        // Get all children of this work item
        const childIds = await api.getChildWorkItems(parentId);

        if (childIds.length === 0) {
          vscode.window.showInformationMessage(`Work item #${parentId} has no child work items.`);
          return;
        }

        // Confirm with user
        const action = await vscode.window.showInformationMessage(
          `Assign ${childIds.length} child work item${childIds.length > 1 ? 's' : ''} of "${parentTitle}" to you?`,
          'Yes, Assign All',
          'Cancel'
        );

        if (action !== 'Yes, Assign All') {
          return;
        }

        // Assign all children
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Assigning ${childIds.length} child work items to you...`,
            cancellable: false
          },
          async (progress) => {
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < childIds.length; i++) {
              const childId = childIds[i];
              progress.report({
                message: `Assigning ${i + 1} of ${childIds.length}...`,
                increment: (100 / childIds.length)
              });

              try {
                await api.updateWorkItem(childId, [{
                  op: 'add',
                  path: '/fields/System.AssignedTo',
                  value: currentUserIdentity
                }]);
                successCount++;
              } catch (error) {
                console.error(`Failed to assign child work item ${childId}:`, error);
                failCount++;
              }
            }

            if (failCount > 0) {
              vscode.window.showWarningMessage(
                `Assigned ${successCount} of ${childIds.length} child work items. ${failCount} failed.`
              );
            } else {
              vscode.window.showInformationMessage(
                `Successfully assigned all ${successCount} child work items to you!`
              );
            }

            // Refresh views
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to assign children: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        console.error('Assignment error:', error);
      }
    })
  );

  // Log Time on Work Item (using Time Logging Extension API)
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.logTime', async (treeItem: any) => {
      if (!auth.isConfigured()) {
        await auth.promptConfiguration();
        return;
      }

      // Reset to ensure we have the latest PAT
      TimeLogApi.resetInstance();
      const timeLogApi = TimeLogApi.getInstance();
      const config = vscode.workspace.getConfiguration('azureDevOps');

      if (!timeLogApi.isEnabled()) {
        const enable = await vscode.window.showInformationMessage(
          'Time Logging Extension integration is not enabled. Enable it to log time directly from VS Code.',
          'Enable',
          'Cancel'
        );

        if (enable === 'Enable') {
          await config.update('useTimeLoggingExtension', true, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage('Time Logging Extension enabled. Try logging time again.');
        }
        return;
      }

      if (!timeLogApi.hasApiKey()) {
        const openSettings = await vscode.window.showWarningMessage(
          'Time Logging API Key is not configured. Get the API Key from Project Settings > Time Log Admin in Azure DevOps.',
          'Open Settings',
          'Cancel'
        );

        if (openSettings === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'azureDevOps.timeLoggingApiKey');
        }
        return;
      }

      try {
        const workItem = treeItem.workItem;
        const workItemId = workItem.id;
        const workItemTitle = workItem.fields['System.Title'];
        const projectName = workItem.fields['System.TeamProject'];

        // Get current user identity
        const currentUserIdentity = await getCurrentUserIdentity();
        if (!currentUserIdentity) {
          vscode.window.showErrorMessage('Could not determine your user identity. Please ensure you have work items assigned to you.');
          return;
        }

        // Get organization ID and project ID automatically
        const orgId = await api.getOrganizationId();
        const projectGuid = await api.getProjectId(projectName);

        // Fetch available time types from the API
        const timeTypes = await timeLogApi.getTimeTypes(orgId);
        const timeTypeItems = timeTypes.map(tt => ({
          label: tt.description
        }));

        // Step 1: Select time type
        const selectedTimeType = await vscode.window.showQuickPick(timeTypeItems, {
          placeHolder: `Select time type for #${workItemId} - ${workItemTitle}`
        });

        if (!selectedTimeType) {
          return;
        }

        // Step 2: Enter time in minutes
        const minutesString = await vscode.window.showInputBox({
          prompt: `Log time for #${workItemId} - ${workItemTitle}`,
          placeHolder: 'Enter time in minutes (e.g., 30, 60, 90)',
          validateInput: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
              return 'Please enter a valid positive number of minutes';
            }
            return null;
          }
        });

        if (!minutesString) {
          return;
        }

        const minutes = parseInt(minutesString, 10);

        // Step 3: Optional comment
        const comment = await vscode.window.showInputBox({
          prompt: 'Add a comment (optional)',
          placeHolder: 'What did you work on?'
        });

        // Create the time log entry
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        const timeLogEntry: TimeLogEntry = {
          minutes: minutes,
          timeTypeDescription: selectedTimeType.label,
          comment: comment || '',
          date: today,
          workItemId: workItemId,
          projectId: projectGuid,
          users: [{
            userId: currentUserIdentity.id || currentUserIdentity.uniqueName,
            userName: currentUserIdentity.displayName,
            userEmail: currentUserIdentity.uniqueName
          }],
          userMakingChange: currentUserIdentity.displayName
        };

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Logging ${minutes} minutes for work item #${workItemId}...`,
            cancellable: false
          },
          async () => {
            await timeLogApi.createTimeLog(orgId, timeLogEntry);

            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            vscode.window.showInformationMessage(
              `Logged ${timeDisplay} (${selectedTimeType.label}) for #${workItemId}`
            );

            // Refresh views to update any time displays
            await refreshAllViews(sprintBoardProvider, myWorkItemsProvider, projectManagerProvider);
          }
        );
      } catch (error: any) {
        // Check if it's a 401 authentication error
        if (error.message?.includes('401')) {
          const action = await vscode.window.showErrorMessage(
            'Time Logging Extension requires authentication from Azure DevOps. Open work item in browser to log time there.',
            'Open in Browser'
          );
          if (action === 'Open in Browser') {
            const url = api.getWorkItemUrl(treeItem.workItem.id);
            vscode.env.openExternal(vscode.Uri.parse(url));
          }
        } else {
          vscode.window.showErrorMessage(
            `Failed to log time: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
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
  myWorkItemsProvider: MyWorkItemsProvider,
  projectManagerProvider?: ProjectManagerProvider
): Promise<void> {
  const promises = [
    sprintBoardProvider.loadWorkItems(),
    myWorkItemsProvider.loadWorkItems()
  ];

  if (projectManagerProvider) {
    promises.push(projectManagerProvider.loadWorkItems());
  }

  await Promise.all(promises);
}
