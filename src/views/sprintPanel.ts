import * as vscode from 'vscode';
import { AzureDevOpsApi } from '../azureDevOps/api';
import { WorkItem, WorkItemTypeIcons, StateColors } from '../models/workItem';
import { EstimateChecker } from '../utils/estimateChecker';

/**
 * Tree item for work items in the sprint board
 */
export class WorkItemTreeItem extends vscode.TreeItem {
  public children: WorkItem[] = [];
  private static currentUser: { uniqueName: string, displayName: string } | null = null;

  public static setCurrentUser(user: { uniqueName: string, displayName: string } | null) {
    WorkItemTreeItem.currentUser = user;
  }

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
    this.contextValue = 'workItem';

    // Check if over-estimate
    const isOver = EstimateChecker.isOverEstimate(workItem);
    const showAlerts = this.shouldShowAlerts();

    // Check if assigned to current user
    const assignedTo = workItem.fields['System.AssignedTo'];
    const isAssignedToMe = this.isAssignedToCurrentUser(assignedTo);

    // Build description with over-estimate warning if applicable
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
      description += ` ⚠️ +${percentage.toFixed(0)}%`;
    }

    this.description = description;

    // Set icon based on work item type and over-estimate status
    const icon = WorkItemTypeIcons[workItemType] || WorkItemTypeIcons['Default'];
    if (isOver && showAlerts) {
      const percentage = EstimateChecker.getOverEstimatePercentage(workItem);
      const severity = EstimateChecker.getSeverityLevel(percentage);
      this.iconPath = new vscode.ThemeIcon(
        this.getThemeIcon(workItemType),
        new vscode.ThemeColor(EstimateChecker.getSeverityColor(severity))
      );
    } else {
      this.iconPath = new vscode.ThemeIcon(
        this.getThemeIcon(workItemType),
        new vscode.ThemeColor(this.getIconColor(state))
      );
    }

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
    if (!assignedTo || !WorkItemTreeItem.currentUser) {
      return false;
    }

    return assignedTo.uniqueName === WorkItemTreeItem.currentUser.uniqueName ||
           assignedTo.displayName === WorkItemTreeItem.currentUser.displayName;
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
  private workItemMap: Map<number, WorkItem> = new Map();
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
      const sprintItems = await this.api.getSprintWorkItems();
      console.log(`[Sprint Board] Loaded ${sprintItems.length} items from sprint`);
      console.log('[Sprint Board] Work item types:', sprintItems.map(wi => wi.fields['System.WorkItemType']).join(', '));

      // Set current user for assignment indicators
      const currentUser = await this.getCurrentUser();
      WorkItemTreeItem.setCurrentUser(currentUser);

      // Enhance with parent/child context
      const enhancedItems = await this.addParentChildContext(sprintItems);
      console.log(`[Sprint Board] After enhancement: ${enhancedItems.length} items total`);

      this.workItems = enhancedItems;

      // Build work item map for quick lookups
      this.workItemMap.clear();
      enhancedItems.forEach(wi => this.workItemMap.set(wi.fields['System.Id'], wi));

      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load sprint work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.workItems = [];
      this.workItemMap.clear();
      this.hasLoaded = true;
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Add parent and child work items for context, even if not in sprint
   */
  private async addParentChildContext(sprintItems: WorkItem[]): Promise<WorkItem[]> {
    const itemMap = new Map<number, WorkItem>();
    const itemsToAdd: WorkItem[] = [];

    // Add all sprint items to map
    sprintItems.forEach(wi => itemMap.set(wi.fields['System.Id'], wi));

    // Get current user for filtering
    const currentUser = await this.getCurrentUser();

    // Recursively fetch all parents up the hierarchy
    await this.fetchAllParents(sprintItems, itemMap, itemsToAdd);

    console.log(`[Sprint Board] Fetched ${itemsToAdd.length} additional parent items`)

    // Find children that need to be added (only for items assigned to current user)
    const childrenToFetch: number[] = [];
    for (const wi of sprintItems) {
      const assignedTo = wi.fields['System.AssignedTo']?.uniqueName || wi.fields['System.AssignedTo']?.displayName;
      const isAssignedToMe = currentUser && assignedTo &&
        (assignedTo === currentUser.uniqueName || assignedTo === currentUser.displayName);

      if (isAssignedToMe) {
        try {
          const childIds = await this.api.getChildWorkItems(wi.fields['System.Id']);
          childrenToFetch.push(...childIds.filter(id => !itemMap.has(id)));
        } catch (error) {
          console.error(`Error fetching children for work item ${wi.fields['System.Id']}:`, error);
        }
      }
    }

    // Fetch and add child work items (filter out those assigned to others)
    if (childrenToFetch.length > 0) {
      try {
        const children = await this.api.getWorkItems(childrenToFetch);
        children.forEach(child => {
          const assignedTo = child.fields['System.AssignedTo']?.uniqueName || child.fields['System.AssignedTo']?.displayName;
          const isAssignedToMe = currentUser && assignedTo &&
            (assignedTo === currentUser.uniqueName || assignedTo === currentUser.displayName);
          const isUnassigned = !assignedTo;

          // Only add if assigned to me or unassigned
          if (isAssignedToMe || isUnassigned) {
            if (!itemMap.has(child.fields['System.Id'])) {
              itemMap.set(child.fields['System.Id'], child);
              itemsToAdd.push(child);
            }
          }
        });
      } catch (error) {
        console.error('Error fetching child work items:', error);
      }
    }

    return [...sprintItems, ...itemsToAdd];
  }

  /**
   * Recursively fetch all parents up the hierarchy
   */
  private async fetchAllParents(
    workItems: WorkItem[],
    itemMap: Map<number, WorkItem>,
    itemsToAdd: WorkItem[]
  ): Promise<void> {
    const parentsToFetch: number[] = [];

    // Find all parents that aren't in the map yet
    for (const wi of workItems) {
      const parentId = wi.fields['System.Parent'];
      if (parentId && !itemMap.has(parentId)) {
        parentsToFetch.push(parentId);
      }
    }

    if (parentsToFetch.length === 0) {
      return; // No more parents to fetch
    }

    try {
      const parents = await this.api.getWorkItems(parentsToFetch);

      // Add fetched parents to map and itemsToAdd
      parents.forEach(parent => {
        if (!itemMap.has(parent.fields['System.Id'])) {
          itemMap.set(parent.fields['System.Id'], parent);
          itemsToAdd.push(parent);
        }
      });

      // Recursively fetch parents of these parents
      await this.fetchAllParents(parents, itemMap, itemsToAdd);
    } catch (error) {
      console.error('Error fetching parent work items:', error);
    }
  }

  /**
   * Get current user identity
   */
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

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getParent(element: vscode.TreeItem): vscode.TreeItem | undefined {
    if (element instanceof WorkItemTreeItem) {
      const parentId = element.workItem.fields['System.Parent'];

      if (parentId) {
        // Find the parent work item
        const parentWorkItem = this.workItems.find(wi => wi.fields['System.Id'] === parentId);

        if (parentWorkItem) {
          // Check if parent has children to determine collapsible state
          const parentChildren = this.workItems.filter(wi => wi.fields['System.Parent'] === parentId);
          return new WorkItemTreeItem(
            parentWorkItem,
            parentChildren.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            false
          );
        }
      }

      // No parent work item, so parent is the state category
      const state = element.workItem.fields['System.State'];
      const stateCategory = this.getStateCategory(state);
      const categoryWorkItems = this.workItems.filter(wi => this.getStateCategory(wi.fields['System.State']) === stateCategory);

      return new StateCategoryTreeItem(
        stateCategory,
        categoryWorkItems,
        vscode.TreeItemCollapsibleState.Expanded
      );
    } else if (element instanceof StateCategoryTreeItem) {
      // State categories are at root level
      return undefined;
    }

    return undefined;
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
      // Show children of this work item - find all children from workItems
      const parentId = element.workItem.fields['System.Id'];
      const allChildren = this.workItems.filter(wi => wi.fields['System.Parent'] === parentId);

      return allChildren.map(child => {
        // Find this child's children
        const grandchildren = this.workItems.filter(wi => wi.fields['System.Parent'] === child.fields['System.Id']);
        const treeItem = new WorkItemTreeItem(
          child,
          grandchildren.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          false
        );
        treeItem.children = grandchildren;
        return treeItem;
      });
    }

    return [];
  }

  private buildHierarchy(workItems: WorkItem[]): WorkItemTreeItem[] {
    // Create a map of ALL work items (including those from other states for hierarchy)
    const itemMap = new Map<number, WorkItem>();

    // Add all work items to the map (from all states)
    this.workItems.forEach(wi => {
      itemMap.set(wi.fields['System.Id'], wi);
    });

    // Collect all ancestors of items in this state category
    const allRelevantItems = new Set<number>();
    const addWithAncestors = (wi: WorkItem) => {
      const id = wi.fields['System.Id'];
      allRelevantItems.add(id);

      // Walk up the parent chain
      let currentId: number | undefined = wi.fields['System.Parent'];
      while (currentId && itemMap.has(currentId)) {
        allRelevantItems.add(currentId);
        const parent = itemMap.get(currentId)!;
        currentId = parent.fields['System.Parent'];
      }
    };

    // Add items in this state and all their ancestors
    workItems.forEach(addWithAncestors);

    console.log(`[Sprint Board] Items in state category: ${workItems.length}`);
    console.log(`[Sprint Board] All relevant items (with ancestors): ${allRelevantItems.size}`);
    if (workItems.length > 0) {
      const sample = workItems[0];
      console.log(`[Sprint Board] Sample item: #${sample.fields['System.Id']} (${sample.fields['System.WorkItemType']}) parent: ${sample.fields['System.Parent'] || 'none'}, state: ${sample.fields['System.State']}`);
      if (sample.fields['System.Parent']) {
        const parentInMap = itemMap.has(sample.fields['System.Parent']);
        console.log(`[Sprint Board] Parent #${sample.fields['System.Parent']} in itemMap: ${parentInMap}`);
        if (parentInMap) {
          const parent = itemMap.get(sample.fields['System.Parent'])!;
          console.log(`[Sprint Board] Parent details: ${parent.fields['System.WorkItemType']}, state: ${parent.fields['System.State']}`);
        }
      }
    }

    // Build parent-child relationships for all relevant items
    const childrenByParent = new Map<number, WorkItem[]>();
    const topLevelItems: WorkItem[] = [];

    allRelevantItems.forEach(id => {
      const wi = itemMap.get(id)!;
      const parentId = wi.fields['System.Parent'];

      if (parentId && allRelevantItems.has(parentId)) {
        // This item has a parent in our relevant set
        if (!childrenByParent.has(parentId)) {
          childrenByParent.set(parentId, []);
        }
        childrenByParent.get(parentId)!.push(wi);
      } else {
        // This is a top-level item (no parent in our set)
        topLevelItems.push(wi);
      }
    });

    console.log(`[Sprint Board] Top-level items: ${topLevelItems.map(w => `#${w.fields['System.Id']} (${w.fields['System.WorkItemType']})`).join(', ')}`);

    // Recursively build tree items with full hierarchy
    const buildTreeItem = (wi: WorkItem): WorkItemTreeItem => {
      const directChildren = childrenByParent.get(wi.fields['System.Id']) || [];
      const treeItem = new WorkItemTreeItem(
        wi,
        directChildren.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        !!wi.fields['System.Parent'] && !allRelevantItems.has(wi.fields['System.Parent'])
      );
      // Recursively build children with their full hierarchies
      treeItem.children = directChildren;
      return treeItem;
    };

    return topLevelItems.map(buildTreeItem);
  }

  private getStateCategory(state: string): string {
    if (['New', 'To Do', 'Proposed'].includes(state)) {
      return 'To Do';
    } else if (['Active', 'In Progress', 'Committed'].includes(state)) {
      return 'In Progress';
    } else if (['Done', 'Closed', 'Resolved'].includes(state)) {
      return 'Done';
    } else if (['Removed', 'Cut'].includes(state)) {
      return 'Removed';
    } else {
      // Default to In Progress for unknown states
      return 'In Progress';
    }
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
      const category = this.getStateCategory(state);
      categories[category].push(wi);
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

      // Set current user for assignment indicators
      const currentUser = await this.getCurrentUser();
      WorkItemTreeItem.setCurrentUser(currentUser);

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
      // Show children of this work item - find all children from workItems
      const parentId = element.workItem.fields['System.Id'];
      const allChildren = this.workItems.filter(wi => wi.fields['System.Parent'] === parentId);

      return allChildren.map(child => {
        // Find this child's children
        const grandchildren = this.workItems.filter(wi => wi.fields['System.Parent'] === child.fields['System.Id']);
        const treeItem = new WorkItemTreeItem(
          child,
          grandchildren.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          false
        );
        treeItem.children = grandchildren;
        return treeItem;
      });
    }

    return [];
  }

  private buildHierarchy(workItems: WorkItem[]): WorkItemTreeItem[] {
    // Create a map of ALL work items (including those from other states for hierarchy)
    const itemMap = new Map<number, WorkItem>();

    // Add all work items to the map (from all states)
    this.workItems.forEach(wi => {
      itemMap.set(wi.fields['System.Id'], wi);
    });

    // Collect all ancestors of items in this state category
    const allRelevantItems = new Set<number>();
    const addWithAncestors = (wi: WorkItem) => {
      const id = wi.fields['System.Id'];
      allRelevantItems.add(id);

      // Walk up the parent chain
      let currentId: number | undefined = wi.fields['System.Parent'];
      while (currentId && itemMap.has(currentId)) {
        allRelevantItems.add(currentId);
        const parent = itemMap.get(currentId)!;
        currentId = parent.fields['System.Parent'];
      }
    };

    // Add items in this state and all their ancestors
    workItems.forEach(addWithAncestors);

    console.log(`[Sprint Board] Items in state category: ${workItems.length}`);
    console.log(`[Sprint Board] All relevant items (with ancestors): ${allRelevantItems.size}`);
    if (workItems.length > 0) {
      const sample = workItems[0];
      console.log(`[Sprint Board] Sample item: #${sample.fields['System.Id']} (${sample.fields['System.WorkItemType']}) parent: ${sample.fields['System.Parent'] || 'none'}, state: ${sample.fields['System.State']}`);
      if (sample.fields['System.Parent']) {
        const parentInMap = itemMap.has(sample.fields['System.Parent']);
        console.log(`[Sprint Board] Parent #${sample.fields['System.Parent']} in itemMap: ${parentInMap}`);
        if (parentInMap) {
          const parent = itemMap.get(sample.fields['System.Parent'])!;
          console.log(`[Sprint Board] Parent details: ${parent.fields['System.WorkItemType']}, state: ${parent.fields['System.State']}`);
        }
      }
    }

    // Build parent-child relationships for all relevant items
    const childrenByParent = new Map<number, WorkItem[]>();
    const topLevelItems: WorkItem[] = [];

    allRelevantItems.forEach(id => {
      const wi = itemMap.get(id)!;
      const parentId = wi.fields['System.Parent'];

      if (parentId && allRelevantItems.has(parentId)) {
        // This item has a parent in our relevant set
        if (!childrenByParent.has(parentId)) {
          childrenByParent.set(parentId, []);
        }
        childrenByParent.get(parentId)!.push(wi);
      } else {
        // This is a top-level item (no parent in our set)
        topLevelItems.push(wi);
      }
    });

    console.log(`[Sprint Board] Top-level items: ${topLevelItems.map(w => `#${w.fields['System.Id']} (${w.fields['System.WorkItemType']})`).join(', ')}`);

    // Recursively build tree items with full hierarchy
    const buildTreeItem = (wi: WorkItem): WorkItemTreeItem => {
      const directChildren = childrenByParent.get(wi.fields['System.Id']) || [];
      const treeItem = new WorkItemTreeItem(
        wi,
        directChildren.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        !!wi.fields['System.Parent'] && !allRelevantItems.has(wi.fields['System.Parent'])
      );
      // Recursively build children with their full hierarchies
      treeItem.children = directChildren;
      return treeItem;
    };

    return topLevelItems.map(buildTreeItem);
  }

  private async getCurrentUser(): Promise<{ uniqueName: string, displayName: string } | null> {
    try {
      // Try to find current user from existing assigned work items
      if (this.workItems.length > 0) {
        const identity = this.workItems[0].fields['System.AssignedTo'];
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
