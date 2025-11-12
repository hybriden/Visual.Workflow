import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { AzureDevOpsAuth } from './auth';

/**
 * Project and Team selection helper
 */
export class ProjectPicker {
  private axiosInstance: AxiosInstance;
  private auth: AzureDevOpsAuth;

  constructor() {
    this.auth = AzureDevOpsAuth.getInstance();
    this.axiosInstance = axios.create({
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });
  }

  /**
   * Get list of projects from Azure DevOps
   */
  private async getProjects(): Promise<Array<{ id: string; name: string; description: string }>> {
    const org = this.auth.getOrganization();
    const pat = this.auth.getPAT();

    if (!org || !pat) {
      throw new Error('Organization and PAT are required');
    }

    const authHeader = Buffer.from(`:${pat}`).toString('base64');
    const url = `https://dev.azure.com/${org}/_apis/projects?api-version=7.0`;

    try {
      const response = await this.axiosInstance.get(url, {
        headers: {
          Authorization: `Basic ${authHeader}`
        }
      });

      return response.data.value.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description || ''
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw new Error('Failed to fetch projects. Please check your organization name and PAT.');
    }
  }

  /**
   * Get list of teams for a project
   */
  private async getTeams(projectId: string): Promise<Array<{ id: string; name: string }>> {
    const org = this.auth.getOrganization();
    const pat = this.auth.getPAT();

    if (!org || !pat) {
      throw new Error('Organization and PAT are required');
    }

    const authHeader = Buffer.from(`:${pat}`).toString('base64');
    const url = `https://dev.azure.com/${org}/_apis/projects/${projectId}/teams?api-version=7.0`;

    try {
      const response = await this.axiosInstance.get(url, {
        headers: {
          Authorization: `Basic ${authHeader}`
        }
      });

      return response.data.value.map((team: any) => ({
        id: team.id,
        name: team.name
      }));
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Don't throw - teams are optional
      return [];
    }
  }

  /**
   * Show project picker and update configuration
   */
  public async pickProject(): Promise<boolean> {
    const org = this.auth.getOrganization();
    const pat = this.auth.getPAT();

    // Validate prerequisites
    if (!org) {
      const orgInput = await vscode.window.showInputBox({
        prompt: 'Enter your Azure DevOps organization name',
        placeHolder: 'e.g., "mycompany" from dev.azure.com/mycompany',
        validateInput: (value) => {
          return value.trim() === '' ? 'Organization name cannot be empty' : null;
        }
      });

      if (!orgInput) {
        return false;
      }

      await vscode.workspace.getConfiguration('azureDevOps').update('organization', orgInput, vscode.ConfigurationTarget.Global);
    }

    if (!pat) {
      const patInput = await vscode.window.showInputBox({
        prompt: 'Enter your Personal Access Token (PAT)',
        placeHolder: 'Paste your PAT here...',
        password: true,
        validateInput: (value) => {
          return value.trim() === '' ? 'PAT cannot be empty' : null;
        }
      });

      if (!patInput) {
        return false;
      }

      await vscode.workspace.getConfiguration('azureDevOps').update('pat', patInput, vscode.ConfigurationTarget.Global);
    }

    // Fetch projects
    let projects: Array<{ id: string; name: string; description: string }>;

    try {
      projects = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Fetching Azure DevOps projects...',
          cancellable: false
        },
        async () => {
          return await this.getProjects();
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }

    if (projects.length === 0) {
      vscode.window.showWarningMessage('No projects found. Please check your PAT permissions.');
      return false;
    }

    // Show project picker
    const projectItems = projects.map(p => ({
      label: p.name,
      description: p.description,
      detail: `Project ID: ${p.id}`,
      project: p
    }));

    const selectedProject = await vscode.window.showQuickPick(projectItems, {
      placeHolder: 'Select an Azure DevOps project',
      matchOnDescription: true,
      matchOnDetail: false
    });

    if (!selectedProject) {
      return false;
    }

    // Save project
    await vscode.workspace.getConfiguration('azureDevOps').update(
      'project',
      selectedProject.project.name,
      vscode.ConfigurationTarget.Global
    );

    // Ask about team
    const selectTeam = await vscode.window.showQuickPick(
      ['Yes', 'No, use default team'],
      {
        placeHolder: 'Do you want to select a specific team?'
      }
    );

    if (selectTeam === 'Yes') {
      // Fetch teams
      let teams: Array<{ id: string; name: string }>;

      try {
        teams = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching teams...',
            cancellable: false
          },
          async () => {
            return await this.getTeams(selectedProject.project.id);
          }
        );
      } catch (error) {
        console.error('Error fetching teams:', error);
        teams = [];
      }

      if (teams.length > 0) {
        const teamItems = teams.map(t => ({
          label: t.name,
          detail: `Team ID: ${t.id}`,
          team: t
        }));

        const selectedTeam = await vscode.window.showQuickPick(teamItems, {
          placeHolder: 'Select a team (or press Escape to skip)'
        });

        if (selectedTeam) {
          await vscode.workspace.getConfiguration('azureDevOps').update(
            'team',
            selectedTeam.team.name,
            vscode.ConfigurationTarget.Global
          );
        }
      } else {
        vscode.window.showInformationMessage('No teams found for this project.');
      }
    }

    vscode.window.showInformationMessage(
      `Configuration updated! Project: ${selectedProject.project.name}`
    );

    return true;
  }

  /**
   * Setup wizard for first-time configuration
   */
  public async runSetupWizard(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      'Welcome to Azure DevOps Workflow! Let\'s configure your connection.',
      'Start Setup',
      'Cancel'
    );

    if (result !== 'Start Setup') {
      return false;
    }

    return await this.pickProject();
  }
}
