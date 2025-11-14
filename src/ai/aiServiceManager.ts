import * as vscode from 'vscode';
import { CopilotService } from './copilotService';
import { ClaudeService } from './claudeService';
import { WorkItem } from '../models/workItem';

export type AiProvider = 'copilot' | 'claude' | 'none';

/**
 * Manager for AI services - handles GitHub Copilot and Claude Code integration
 */
export class AiServiceManager {
  private static instance: AiServiceManager;
  private copilotService: CopilotService;
  private claudeService: ClaudeService;

  private constructor() {
    this.copilotService = CopilotService.getInstance();
    this.claudeService = ClaudeService.getInstance();
  }

  public static getInstance(): AiServiceManager {
    if (!AiServiceManager.instance) {
      AiServiceManager.instance = new AiServiceManager();
    }
    return AiServiceManager.instance;
  }

  /**
   * Get the configured AI provider
   */
  public getConfiguredProvider(): AiProvider {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<AiProvider>('aiProvider', 'copilot');
  }

  /**
   * Set the AI provider
   */
  public async setAiProvider(provider: AiProvider): Promise<void> {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    await config.update('aiProvider', provider, vscode.ConfigurationTarget.Global);
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
   * Check if Claude is available
   */
  public async isClaudeAvailable(): Promise<boolean> {
    return await this.claudeService.isClaudeAvailable();
  }

  /**
   * Check if the current provider is available
   */
  public async isCurrentProviderAvailable(): Promise<boolean> {
    const provider = this.getConfiguredProvider();

    switch (provider) {
      case 'copilot':
        return await this.copilotService.isCopilotAvailable();
      case 'claude':
        return await this.claudeService.isClaudeAvailable();
      case 'none':
        return false;
      default:
        return false;
    }
  }

  /**
   * Generate a description for a work item using the configured provider
   */
  public async generateDescription(
    workItem: WorkItem,
    existingDescription?: string
  ): Promise<string> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled. Enable them in settings.');
    }

    const provider = this.getConfiguredProvider();

    if (provider === 'none') {
      throw new Error('No AI provider configured. Please select a provider in settings.');
    }

    switch (provider) {
      case 'copilot':
        if (!await this.copilotService.isCopilotAvailable()) {
          throw new Error('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
        }
        return await this.copilotService.generateDescription(workItem, existingDescription);

      case 'claude':
        if (!await this.claudeService.isClaudeAvailable()) {
          throw new Error('Claude Code is not available. Please install and authenticate the Claude extension.');
        }
        return await this.claudeService.generateDescription(workItem, existingDescription);

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  /**
   * Generate an implementation plan for a work item using the configured provider
   */
  public async generateImplementationPlan(workItem: WorkItem): Promise<string> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled. Enable them in settings.');
    }

    const provider = this.getConfiguredProvider();

    if (provider === 'none') {
      throw new Error('No AI provider configured. Please select a provider in settings.');
    }

    switch (provider) {
      case 'copilot':
        if (!await this.copilotService.isCopilotAvailable()) {
          throw new Error('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
        }
        return await this.copilotService.generateImplementationPlan(workItem);

      case 'claude':
        if (!await this.claudeService.isClaudeAvailable()) {
          throw new Error('Claude Code is not available. Please install and authenticate the Claude extension.');
        }
        return await this.claudeService.generateImplementationPlan(workItem);

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  /**
   * Get display name for provider
   */
  private getProviderDisplayName(provider: AiProvider): string {
    switch (provider) {
      case 'copilot':
        return 'GitHub Copilot';
      case 'claude':
        return 'Claude Code';
      case 'none':
        return 'None';
      default:
        return provider;
    }
  }

  /**
   * Show AI provider selection dialog
   */
  public async selectAiProvider(): Promise<void> {
    interface ProviderOption extends vscode.QuickPickItem {
      provider: AiProvider;
    }

    const copilotAvailable = await this.copilotService.isCopilotAvailable();
    const claudeAvailable = await this.claudeService.isClaudeAvailable();
    const currentProvider = this.getConfiguredProvider();

    const options: ProviderOption[] = [
      {
        label: '$(github) GitHub Copilot',
        description: copilotAvailable ? 'Available' + (currentProvider === 'copilot' ? ' (Current)' : '') : 'Not available',
        detail: 'Use GitHub Copilot for AI-powered suggestions',
        provider: 'copilot'
      },
      {
        label: '$(robot) Claude Code',
        description: claudeAvailable ? 'Available' + (currentProvider === 'claude' ? ' (Current)' : '') : 'Not available',
        detail: 'Use Claude Code for AI-powered suggestions',
        provider: 'claude'
      },
      {
        label: '$(circle-slash) None',
        description: currentProvider === 'none' ? '(Current)' : 'Disable AI suggestions',
        detail: 'Turn off AI-powered features',
        provider: 'none'
      }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select AI provider for work item descriptions',
      title: 'AI Provider Selection'
    });

    if (!selected) {
      return;
    }

    // Check if provider is available and prompt for setup if needed
    if (selected.provider === 'copilot' && !copilotAvailable) {
      const install = await vscode.window.showInformationMessage(
        'GitHub Copilot is not available. Would you like to install it?',
        'Install',
        'Cancel'
      );

      if (install === 'Install') {
        await this.copilotService.promptToInstallCopilot();
      }
      return;
    }

    if (selected.provider === 'claude' && !claudeAvailable) {
      const install = await vscode.window.showInformationMessage(
        'Claude Code is not available. Would you like to install it?',
        'Install',
        'Cancel'
      );

      if (install === 'Install') {
        await this.claudeService.promptToInstallClaude();
      }
      return;
    }

    // Set the selected provider
    await this.setAiProvider(selected.provider);

    vscode.window.showInformationMessage(
      `AI provider set to: ${this.getProviderDisplayName(selected.provider)}`
    );
  }

  /**
   * Show current AI provider status
   */
  public async showProviderStatus(): Promise<void> {
    const provider = this.getConfiguredProvider();
    const enabled = this.isAiEnabled();
    const available = await this.isCurrentProviderAvailable();

    const copilotInstalled = this.copilotService.isCopilotInstalled();
    const copilotAvailable = await this.copilotService.isCopilotAvailable();
    const claudeInstalled = this.claudeService.isClaudeInstalled();
    const claudeAvailable = await this.claudeService.isClaudeAvailable();

    let message = 'AI Service Status:\n\n';
    message += `Enabled: ${enabled ? '✓' : '✗'}\n`;
    message += `Current Provider: ${this.getProviderDisplayName(provider)}\n`;
    message += `Provider Available: ${available ? '✓' : '✗'}\n\n`;

    message += '--- Available Providers ---\n';
    message += `GitHub Copilot: ${copilotInstalled ? '✓ Installed' : '✗ Not installed'} ${copilotAvailable ? '(Available)' : ''}\n`;
    message += `Claude Code: ${claudeInstalled ? '✓ Installed' : '✗ Not installed'} ${claudeAvailable ? '(Available)' : ''}\n`;

    if (provider !== 'none' && !available) {
      message += `\n${this.getProviderDisplayName(provider)} is selected but not available. Please check your installation and authentication.`;
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
   * Prompt to install Claude if not available
   */
  public async promptToInstallClaude(): Promise<boolean> {
    return await this.claudeService.promptToInstallClaude();
  }
}
