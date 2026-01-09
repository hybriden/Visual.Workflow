import axios, { AxiosInstance, AxiosError } from 'axios';
import * as vscode from 'vscode';

/**
 * Time Log Entry for the Time Logging Extension API
 */
export interface TimeLogEntry {
  minutes: number;
  timeTypeDescription: string;
  comment: string;
  date: string; // Format: YYYY-MM-DD
  workItemId: number;
  projectId: string;
  users: Array<{
    userId: string;
    userName: string;
    userEmail: string;
  }>;
  userMakingChange: string;
}

/**
 * Time Type for categorizing time entries
 */
export interface TimeType {
  id: string;
  description: string;
}

/**
 * Time Log Record returned from the API
 */
export interface TimeLogRecord {
  timeLogId: string;
  minutes: number;
  timeTypeDescription: string;
  comment: string;
  date: string;
  week: string;
  userId: string;
  userName: string;
  userEmail: string;
}

/**
 * Time Logging Extension API Client
 * Integrates with BozNet's Time Logging Extension for Azure DevOps (Premium)
 */
export class TimeLogApi {
  private static instance: TimeLogApi;
  private axiosInstance: AxiosInstance;
  private readonly baseUrl = 'https://boznet-timelogapi.azurewebsites.net/api';
  private apiKey: string = '';

  private constructor() {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    this.apiKey = config.get<string>('timeLoggingApiKey', '');

    this.axiosInstance = axios.create({
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'x-functions-key': this.apiKey })
      },
      timeout: 30000
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): TimeLogApi {
    if (!TimeLogApi.instance) {
      TimeLogApi.instance = new TimeLogApi();
    }
    return TimeLogApi.instance;
  }

  public static resetInstance(): void {
    TimeLogApi.instance = undefined as any;
  }

  public isEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<boolean>('useTimeLoggingExtension', false);
  }

  public hasApiKey(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const apiKey = config.get<string>('timeLoggingApiKey', '');
    return apiKey.length > 0;
  }

  /**
   * Fetch time types from the API
   */
  public async getTimeTypes(orgId: string): Promise<TimeType[]> {
    const url = `${this.baseUrl}/${orgId}/timetype/project`;

    try {
      const response = await this.axiosInstance.get(url);
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((tt: any) => ({
          id: tt.id || tt.description,
          description: tt.description || tt.id
        }));
      }
    } catch (error) {
      console.error('Failed to fetch time types from API:', error);
    }

    // Fallback to defaults if API fails
    return [
      { id: 'Development', description: 'Development' },
      { id: 'Testing', description: 'Testing' },
      { id: 'Documentation', description: 'Documentation' },
      { id: 'Meeting', description: 'Meeting' },
      { id: 'Other', description: 'Other' }
    ];
  }

  /**
   * Create a new time log entry
   */
  public async createTimeLog(orgId: string, entry: TimeLogEntry): Promise<void> {
    const url = `${this.baseUrl}/${orgId}/timelogs/`;

    try {
      await this.axiosInstance.post(url, entry, {
        headers: {
          'x-timelog-usermakingchange': encodeURIComponent(entry.userMakingChange)
        }
      });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        throw new Error(`Failed to create time log: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get time logs for a work item
   */
  public async getTimeLogs(orgId: string, projectId: string, workItemId: number): Promise<TimeLogRecord[]> {
    const url = `${this.baseUrl}/${orgId}/timelog/project/${projectId}/workitem/${workItemId}`;

    try {
      const response = await this.axiosInstance.get(url);
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch time logs:', error);
      return [];
    }
  }

  /**
   * Delete a time log entry
   */
  public async deleteTimeLog(orgId: string, timeLogId: string): Promise<void> {
    const url = `${this.baseUrl}/${orgId}/timelog/${timeLogId}`;

    try {
      await this.axiosInstance.delete(url);
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        throw new Error(`Failed to delete time log: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Update a time log entry
   */
  public async updateTimeLog(orgId: string, timeLogId: string, payload: {
    minutes: number;
    timeTypeDescription: string;
    comment: string;
    date: string;
    workItemId: number;
    projectId: string;
    userName: string;
    userId: string;
    userEmail: string;
    userMakingChange: string;
  }): Promise<void> {
    const url = `${this.baseUrl}/${orgId}/timelog/${timeLogId}`;

    try {
      await this.axiosInstance.post(url, payload);
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        throw new Error(`Failed to update time log: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  public clearCache(): void {
    // No-op for now
  }

  private handleApiError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case 400:
          vscode.window.showErrorMessage('Time Log: Invalid request. Please check your input.');
          break;
        case 401:
          vscode.window.showErrorMessage('Time Log: Access denied. Check your API Key in settings (azureDevOps.timeLoggingApiKey).');
          break;
        case 403:
          vscode.window.showErrorMessage('Time Log: Forbidden. Verify your API Key is correct.');
          break;
        case 404:
          vscode.window.showErrorMessage('Time Log: Not found. Check organization ID and extension installation.');
          break;
        case 500:
          vscode.window.showErrorMessage('Time Log: Server error. Please try again later.');
          break;
        default:
          vscode.window.showErrorMessage(`Time Log: Request failed with status ${status}`);
      }
    } else if (error.request) {
      vscode.window.showErrorMessage('Time Log: Unable to connect. Please check your network connection.');
    }
  }
}
