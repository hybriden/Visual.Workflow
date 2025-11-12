import * as vscode from 'vscode';
import { WorkItem } from '../models/workItem';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { OpenAiService } from '../ai/openAiService';

/**
 * Webview panel for displaying work item details
 */
export class WorkItemViewPanel {
  public static currentPanel: WorkItemViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private workItem: WorkItem;
  private api: AzureDevOpsApi;
  private openAiService: OpenAiService;
  private validStates: string[] = [];

  private constructor(panel: vscode.WebviewPanel, workItem: WorkItem) {
    this._panel = panel;
    this.workItem = workItem;
    this.api = AzureDevOpsApi.getInstance();
    this.openAiService = OpenAiService.getInstance();

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
            await this.generateDescription();
            break;
          case 'saveDescription':
            await this.saveDescription(message.description);
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

  private async generateDescription() {
    try {
      // Check if OpenAI is configured
      if (!this.openAiService.isConfigured()) {
        const configured = await this.openAiService.promptForApiKey();
        if (!configured) {
          return;
        }
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating description with AI...',
          cancellable: false
        },
        async () => {
          // Generate description
          const description = await this.openAiService.generateDescription(this.workItem);

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
    
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const fields = this.workItem.fields;
    const workItemType = fields['System.WorkItemType'];
    const state = fields['System.State'];
    const title = fields['System.Title'];
    const id = fields['System.Id'];
    const description = fields['System.Description'] || '';
    const hasDescription = description.trim() !== '';
    const isAiConfigured = this.openAiService.isConfigured();
    const assignedTo = fields['System.AssignedTo']?.displayName || 'Unassigned';
    const createdDate = new Date(fields['System.CreatedDate']).toLocaleString();
    const changedDate = new Date(fields['System.ChangedDate']).toLocaleString();
    const areaPath = fields['System.AreaPath'];
    const iterationPath = fields['System.IterationPath'];
    const tags = fields['System.Tags'] || 'No tags';
    const remainingWork = fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0;

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
        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ai-icon-btn {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          border-radius: 2px;
          margin-left: 10px;
        }
        .ai-icon-btn:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="work-item-id">Work Item #${id}</div>
        <h1 class="work-item-title">${title}</h1>
        <div>
          <span class="badge type-badge">${workItemType}</span>
          <span class="badge state-badge">${state}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          Description
          ${isAiConfigured ? `<button class="ai-icon-btn" onclick="generateWithAI()" title="Generate description with AI">✨ AI</button>` : ''}
        </div>
        <textarea id="descriptionText" class="description-textarea" placeholder="Enter work item description...">${this.stripHtml(description)}</textarea>
        <div style="margin-top: 10px;">
          <button onclick="saveDescription()">Save Description</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Details</div>
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

      <div class="actions">
        <div class="section-title">Actions</div>
        <div style="margin-top: 15px;">
          <select id="stateSelect">
            <option value="">-- Change State --</option>
            ${stateOptions}
          </select>
          <button onclick="changeState()">Update State</button>
          <button class="secondary" onclick="refresh()">Refresh</button>
          <button class="secondary" onclick="openInBrowser()">Open in Browser</button>
        </div>
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
          vscode.postMessage({ command: 'generateDescription' });
        }

        function saveDescription() {
          const textarea = document.getElementById('descriptionText');
          const newDescription = textarea.value;
          vscode.postMessage({
            command: 'saveDescription',
            description: newDescription
          });
        }
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
}
