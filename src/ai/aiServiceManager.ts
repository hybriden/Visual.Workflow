import * as vscode from 'vscode';
import { CopilotService } from './copilotService';
import { WorkItem } from '../models/workItem';

/**
 * Manager for AI services - handles GitHub Copilot integration
 */
export class AiServiceManager {
  private static instance: AiServiceManager;
  private copilotService: CopilotService;

  private constructor() {
    this.copilotService = CopilotService.getInstance();
  }

  public static getInstance(): AiServiceManager {
    if (!AiServiceManager.instance) {
      AiServiceManager.instance = new AiServiceManager();
    }
    return AiServiceManager.instance;
  }

  /**
   * Check if AI suggestions are enabled
   */
  public isAiEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<boolean>('enableAiSuggestions', true);
  }

  /**
   * Set AI suggestions enabled/disabled
   */
  public async setAiEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    await config.update('enableAiSuggestions', enabled, vscode.ConfigurationTarget.Global);
  }

  /**
   * Check if Copilot is available
   */
  public async isCopilotAvailable(): Promise<boolean> {
    return await this.copilotService.isCopilotAvailable();
  }

  /**
   * Check if Copilot is installed
   */
  public isCopilotInstalled(): boolean {
    return this.copilotService.isCopilotInstalled();
  }

  /**
   * Generate a description for a work item using Copilot
   */
  public async generateDescription(
    workItem: WorkItem,
    existingDescription?: string
  ): Promise<string> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled. Enable them in settings.');
    }

    if (!await this.copilotService.isCopilotAvailable()) {
      throw new Error('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
    }

    return await this.copilotService.generateDescription(workItem, existingDescription);
  }

  /**
   * Generate an implementation plan for a work item using Copilot
   */
  public async generateImplementationPlan(workItem: WorkItem): Promise<string> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled. Enable them in settings.');
    }

    if (!await this.copilotService.isCopilotAvailable()) {
      throw new Error('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
    }

    return await this.copilotService.generateImplementationPlan(workItem);
  }

  /**
   * Show current AI status
   */
  public async showStatus(): Promise<void> {
    const enabled = this.isAiEnabled();
    const installed = this.copilotService.isCopilotInstalled();
    const available = await this.copilotService.isCopilotAvailable();

    let message = 'AI Service Status:\n\n';
    message += `AI Suggestions: ${enabled ? '✓ Enabled' : '✗ Disabled'}\n`;
    message += `GitHub Copilot: ${installed ? '✓ Installed' : '✗ Not installed'}`;

    if (installed) {
      message += ` ${available ? '(Available)' : '(Not available)'}`;
    }

    if (enabled && !available) {
      message += '\n\nGitHub Copilot is enabled but not available. Please ensure you have an active Copilot subscription and are signed in.';
    }

    vscode.window.showInformationMessage(message);
  }

  /**
   * Prompt to install Copilot if not available
   */
  public async promptToInstallCopilot(): Promise<boolean> {
    return await this.copilotService.promptToInstallCopilot();
  }

  /**
   * Toggle AI suggestions on/off
   */
  public async toggleAiSuggestions(): Promise<void> {
    const currentState = this.isAiEnabled();
    await this.setAiEnabled(!currentState);

    const newState = !currentState;
    vscode.window.showInformationMessage(
      `AI suggestions ${newState ? 'enabled' : 'disabled'}`
    );
  }
}
