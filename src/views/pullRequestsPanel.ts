import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { PullRequest, getBranchName, getVoteIcon } from '../models/pullRequest';
import { PullRequestViewPanel } from './pullRequestView';

/**
 * Tree item for a pull request
 */
class PullRequestTreeItem extends vscode.TreeItem {
  constructor(
    public readonly pr: PullRequest,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(`!${pr.pullRequestId} ${pr.title}`, collapsibleState);

    this.contextValue = 'pullRequest';
    this.id = `pr-${pr.pullRequestId}`;

    // Description shows repo and branch info
    const sourceBranch = getBranchName(pr.sourceRefName);
    const targetBranch = getBranchName(pr.targetRefName);
    this.description = `${pr.repository.name} • ${sourceBranch} → ${targetBranch}`;

    // Tooltip with more details
    const reviewerInfo = pr.reviewers && pr.reviewers.length > 0
      ? pr.reviewers.map(r => `${getVoteIcon(r.vote)} ${r.displayName}`).join('\n')
      : 'No reviewers';

    this.tooltip = new vscode.MarkdownString(
      `**${pr.title}**\n\n` +
      `**ID:** ${pr.pullRequestId}\n\n` +
      `**Repository:** ${pr.repository.name}\n\n` +
      `**Branch:** ${sourceBranch} → ${targetBranch}\n\n` +
      `**Created by:** ${pr.createdBy.displayName}\n\n` +
      `**Created:** ${new Date(pr.creationDate).toLocaleString()}\n\n` +
      `**Status:** ${pr.status}${pr.isDraft ? ' (Draft)' : ''}\n\n` +
      `**Reviewers:**\n${reviewerInfo}`
    );

    // Icon based on status
    this.iconPath = this.getStatusIcon(pr.status, pr.isDraft);

    // Command to open PR details
    this.command = {
      command: 'azureDevOps.openPullRequest',
      title: 'Open Pull Request',
      arguments: [pr]
    };
  }

  private getStatusIcon(status: string, isDraft?: boolean): vscode.ThemeIcon {
    if (isDraft) {
      return new vscode.ThemeIcon('git-pull-request-draft', new vscode.ThemeColor('charts.gray'));
    }

    switch (status) {
      case 'active':
        return new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.blue'));
      case 'completed':
        return new vscode.ThemeIcon('git-merge', new vscode.ThemeColor('charts.green'));
      case 'abandoned':
        return new vscode.ThemeIcon('git-pull-request-closed', new vscode.ThemeColor('charts.gray'));
      default:
        return new vscode.ThemeIcon('git-pull-request');
    }
  }
}

/**
 * Tree item for a status category
 */
class StatusCategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly status: string,
    public readonly count: number
  ) {
    super(StatusCategoryTreeItem.getLabel(status), vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'prCategory';
    this.id = `pr-category-${status}`;
    this.description = `${count} PR${count !== 1 ? 's' : ''}`;
    this.iconPath = StatusCategoryTreeItem.getIcon(status);
  }

  private static getLabel(status: string): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'abandoned':
        return 'Abandoned';
      default:
        return status;
    }
  }

  private static getIcon(status: string): vscode.ThemeIcon {
    switch (status) {
      case 'active':
        return new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.blue'));
      case 'completed':
        return new vscode.ThemeIcon('git-merge', new vscode.ThemeColor('charts.green'));
      case 'abandoned':
        return new vscode.ThemeIcon('git-pull-request-closed', new vscode.ThemeColor('charts.gray'));
      default:
        return new vscode.ThemeIcon('git-pull-request');
    }
  }
}

/**
 * TreeDataProvider for Pull Requests view
 */
export class PullRequestsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private api: AzureDevOpsApi;
  private pullRequests: PullRequest[] = [];
  private hasLoaded: boolean = false;
  private isLoading: boolean = false;

  constructor() {
    this.api = AzureDevOpsApi.getInstance();
  }

  refresh(): void {
    this.loadPullRequests();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // Check if extension is configured
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const org = config.get<string>('organization', '');
    const pat = config.get<string>('pat', '');
    const project = config.get<string>('project', '');

    if (!org || !pat || !project) {
      return [
        new vscode.TreeItem('Please configure Azure DevOps settings', vscode.TreeItemCollapsibleState.None)
      ];
    }

    // Load pull requests if not loaded
    if (!this.hasLoaded && !this.isLoading) {
      await this.loadPullRequests();
    }

    // Root level - return categories
    if (!element) {
      return this.getCategoryItems();
    }

    // Category level - return PRs for that status
    if (element instanceof StatusCategoryTreeItem) {
      return this.getPRsForStatus(element.status);
    }

    return [];
  }

  private getCategoryItems(): vscode.TreeItem[] {
    const statusOrder = ['active', 'completed', 'abandoned'];
    const categories: vscode.TreeItem[] = [];

    for (const status of statusOrder) {
      const prsForStatus = this.pullRequests.filter(pr => pr.status === status);
      if (prsForStatus.length > 0) {
        categories.push(new StatusCategoryTreeItem(status, prsForStatus.length));
      }
    }

    if (categories.length === 0) {
      return [
        new vscode.TreeItem('No pull requests found', vscode.TreeItemCollapsibleState.None)
      ];
    }

    return categories;
  }

  private getPRsForStatus(status: string): vscode.TreeItem[] {
    const prs = this.pullRequests.filter(pr => pr.status === status);
    return prs.map(pr => new PullRequestTreeItem(pr));
  }

  async loadPullRequests(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      this.pullRequests = await this.api.getMyPullRequests('all');
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Error loading pull requests:', error);
      this.pullRequests = [];
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Open a pull request in the detail panel
   */
  openPullRequest(pr: PullRequest): void {
    PullRequestViewPanel.createOrShow(pr);
  }
}
