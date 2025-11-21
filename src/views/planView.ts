import * as vscode from 'vscode';
import { WorkItem } from '../models/workItem';
import { GitHubApi } from '../github/githubApi';

/**
 * Webview panel for displaying implementation plans
 */
export class PlanViewPanel {
  public static currentPanel: PlanViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private workItem: WorkItem;
  private plan: string;

  private constructor(panel: vscode.WebviewPanel, workItem: WorkItem, plan: string) {
    this._panel = panel;
    this.workItem = workItem;
    this.plan = plan;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'copyPlan':
            await vscode.env.clipboard.writeText(this.plan);
            vscode.window.showInformationMessage('Plan copied to clipboard!');
            break;
          case 'openWorkItem':
            vscode.commands.executeCommand('azureDevOps.viewWorkItemDetails', this.workItem);
            break;
          case 'loadOrganizations':
            await this.handleLoadOrganizations();
            break;
          case 'loadRepositories':
            await this.handleLoadRepositories(message.organization);
            break;
          case 'createIssueWithCopilot':
            await this.handleCreateIssueWithCopilot(message.organization, message.repository);
            break;
          case 'savePlan':
            this.plan = message.plan;
            this._update();
            vscode.window.showInformationMessage('Plan updated successfully!');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(workItem: WorkItem, plan: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, update it
    if (PlanViewPanel.currentPanel) {
      PlanViewPanel.currentPanel.workItem = workItem;
      PlanViewPanel.currentPanel.plan = plan;
      PlanViewPanel.currentPanel._update();
      PlanViewPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'planView',
      `Plan: ${workItem.fields['System.Title']}`,
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    PlanViewPanel.currentPanel = new PlanViewPanel(panel, workItem, plan);
  }

  public dispose() {
    PlanViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Handle loading GitHub organizations
   */
  private async handleLoadOrganizations(): Promise<void> {
    try {
      const githubApi = GitHubApi.getInstance();

      const isConfigured = await githubApi.isConfigured();
      if (!isConfigured) {
        this._panel.webview.postMessage({
          command: 'organizationsLoaded',
          organizations: [],
          error: 'GitHub authentication failed. Please sign in to GitHub.'
        });
        return;
      }

      const organizations = await githubApi.getOrganizations();
      const user = await githubApi.getAuthenticatedUser();

      // Add user's personal repos as an option
      const allOrgs = [
        { login: user.login, id: 0, description: 'Personal repositories' },
        ...organizations
      ];

      this._panel.webview.postMessage({
        command: 'organizationsLoaded',
        organizations: allOrgs
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'organizationsLoaded',
        organizations: [],
        error: error instanceof Error ? error.message : 'Failed to load organizations'
      });
    }
  }

  /**
   * Handle loading repositories for a selected organization
   */
  private async handleLoadRepositories(organization: string): Promise<void> {
    try {
      const githubApi = GitHubApi.getInstance();
      const repositories = await githubApi.getRepositories(organization);

      this._panel.webview.postMessage({
        command: 'repositoriesLoaded',
        repositories
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'repositoriesLoaded',
        repositories: [],
        error: error instanceof Error ? error.message : 'Failed to load repositories'
      });
    }
  }

  /**
   * Handle creating GitHub issue with Copilot agent
   */
  private async handleCreateIssueWithCopilot(organization: string, repository: string): Promise<void> {
    try {
      const githubApi = GitHubApi.getInstance();
      const workItemTitle = this.workItem.fields['System.Title'];
      const workItemId = this.workItem.id;

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Creating GitHub issue with Copilot agent...',
          cancellable: false
        },
        async () => {
          const issue = await githubApi.createIssueWithCopilotAgent(
            organization,
            repository,
            workItemTitle,
            workItemId,
            this.plan
          );

          vscode.window.showInformationMessage(
            `GitHub issue #${issue.number} created successfully! Copilot agent will start working on it.`,
            'Open Issue'
          ).then(action => {
            if (action === 'Open Issue') {
              vscode.env.openExternal(vscode.Uri.parse(issue.html_url));
            }
          });

          this._panel.webview.postMessage({
            command: 'issueCreated',
            issue
          });
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create issue';
      vscode.window.showErrorMessage(errorMessage);

      this._panel.webview.postMessage({
        command: 'issueCreated',
        error: errorMessage
      });
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = `Plan: #${this.workItem.id} - ${this.workItem.fields['System.Title']}`;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * Check if Copilot agent integration is enabled
   */
  private isCopilotAgentEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<boolean>('enableCopilotAgent', false);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const fields = this.workItem.fields;
    const workItemType = fields['System.WorkItemType'];
    const title = fields['System.Title'];
    const id = fields['System.Id'];

    // Convert markdown to HTML (basic conversion)
    const planHtml = this.convertMarkdownToHtml(this.plan);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Implementation Plan</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          line-height: 1.6;
        }
        .header {
          border-bottom: 2px solid var(--vscode-panel-border);
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .work-item-info {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-textLink-activeForeground);
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .work-item-id {
          color: var(--vscode-descriptionForeground);
          font-size: 13px;
          font-weight: 500;
        }
        .work-item-title {
          font-size: 18px;
          font-weight: 600;
          margin: 8px 0;
          color: var(--vscode-foreground);
        }
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .plan-container {
          background-color: var(--vscode-editor-background);
          padding: 20px;
          border-radius: 6px;
          border: 1px solid var(--vscode-panel-border);
        }
        .plan-content {
          color: var(--vscode-foreground);
        }
        .plan-content h1 {
          font-size: 22px;
          font-weight: 600;
          margin-top: 25px;
          margin-bottom: 15px;
          color: var(--vscode-textLink-activeForeground);
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 8px;
        }
        .plan-content h2 {
          font-size: 18px;
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 12px;
          color: var(--vscode-textLink-foreground);
        }
        .plan-content h3 {
          font-size: 15px;
          font-weight: 600;
          margin-top: 15px;
          margin-bottom: 10px;
        }
        .plan-content ul, .plan-content ol {
          margin: 10px 0;
          padding-left: 25px;
        }
        .plan-content li {
          margin: 6px 0;
        }
        .plan-content p {
          margin: 10px 0;
        }
        .plan-content code {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: var(--vscode-editor-font-family);
          font-size: 12px;
        }
        .plan-content pre {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          border: 1px solid var(--vscode-panel-border);
        }
        .plan-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .plan-content strong {
          font-weight: 600;
          color: var(--vscode-textLink-foreground);
        }
        .plan-content blockquote {
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          background-color: var(--vscode-textBlockQuote-background);
          padding: 10px 15px;
          margin: 15px 0;
          font-style: italic;
        }
        .actions {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid var(--vscode-panel-border);
          display: flex;
          gap: 10px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 10px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 13px;
          font-weight: 500;
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
        .ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        .copilot-section {
          margin-top: 30px;
          padding: 20px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          background-color: var(--vscode-editor-background);
        }
        .copilot-controls {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group label {
          font-size: 13px;
          font-weight: 500;
          color: var(--vscode-foreground);
        }
        .form-group select {
          padding: 8px 12px;
          border: 1px solid var(--vscode-input-border);
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border-radius: 3px;
          font-size: 13px;
          font-family: var(--vscode-font-family);
          cursor: pointer;
        }
        .form-group select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .form-group select:focus {
          outline: 1px solid var(--vscode-focusBorder);
        }
        .copilot-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          cursor: pointer;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          margin-top: 10px;
          transition: opacity 0.2s;
        }
        .copilot-button:hover:not(:disabled) {
          opacity: 0.9;
        }
        .copilot-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .error-message {
          margin-top: 10px;
          padding: 10px;
          background-color: var(--vscode-inputValidation-errorBackground);
          border: 1px solid var(--vscode-inputValidation-errorBorder);
          border-radius: 3px;
          color: var(--vscode-errorForeground);
          font-size: 12px;
        }
        .plan-edit {
          width: 100%;
        }
        .plan-textarea {
          width: 100%;
          min-height: 500px;
          padding: 15px;
          border: 1px solid var(--vscode-input-border);
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          font-family: var(--vscode-editor-font-family);
          font-size: 13px;
          line-height: 1.6;
          border-radius: 4px;
          resize: vertical;
        }
        .plan-textarea:focus {
          outline: 1px solid var(--vscode-focusBorder);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="ai-badge">
          ✨ Generated by GitHub Copilot
        </div>
        <h1 style="margin: 10px 0 20px 0; font-size: 26px;">Implementation Plan</h1>

        <div class="work-item-info">
          <div class="work-item-id">Work Item #${id}</div>
          <div class="work-item-title">${this.escapeHtml(title)}</div>
          <span class="badge">${workItemType}</span>
        </div>
      </div>

      <div class="plan-container">
        <div id="planView" class="plan-content">
          ${planHtml}
        </div>
        <div id="planEdit" class="plan-edit" style="display: none;">
          <textarea id="planTextarea" class="plan-textarea">${this.escapeHtml(this.plan)}</textarea>
        </div>
      </div>

      <div class="actions">
        <div id="viewActions" style="display: flex; gap: 10px;">
          <button onclick="editPlan()">✏️ Edit Plan</button>
          <button onclick="copyPlan()">📋 Copy Plan</button>
          <button class="secondary" onclick="openWorkItem()">🔗 Open Work Item</button>
        </div>
        <div id="editActions" style="display: none; gap: 10px;">
          <button onclick="savePlan()">💾 Save Changes</button>
          <button class="secondary" onclick="cancelEdit()">❌ Cancel</button>
        </div>
      </div>

      <div id="copilotSection" class="copilot-section" style="display: none;">
        <h3 style="margin-top: 30px; margin-bottom: 15px;">🤖 GitHub Copilot Agent Integration</h3>
        <div class="copilot-controls">
          <div class="form-group">
            <label for="orgSelect">Organization:</label>
            <select id="orgSelect" onchange="onOrgChange()">
              <option value="">-- Select Organization --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="repoSelect">Repository:</label>
            <select id="repoSelect" disabled>
              <option value="">-- Select Repository --</option>
            </select>
          </div>
          <button id="createIssueBtn" class="copilot-button" onclick="createIssueWithCopilot()" disabled>
            🚀 Create Issue & Assign to Copilot
          </button>
        </div>
        <div id="copilotError" class="error-message" style="display: none;"></div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const copilotEnabled = ${this.isCopilotAgentEnabled()};
        let isEditMode = false;

        // Initialize
        if (copilotEnabled) {
          document.getElementById('copilotSection').style.display = 'block';
          loadOrganizations();
        }

        function editPlan() {
          isEditMode = true;
          document.getElementById('planView').style.display = 'none';
          document.getElementById('planEdit').style.display = 'block';
          document.getElementById('viewActions').style.display = 'none';
          document.getElementById('editActions').style.display = 'flex';
          document.getElementById('copilotSection').style.display = 'none';

          // Focus the textarea
          document.getElementById('planTextarea').focus();
        }

        function cancelEdit() {
          isEditMode = false;
          document.getElementById('planView').style.display = 'block';
          document.getElementById('planEdit').style.display = 'none';
          document.getElementById('viewActions').style.display = 'flex';
          document.getElementById('editActions').style.display = 'none';
          if (copilotEnabled) {
            document.getElementById('copilotSection').style.display = 'block';
          }
        }

        function savePlan() {
          const textarea = document.getElementById('planTextarea');
          const newPlan = textarea.value;

          vscode.postMessage({
            command: 'savePlan',
            plan: newPlan
          });

          // Exit edit mode after saving
          cancelEdit();
        }

        function copyPlan() {
          vscode.postMessage({ command: 'copyPlan' });
        }

        function openWorkItem() {
          vscode.postMessage({ command: 'openWorkItem' });
        }

        function loadOrganizations() {
          vscode.postMessage({ command: 'loadOrganizations' });
        }

        function onOrgChange() {
          const orgSelect = document.getElementById('orgSelect');
          const repoSelect = document.getElementById('repoSelect');
          const createBtn = document.getElementById('createIssueBtn');

          const selectedOrg = orgSelect.value;

          // Reset repository dropdown
          repoSelect.innerHTML = '<option value="">-- Select Repository --</option>';
          repoSelect.disabled = !selectedOrg;
          createBtn.disabled = true;

          if (selectedOrg) {
            vscode.postMessage({
              command: 'loadRepositories',
              organization: selectedOrg
            });
          }
        }

        function onRepoChange() {
          const repoSelect = document.getElementById('repoSelect');
          const createBtn = document.getElementById('createIssueBtn');
          createBtn.disabled = !repoSelect.value;
        }

        function createIssueWithCopilot() {
          const orgSelect = document.getElementById('orgSelect');
          const repoSelect = document.getElementById('repoSelect');
          const createBtn = document.getElementById('createIssueBtn');

          const organization = orgSelect.value;
          const repository = repoSelect.value;

          if (!organization || !repository) {
            showError('Please select both organization and repository');
            return;
          }

          createBtn.disabled = true;
          createBtn.textContent = '⏳ Creating issue...';

          vscode.postMessage({
            command: 'createIssueWithCopilot',
            organization,
            repository
          });
        }

        function showError(message) {
          const errorDiv = document.getElementById('copilotError');
          errorDiv.textContent = message;
          errorDiv.style.display = 'block';
          setTimeout(() => {
            errorDiv.style.display = 'none';
          }, 5000);
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
          const message = event.data;

          switch (message.command) {
            case 'organizationsLoaded':
              handleOrganizationsLoaded(message);
              break;
            case 'repositoriesLoaded':
              handleRepositoriesLoaded(message);
              break;
            case 'issueCreated':
              handleIssueCreated(message);
              break;
          }
        });

        function handleOrganizationsLoaded(message) {
          const orgSelect = document.getElementById('orgSelect');

          if (message.error) {
            showError(message.error);
            return;
          }

          orgSelect.innerHTML = '<option value="">-- Select Organization --</option>';
          message.organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.login;
            option.textContent = \`\${org.login}\${org.description ? ' - ' + org.description : ''}\`;
            orgSelect.appendChild(option);
          });
        }

        function handleRepositoriesLoaded(message) {
          const repoSelect = document.getElementById('repoSelect');

          if (message.error) {
            showError(message.error);
            return;
          }

          repoSelect.innerHTML = '<option value="">-- Select Repository --</option>';
          message.repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.name;
            option.textContent = \`\${repo.name}\${repo.description ? ' - ' + repo.description : ''}\`;
            repoSelect.appendChild(option);
          });

          repoSelect.disabled = false;
          repoSelect.onchange = onRepoChange;
        }

        function handleIssueCreated(message) {
          const createBtn = document.getElementById('createIssueBtn');

          if (message.error) {
            createBtn.disabled = false;
            createBtn.textContent = '🚀 Create Issue & Assign to Copilot';
            showError(message.error);
            return;
          }

          createBtn.textContent = '✅ Issue Created!';
          setTimeout(() => {
            createBtn.disabled = false;
            createBtn.textContent = '🚀 Create Issue & Assign to Copilot';
          }, 3000);
        }
      </script>
    </body>
    </html>`;
  }

  private convertMarkdownToHtml(markdown: string): string {
    // Basic markdown to HTML conversion
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```(\w*)\n?/g, '').replace(/```$/g, '');
      return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Lists (ordered)
    html = html.replace(/^\d+\.\s(.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

    // Lists (unordered)
    html = html.replace(/^[-*]\s(.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, (match) => {
      if (!match.includes('<ol>')) {
        return '<ul>' + match + '</ul>';
      }
      return match;
    });

    // Blockquotes
    html = html.replace(/^>\s(.+)$/gim, '<blockquote>$1</blockquote>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up extra p tags
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<[huo][1-6lp]>)/g, '$1');
    html = html.replace(/(<\/[huo][1-6lp]>)<\/p>/g, '$1');

    return html;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
