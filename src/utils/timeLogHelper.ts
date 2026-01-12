import * as vscode from 'vscode';
import { TimeLogApi, TimeLogEntry } from '../azureDevOps/timeLogApi';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { AiServiceManager } from '../ai/aiServiceManager';
import { formatTimeDisplay } from './timeUtils';

// Re-export formatTimeDisplay for backwards compatibility
export { formatTimeDisplay } from './timeUtils';

/**
 * User identity information for time logging
 */
export interface TimeLogUserIdentity {
  id: string;
  displayName: string;
  uniqueName: string;
}

/**
 * Work item information for time logging
 */
export interface TimeLogWorkItem {
  id: number;
  title: string;
  workItemType: string;
  projectName: string;
}

/**
 * Result of a time logging operation
 */
export interface TimeLogResult {
  success: boolean;
  entriesCreated: number;
  totalMinutes: number;
  error?: string;
}

/**
 * Check if time logging is enabled and properly configured.
 * Shows appropriate prompts if not configured.
 *
 * @returns true if time logging is ready to use, false otherwise
 */
export async function ensureTimeLoggingReady(): Promise<boolean> {
  // Reset to ensure we have the latest configuration
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
    return false;
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
    return false;
  }

  return true;
}

/**
 * Prompt user for time type selection
 */
async function selectTimeType(
  timeLogApi: TimeLogApi,
  orgId: string,
  workItem: TimeLogWorkItem
): Promise<string | undefined> {
  const timeTypes = await timeLogApi.getTimeTypes(orgId);
  const timeTypeItems = timeTypes.map(tt => ({
    label: tt.description,
    description: tt.id !== tt.description ? tt.id : undefined
  }));

  const selectedTimeType = await vscode.window.showQuickPick(timeTypeItems, {
    placeHolder: `Select time type for #${workItem.id} - ${workItem.title}`
  });

  return selectedTimeType?.label;
}

/**
 * Prompt user for minutes input
 */
async function promptForMinutes(workItem: TimeLogWorkItem): Promise<number | undefined> {
  const minutesString = await vscode.window.showInputBox({
    prompt: `Log time for #${workItem.id} - ${workItem.title}`,
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
    return undefined;
  }

  return parseInt(minutesString, 10);
}

/**
 * Get time log entries - either AI-generated or manual
 */
async function getTimeLogEntries(
  workItem: TimeLogWorkItem,
  timeType: string,
  minutes: number,
  aiManager: AiServiceManager
): Promise<Array<{ minutes: number; comment: string }> | undefined> {
  const isAiAvailable = aiManager.isAiEnabled() && await aiManager.isCopilotAvailable();

  if (isAiAvailable) {
    // Show option to auto-generate or enter manually
    const commentOption = await vscode.window.showQuickPick([
      {
        label: '✨ Auto-generate with AI',
        description: minutes > 180 ? `Will create up to 3 entries` : 'Generate comment based on task',
        value: 'auto'
      },
      {
        label: '📝 Enter manually',
        description: 'Type your own comment',
        value: 'manual'
      }
    ], {
      placeHolder: 'How would you like to add comments?'
    });

    if (!commentOption) {
      return undefined;
    }

    if (commentOption.value === 'auto') {
      // Auto-generate comments using AI
      let entries: Array<{ minutes: number; comment: string }> = [];

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating comments with AI...',
          cancellable: false
        },
        async () => {
          entries = await aiManager.generateTimeLogComments(
            workItem.title,
            workItem.workItemType,
            timeType,
            minutes
          );
        }
      );

      return entries;
    }
  }

  // Manual entry
  const comment = await vscode.window.showInputBox({
    prompt: 'Add a comment (optional)',
    placeHolder: 'What did you work on?'
  });

  return [{ minutes, comment: comment || '' }];
}

/**
 * Log time for a work item.
 * This is the main entry point for time logging functionality.
 *
 * @param workItem - The work item to log time against
 * @param userIdentity - The user identity for the time log
 * @param onSuccess - Optional callback called after successful time logging
 * @returns TimeLogResult indicating success/failure
 */
export async function logTimeForWorkItem(
  workItem: TimeLogWorkItem,
  userIdentity: TimeLogUserIdentity,
  onSuccess?: () => Promise<void>
): Promise<TimeLogResult> {
  // Ensure time logging is ready
  if (!await ensureTimeLoggingReady()) {
    return { success: false, entriesCreated: 0, totalMinutes: 0, error: 'Time logging not configured' };
  }

  const timeLogApi = TimeLogApi.getInstance();
  const api = AzureDevOpsApi.getInstance();
  const aiManager = AiServiceManager.getInstance();

  try {
    // Get organization ID and project ID
    const orgId = await api.getOrganizationId();
    const projectGuid = await api.getProjectId(workItem.projectName);

    // Step 1: Select time type
    const timeType = await selectTimeType(timeLogApi, orgId, workItem);
    if (!timeType) {
      return { success: false, entriesCreated: 0, totalMinutes: 0 };
    }

    // Step 2: Enter minutes
    const minutes = await promptForMinutes(workItem);
    if (!minutes) {
      return { success: false, entriesCreated: 0, totalMinutes: 0 };
    }

    // Step 3: Get time log entries (AI or manual)
    const timeLogEntries = await getTimeLogEntries(workItem, timeType, minutes, aiManager);
    if (!timeLogEntries || timeLogEntries.length === 0) {
      return { success: false, entriesCreated: 0, totalMinutes: 0 };
    }

    // Step 4: Create the time log entries
    const today = new Date().toISOString().split('T')[0];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Logging ${timeLogEntries.length > 1 ? `${timeLogEntries.length} entries` : `${minutes} minutes`} for work item #${workItem.id}...`,
        cancellable: false
      },
      async () => {
        for (const entry of timeLogEntries) {
          const timeLogEntry: TimeLogEntry = {
            minutes: entry.minutes,
            timeTypeDescription: timeType,
            comment: entry.comment,
            date: today,
            workItemId: workItem.id,
            projectId: projectGuid,
            users: [{
              userId: userIdentity.id || userIdentity.uniqueName,
              userName: userIdentity.displayName,
              userEmail: userIdentity.uniqueName
            }],
            userMakingChange: userIdentity.displayName
          };

          await timeLogApi.createTimeLog(orgId, timeLogEntry);
        }
      }
    );

    // Calculate totals for result
    const totalMinutes = timeLogEntries.reduce((sum, e) => sum + e.minutes, 0);
    const timeDisplay = formatTimeDisplay(totalMinutes);

    // Show success message
    if (timeLogEntries.length > 1) {
      vscode.window.showInformationMessage(
        `Logged ${timeDisplay} in ${timeLogEntries.length} entries for #${workItem.id}`
      );
    } else {
      vscode.window.showInformationMessage(
        `Logged ${timeDisplay} (${timeType}) for #${workItem.id}`
      );
    }

    // Call success callback if provided
    if (onSuccess) {
      await onSuccess();
    }

    return {
      success: true,
      entriesCreated: timeLogEntries.length,
      totalMinutes
    };

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a 401 authentication error
    if (errorMessage.includes('401')) {
      const action = await vscode.window.showErrorMessage(
        'Time Logging Extension requires authentication from Azure DevOps. Open work item in browser to log time there.',
        'Open in Browser'
      );

      if (action === 'Open in Browser') {
        const api = AzureDevOpsApi.getInstance();
        const url = api.getWorkItemUrl(workItem.id);
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    } else {
      vscode.window.showErrorMessage(`Failed to log time: ${errorMessage}`);
    }

    return {
      success: false,
      entriesCreated: 0,
      totalMinutes: 0,
      error: errorMessage
    };
  }
}

/**
 * Extract user identity from a work item's AssignedTo field
 */
export function extractUserIdentityFromWorkItem(assignedTo: any): TimeLogUserIdentity | null {
  if (!assignedTo) {
    return null;
  }

  return {
    id: assignedTo.id || assignedTo.uniqueName,
    displayName: assignedTo.displayName,
    uniqueName: assignedTo.uniqueName
  };
}
