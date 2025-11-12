import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { WorkItem, WorkItemTypeIcons, StateColors } from '../models/workItem';

/**
 * Tree item for work items in the sprint board
 */
export class WorkItemTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workItem: WorkItem,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(workItem.fields['System.Title'], collapsibleState);

    const workItemType = workItem.fields['System.WorkItemType'];
    const state = workItem.fields['System.State'];
    const id = workItem.fields['System.Id'];

    this.id = id.toString();
    this.tooltip = this.getTooltip();
    this.description = `#${id} - ${state}`;
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

  constructor() {
    this.api = AzureDevOpsApi.getInstance();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadWorkItems(): Promise<void> {
    try {
      this.workItems = await this.api.getSprintWorkItems();
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load sprint work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.workItems = [];
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level - show state categories
      if (this.workItems.length === 0) {
        await this.loadWorkItems();
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
      // Show work items in this category
      return element.workItems.map(
        wi => new WorkItemTreeItem(wi, vscode.TreeItemCollapsibleState.None)
      );
    }

    return [];
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

  constructor() {
    this.api = AzureDevOpsApi.getInstance();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadWorkItems(): Promise<void> {
    try {
      this.workItems = await this.api.getMyWorkItems();
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load my work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.workItems = [];
    }
  }

  getTreeItem(element: WorkItemTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkItemTreeItem): Promise<WorkItemTreeItem[]> {
    if (!element) {
      if (this.workItems.length === 0) {
        await this.loadWorkItems();
      }

      return this.workItems.map(
        wi => new WorkItemTreeItem(wi, vscode.TreeItemCollapsibleState.None)
      );
    }

    return [];
  }

  getWorkItems(): WorkItem[] {
    return this.workItems;
  }
}
