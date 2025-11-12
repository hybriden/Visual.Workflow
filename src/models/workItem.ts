/**
 * Azure DevOps Work Item models
 */

export interface WorkItem {
  id: number;
  rev: number;
  fields: WorkItemFields;
  url: string;
}

export interface WorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.WorkItemType': string;
  'System.State': string;
  'System.AssignedTo'?: AssignedTo;
  'System.CreatedDate': string;
  'System.ChangedDate': string;
  'System.Description'?: string;
  'System.AreaPath': string;
  'System.IterationPath': string;
  'System.Tags'?: string;
  'Microsoft.VSTS.Scheduling.RemainingWork'?: number;
  'Microsoft.VSTS.Scheduling.OriginalEstimate'?: number;
  'Microsoft.VSTS.Scheduling.CompletedWork'?: number;
  'System.Parent'?: number;
}

export interface AssignedTo {
  displayName: string;
  url: string;
  id: string;
  uniqueName: string;
  imageUrl: string;
}

export interface WorkItemQueryResult {
  queryType: string;
  queryResultType: string;
  asOf: string;
  workItems: WorkItemReference[];
}

export interface WorkItemReference {
  id: number;
  url: string;
}

export interface Iteration {
  id: string;
  name: string;
  path: string;
  attributes: {
    startDate: string;
    finishDate: string;
    timeFrame: 'past' | 'current' | 'future';
  };
  url: string;
}

export interface WorkItemUpdate {
  id: number;
  fields: Partial<WorkItemFields>;
}

export interface WorkItemStateCategory {
  'To Do': WorkItem[];
  'In Progress': WorkItem[];
  'Done': WorkItem[];
  'Removed': WorkItem[];
}

// Work item type icons mapping
export const WorkItemTypeIcons: { [key: string]: string } = {
  'User Story': '📖',
  'Task': '✓',
  'Bug': '🐛',
  'Feature': '🎯',
  'Epic': '🎪',
  'Issue': '⚠️',
  'Test Case': '🧪',
  'Default': '📋'
};

// State color mapping for UI
export const StateColors: { [key: string]: string } = {
  'New': '#0078d4',
  'Active': '#107c10',
  'In Progress': '#107c10',
  'Resolved': '#8764b8',
  'Closed': '#605e5c',
  'Removed': '#d13438',
  'Done': '#107c10',
  'To Do': '#0078d4',
  'Committed': '#107c10'
};
