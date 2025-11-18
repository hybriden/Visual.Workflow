import * as vscode from 'vscode';
import { WorkItem } from '../models/workItem';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { AiServiceManager } from '../ai/aiServiceManager';
import { PlanViewPanel } from './planView';

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
      await this.api.changeWorkItemState(this.workItem.id, newState);
      vscode.window.showInformationMessage(
        `Work item #${this.workItem.id} state changed to "${newState}"`
      );
      await this.refresh();

      // Refresh the sprint board
      vscode.commands.executeCommand('azureDevOps.refreshWorkItems');
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

    // Parent work item info
    const parentInfo = this.parentWorkItem ? `#${this.parentWorkItem.id} - ${this.parentWorkItem.fields['System.Title']}` : null;
    const parentType = this.parentWorkItem ? this.parentWorkItem.fields['System.WorkItemType'] : null;

    // Common state transitions
    const stateOptions = this.getStateOptions(state);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Work Item #${id}</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        .header {
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .work-item-id {
          color: var(--vscode-descriptionForeground);
          font-size: 14px;
        }
        .work-item-title {
          font-size: 24px;
          font-weight: 600;
          margin: 10px 0;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 500;
          margin-right: 8px;
        }
        .type-badge {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .state-badge {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        .section {
          margin: 20px 0;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 10px;
          color: var(--vscode-foreground);
        }
        .field {
          margin: 12px 0;
          display: flex;
        }
        .field-label {
          font-weight: 600;
          min-width: 150px;
          color: var(--vscode-descriptionForeground);
        }
        .field-value {
          flex: 1;
        }
        .description {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          padding: 15px;
          margin: 10px 0;
          white-space: pre-wrap;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          margin: 5px 5px 5px 0;
          cursor: pointer;
          border-radius: 2px;
          font-size: 13px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
        select {
          background-color: var(--vscode-dropdown-background);
          color: var(--vscode-dropdown-foreground);
          border: 1px solid var(--vscode-dropdown-border);
          padding: 6px 12px;
          margin-right: 10px;
          border-radius: 2px;
          font-size: 13px;
        }
        .actions {
          margin: 20px 0;
          padding: 15px 0;
          border-top: 1px solid var(--vscode-panel-border);
        }
        .ai-banner {
          background-color: var(--vscode-inputValidation-warningBackground);
          border: 1px solid var(--vscode-inputValidation-warningBorder);
          border-radius: 4px;
          padding: 12px;
          margin: 10px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ai-banner-text {
          flex: 1;
          color: var(--vscode-foreground);
        }
        .ai-banner button {
          margin-left: 10px;
          white-space: nowrap;
        }
        .description-textarea {
          width: 100%;
          min-height: 150px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          padding: 12px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          border-radius: 2px;
          resize: vertical;
        }
        .description-textarea:focus {
          outline: 1px solid var(--vscode-focusBorder);
        }
        .ai-generate-btn {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          padding: 8px 16px;
          font-size: 13px;
          cursor: pointer;
          border-radius: 2px;
          margin: 0;
        }
        .ai-generate-btn:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .ai-plan-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 8px 16px;
          margin: 5px 5px 5px 0;
          cursor: pointer;
          border-radius: 2px;
          font-size: 13px;
          font-weight: 500;
        }
        .ai-plan-btn:hover {
          background: linear-gradient(135deg, #5568d3 0%, #653a8a 100%);
        }
        .comments-container {
          margin-top: 10px;
        }
        .comment {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 10px;
        }
        .comment-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .comment-author {
          font-weight: 600;
          color: var(--vscode-foreground);
        }
        .comment-date {
          color: var(--vscode-descriptionForeground);
          font-size: 12px;
        }
        .comment-text {
          color: var(--vscode-foreground);
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .comment-text strong {
          color: var(--vscode-textLink-foreground);
          font-weight: 600;
        }
        .comment-text a {
          color: var(--vscode-textLink-foreground);
          text-decoration: none;
        }
        .comment-text a:hover {
          text-decoration: underline;
        }
        .delete-comment-btn {
          background-color: transparent;
          border: 1px solid var(--vscode-button-secondaryBackground);
          color: var(--vscode-errorForeground);
          padding: 2px 6px;
          cursor: pointer;
          border-radius: 2px;
          font-size: 12px;
          margin: 0;
        }
        .delete-comment-btn:hover {
          background-color: var(--vscode-button-secondaryBackground);
        }
        .estimate-dialog {
          display: none;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          padding: 20px;
          border-radius: 4px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          min-width: 300px;
        }
        .estimate-dialog.show {
          display: block;
        }
        .estimate-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }
        .estimate-overlay.show {
          display: block;
        }
        .estimate-input {
          width: 100%;
          padding: 8px;
          margin: 10px 0;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
        }
        .estimate-input:focus {
          outline: 1px solid var(--vscode-focusBorder);
        }
      </style>
    </head>
    <body>
      <div class="estimate-overlay" id="estimateOverlay" onclick="closeEstimateDialog()"></div>
      <div class="estimate-dialog" id="estimateDialog">
        <h3 style="margin-top: 0;">Set Remaining Work Estimate</h3>
        <p style="color: var(--vscode-descriptionForeground); margin: 10px 0;">Enter the estimated remaining work in hours:</p>
        <input type="number" id="estimateInput" class="estimate-input" placeholder="Hours (e.g., 8)" min="0" step="0.5" value="${remainingWork || 0}" />
        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
          <button class="secondary" onclick="closeEstimateDialog()">Cancel</button>
          <button onclick="submitEstimate()">Set Estimate</button>
        </div>
      </div>

      <div class="header">
        <div class="work-item-id">Work Item #${id}</div>
        <h1 class="work-item-title">${title}</h1>
        <div>
          <span class="badge type-badge">${workItemType}</span>
          <span class="badge state-badge">${state}</span>
        </div>
      </div>

      <div class="actions">
        <div class="section-title">Actions</div>
        <div style="margin-top: 15px;">
          <select id="stateSelect">
            <option value="">-- Change State --</option>
            ${stateOptions}
          </select>
          <button onclick="changeState()">Update State</button>
          <button class="secondary" onclick="showEstimateDialog()">⏱️ Set Estimate</button>
          <button class="secondary" onclick="refresh()">Refresh</button>
          <button class="secondary" onclick="openInBrowser()">Open in Browser</button>
          ${isAiProviderAvailable ? `<button class="ai-plan-btn" onclick="generatePlan()" title="Generate implementation plan with AI">🎯 Plan</button>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Description</div>
        <textarea id="descriptionText" class="description-textarea" placeholder="Enter work item description...">${this.stripHtml(description)}</textarea>
        <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
          <button onclick="saveDescription()">Save Description</button>
          ${isAiEnabled ? `<button class="ai-generate-btn" onclick="generateWithAI()" title="Generate description with AI">✨ Generate with AI</button>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Details</div>
        ${parentInfo ? `<div class="field">
          <div class="field-label">Parent ${parentType}:</div>
          <div class="field-value" style="cursor: pointer; color: var(--vscode-textLink-foreground);" onclick="openParent()">${parentInfo}</div>
        </div>` : ''}
        <div class="field">
          <div class="field-label">Assigned To:</div>
          <div class="field-value">${assignedTo}</div>
        </div>
        <div class="field">
          <div class="field-label">Area Path:</div>
          <div class="field-value">${areaPath}</div>
        </div>
        <div class="field">
          <div class="field-label">Iteration:</div>
          <div class="field-value">${iterationPath}</div>
        </div>
        <div class="field">
          <div class="field-label">Tags:</div>
          <div class="field-value">${tags}</div>
        </div>
        <div class="field">
          <div class="field-label">Remaining Work:</div>
          <div class="field-value">${remainingWork}h</div>
        </div>
        <div class="field">
          <div class="field-label">Created:</div>
          <div class="field-value">${createdDate}</div>
        </div>
        <div class="field">
          <div class="field-label">Last Updated:</div>
          <div class="field-value">${changedDate}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Comments${this.comments.length > 0 ? ` (${this.comments.length})` : ''}</div>

        <!-- Add Comment Form -->
        <div style="margin-bottom: 20px;">
          <textarea id="commentInput" class="description-textarea" placeholder="Add a comment..." style="min-height: 80px;"></textarea>
          <div style="margin-top: 10px;">
            <button onclick="addComment()">Add Comment</button>
          </div>
        </div>

        <!-- Existing Comments -->
        ${this.comments.length > 0 ? `
        <div class="comments-container">
          ${this.comments.map(comment => `
            <div class="comment">
              <div class="comment-header">
                <span class="comment-author">${this.escapeHtml(comment.createdBy?.displayName || 'Unknown')}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="comment-date">${new Date(comment.createdDate).toLocaleString()}</span>
                  <button class="delete-comment-btn" onclick="deleteComment(${comment.id})" title="Delete comment">🗑️</button>
                </div>
              </div>
              <div class="comment-text">${this.sanitizeCommentHtml(comment.text)}</div>
            </div>
          `).join('')}
        </div>
        ` : '<p style="color: var(--vscode-descriptionForeground); margin-top: 10px;">No comments yet. Be the first to add one!</p>'}
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function openInBrowser() {
          vscode.postMessage({ command: 'openInBrowser' });
        }

        function changeState() {
          const select = document.getElementById('stateSelect');
          const newState = select.value;
          if (newState) {
            vscode.postMessage({
              command: 'changeState',
              newState: newState
            });
          }
        }

        function refresh() {
          vscode.postMessage({ command: 'refresh' });
        }

        function generateWithAI() {
          const textarea = document.getElementById('descriptionText');
          const existingDescription = textarea.value;
          vscode.postMessage({ 
            command: 'generateDescription',
            existingDescription: existingDescription 
          });
        }

        function saveDescription() {
          const textarea = document.getElementById('descriptionText');
          const newDescription = textarea.value;
          vscode.postMessage({
            command: 'saveDescription',
            description: newDescription
          });
        }

        function openParent() {
          vscode.postMessage({ command: 'openParent' });
        }

        function generatePlan() {
          vscode.postMessage({ command: 'generatePlan' });
        }

        function addComment() {
          const textarea = document.getElementById('commentInput');
          const commentText = textarea.value.trim();
          if (commentText) {
            vscode.postMessage({
              command: 'addComment',
              commentText: commentText
            });
            // Clear the textarea
            textarea.value = '';
          }
        }

        function deleteComment(commentId) {
          vscode.postMessage({
            command: 'deleteComment',
            commentId: commentId
          });
        }

        function showEstimateDialog() {
          document.getElementById('estimateDialog').classList.add('show');
          document.getElementById('estimateOverlay').classList.add('show');
          // Focus on the input
          setTimeout(() => {
            document.getElementById('estimateInput').focus();
            document.getElementById('estimateInput').select();
          }, 100);
        }

        function closeEstimateDialog() {
          document.getElementById('estimateDialog').classList.remove('show');
          document.getElementById('estimateOverlay').classList.remove('show');
        }

        function submitEstimate() {
          const input = document.getElementById('estimateInput');
          const hours = input.value;
          if (hours !== '') {
            vscode.postMessage({
              command: 'setEstimate',
              hours: hours
            });
            closeEstimateDialog();
          }
        }

        // Allow Enter key to submit estimate
        document.addEventListener('DOMContentLoaded', function() {
          const estimateInput = document.getElementById('estimateInput');
          if (estimateInput) {
            estimateInput.addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                submitEstimate();
              }
            });
          }
        });

      </script>
    </body>
    </html>`;
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

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
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
