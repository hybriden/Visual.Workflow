import * as vscode from 'vscode';
import { WorkItem } from '../models/workItem';
import { AzureDevOpsApi } from '../azureDevOps/api';

/**
 * Check if we should prompt to update parent status
 * Returns the parent work item if it should be updated, null otherwise
 */
export async function shouldPromptParentUpdate(workItem: WorkItem, newState: string): Promise<WorkItem | null> {
  const api = AzureDevOpsApi.getInstance();

  // Check if work item has a parent
  const parentId = workItem.fields['System.Parent'];
  if (!parentId) {
    return null;
  }

  // Check if new state is "in progress" type
  const inProgressStates = ['In Progress', 'Active', 'Committed'];
  if (!inProgressStates.includes(newState)) {
    return null;
  }

  try {
    // Fetch parent work item
    const parent = await api.getWorkItem(parentId);

    // Check if parent is in "not started" state
    const notStartedStates = ['New', 'To Do', 'Proposed'];
    const parentState = parent.fields['System.State'];

    if (notStartedStates.includes(parentState)) {
      return parent;
    }
  } catch (error) {
    console.error('Error fetching parent work item:', error);
  }

  return null;
}

/**
 * Prompt user to update parent status and execute if confirmed
 */
export async function promptAndUpdateParent(parent: WorkItem, childId: number, childNewState: string): Promise<boolean> {
  const api = AzureDevOpsApi.getInstance();
  const parentId = parent.fields['System.Id'];
  const parentTitle = parent.fields['System.Title'];
  const parentState = parent.fields['System.State'];
  const parentType = parent.fields['System.WorkItemType'];

  // Get valid states for parent
  const validStates = await api.getWorkItemStates(parentType);

  // Suggest an appropriate state for the parent
  const suggestedStates = ['In Progress', 'Active', 'Committed'];
  const suggestedState = validStates.find(state => suggestedStates.includes(state));

  if (!suggestedState) {
    return false; // No appropriate state available
  }

  // Wait a moment for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));

  // Ask user if they want to update parent
  const message = `Child task #${childId} is now "${childNewState}". ` +
    `Do you want to move parent #${parentId} (${parentTitle}) from "${parentState}" to "${suggestedState}"?`;

  const action = await vscode.window.showInformationMessage(
    message,
    { modal: true },
    'Yes, Update Parent',
    'No, Keep As Is'
  );

  if (action === 'Yes, Update Parent') {
    try {
      await api.changeWorkItemState(parentId, suggestedState);
      vscode.window.showInformationMessage(
        `Parent work item #${parentId} state changed to "${suggestedState}"`
      );
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to update parent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return false;
}
