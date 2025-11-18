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
        // Check if this request should suppress error messages
        const suppressErrors = (error.config as any)?.suppressErrors;
        if (!suppressErrors) {
          this.handleApiError(error);
        }
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
      const project = this.auth.getProject();
      if (!project) {
        return false;
      }

      // Use project endpoint which is reliable and doesn't require specific work item IDs
      const url = `${this.getBaseUrl()}/_apis/projects/${encodeURIComponent(project)}?api-version=7.1`;

      // Suppress error popups for connection tests
      await this.axiosInstance.get(url, { suppressErrors: true } as any);
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
   * Get work item comments
   */
  public async getWorkItemComments(id: number): Promise<any[]> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.3`;
      const response = await this.axiosInstance.get(url);

      // Try different response formats
      if (response.data.comments) {
        return response.data.comments;
      } else if (response.data.value) {
        return response.data.value;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }

      console.log('Unexpected comments response format:', response.data);
      return [];
    } catch (error: any) {
      console.error(`Error fetching comments for work item ${id}:`, error.response?.status, error.response?.data);
      // Return empty array if comments API fails (some orgs may not have it enabled)
      // This is a preview API and may not be available in all Azure DevOps instances
      return [];
    }
  }

  /**
   * Add a comment to a work item
   */
  public async addWorkItemComment(id: number, commentText: string): Promise<any> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.3`;
      const response = await this.axiosInstance.post(url, {
        text: commentText
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error adding comment to work item ${id}:`, error.response?.status, error.response?.data);
      throw error;
    }
  }

  /**
   * Delete a comment from a work item
   */
  public async deleteWorkItemComment(workItemId: number, commentId: number): Promise<void> {
    try {
      const url = `${this.getProjectUrl()}/_apis/wit/workItems/${workItemId}/comments/${commentId}?api-version=7.1-preview.3`;
      await this.axiosInstance.delete(url);
    } catch (error: any) {
      console.error(`Error deleting comment ${commentId} from work item ${workItemId}:`, error.response?.status, error.response?.data);
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
   * Add parent link to a work item
   */
  public async addParentLink(childId: number, parentId: number): Promise<void> {
    try {
      const url = `${this.getBaseUrl()}/_apis/wit/workitems/${childId}?api-version=7.0`;

      const updates = [
        {
          op: 'add',
          path: '/relations/-',
          value: {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: `${this.getBaseUrl()}/_apis/wit/workitems/${parentId}`,
            attributes: {
              comment: 'Parent link'
            }
          }
        }
      ];

      await this.axiosInstance.patch(url, updates, {
        headers: {
          'Content-Type': 'application/json-patch+json'
        }
      });
    } catch (error) {
      console.error(`Error adding parent link from ${childId} to ${parentId}:`, error);
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  public async getCurrentUser(): Promise<any> {
    try {
      const org = this.auth.getOrganization();
      const url = `https://vssps.dev.azure.com/${org}/_apis/profile/profiles/me?api-version=7.0`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  }

  /**
   * Get current user's connection data (includes display name and email)
   */
  public async getCurrentUserConnection(): Promise<any> {
    try {
      const org = this.auth.getOrganization();
      const url = `https://dev.azure.com/${org}/_apis/connectionData?api-version=7.0`;
      const response = await this.axiosInstance.get(url);
      return response.data.authenticatedUser;
    } catch (error) {
      console.error('Error fetching current user connection:', error);
      throw error;
    }
  }

  /**
   * Get all teams in the project (helper for debugging)
   */
  private async getProjectTeams(): Promise<Array<{ id: string; name: string }>> {
    try {
      const project = this.auth.getProject();
      if (!project) {
        return [];
      }

      const url = `${this.getBaseUrl()}/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1`;
      const response = await this.axiosInstance.get(url);

      return response.data.value.map((team: any) => ({
        id: team.id,
        name: team.name
      }));
    } catch (error) {
      console.error('Error fetching project teams:', error);
      return [];
    }
  }

  /**
   * Get team members for assignment dropdown
   * Fetches members from ALL teams in the project and combines them
   */
  public async getTeamMembers(): Promise<Array<{ id: string; displayName: string; uniqueName: string }>> {
    try {
      const project = this.auth.getProject();
      if (!project) {
        throw new Error('No project configured');
      }

      // Get all teams in the project
      const availableTeams = await this.getProjectTeams();
      console.log(`Found ${availableTeams.length} teams in project "${project}":`, availableTeams.map(t => t.name).join(', '));

      if (availableTeams.length === 0) {
        console.error('No teams found in project');
        return [];
      }

      // Fetch members from all teams
      const allMembersMap = new Map<string, { id: string; displayName: string; uniqueName: string }>();

      for (const team of availableTeams) {
        try {
          const url = `${this.getBaseUrl()}/_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team.id)}/members?api-version=7.1`;
          console.log(`Fetching members from team "${team.name}"...`);

          const response = await this.axiosInstance.get(url);
          const teamMembers = response.data.value || [];

          // Add members to map (deduplicates by uniqueName)
          for (const member of teamMembers) {
            if (member.identity && member.identity.uniqueName) {
              allMembersMap.set(member.identity.uniqueName, {
                id: member.identity.id,
                displayName: member.identity.displayName,
                uniqueName: member.identity.uniqueName
              });
            }
          }

          console.log(`  Added ${teamMembers.length} members from "${team.name}"`);
        } catch (teamError: any) {
          console.warn(`Failed to fetch members from team "${team.name}":`, teamError.message);
          // Continue with other teams even if one fails
        }
      }

      const uniqueMembers = Array.from(allMembersMap.values());
      console.log(`Successfully fetched ${uniqueMembers.length} unique members across all teams`);

      // Sort by display name for easier selection
      uniqueMembers.sort((a, b) => a.displayName.localeCompare(b.displayName));

      return uniqueMembers;
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      // Return empty array if fetch fails
      return [];
    }
  }

  /**
   * Assign work item to a user
   */
  public async assignWorkItem(workItemId: number, userIdentity: string): Promise<WorkItem> {
    try {
      const updates = [
        {
          op: 'add',
          path: '/fields/System.AssignedTo',
          value: userIdentity
        }
      ];

      return await this.updateWorkItem(workItemId, updates);
    } catch (error) {
      console.error('Error assigning work item:', error);
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
