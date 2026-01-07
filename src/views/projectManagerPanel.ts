import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { WorkItem } from '../models/workItem';
import { EstimateChecker } from '../utils/estimateChecker';

/**
 * Tree item for work items with over-estimate support
 */
export class ProjectManagerWorkItemTreeItem extends vscode.TreeItem {
  public children: WorkItem[] = [];
  private static currentUser: { uniqueName: string, displayName: string } | null = null;
  private static instanceCounter: number = 0;

  public static setCurrentUser(user: { uniqueName: string, displayName: string } | null) {
    ProjectManagerWorkItemTreeItem.currentUser = user;
  }

  constructor(
    public readonly workItem: WorkItem,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly showParentInDescription: boolean = false,
    private readonly parentContextId?: string
  ) {
    super(workItem.fields['System.Title'], collapsibleState);

    const workItemType = workItem.fields['System.WorkItemType'];
    const state = workItem.fields['System.State'];
    const id = workItem.fields['System.Id'];
    const parentId = workItem.fields['System.Parent'];

    // Create unique ID by including parent context and instance counter
    // This ensures each tree item instance has a globally unique ID
    // Format: "workItemId-instance" or "parentContextId-workItemId-instance"
    const instanceId = ProjectManagerWorkItemTreeItem.instanceCounter++;
    this.id = parentContextId ? `${parentContextId}-${id}-${instanceId}` : `${id}-${instanceId}`;
    this.tooltip = this.getTooltip();
    this.contextValue = 'workItem';

    // Check if over-estimate
    const isOver = EstimateChecker.isOverEstimate(workItem);
    const showAlerts = this.shouldShowAlerts();

    // Check if assigned to current user
    const assignedTo = workItem.fields['System.AssignedTo'];
    const isAssignedToMe = this.isAssignedToCurrentUser(assignedTo);

    // Build description
    let description = '';
    if (showParentInDescription && parentId) {
      description = `#${id} - ${state} (Parent: #${parentId})`;
    } else {
      description = `#${id} - ${state}`;
    }

    // Add assignment indicator
    if (isAssignedToMe) {
      description = `👤 ${description}`;
    }

    if (isOver && showAlerts) {
      const percentage = EstimateChecker.getOverEstimatePercentage(workItem);
      const severity = EstimateChecker.getSeverityLevel(percentage);
      description += ` ⚠️ +${percentage.toFixed(0)}%`;

      // Use warning color for icon
      this.iconPath = new vscode.ThemeIcon(
        this.getThemeIcon(workItemType),
        new vscode.ThemeColor(EstimateChecker.getSeverityColor(severity))
      );
    } else {
      // Regular icon
      this.iconPath = new vscode.ThemeIcon(
        this.getThemeIcon(workItemType),
        new vscode.ThemeColor(this.getIconColor(state))
      );
    }

    this.description = description;

    // Command to view work item details
    this.command = {
      command: 'azureDevOps.viewWorkItemDetails',
      title: 'View Work Item Details',
      arguments: [this.workItem]
    };
  }

  private shouldShowAlerts(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<boolean>('showOverEstimateAlerts', true);
  }

  private isAssignedToCurrentUser(assignedTo: any): boolean {
    if (!assignedTo || !ProjectManagerWorkItemTreeItem.currentUser) {
      return false;
    }

    return assignedTo.uniqueName === ProjectManagerWorkItemTreeItem.currentUser.uniqueName ||
           assignedTo.displayName === ProjectManagerWorkItemTreeItem.currentUser.displayName;
  }

  private getThemeIcon(workItemType: string): string {
    const iconMap: { [key: string]: string } = {
      'User Story': 'book',
      'Task': 'checklist',
      'Bug': 'bug',
      'Feature': 'rocket',
      'Epic': 'milestone',
      'Issue': 'warning',
      'Test Case': 'beaker'
    };

    return iconMap[workItemType] || 'circle-outline';
  }

  private getIconColor(state: string): string {
    const colorMap: { [key: string]: string } = {
      'New': 'charts.blue',
      'Active': 'charts.green',
      'In Progress': 'charts.green',
      'Resolved': 'charts.purple',
      'Closed': 'charts.gray',
      'Removed': 'charts.red',
      'Done': 'charts.green',
      'To Do': 'charts.blue',
      'Committed': 'charts.green'
    };

    return colorMap[state] || 'charts.blue';
  }

  private getTooltip(): string {
    const wi = this.workItem;
    const fields = wi.fields;

    let tooltip = `ID: ${fields['System.Id']}\n`;
    tooltip += `Title: ${fields['System.Title']}\n`;
    tooltip += `Type: ${fields['System.WorkItemType']}\n`;
    tooltip += `State: ${fields['System.State']}\n`;

    if (fields['System.AssignedTo']) {
      tooltip += `Assigned To: ${fields['System.AssignedTo'].displayName}\n`;
    }

    // Add estimate info
    const summary = EstimateChecker.getEstimateSummary(wi);
    if (summary.originalEstimate > 0) {
      tooltip += `\nOriginal Estimate: ${summary.originalEstimate}h\n`;
      tooltip += `Completed Work: ${summary.completedWork}h\n`;
      tooltip += `Remaining Work: ${summary.remainingWork}h\n`;
      tooltip += `Total Work: ${summary.totalWork}h\n`;

      if (summary.isOver) {
        tooltip += `⚠️ ${summary.percentage.toFixed(1)}% over estimate`;
      }
    }

    return tooltip;
  }
}

/**
 * Category tree item for grouping
 */
class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly workItems: WorkItem[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.contextValue = 'category';
    this.description = `${workItems.length} item${workItems.length !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

/**
 * Project Manager view provider
 */
export class ProjectManagerProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private workItems: WorkItem[] = [];
  private api: AzureDevOpsApi;
  private hasLoaded: boolean = false;

  constructor() {
    this.api = AzureDevOpsApi.getInstance();
  }

  refresh(): void {
    this.hasLoaded = false;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update a work item in the local cache (optimistic update)
   */
  updateWorkItemInCache(updatedWorkItem: WorkItem): void {
    const id = updatedWorkItem.fields['System.Id'];
    const index = this.workItems.findIndex(wi => wi.fields['System.Id'] === id);

    if (index !== -1) {
      this.workItems[index] = updatedWorkItem;
      this._onDidChangeTreeData.fire();
    }
  }

  async loadWorkItems(): Promise<void> {
    try {
      this.workItems = await this.api.getAllProjectWorkItems();

      // Set current user for assignment indicators
      const currentUser = await this.getCurrentUser();
      ProjectManagerWorkItemTreeItem.setCurrentUser(currentUser);

      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load project work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.workItems = [];
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level - show grouped categories
      if (!this.hasLoaded) {
        await this.loadWorkItems();
      }

      if (this.workItems.length === 0) {
        const emptyItem = new vscode.TreeItem('No work items to display', vscode.TreeItemCollapsibleState.None);
        emptyItem.iconPath = new vscode.ThemeIcon('info');
        emptyItem.contextValue = 'empty';
        return [emptyItem];
      }

      // Get grouping preference
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const groupBy = config.get<string>('projectManagerGroupBy', 'state');

      return this.getGroupedItems(groupBy);
    } else if (element instanceof CategoryTreeItem) {
      // Show work items in category with parent-child hierarchy
      return this.buildHierarchy(element.workItems);
    } else if (element instanceof ProjectManagerWorkItemTreeItem) {
      // Show children of this work item - find all children from workItems
      const parentId = element.workItem.fields['System.Id'];
      const allChildren = this.workItems.filter(wi => wi.fields['System.Parent'] === parentId);

      return allChildren.map(child => {
        // Find this child's children
        const grandchildren = this.workItems.filter(wi => wi.fields['System.Parent'] === child.fields['System.Id']);
        // Use element's ID as parent context to create unique child IDs
        const treeItem = new ProjectManagerWorkItemTreeItem(
          child,
          grandchildren.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          false,
          element.id
        );
        treeItem.children = grandchildren;
        return treeItem;
      });
    }

    return [];
  }

  private getGroupedItems(groupBy: string): vscode.TreeItem[] {
    switch (groupBy) {
      case 'type':
        return this.groupByType();
      case 'iteration':
        return this.groupByIteration();
      case 'assignedTo':
        return this.groupByAssignedTo();
      case 'epic':
        return this.groupByEpic();
      case 'state':
      default:
        return this.groupByState();
    }
  }

  private groupByState(): vscode.TreeItem[] {
    const groups: { [key: string]: WorkItem[] } = {};

    this.workItems.forEach(wi => {
      const state = wi.fields['System.State'];
      if (!groups[state]) {
        groups[state] = [];
      }
      groups[state].push(wi);
    });

    const items: vscode.TreeItem[] = [];
    for (const [state, workItems] of Object.entries(groups)) {
      if (workItems.length > 0) {
        items.push(
          new CategoryTreeItem(state, workItems, vscode.TreeItemCollapsibleState.Collapsed)
        );
      }
    }

    return items;
  }

  private groupByType(): vscode.TreeItem[] {
    const groups: { [key: string]: WorkItem[] } = {};

    this.workItems.forEach(wi => {
      const type = wi.fields['System.WorkItemType'];
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(wi);
    });

    const items: vscode.TreeItem[] = [];
    for (const [type, workItems] of Object.entries(groups)) {
      if (workItems.length > 0) {
        items.push(
          new CategoryTreeItem(type, workItems, vscode.TreeItemCollapsibleState.Collapsed)
        );
      }
    }

    return items;
  }

  private groupByIteration(): vscode.TreeItem[] {
    const groups: { [key: string]: WorkItem[] } = {};

    this.workItems.forEach(wi => {
      const iteration = wi.fields['System.IterationPath'];
      if (!groups[iteration]) {
        groups[iteration] = [];
      }
      groups[iteration].push(wi);
    });

    const items: vscode.TreeItem[] = [];
    for (const [iteration, workItems] of Object.entries(groups)) {
      if (workItems.length > 0) {
        items.push(
          new CategoryTreeItem(iteration, workItems, vscode.TreeItemCollapsibleState.Collapsed)
        );
      }
    }

    return items;
  }

  private groupByAssignedTo(): vscode.TreeItem[] {
    const groups: { [key: string]: WorkItem[] } = {};

    this.workItems.forEach(wi => {
      const assignedTo = wi.fields['System.AssignedTo']?.displayName || 'Unassigned';
      if (!groups[assignedTo]) {
        groups[assignedTo] = [];
      }
      groups[assignedTo].push(wi);
    });

    const items: vscode.TreeItem[] = [];
    for (const [assignedTo, workItems] of Object.entries(groups)) {
      if (workItems.length > 0) {
        items.push(
          new CategoryTreeItem(assignedTo, workItems, vscode.TreeItemCollapsibleState.Collapsed)
        );
      }
    }

    return items;
  }

  private groupByEpic(): vscode.TreeItem[] {
    // Create a map of all work items for easy lookup
    const itemMap = new Map<number, WorkItem>();
    this.workItems.forEach(wi => itemMap.set(wi.fields['System.Id'], wi));

    // Helper function to find the epic for a work item
    const findEpic = (workItem: WorkItem): WorkItem | null => {
      let current = workItem;

      // Walk up the parent chain
      while (current) {
        const workItemType = current.fields['System.WorkItemType'];

        // If this is an Epic, we found it
        if (workItemType === 'Epic') {
          return current;
        }

        // Move to parent
        const parentId = current.fields['System.Parent'];
        if (parentId && itemMap.has(parentId)) {
          current = itemMap.get(parentId)!;
        } else {
          // No parent found, stop searching
          break;
        }
      }

      return null;
    };

    // Group work items by their epic
    const groups: { [key: string]: WorkItem[] } = {};
    const epicMap = new Map<string, WorkItem>(); // Map epic key to epic work item

    this.workItems.forEach(wi => {
      const epic = findEpic(wi);

      if (epic) {
        const epicKey = `#${epic.fields['System.Id']}: ${epic.fields['System.Title']}`;
        if (!groups[epicKey]) {
          groups[epicKey] = [];
          epicMap.set(epicKey, epic);
        }
        groups[epicKey].push(wi);
      } else {
        const noEpicKey = 'No Epic';
        if (!groups[noEpicKey]) {
          groups[noEpicKey] = [];
        }
        groups[noEpicKey].push(wi);
      }
    });

    // Create category items sorted by epic ID (epics first, then "No Epic")
    const items: vscode.TreeItem[] = [];
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'No Epic') return 1;
      if (b === 'No Epic') return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      const workItems = groups[key];
      if (workItems.length > 0) {
        items.push(
          new CategoryTreeItem(key, workItems, vscode.TreeItemCollapsibleState.Collapsed)
        );
      }
    }

    return items;
  }

  private buildHierarchy(workItems: WorkItem[]): ProjectManagerWorkItemTreeItem[] {
    // Create a map of work item ID to work item
    const itemMap = new Map<number, WorkItem>();
    workItems.forEach(wi => itemMap.set(wi.fields['System.Id'], wi));

    // Separate parents and children
    const parents: WorkItem[] = [];
    const childrenByParent = new Map<number, WorkItem[]>();

    workItems.forEach(wi => {
      const parentId = wi.fields['System.Parent'];

      if (parentId && itemMap.has(parentId)) {
        // This item has a parent in the current list
        if (!childrenByParent.has(parentId)) {
          childrenByParent.set(parentId, []);
        }
        childrenByParent.get(parentId)!.push(wi);
      } else {
        // This is either a parent or an orphan (parent not in current group)
        parents.push(wi);
      }
    });

    // Build tree items
    return parents.map(parent => {
      const children = childrenByParent.get(parent.fields['System.Id']) || [];
      const hasChildren = children.length > 0;

      const treeItem = new ProjectManagerWorkItemTreeItem(
        parent,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        !!parent.fields['System.Parent'] // Show parent in description if this item has a parent not in view
      );

      treeItem.children = children;
      return treeItem;
    });
  }

  private async getCurrentUser(): Promise<{ uniqueName: string, displayName: string } | null> {
    try {
      // Try to find current user from existing assigned work items
      const myItems = await this.api.getMyWorkItems();
      if (myItems.length > 0) {
        const identity = myItems[0].fields['System.AssignedTo'];
        if (identity) {
          return {
            uniqueName: identity.uniqueName || identity.displayName,
            displayName: identity.displayName
          };
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  }

  getWorkItems(): WorkItem[] {
    return this.workItems;
  }
}
