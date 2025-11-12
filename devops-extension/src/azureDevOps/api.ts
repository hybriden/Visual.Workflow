import axios, { AxiosInstance, AxiosError } from 'axios';
import * as vscode from 'vscode';
import { AzureDevOpsAuth } from './auth';
import { WorkItem, WorkItemQueryResult, Iteration } from '../models/workItem';

/**
 * Azure DevOps API Client
 */
export class AzureDevOpsApi {
  private static instance: AzureDevOpsApi;
  private axiosInstance: AxiosInstance;
  private auth: AzureDevOpsAuth;

  private constructor() {
    this.auth = AzureDevOpsAuth.getInstance();

    this.axiosInstance = axios.create({
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    // Request interceptor to add auth header
    this.axiosInstance.interceptors.request.use(
      (config) => {
        try {
          config.headers.Authorization = this.auth.getAuthHeader();
        } catch (error) {
          return Promise.reject(error);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): AzureDevOpsApi {
    if (!AzureDevOpsApi.instance) {
      AzureDevOpsApi.instance = new AzureDevOpsApi();
    }
    return AzureDevOpsApi.instance;
  }

  /**
   * Get base URL for Azure DevOps API
   */
  private getBaseUrl(): string {
    const org = this.auth.getOrganization();
    return `https://dev.azure.com/${org}`;
  }

  /**
   * Get project-specific base URL
   */
  private getProjectUrl(): string {
    const project = this.auth.getProject();
    return `${this.getBaseUrl()}/${project}`;
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case 401:
          vscode.window.showErrorMessage(
            'Azure DevOps authentication failed. Please check your Personal Access Token.'
          );
          break;
        case 403:
          vscode.window.showErrorMessage(
            'Access denied. Please ensure your PAT has the required permissions.'
          );
          break;
        case 404:
          vscode.window.showErrorMessage(
            'Resource not found. Please check your organization and project names.'
          );
          break;
        default:
          vscode.window.showErrorMessage(
            `Azure DevOps API error: ${error.message}`
          );
      }
    } else if (error.request) {
      vscode.window.showErrorMessage(
        'Unable to connect to Azure DevOps. Please check your network connection.'
      );
    } else {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  }

  /**
   * Test connection to Azure DevOps
   */
  public async testConnection(): Promise<boolean> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/workitems?ids=1&api-version=7.0`;
      await this.axiosInstance.get(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current iteration (sprint)
   */
  public async getCurrentIteration(): Promise<Iteration | null> {
    try {
      const team = this.auth.getTeam();
      const teamPath = team ? `/${team}` : '';
      const url = `${this.getProjectUrl()}${teamPath}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.0`;

      const response = await this.axiosInstance.get(url);

      if (response.data.value && response.data.value.length > 0) {
        return response.data.value[0];
      }

      return null;
    } catch (error) {
      console.error('Error fetching current iteration:', error);
      throw error;
    }
  }

  /**
   * Query work items using WIQL
   */
  public async queryWorkItems(wiql: string): Promise<number[]> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/wiql?api-version=7.0`;

      const response = await this.axiosInstance.post(url, {
        query: wiql
      });

      const result: WorkItemQueryResult = response.data;
      return result.workItems.map(wi => wi.id);
    } catch (error) {
      console.error('Error querying work items:', error);
      throw error;
    }
  }

  /**
   * Get work items by IDs
   */
  public async getWorkItems(ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      const idsString = ids.join(',');
      const url = `${this.getBaseUrl()}/_apis/wit/workitems?ids=${idsString}&$expand=all&api-version=7.0`;

      const response = await this.axiosInstance.get(url);
      return response.data.value;
    } catch (error) {
      console.error('Error fetching work items:', error);
      throw error;
    }
  }

  /**
   * Get work items for current sprint with filtering
   */
  public async getSprintWorkItems(): Promise<WorkItem[]> {
    try {
      const iteration = await this.getCurrentIteration();

      if (!iteration) {
        vscode.window.showWarningMessage('No active sprint found.');
        return [];
      }

      // Get filter settings
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const hideCompleted = config.get<boolean>('hideCompletedItems', true);
      const hideRemoved = config.get<boolean>('hideRemovedItems', true);
      const showOnlyAssignedToMe = config.get<boolean>('showOnlyAssignedToMe', false);

      // Build state filter
      let stateFilter = '';
      if (hideCompleted) {
        stateFilter += `AND [System.State] <> 'Done'
        AND [System.State] <> 'Closed'
        AND [System.State] <> 'Resolved' `;
      }
      if (hideRemoved) {
        stateFilter += `AND [System.State] <> 'Removed'
        AND [System.State] <> 'Cut' `;
      }

      // Build assignment filter
      let assignmentFilter = '';
      if (showOnlyAssignedToMe) {
        assignmentFilter = 'AND [System.AssignedTo] = @Me ';
      }

      // Query for work items in current iteration
      const wiql = `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.IterationPath] = '${iteration.path}'
        AND [System.TeamProject] = '${this.auth.getProject()}'
        ${stateFilter}
        ${assignmentFilter}
        ORDER BY [System.State] ASC, [System.ChangedDate] DESC
      `;

      const ids = await this.queryWorkItems(wiql);
      return await this.getWorkItems(ids);
    } catch (error) {
      console.error('Error fetching sprint work items:', error);
      throw error;
    }
  }

  /**
   * Get work items assigned to current user with filtering
   */
  public async getMyWorkItems(): Promise<WorkItem[]> {
    try {
      // Get filter settings
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const hideCompleted = config.get<boolean>('hideCompletedItems', true);
      const hideRemoved = config.get<boolean>('hideRemovedItems', true);

      // Build state filter
      let stateFilter = '';
      if (hideCompleted) {
        stateFilter += `AND [System.State] <> 'Done'
        AND [System.State] <> 'Closed'
        AND [System.State] <> 'Resolved' `;
      }
      if (hideRemoved) {
        stateFilter += `AND [System.State] <> 'Removed'
        AND [System.State] <> 'Cut' `;
      }

      // Use @Me macro to get current user's work items
      const wiql = `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.AssignedTo] = @Me
        AND [System.TeamProject] = '${this.auth.getProject()}'
        ${stateFilter}
        ORDER BY [System.ChangedDate] DESC
      `;

      const ids = await this.queryWorkItems(wiql);
      return await this.getWorkItems(ids);
    } catch (error) {
      console.error('Error fetching my work items:', error);
      throw error;
    }
  }

  /**
   * Get a single work item by ID
   */
  public async getWorkItem(id: number): Promise<WorkItem> {
    try {
      const url = `${this.getBaseUrl()}/_apis/wit/workitems/${id}?$expand=all&api-version=7.0`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching work item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update work item
   */
  public async updateWorkItem(id: number, updates: Array<{ op: string; path: string; value: any }>): Promise<WorkItem> {
    try {
      const url = `${this.getBaseUrl()}/_apis/wit/workitems/${id}?api-version=7.0`;

      const response = await this.axiosInstance.patch(url, updates, {
        headers: {
          'Content-Type': 'application/json-patch+json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error updating work item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Change work item state
   */
  public async changeWorkItemState(id: number, newState: string): Promise<WorkItem> {
    try {
      const updates = [
        {
          op: 'add',
          path: '/fields/System.State',
          value: newState
        }
      ];

      return await this.updateWorkItem(id, updates);
    } catch (error: any) {
      // Provide better error messages for state transition errors
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || 'Invalid state transition';
        throw new Error(`Cannot change to "${newState}": ${errorMessage}. This state transition may not be allowed.`);
      }
      throw error;
    }
  }

  /**
   * Get available states for a work item type
   */
  public async getWorkItemStates(workItemType: string): Promise<string[]> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/workitemtypes/${workItemType}/states?api-version=7.0`;
      const response = await this.axiosInstance.get(url);

      return response.data.value.map((state: any) => state.name);
    } catch (error) {
      console.error(`Error fetching states for ${workItemType}:`, error);
      // Return common default states
      return ['New', 'Active', 'Resolved', 'Closed'];
    }
  }

  /**
   * Create a new work item
   */
  public async createWorkItem(
    workItemType: string,
    title: string,
    description?: string,
    assignedTo?: string
  ): Promise<WorkItem> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/workitems/$${workItemType}?api-version=7.0`;

      const updates: Array<{ op: string; path: string; value: any }> = [
        {
          op: 'add',
          path: '/fields/System.Title',
          value: title
        }
      ];

      if (description) {
        updates.push({
          op: 'add',
          path: '/fields/System.Description',
          value: description
        });
      }

      if (assignedTo) {
        updates.push({
          op: 'add',
          path: '/fields/System.AssignedTo',
          value: assignedTo
        });
      }

      const response = await this.axiosInstance.post(url, updates, {
        headers: {
          'Content-Type': 'application/json-patch+json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating work item:', error);
      throw error;
    }
  }

  /**
   * Get work item URL for browser
   */
  public getWorkItemUrl(id: number): string {
    return `${this.getProjectUrl()}/_workitems/edit/${id}`;
  }
}
