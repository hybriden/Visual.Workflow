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
   * Check if Copilot is available
   */
  public async isCopilotAvailable(): Promise<boolean> {
    return await this.copilotService.isCopilotAvailable();
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
   * Show Copilot status information
   */
  public async showCopilotStatus(): Promise<void> {
    const enabled = this.isAiEnabled();
    const available = await this.copilotService.isCopilotAvailable();
    const installed = this.copilotService.isCopilotInstalled();

    let message = 'GitHub Copilot Status:\n\n';
    message += `AI Enabled: ${enabled ? '✓' : '✗'}\n`;
    message += `Copilot Installed: ${installed ? '✓' : '✗'}\n`;
    message += `Copilot Available: ${available ? '✓' : '✗'}\n\n`;

    if (!installed) {
      message += 'GitHub Copilot is not installed. Would you like to install it?';
    } else if (!available) {
      message += 'GitHub Copilot is installed but not available. Please ensure you have an active subscription and are signed in.';
    } else if (!enabled) {
      message += 'AI suggestions are disabled. Enable them in settings to use Copilot features.';
    } else {
      message += 'GitHub Copilot is ready to use!';
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
   * Generate field suggestions using Copilot
   */
  public async generateFieldSuggestions(
    workItemType: string,
    title: string,
    context?: string
  ): Promise<{ description?: string; acceptanceCriteria?: string; tasks?: string[] }> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled.');
    }

    if (!await this.copilotService.isCopilotAvailable()) {
      throw new Error('GitHub Copilot is not available.');
    }

    return await this.copilotService.generateFieldSuggestions(workItemType, title, context);
  }
}
