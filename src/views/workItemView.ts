import * as vscode from 'vscode';
import { WorkItem } from '../models/workItem';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { AiServiceManager } from '../ai/aiServiceManager';
import { PlanViewPanel } from './planView';
import { EstimateChecker } from '../utils/estimateChecker';
import { shouldPromptParentUpdate, promptAndUpdateParent } from '../utils/parentStatusHelper';
import { TimeLogApi, TimeLogRecord } from '../azureDevOps/timeLogApi';
import { logTimeForWorkItem, extractUserIdentityFromWorkItem } from '../utils/timeLogHelper';
import { generateWorkItemHtml, WorkItemTemplateData } from '../templates/workItemTemplate';

/**
 * Webview panel for displaying work item details
 */
export class WorkItemViewPanel {
  public static currentPanel: WorkItemViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private workItem: WorkItem;
  private api: AzureDevOpsApi;
  private aiManager: AiServiceManager;
  private validStates: string[] = [];
  private parentWorkItem: WorkItem | undefined;
  private comments: any[] = [];
  private timeLogs: TimeLogRecord[] = [];

  private constructor(panel: vscode.WebviewPanel, workItem: WorkItem) {
    this._panel = panel;
    this.workItem = workItem;
    this.api = AzureDevOpsApi.getInstance();
    this.aiManager = AiServiceManager.getInstance();

    this._update().catch(error => {
      console.error('Error updating work item view:', error);
    });

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'openInBrowser':
            const url = this.api.getWorkItemUrl(this.workItem.id);
            vscode.env.openExternal(vscode.Uri.parse(url));
            break;
          case 'changeState':
            await this.changeState(message.newState);
            break;
          case 'refresh':
            await this.refresh();
            break;
          case 'generateDescription':
            await this.generateDescription(message.existingDescription);
            break;
          case 'saveDescription':
            await this.saveDescription(message.description);
            break;
          case 'generatePlan':
            await this.generatePlan();
            break;
          case 'openParent':
            if (this.parentWorkItem) {
              WorkItemViewPanel.createOrShow(this.parentWorkItem);
            }
            break;
          case 'addComment':
            await this.addComment(message.commentText);
            break;
          case 'deleteComment':
            await this.deleteComment(message.commentId);
            break;
          case 'setEstimate':
            await this.setEstimate(message.hours);
            break;
          case 'assignToMe':
            await this.assignToMe();
            break;
          case 'logTime':
            await this.logTime();
            break;
          case 'deleteTimeLog':
            await this.deleteTimeLog(message.timeLogId);
            break;
          case 'editTimeLog':
            await this.editTimeLog(message.timeLogId, message.currentMinutes, message.currentComment);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(workItem: WorkItem) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (WorkItemViewPanel.currentPanel) {
      WorkItemViewPanel.currentPanel.workItem = workItem;
      WorkItemViewPanel.currentPanel._update().catch(error => {
        console.error('Error updating work item view:', error);
      });
      WorkItemViewPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'workItemView',
      `Work Item #${workItem.id}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    WorkItemViewPanel.currentPanel = new WorkItemViewPanel(panel, workItem);
  }

  private async changeState(newState: string) {
    try {
      const updatedWorkItem = await this.api.changeWorkItemState(this.workItem.id, newState);

      // Update local work item reference
      this.workItem = updatedWorkItem;
      await this.refresh();

      // Refresh the sprint board (full refresh will get latest data)
      vscode.commands.executeCommand('azureDevOps.refreshWorkItems');

      // Check if we should prompt to update parent
      const parent = await shouldPromptParentUpdate(this.workItem, newState);
      if (parent) {
        const updated = await promptAndUpdateParent(parent, this.workItem.id, newState);
        if (updated) {
          // Refresh again if parent was updated
          await this.refresh();
          vscode.commands.executeCommand('azureDevOps.refreshWorkItems');
        }
      } else {
        // Only show success message if we're not prompting for parent
        vscode.window.showInformationMessage(
          `Work item #${this.workItem.id} state changed to "${newState}"`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to change state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async refresh() {
    try {
      this.workItem = await this.api.getWorkItem(this.workItem.id);
      this._update();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh work item: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async generateDescription(existingDescription?: string) {
    try {
      // Check if AI is enabled
      if (!this.aiManager.isAiEnabled()) {
        const enable = await vscode.window.showInformationMessage(
          'AI suggestions are disabled. Would you like to enable them?',
          'Enable',
          'Cancel'
        );

        if (enable !== 'Enable') {
          return;
        }

        const config = vscode.workspace.getConfiguration('azureDevOps');
        await config.update('enableAiSuggestions', true, vscode.ConfigurationTarget.Global);
      }

      // Check if Copilot is available
      if (!await this.aiManager.isCopilotAvailable()) {
        const install = await vscode.window.showInformationMessage(
          'GitHub Copilot is not available. Would you like to install it?',
          'Install',
          'Cancel'
        );

        if (install === 'Install') {
          await this.aiManager.promptToInstallCopilot();
        }
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating description with GitHub Copilot...',
          cancellable: false
        },
        async () => {
          // Generate description
          const description = await this.aiManager.generateDescription(this.workItem, existingDescription);

          // Update work item with new description
          const updates = [
            {
              op: 'add',
              path: '/fields/System.Description',
              value: description
            }
          ];

          await this.api.updateWorkItem(this.workItem.id, updates);

          // Refresh the view
          this.workItem = await this.api.getWorkItem(this.workItem.id);
          await this._update();

          vscode.window.showInformationMessage('Description generated and saved successfully!');

          // Refresh the sprint board
          vscode.commands.executeCommand('azureDevOps.refreshWorkItems');
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async saveDescription(description: string) {
    try {
      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Saving description...',
          cancellable: false
        },
        async () => {
          // Update work item with new description
          const updates = [
            {
              op: 'add',
              path: '/fields/System.Description',
              value: description
            }
          ];

          await this.api.updateWorkItem(this.workItem.id, updates);

          // Refresh the view
          this.workItem = await this.api.getWorkItem(this.workItem.id);
          await this._update();

          vscode.window.showInformationMessage('Description saved successfully!');

          // Refresh the sprint board
          vscode.commands.executeCommand('azureDevOps.refreshWorkItems');
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async generatePlan() {
    try {
      // Check if AI is enabled
      if (!this.aiManager.isAiEnabled()) {
        const enable = await vscode.window.showInformationMessage(
          'AI suggestions are disabled. Would you like to enable them?',
          'Enable',
          'Cancel'
        );

        if (enable !== 'Enable') {
          return;
        }

        const config = vscode.workspace.getConfiguration('azureDevOps');
        await config.update('enableAiSuggestions', true, vscode.ConfigurationTarget.Global);
      }

      // Check if Copilot is available
      if (!await this.aiManager.isCopilotAvailable()) {
        const install = await vscode.window.showInformationMessage(
          'GitHub Copilot is not available. Would you like to install it?',
          'Install',
          'Cancel'
        );

        if (install === 'Install') {
          await this.aiManager.promptToInstallCopilot();
        }
        return;
      }

      // Generate the plan
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating implementation plan with GitHub Copilot...',
          cancellable: false
        },
        async () => {
          const plan = await this.aiManager.generateImplementationPlan(this.workItem);

          // Show the plan in a new panel
          PlanViewPanel.createOrShow(this.workItem, plan);

          vscode.window.showInformationMessage('Implementation plan generated successfully!');
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async addComment(commentText: string) {
    try {
      if (!commentText || commentText.trim() === '') {
        vscode.window.showWarningMessage('Please enter a comment.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Adding comment...',
          cancellable: false
        },
        async () => {
          await this.api.addWorkItemComment(this.workItem.id, commentText);

          vscode.window.showInformationMessage('Comment added successfully!');

          // Refresh the view to show the new comment
          await this.refresh();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async deleteComment(commentId: number) {
    try {
      // Confirm deletion
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this comment?',
        'Delete',
        'Cancel'
      );

      if (confirm !== 'Delete') {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Deleting comment...',
          cancellable: false
        },
        async () => {
          await this.api.deleteWorkItemComment(this.workItem.id, commentId);

          vscode.window.showInformationMessage('Comment deleted successfully!');

          // Refresh the view to remove the deleted comment
          await this.refresh();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async setEstimate(hours: string) {
    try {
      const hoursNum = parseFloat(hours);

      if (isNaN(hoursNum) || hoursNum < 0) {
        vscode.window.showWarningMessage('Please enter a valid number of hours (0 or greater).');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Updating estimate...',
          cancellable: false
        },
        async () => {
          const updates = [
            {
              op: 'add',
              path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',
              value: hoursNum
            }
          ];

          await this.api.updateWorkItem(this.workItem.id, updates);

          vscode.window.showInformationMessage(
            `Work item #${this.workItem.id} estimate set to ${hoursNum}h`
          );

          // Refresh the view to show the updated estimate
          await this.refresh();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to set estimate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async logTime() {
    // Get current user identity from the work item's assigned to field
    const assignedTo = this.workItem.fields['System.AssignedTo'];
    const userIdentity = extractUserIdentityFromWorkItem(assignedTo);

    if (!userIdentity) {
      vscode.window.showErrorMessage('Could not determine your user identity. Please ensure you are assigned to this work item.');
      return;
    }

    // Use shared time logging helper
    await logTimeForWorkItem(
      {
        id: this.workItem.id,
        title: this.workItem.fields['System.Title'],
        workItemType: this.workItem.fields['System.WorkItemType'],
        projectName: this.workItem.fields['System.TeamProject']
      },
      userIdentity,
      async () => {
        // Refresh the view after successful time logging
        await this.refresh();
      }
    );
  }

  private async deleteTimeLog(timeLogId: string) {
    try {

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Deleting time log...',
          cancellable: false
        },
        async () => {
          TimeLogApi.resetInstance();
          const timeLogApi = TimeLogApi.getInstance();
          const orgId = await this.api.getOrganizationId();

          await timeLogApi.deleteTimeLog(orgId, timeLogId);

          vscode.window.showInformationMessage('Time log entry deleted.');
          await this.refresh();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete time log: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async editTimeLog(timeLogId: string, currentMinutes: number, currentComment: string) {
    try {
      // Find the time log entry to get all its data
      const timeLog = this.timeLogs.find(log => log.timeLogId === timeLogId);
      if (!timeLog) {
        vscode.window.showErrorMessage('Time log entry not found.');
        return;
      }

      TimeLogApi.resetInstance();
      const timeLogApi = TimeLogApi.getInstance();
      const orgId = await this.api.getOrganizationId();
      const projectId = await this.api.getProjectId(this.workItem.fields['System.TeamProject']);

      // Ask for new minutes
      const minutesString = await vscode.window.showInputBox({
        prompt: 'Edit time (in minutes)',
        value: currentMinutes.toString(),
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

      // Ask for new comment
      const comment = await vscode.window.showInputBox({
        prompt: 'Edit comment',
        value: currentComment || ''
      });

      if (comment === undefined) {
        return; // User cancelled
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Updating time log...',
          cancellable: false
        },
        async () => {
          await timeLogApi.updateTimeLog(orgId, timeLogId, {
            minutes,
            comment,
            timeTypeDescription: timeLog.timeTypeDescription,
            date: timeLog.date,
            workItemId: this.workItem.id,
            projectId: projectId,
            userName: timeLog.userName,
            userId: timeLog.userId,
            userEmail: timeLog.userEmail,
            userMakingChange: timeLog.userName
          });

          vscode.window.showInformationMessage('Time log entry updated.');
          await this.refresh();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to update time log: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async assignToMe() {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Assigning to you...',
          cancellable: false
        },
        async () => {
          await vscode.commands.executeCommand('azureDevOps.assignToMe', this.workItem);

          // Refresh the view to show the updated assignment
          await this.refresh();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to assign: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public dispose() {
    WorkItemViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private async _update() {
    const webview = this._panel.webview;
    this._panel.title = `#${this.workItem.id} - ${this.workItem.fields['System.Title']}`;

    // Fetch valid states for this work item type
    const workItemType = this.workItem.fields['System.WorkItemType'];
    try {
      this.validStates = await this.api.getWorkItemStates(workItemType);
    } catch (error) {
      console.error('Error fetching valid states:', error);
      this.validStates = ['Active', 'Resolved', 'Closed'];
    }

    // Fetch parent work item if it exists
    const parentId = this.workItem.fields['System.Parent'];
    if (parentId) {
      try {
        this.parentWorkItem = await this.api.getWorkItem(parentId);
      } catch (error) {
        console.error('Error fetching parent work item:', error);
        this.parentWorkItem = undefined;
      }
    } else {
      this.parentWorkItem = undefined;
    }

    // Fetch comments for this work item
    try {
      this.comments = await this.api.getWorkItemComments(this.workItem.id);
    } catch (error) {
      console.error('Error fetching comments:', error);
      this.comments = [];
    }

    // Fetch time logs if Time Logging Extension is enabled
    const timeLogApi = TimeLogApi.getInstance();
    if (timeLogApi.isEnabled() && timeLogApi.hasApiKey()) {
      try {
        const projectName = this.workItem.fields['System.TeamProject'];
        const orgId = await this.api.getOrganizationId();
        const projectId = await this.api.getProjectId(projectName);
        this.timeLogs = await timeLogApi.getTimeLogs(orgId, projectId, this.workItem.id);
      } catch (error) {
        console.error('Error fetching time logs:', error);
        this.timeLogs = [];
      }
    } else {
      this.timeLogs = [];
    }

    this._panel.webview.html = await this._getHtmlForWebview(webview);
  }

  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const fields = this.workItem.fields;
    const workItemType = fields['System.WorkItemType'];
    const state = fields['System.State'];
    const title = fields['System.Title'];
    const id = fields['System.Id'];
    const description = fields['System.Description'] || '';
    const hasDescription = description.trim() !== '';
    const isAiEnabled = this.aiManager.isAiEnabled();
    const isAiProviderAvailable = await this.aiManager.isCopilotAvailable();
    const assignedTo = fields['System.AssignedTo']?.displayName || 'Unassigned';
    const createdDate = new Date(fields['System.CreatedDate']).toLocaleString();
    const changedDate = new Date(fields['System.ChangedDate']).toLocaleString();
    const areaPath = fields['System.AreaPath'];
    const iterationPath = fields['System.IterationPath'];
    const tags = fields['System.Tags'] || 'No tags';
    const remainingWork = fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0;

    // Estimate summary and over-estimate check
    const estimateSummary = EstimateChecker.getEstimateSummary(this.workItem);
    const showAlerts = vscode.workspace.getConfiguration('azureDevOps').get<boolean>('showOverEstimateAlerts', true);

    // Parent work item info
    const parentInfo = this.parentWorkItem ? `#${this.parentWorkItem.id} - ${this.parentWorkItem.fields['System.Title']}` : null;
    const parentType = this.parentWorkItem ? this.parentWorkItem.fields['System.WorkItemType'] : null;

    // Common state transitions
    const stateOptions = this.getStateOptions(state);

    // Time log summary
    const totalMinutesLogged = this.timeLogs.reduce((sum, log) => sum + log.minutes, 0);
    const totalHoursLogged = Math.floor(totalMinutesLogged / 60);
    const totalMinsLogged = totalMinutesLogged % 60;
    const totalTimeDisplay = totalHoursLogged > 0
      ? `${totalHoursLogged}h ${totalMinsLogged}m`
      : `${totalMinsLogged}m`;
    const timeLogEnabled = TimeLogApi.getInstance().isEnabled() && TimeLogApi.getInstance().hasApiKey();

    // Build template data
    const templateData: WorkItemTemplateData = {
      id: this.workItem.id,
      title,
      workItemType,
      state,
      description: this.stripHtml(description),
      assignedTo,
      createdDate,
      changedDate,
      areaPath,
      iterationPath,
      tags,
      remainingWork,
      stateOptions,
      isAiEnabled,
      isAiProviderAvailable,
      timeLogEnabled,
      parentInfo: parentInfo || undefined,
      parentType: parentType || undefined,
      estimateSummary,
      showAlerts,
      timeLogs: this.timeLogs,
      totalTimeDisplay,
      comments: this.comments.map(c => ({
        id: c.id,
        createdBy: c.createdBy,
        createdDate: c.createdDate,
        text: this.sanitizeCommentHtml(c.text)
      }))
    };

    return generateWorkItemHtml(templateData);
  }

  private getStateOptions(currentState: string): string {
    // Use the dynamically fetched valid states
    // Filter out the current state from the available options
    const availableStates = this.validStates.filter(state => state !== currentState);

    // If no states were fetched, provide some defaults
    if (availableStates.length === 0) {
      return '<option value="Active">Active</option><option value="Closed">Closed</option>';
    }

    return availableStates
      .map(state => `<option value="${state}">${state}</option>`)
      .join('\n');
  }

  private stripHtml(html: string): string {
    // Basic HTML stripping - in production, use a proper HTML parser
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }


  private sanitizeCommentHtml(html: string): string {
    if (!html) return '';

    // Allow safe HTML tags and attributes for comment rendering
    // This handles Azure DevOps comment formatting including mentions
    let result = html;

    // First, handle mentions with GUIDs that appear as @&lt;GUID&gt; (outside of link tags)
    // Use a more flexible pattern that handles hexadecimal characters
    result = result.replace(/@&lt;([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})&gt;/g, '<strong>@User</strong>');

    // Also handle @<GUID> format (if angle brackets are not encoded)
    result = result.replace(/@<([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})>/g, '<strong>@User</strong>');

    // Convert Azure DevOps mentions inside link tags to plain text
    // Handle mentions with display names (e.g., @Stefan Holm Olsen)
    result = result.replace(/<a[^>]*data-vss-mention[^>]*>@([^<]+)<\/a>/gi, (match, name) => {
      // Decode HTML entities first (e.g., &lt; to <, &gt; to >)
      const decodedName = name
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      // Check if the name is a GUID pattern (UUID), with or without angle brackets
      const guidPattern = /^<?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}>?$/;
      if (guidPattern.test(decodedName)) {
        // If it's a GUID, just show "@User" instead of the GUID
        return '<strong>@User</strong>';
      }
      // Otherwise, show the actual name (keep HTML encoded for safety)
      return `<strong>@${name}</strong>`;
    });

    // Keep basic formatting tags
    result = result.replace(/<div>/gi, '');
    result = result.replace(/<\/div>/gi, '<br>');
    result = result.replace(/&nbsp;/g, ' ');

    // Remove any remaining attributes from links but keep the link
    result = result.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');

    // Clean up multiple line breaks
    result = result.replace(/(<br>\s*){3,}/gi, '<br><br>');

    return result;
  }
}
