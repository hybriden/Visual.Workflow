import * as vscode from 'vscode';
import { PullRequest, getBranchName, getVoteDisplay, getVoteIcon, PRVote } from '../models/pullRequest';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { WorkItem } from '../models/workItem';
import { CopilotService } from '../ai/copilotService';
import { sanitizePrDescription, escapeHtml } from '../utils/htmlSanitizer';

/**
 * Webview panel for displaying pull request details
 */
export class PullRequestViewPanel {
  public static currentPanel: PullRequestViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private pullRequest: PullRequest;
  private api: AzureDevOpsApi;
  private copilotService: CopilotService;
  private linkedWorkItems: WorkItem[] = [];
  private changedFiles: Array<{ path: string; changeType: string }> = [];
  private aiReview: { summary: string; suggestions: string[]; codeSmells: Array<{ severity: 'warning' | 'error' | 'info'; message: string; file?: string }> } | null = null;
  private aiReviewLoading: boolean = false;
  private aiReviewError: string | null = null;

  private constructor(panel: vscode.WebviewPanel, pullRequest: PullRequest) {
    this._panel = panel;
    this.pullRequest = pullRequest;
    this.api = AzureDevOpsApi.getInstance();
    this.copilotService = CopilotService.getInstance();

    this._update().catch(error => {
      console.error('Error updating pull request view:', error);
    });

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'openInBrowser':
            const url = this.api.getPullRequestUrl(
              this.pullRequest.repository.name,
              this.pullRequest.pullRequestId
            );
            vscode.env.openExternal(vscode.Uri.parse(url));
            break;
          case 'refresh':
            await this.refresh();
            break;
          case 'openWorkItem':
            await vscode.commands.executeCommand('azureDevOps.viewWorkItemDetails', { id: message.workItemId });
            break;
          case 'generateAiReview':
            await this.generateAiReview();
            break;
          case 'vote':
            await this.vote(message.vote);
            break;
          case 'checkoutBranch':
            await this.checkoutBranch();
            break;
          case 'openFileDiff':
            await this.openFileDiff(message.filePath);
            break;
          case 'copyLink':
            await this.copyLink();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(pullRequest: PullRequest) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, update it with new PR
    if (PullRequestViewPanel.currentPanel) {
      PullRequestViewPanel.currentPanel.pullRequest = pullRequest;
      // Reset state when switching PRs
      PullRequestViewPanel.currentPanel.aiReview = null;
      PullRequestViewPanel.currentPanel.aiReviewLoading = false;
      PullRequestViewPanel.currentPanel.aiReviewError = null;
      PullRequestViewPanel.currentPanel.changedFiles = [];
      PullRequestViewPanel.currentPanel._update().catch(error => {
        console.error('Error updating pull request view:', error);
      });
      PullRequestViewPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'pullRequestView',
      `PR !${pullRequest.pullRequestId}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    PullRequestViewPanel.currentPanel = new PullRequestViewPanel(panel, pullRequest);
  }

  private async refresh() {
    try {
      this.pullRequest = await this.api.getPullRequest(
        this.pullRequest.repository.id,
        this.pullRequest.pullRequestId
      );
      await this._update();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh pull request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async generateAiReview() {
    // Check if Copilot is available
    const isAvailable = await this.copilotService.isCopilotAvailable();
    if (!isAvailable) {
      this.aiReviewError = 'GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.';
      await this._update();
      return;
    }

    // Set loading state
    this.aiReviewLoading = true;
    this.aiReviewError = null;
    await this._update();

    try {
      // Fetch PR changes
      const changes = await this.api.getPullRequestChanges(
        this.pullRequest.repository.id,
        this.pullRequest.pullRequestId
      );

      // Prepare changed files list
      const changedFiles = changes.map((change: any) => ({
        path: change.item?.path || change.originalPath || 'unknown',
        changeType: change.changeType || 'edit'
      }));

      // Fetch diffs for a subset of files (limit to avoid token limits)
      const fileContents: Array<{ path: string; content: string }> = [];
      const filesToFetch = changedFiles.slice(0, 5);

      for (const file of filesToFetch) {
        try {
          // Get the actual diff, not the full file content
          const diff = await this.api.getPullRequestFileDiff(
            this.pullRequest.repository.id,
            this.pullRequest.pullRequestId,
            file.path
          );
          if (diff) {
            fileContents.push({ path: file.path, content: diff });
          }
        } catch (error) {
          console.log(`Could not fetch diff for ${file.path}:`, error);
        }
      }

      // Generate review
      const sourceBranch = getBranchName(this.pullRequest.sourceRefName);
      const targetBranch = getBranchName(this.pullRequest.targetRefName);

      this.aiReview = await this.copilotService.generatePullRequestReview(
        this.pullRequest.title,
        this.pullRequest.description || '',
        sourceBranch,
        targetBranch,
        changedFiles,
        fileContents
      );

      this.aiReviewLoading = false;
      await this._update();
    } catch (error) {
      console.error('Error generating AI review:', error);
      this.aiReviewLoading = false;
      this.aiReviewError = error instanceof Error ? error.message : 'Failed to generate AI review';
      await this._update();
    }
  }

  private async vote(vote: number) {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Submitting vote...',
          cancellable: false
        },
        async () => {
          await this.api.votePullRequest(
            this.pullRequest.repository.id,
            this.pullRequest.pullRequestId,
            vote
          );
        }
      );

      // Refresh to show updated vote
      await this.refresh();

      const voteNames: { [key: number]: string } = {
        10: 'Approved',
        5: 'Approved with suggestions',
        0: 'Reset vote',
        [-5]: 'Waiting for author',
        [-10]: 'Rejected'
      };
      vscode.window.showInformationMessage(`PR ${voteNames[vote] || 'vote submitted'}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to submit vote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async checkoutBranch() {
    const sourceBranch = getBranchName(this.pullRequest.sourceRefName);

    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
        return;
      }

      const cwd = workspaceFolders[0].uri.fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Checking out branch: ${sourceBranch}`,
          cancellable: false
        },
        async () => {
          // Fetch and checkout using VS Code's built-in git
          const gitExtension = vscode.extensions.getExtension('vscode.git');
          if (gitExtension) {
            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];
            if (repo) {
              // Fetch first
              await repo.fetch();
              // Checkout the branch
              await repo.checkout(sourceBranch);
              return;
            }
          }

          // Fallback to terminal command
          const terminal = vscode.window.createTerminal({
            name: 'Git Checkout',
            cwd
          });
          terminal.show();
          terminal.sendText(`git fetch origin && git checkout ${sourceBranch}`);
        }
      );

      vscode.window.showInformationMessage(`Checked out branch: ${sourceBranch}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to checkout branch: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async openFileDiff(filePath: string) {
    try {
      const sourceBranch = getBranchName(this.pullRequest.sourceRefName);
      const targetBranch = getBranchName(this.pullRequest.targetRefName);

      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      // Fetch file contents from both branches
      const [sourceContent, targetContent] = await Promise.all([
        this.api.getFileAtVersion(this.pullRequest.repository.id, filePath, sourceBranch),
        this.api.getFileAtVersion(this.pullRequest.repository.id, filePath, targetBranch)
      ]);

      // Create temp URIs for diff view
      const fileName = filePath.split('/').pop() || 'file';
      const leftUri = vscode.Uri.parse(`untitled:${targetBranch}/${fileName}`);
      const rightUri = vscode.Uri.parse(`untitled:${sourceBranch}/${fileName}`);

      // Open the documents and show diff
      const leftDoc = await vscode.workspace.openTextDocument({ content: targetContent || '(file does not exist)', language: this.getLanguageId(filePath) });
      const rightDoc = await vscode.workspace.openTextDocument({ content: sourceContent || '(file does not exist)', language: this.getLanguageId(filePath) });

      await vscode.commands.executeCommand(
        'vscode.diff',
        leftDoc.uri,
        rightDoc.uri,
        `${fileName} (${targetBranch} ↔ ${sourceBranch})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to open diff: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private getLanguageId(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'js': 'javascript',
      'jsx': 'javascriptreact',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'sql': 'sql',
      'sh': 'shellscript',
      'ps1': 'powershell'
    };
    return languageMap[ext || ''] || 'plaintext';
  }

  private async copyLink() {
    const url = this.api.getPullRequestUrl(
      this.pullRequest.repository.name,
      this.pullRequest.pullRequestId
    );
    await vscode.env.clipboard.writeText(url);
    vscode.window.showInformationMessage('PR link copied to clipboard');
  }

  public dispose() {
    PullRequestViewPanel.currentPanel = undefined;

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
    this._panel.title = `PR !${this.pullRequest.pullRequestId} - ${this.pullRequest.title}`;

    // Fetch linked work items and changed files in parallel
    try {
      const [workItems, changes] = await Promise.all([
        this.api.getPullRequestWorkItems(
          this.pullRequest.repository.id,
          this.pullRequest.pullRequestId
        ).catch(err => {
          console.error('Error fetching linked work items:', err);
          return [];
        }),
        this.api.getPullRequestChanges(
          this.pullRequest.repository.id,
          this.pullRequest.pullRequestId
        ).catch(err => {
          console.error('Error fetching PR changes:', err);
          return [];
        })
      ]);

      this.linkedWorkItems = workItems;
      this.changedFiles = changes.map((change: any) => ({
        path: change.item?.path || change.originalPath || 'unknown',
        changeType: change.changeType || 'edit'
      }));
    } catch (error) {
      console.error('Error fetching PR data:', error);
      this.linkedWorkItems = [];
      this.changedFiles = [];
    }

    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const pr = this.pullRequest;
    const sourceBranch = getBranchName(pr.sourceRefName);
    const targetBranch = getBranchName(pr.targetRefName);
    const createdDate = new Date(pr.creationDate).toLocaleString();
    const closedDate = pr.closedDate ? new Date(pr.closedDate).toLocaleString() : null;

    // Status badge color
    const statusColor = this.getStatusColor(pr.status);
    const statusText = pr.isDraft ? 'Draft' : this.capitalizeFirst(pr.status);

    // Reviewers HTML
    const reviewersHtml = pr.reviewers && pr.reviewers.length > 0
      ? pr.reviewers.map(r => `
          <div class="reviewer">
            <span class="reviewer-vote">${getVoteIcon(r.vote)}</span>
            <span class="reviewer-name">${escapeHtml(r.displayName)}</span>
            <span class="reviewer-status">${getVoteDisplay(r.vote)}</span>
            ${r.isRequired ? '<span class="required-badge">Required</span>' : ''}
          </div>
        `).join('')
      : '<p class="no-data">No reviewers assigned</p>';

    // Linked work items HTML
    const workItemsHtml = this.linkedWorkItems.length > 0
      ? this.linkedWorkItems.map(wi => `
          <div class="work-item" onclick="openWorkItem(${wi.id})">
            <span class="wi-type">${escapeHtml(wi.fields['System.WorkItemType'])}</span>
            <span class="wi-id">#${wi.id}</span>
            <span class="wi-title">${escapeHtml(wi.fields['System.Title'])}</span>
          </div>
        `).join('')
      : '<p class="no-data">No linked work items</p>';

    // Description - handle HTML content (using secure sanitizer)
    const description = sanitizePrDescription(pr.description);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pull Request !${pr.pullRequestId}</title>
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
        .pr-id {
          color: var(--vscode-descriptionForeground);
          font-size: 14px;
        }
        .pr-title {
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
        .status-badge {
          background-color: ${statusColor};
          color: white;
        }
        .draft-badge {
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
        .branch-info {
          font-family: var(--vscode-editor-font-family);
          background-color: var(--vscode-textBlockQuote-background);
          padding: 4px 8px;
          border-radius: 3px;
        }
        .branch-arrow {
          margin: 0 8px;
          color: var(--vscode-descriptionForeground);
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
        .actions {
          margin: 20px 0;
          padding: 15px 0;
          border-top: 1px solid var(--vscode-panel-border);
        }
        .description {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          padding: 15px;
          margin: 10px 0;
          white-space: pre-wrap;
        }
        .reviewer {
          display: flex;
          align-items: center;
          padding: 8px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .reviewer-vote {
          font-size: 16px;
          margin-right: 10px;
        }
        .reviewer-name {
          font-weight: 500;
          margin-right: 10px;
        }
        .reviewer-status {
          color: var(--vscode-descriptionForeground);
          font-size: 12px;
          flex: 1;
        }
        .required-badge {
          background-color: var(--vscode-inputValidation-warningBackground);
          color: var(--vscode-inputValidation-warningForeground);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
        }
        .work-item {
          display: flex;
          align-items: center;
          padding: 8px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
        }
        .work-item:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        .wi-type {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          margin-right: 8px;
        }
        .wi-id {
          font-weight: 600;
          margin-right: 8px;
          color: var(--vscode-textLink-foreground);
        }
        .wi-title {
          flex: 1;
        }
        .no-data {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }
        .ai-review-section {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 15px;
          margin: 10px 0;
        }
        .ai-review-header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }
        .ai-review-header .sparkle {
          margin-right: 8px;
          font-size: 18px;
        }
        .ai-summary {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid #0078d4;
          padding: 12px;
          margin: 10px 0;
          white-space: pre-wrap;
        }
        .ai-suggestions {
          margin-top: 15px;
        }
        .ai-suggestion {
          padding: 10px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          margin-bottom: 8px;
          background-color: var(--vscode-editor-background);
        }
        .ai-suggestion-icon {
          margin-right: 8px;
          color: var(--vscode-charts-yellow);
        }
        .ai-loading {
          display: flex;
          align-items: center;
          padding: 20px;
          color: var(--vscode-descriptionForeground);
        }
        .ai-loading .spinner {
          margin-right: 10px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .ai-error {
          color: var(--vscode-errorForeground);
          background-color: var(--vscode-inputValidation-errorBackground);
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
        button.ai-button {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        button.ai-button:hover {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }
        button.ai-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .vote-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        button.vote-approve {
          background-color: #107c10;
        }
        button.vote-approve:hover {
          background-color: #0e6b0e;
        }
        button.vote-approve-suggestions {
          background-color: #5c6bc0;
        }
        button.vote-approve-suggestions:hover {
          background-color: #4a59b5;
        }
        button.vote-reject {
          background-color: #d32f2f;
        }
        button.vote-reject:hover {
          background-color: #b71c1c;
        }
        button.vote-wait {
          background-color: #ff9800;
        }
        button.vote-wait:hover {
          background-color: #f57c00;
        }
        .changed-file {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          margin-bottom: 4px;
          cursor: pointer;
          font-family: var(--vscode-editor-font-family);
          font-size: 13px;
        }
        .changed-file:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        .change-type {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          margin-right: 8px;
          font-weight: 500;
        }
        .change-add {
          background-color: #107c10;
          color: white;
        }
        .change-edit {
          background-color: #0078d4;
          color: white;
        }
        .change-delete {
          background-color: #d32f2f;
          color: white;
        }
        .change-rename {
          background-color: #ff9800;
          color: white;
        }
        .file-path {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action-group {
          margin-bottom: 15px;
        }
        .action-group-title {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--vscode-descriptionForeground);
        }
        .code-smells {
          margin-top: 15px;
        }
        .code-smell {
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 8px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .code-smell-error {
          background-color: rgba(211, 47, 47, 0.15);
          border-left: 3px solid #d32f2f;
        }
        .code-smell-warning {
          background-color: rgba(255, 152, 0, 0.15);
          border-left: 3px solid #ff9800;
        }
        .code-smell-info {
          background-color: rgba(33, 150, 243, 0.15);
          border-left: 3px solid #2196f3;
        }
        .smell-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        .smell-content {
          flex: 1;
        }
        .smell-message {
          margin-bottom: 4px;
        }
        .smell-file {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          font-family: var(--vscode-editor-font-family);
        }
        .smell-count {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          margin-left: 8px;
        }
        .smell-count-error {
          background-color: #d32f2f;
          color: white;
        }
        .smell-count-warning {
          background-color: #ff9800;
          color: white;
        }
        .smell-count-info {
          background-color: #2196f3;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="pr-id">Pull Request !${pr.pullRequestId}</div>
        <h1 class="pr-title">${escapeHtml(pr.title)}</h1>
        <div>
          <span class="badge status-badge">${statusText}</span>
          ${pr.isDraft ? '<span class="badge draft-badge">Draft</span>' : ''}
        </div>
      </div>

      <div class="actions">
        <div class="section-title">Actions</div>

        <div class="action-group">
          <div class="action-group-title">Review</div>
          <div class="vote-buttons">
            <button class="vote-approve" onclick="vote(10)">&#10004; Approve</button>
            <button class="vote-approve-suggestions" onclick="vote(5)">&#10004; Approve with Suggestions</button>
            <button class="vote-wait" onclick="vote(-5)">&#8987; Wait for Author</button>
            <button class="vote-reject" onclick="vote(-10)">&#10008; Reject</button>
            <button class="secondary" onclick="vote(0)">Reset Vote</button>
          </div>
        </div>

        <div class="action-group">
          <div class="action-group-title">Quick Actions</div>
          <div>
            <button onclick="checkoutBranch()">&#128229; Checkout Branch</button>
            <button onclick="openInBrowser()">&#127760; Open in Browser</button>
            <button class="secondary" onclick="copyLink()">&#128203; Copy Link</button>
            <button class="secondary" onclick="refresh()">&#8635; Refresh</button>
          </div>
        </div>

        <div class="action-group">
          <div class="action-group-title">AI Assistance</div>
          <div>
            <button class="ai-button" onclick="generateAiReview()" ${this.aiReviewLoading ? 'disabled' : ''}>
              <span>&#10024;</span> AI Review
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Branch Info</div>
        <div style="display: flex; align-items: center; margin-top: 10px;">
          <span class="branch-info">${escapeHtml(sourceBranch)}</span>
          <span class="branch-arrow">→</span>
          <span class="branch-info">${escapeHtml(targetBranch)}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Details</div>
        <div class="field">
          <div class="field-label">Repository:</div>
          <div class="field-value">${escapeHtml(pr.repository.name)}</div>
        </div>
        <div class="field">
          <div class="field-label">Created By:</div>
          <div class="field-value">${escapeHtml(pr.createdBy.displayName)}</div>
        </div>
        <div class="field">
          <div class="field-label">Created:</div>
          <div class="field-value">${createdDate}</div>
        </div>
        ${closedDate ? `
        <div class="field">
          <div class="field-label">Closed:</div>
          <div class="field-value">${closedDate}</div>
        </div>
        ` : ''}
        ${pr.mergeStatus ? `
        <div class="field">
          <div class="field-label">Merge Status:</div>
          <div class="field-value">${escapeHtml(pr.mergeStatus)}</div>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">Description</div>
        <div class="description">${description}</div>
      </div>

      ${this.getAiReviewHtml()}

      ${this.getChangedFilesHtml()}

      <div class="section">
        <div class="section-title">Reviewers (${pr.reviewers?.length || 0})</div>
        ${reviewersHtml}
      </div>

      <div class="section">
        <div class="section-title">Linked Work Items (${this.linkedWorkItems.length})</div>
        ${workItemsHtml}
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function openInBrowser() {
          vscode.postMessage({ command: 'openInBrowser' });
        }

        function refresh() {
          vscode.postMessage({ command: 'refresh' });
        }

        function openWorkItem(workItemId) {
          vscode.postMessage({ command: 'openWorkItem', workItemId: workItemId });
        }

        function generateAiReview() {
          vscode.postMessage({ command: 'generateAiReview' });
        }

        function vote(voteValue) {
          vscode.postMessage({ command: 'vote', vote: voteValue });
        }

        function checkoutBranch() {
          vscode.postMessage({ command: 'checkoutBranch' });
        }

        function openFileDiff(filePath) {
          vscode.postMessage({ command: 'openFileDiff', filePath: filePath });
        }

        function copyLink() {
          vscode.postMessage({ command: 'copyLink' });
        }
      </script>
    </body>
    </html>`;
  }

  private getAiReviewHtml(): string {
    // Show loading state
    if (this.aiReviewLoading) {
      return `
        <div class="section">
          <div class="section-title">&#10024; AI Review</div>
          <div class="ai-review-section">
            <div class="ai-loading">
              <span class="spinner">&#8635;</span>
              Analyzing pull request with GitHub Copilot...
            </div>
          </div>
        </div>
      `;
    }

    // Show error state
    if (this.aiReviewError) {
      return `
        <div class="section">
          <div class="section-title">&#10024; AI Review</div>
          <div class="ai-review-section">
            <div class="ai-error">${escapeHtml(this.aiReviewError)}</div>
            <button class="secondary" onclick="generateAiReview()" style="margin-top: 10px;">Try Again</button>
          </div>
        </div>
      `;
    }

    // Show review results
    if (this.aiReview) {
      const suggestionsHtml = this.aiReview.suggestions.length > 0
        ? this.aiReview.suggestions.map(s => `
            <div class="ai-suggestion">
              <span class="ai-suggestion-icon">&#128161;</span>
              ${escapeHtml(s)}
            </div>
          `).join('')
        : '<p class="no-data">No specific suggestions</p>';

      // Code smells section
      const codeSmells = this.aiReview.codeSmells || [];
      const errorCount = codeSmells.filter(s => s.severity === 'error').length;
      const warningCount = codeSmells.filter(s => s.severity === 'warning').length;
      const infoCount = codeSmells.filter(s => s.severity === 'info').length;

      const getSeverityIcon = (severity: string) => {
        switch (severity) {
          case 'error': return '&#10060;'; // Red X
          case 'warning': return '&#9888;'; // Warning triangle
          case 'info': return '&#8505;'; // Info
          default: return '&#9888;';
        }
      };

      const codeSmellsHtml = codeSmells.length > 0
        ? codeSmells.map(smell => `
            <div class="code-smell code-smell-${smell.severity}">
              <span class="smell-icon">${getSeverityIcon(smell.severity)}</span>
              <div class="smell-content">
                <div class="smell-message">${escapeHtml(smell.message)}</div>
                ${smell.file ? `<div class="smell-file">${escapeHtml(smell.file)}</div>` : ''}
              </div>
            </div>
          `).join('')
        : '<p class="no-data">No code smells detected</p>';

      const smellCountBadges = `
        ${errorCount > 0 ? `<span class="smell-count smell-count-error">&#10060; ${errorCount}</span>` : ''}
        ${warningCount > 0 ? `<span class="smell-count smell-count-warning">&#9888; ${warningCount}</span>` : ''}
        ${infoCount > 0 ? `<span class="smell-count smell-count-info">&#8505; ${infoCount}</span>` : ''}
      `;

      return `
        <div class="section">
          <div class="section-title">&#10024; AI Review</div>
          <div class="ai-review-section">
            <div class="ai-review-header">
              <span class="sparkle">&#10024;</span>
              <strong>Summary</strong>
            </div>
            <div class="ai-summary">${escapeHtml(this.aiReview.summary)}</div>

            <div class="code-smells">
              <div class="ai-review-header">
                <span class="sparkle">&#9888;</span>
                <strong>Code Smells & Warnings</strong>
                ${smellCountBadges}
              </div>
              ${codeSmellsHtml}
            </div>

            <div class="ai-suggestions">
              <div class="ai-review-header">
                <span class="sparkle">&#128161;</span>
                <strong>Suggestions (${this.aiReview.suggestions.length})</strong>
              </div>
              ${suggestionsHtml}
            </div>

            <button class="secondary" onclick="generateAiReview()" style="margin-top: 15px;">Regenerate Review</button>
          </div>
        </div>
      `;
    }

    // No review yet - show nothing (button is in actions)
    return '';
  }

  private getChangedFilesHtml(): string {
    if (this.changedFiles.length === 0) {
      return '';
    }

    const getChangeTypeClass = (changeType: string): string => {
      const type = changeType.toLowerCase();
      if (type.includes('add')) return 'change-add';
      if (type.includes('delete')) return 'change-delete';
      if (type.includes('rename')) return 'change-rename';
      return 'change-edit';
    };

    const getChangeTypeLabel = (changeType: string): string => {
      const type = changeType.toLowerCase();
      if (type.includes('add')) return 'A';
      if (type.includes('delete')) return 'D';
      if (type.includes('rename')) return 'R';
      return 'M';
    };

    const filesHtml = this.changedFiles.map(f => `
      <div class="changed-file" onclick="openFileDiff('${escapeHtml(f.path).replace(/'/g, "\\'")}')">
        <span class="change-type ${getChangeTypeClass(f.changeType)}">${getChangeTypeLabel(f.changeType)}</span>
        <span class="file-path" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
      </div>
    `).join('');

    return `
      <div class="section">
        <div class="section-title">Changed Files (${this.changedFiles.length})</div>
        <p style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 10px;">
          Click a file to view diff in VS Code
        </p>
        ${filesHtml}
      </div>
    `;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return '#0078d4'; // Blue
      case 'completed':
        return '#107c10'; // Green
      case 'abandoned':
        return '#8a8886'; // Gray
      default:
        return '#0078d4';
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
