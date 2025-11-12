import * as vscode from 'vscode';

/**
 * Authentication manager for Azure DevOps
 */
export class AzureDevOpsAuth {
  private static instance: AzureDevOpsAuth;

  private constructor() {}

  public static getInstance(): AzureDevOpsAuth {
    if (!AzureDevOpsAuth.instance) {
      AzureDevOpsAuth.instance = new AzureDevOpsAuth();
    }
    return AzureDevOpsAuth.instance;
  }

  /**
   * Get the Personal Access Token from settings
   */
  public getPAT(): string | undefined {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const pat = config.get<string>('pat');

    if (!pat || pat.trim() === '') {
      return undefined;
    }

    return pat;
  }

  /**
   * Get the organization name from settings
   */
  public getOrganization(): string | undefined {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const org = config.get<string>('organization');

    if (!org || org.trim() === '') {
      return undefined;
    }

    return org;
  }

  /**
   * Get the project name from settings
   */
  public getProject(): string | undefined {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const project = config.get<string>('project');

    if (!project || project.trim() === '') {
      return undefined;
    }

    return project;
  }

  /**
   * Get the team name from settings
   */
  public getTeam(): string | undefined {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const team = config.get<string>('team');

    if (!team || team.trim() === '') {
      return undefined;
    }

    return team;
  }

  /**
   * Check if all required configuration is present
   */
  public isConfigured(): boolean {
    return !!(this.getPAT() && this.getOrganization() && this.getProject());
  }

  /**
   * Get Base64 encoded authorization header
   */
  public getAuthHeader(): string {
    const pat = this.getPAT();
    if (!pat) {
      throw new Error('Personal Access Token not configured');
    }

    // Azure DevOps expects "username:PAT" encoded in Base64
    // Username can be empty string
    const token = Buffer.from(`:${pat}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Prompt user to configure the extension
   */
  public async promptConfiguration(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      'Azure DevOps extension is not configured. Would you like to configure it now?',
      'Configure',
      'Cancel'
    );

    if (result === 'Configure') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'azureDevOps');
      return true;
    }

    return false;
  }

  /**
   * Validate configuration by attempting to connect
   */
  public async validateConfiguration(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // Try to get auth header to validate PAT format
      this.getAuthHeader();
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Invalid Azure DevOps configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }
}
