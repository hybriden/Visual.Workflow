import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { WorkItem, WorkItemTypeIcons, StateColors } from '../models/workItem';

/**
 * Tree item for work items in the sprint board
 */
export class WorkItemTreeItem extends vscode.TreeItem {
  public children: WorkItem[] = [];

  constructor(
    public readonly workItem: WorkItem,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly showParentInDescription: boolean = false
  ) {
    super(workItem.fields['System.Title'], collapsibleState);

    const workItemType = workItem.fields['System.WorkItemType'];
    const state = workItem.fields['System.State'];
    const id = workItem.fields['System.Id'];
    const parentId = workItem.fields['System.Parent'];

    this.id = id.toString();
    this.tooltip = this.getTooltip();

    // Only show parent in description if explicitly requested (for items whose parent is not in the same view)
    if (showParentInDescription && parentId) {
      this.description = `#${id} - ${state} (Parent: #${parentId})`;
    } else {
      this.description = `#${id} - ${state}`;
    }

    this.contextValue = 'workItem';

    // Set icon based on work item type
    const icon = WorkItemTypeIcons[workItemType] || WorkItemTypeIcons['Default'];
    this.iconPath = new vscode.ThemeIcon(
      this.getThemeIcon(workItemType),
      new vscode.ThemeColor(this.getIconColor(state))
    );

    // Command to view work item details
    this.command = {
      command: 'azureDevOps.viewWorkItemDetails',
      title: 'View Work Item Details',
      arguments: [this.workItem]
    };
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

    if (fields['Microsoft.VSTS.Scheduling.RemainingWork']) {
      tooltip += `Remaining Work: ${fields['Microsoft.VSTS.Scheduling.RemainingWork']}h\n`;
    }

    return tooltip;
  }
}

/**
 * Tree item for state categories (To Do, In Progress, Done)
 */
export class StateCategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly workItems: WorkItem[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    this.contextValue = 'stateCategory';
    this.description = `${workItems.length} items`;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

/**
 * Tree data provider for Sprint Board
 */
export class SprintBoardProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

  async loadWorkItems(): Promise<void> {
    try {
      this.workItems = await this.api.getSprintWorkItems();
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load sprint work items: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      // Root level - show state categories
      if (!this.hasLoaded) {
        await this.loadWorkItems();
      }

      // If no work items after loading, show a message
      if (this.workItems.length === 0) {
        const emptyItem = new vscode.TreeItem('No work items to display', vscode.TreeItemCollapsibleState.None);
        emptyItem.iconPath = new vscode.ThemeIcon('info');
        emptyItem.contextValue = 'empty';
        return [emptyItem];
      }

      const categories = this.groupByStateCategory(this.workItems);
      const items: vscode.TreeItem[] = [];

      for (const [category, workItems] of Object.entries(categories)) {
        if (workItems.length > 0) {
          items.push(
            new StateCategoryTreeItem(
              category,
              workItems,
              vscode.TreeItemCollapsibleState.Expanded
            )
          );
        }
      }

      return items;
    } else if (element instanceof StateCategoryTreeItem) {
      // Show work items in this category with parent-child hierarchy
      return this.buildHierarchy(element.workItems);
    } else if (element instanceof WorkItemTreeItem) {
      // Show children of this work item
      return element.children.map(
        child => new WorkItemTreeItem(child, vscode.TreeItemCollapsibleState.None, false)
      );
    }

    return [];
  }

  private buildHierarchy(workItems: WorkItem[]): WorkItemTreeItem[] {
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
        // This is either a parent or an orphan (parent not in current state)
        parents.push(wi);
      }
    });

    // Build tree items
    return parents.map(parent => {
      const children = childrenByParent.get(parent.fields['System.Id']) || [];
      const hasChildren = children.length > 0;
      
      const treeItem = new WorkItemTreeItem(
        parent,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        !!parent.fields['System.Parent'] // Show parent in description if this item has a parent not in view
      );
      
      treeItem.children = children;
      return treeItem;
    });
  }

  private groupByStateCategory(workItems: WorkItem[]): { [key: string]: WorkItem[] } {
    const categories: { [key: string]: WorkItem[] } = {
      'To Do': [],
      'In Progress': [],
      'Done': [],
      'Removed': []
    };

    for (const wi of workItems) {
      const state = wi.fields['System.State'];

      // Map states to categories
      if (['New', 'To Do', 'Proposed'].includes(state)) {
        categories['To Do'].push(wi);
      } else if (['Active', 'In Progress', 'Committed'].includes(state)) {
        categories['In Progress'].push(wi);
      } else if (['Done', 'Closed', 'Resolved'].includes(state)) {
        categories['Done'].push(wi);
      } else if (['Removed', 'Cut'].includes(state)) {
        categories['Removed'].push(wi);
      } else {
        // Default to In Progress for unknown states
        categories['In Progress'].push(wi);
      }
    }

    return categories;
  }

  getWorkItems(): WorkItem[] {
    return this.workItems;
  }
}

/**
 * Tree data provider for My Work Items
 */
export class MyWorkItemsProvider implements vscode.TreeDataProvider<WorkItemTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkItemTreeItem | undefined | null | void> =
    new vscode.EventEmitter<WorkItemTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorkItemTreeItem | undefined | null | void> =
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

  async loadWorkItems(): Promise<void> {
    try {
      this.workItems = await this.api.getMyWorkItems();
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load my work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.workItems = [];
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: WorkItemTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkItemTreeItem): Promise<WorkItemTreeItem[]> {
    if (!element) {
      if (!this.hasLoaded) {
        await this.loadWorkItems();
      }

      // If no work items after loading, show a message
      if (this.workItems.length === 0) {
        const emptyItem = new vscode.TreeItem('No work items assigned to you', vscode.TreeItemCollapsibleState.None) as any;
        emptyItem.iconPath = new vscode.ThemeIcon('info');
        emptyItem.contextValue = 'empty';
        return [emptyItem];
      }

      return this.buildHierarchy(this.workItems);
    } else if (element instanceof WorkItemTreeItem) {
      // Show children of this work item
      return element.children.map(
        child => new WorkItemTreeItem(child, vscode.TreeItemCollapsibleState.None, false)
      );
    }

    return [];
  }

  private buildHierarchy(workItems: WorkItem[]): WorkItemTreeItem[] {
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
        // This is either a parent or an orphan (parent not in current state)
        parents.push(wi);
      }
    });

    // Build tree items
    return parents.map(parent => {
      const children = childrenByParent.get(parent.fields['System.Id']) || [];
      const hasChildren = children.length > 0;
      
      const treeItem = new WorkItemTreeItem(
        parent,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        !!parent.fields['System.Parent'] // Show parent in description if this item has a parent not in view
      );
      
      treeItem.children = children;
      return treeItem;
    });
  }

  getWorkItems(): WorkItem[] {
    return this.workItems;
  }
}
