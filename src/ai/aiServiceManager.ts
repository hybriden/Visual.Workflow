import * as vscode from 'vscode';
import { OpenAiService } from './openAiService';
import { CopilotService } from './copilotService';
import { WorkItem } from '../models/workItem';

export type AiProvider = 'copilot' | 'azureOpenAI' | 'none';

/**
 * Manager for AI services - handles selection between Copilot and Azure OpenAI
 */
export class AiServiceManager {
  private static instance: AiServiceManager;
  private openAiService: OpenAiService;
  private copilotService: CopilotService;

  private constructor() {
    this.openAiService = OpenAiService.getInstance();
    this.copilotService = CopilotService.getInstance();
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
   * Check if AI suggestions are enabled
   */
  public isAiEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<boolean>('enableAiSuggestions', true);
  }

  /**
   * Set the AI provider
   */
  public async setAiProvider(provider: AiProvider): Promise<void> {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    await config.update('aiProvider', provider, vscode.ConfigurationTarget.Global);
  }

  /**
   * Check if the current provider is available
   */
  public async isProviderAvailable(provider?: AiProvider): Promise<boolean> {
    const selectedProvider = provider || this.getConfiguredProvider();

    switch (selectedProvider) {
      case 'copilot':
        return await this.copilotService.isCopilotAvailable();
      case 'azureOpenAI':
        return this.openAiService.isConfigured();
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

    // Try the configured provider first
    try {
      return await this.generateWithProvider(provider, workItem, existingDescription);
    } catch (error: any) {
      console.error(`Failed to generate with ${provider}:`, error);

      // Try fallback to the other provider if available
      const fallbackProvider = provider === 'copilot' ? 'azureOpenAI' : 'copilot';

      if (await this.isProviderAvailable(fallbackProvider)) {
        const useFallback = await vscode.window.showWarningMessage(
          `${this.getProviderDisplayName(provider)} failed: ${error.message}\n\nWould you like to try ${this.getProviderDisplayName(fallbackProvider)} instead?`,
          'Yes',
          'No'
        );

        if (useFallback === 'Yes') {
          return await this.generateWithProvider(fallbackProvider, workItem, existingDescription);
        }
      }

      throw error;
    }
  }

  /**
   * Generate description with a specific provider
   */
  private async generateWithProvider(
    provider: AiProvider,
    workItem: WorkItem,
    existingDescription?: string
  ): Promise<string> {
    switch (provider) {
      case 'copilot':
        if (!await this.copilotService.isCopilotAvailable()) {
          throw new Error('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
        }
        return await this.copilotService.generateDescription(workItem, existingDescription);

      case 'azureOpenAI':
        if (!this.openAiService.isConfigured()) {
          throw new Error('Azure OpenAI is not configured. Please configure it in settings.');
        }
        return await this.openAiService.generateDescription(workItem, existingDescription);

      case 'none':
        throw new Error('No AI provider configured.');

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
      case 'azureOpenAI':
        return 'Azure OpenAI';
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
    const openAiConfigured = this.openAiService.isConfigured();

    const options: ProviderOption[] = [
      {
        label: '$(github) GitHub Copilot',
        description: copilotAvailable ? 'Available' : 'Not available',
        detail: 'Use GitHub Copilot for AI-powered suggestions',
        provider: 'copilot'
      },
      {
        label: '$(azure) Azure OpenAI',
        description: openAiConfigured ? 'Configured' : 'Not configured',
        detail: 'Use Azure OpenAI for AI-powered suggestions',
        provider: 'azureOpenAI'
      },
      {
        label: '$(circle-slash) None',
        description: 'Disable AI suggestions',
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

    if (selected.provider === 'azureOpenAI' && !openAiConfigured) {
      const configure = await vscode.window.showInformationMessage(
        'Azure OpenAI is not configured. Would you like to configure it?',
        'Configure',
        'Cancel'
      );

      if (configure === 'Configure') {
        await this.openAiService.promptForApiKey();
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
    const available = await this.isProviderAvailable();

    let message = 'AI Service Status:\n\n';
    message += `Enabled: ${enabled ? '✓' : '✗'}\n`;
    message += `Provider: ${this.getProviderDisplayName(provider)}\n`;
    message += `Available: ${available ? '✓' : '✗'}\n\n`;

    if (provider === 'copilot') {
      const copilotInstalled = this.copilotService.isCopilotInstalled();
      message += `Copilot Installed: ${copilotInstalled ? '✓' : '✗'}\n`;

      if (!available) {
        message += '\nGitHub Copilot is not available. Please ensure you have an active subscription and are signed in.';
      }
    } else if (provider === 'azureOpenAI') {
      const configured = this.openAiService.isConfigured();
      message += `Azure OpenAI Configured: ${configured ? '✓' : '✗'}\n`;

      if (!configured) {
        message += '\nAzure OpenAI is not configured. Please add your credentials in settings.';
      }
    }

    vscode.window.showInformationMessage(message);
  }

  /**
   * Generate an implementation plan for a work item (Copilot only feature)
   */
  public async generateImplementationPlan(workItem: WorkItem): Promise<string> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled. Enable them in settings.');
    }

    const provider = this.getConfiguredProvider();

    // This feature is only available with Copilot
    if (provider !== 'copilot') {
      throw new Error('Implementation plan generation is only available with GitHub Copilot. Please select Copilot as your AI provider.');
    }

    if (!await this.copilotService.isCopilotAvailable()) {
      throw new Error('GitHub Copilot is not available. Please install and authenticate the GitHub Copilot extension.');
    }

    return await this.copilotService.generateImplementationPlan(workItem);
  }

  /**
   * Generate field suggestions (Copilot only feature)
   */
  public async generateFieldSuggestions(
    workItemType: string,
    title: string,
    context?: string
  ): Promise<{ description?: string; acceptanceCriteria?: string; tasks?: string[] }> {
    if (!this.isAiEnabled()) {
      throw new Error('AI suggestions are disabled.');
    }

    // This feature is only available with Copilot
    const provider = this.getConfiguredProvider();

    if (provider === 'copilot') {
      if (!await this.copilotService.isCopilotAvailable()) {
        throw new Error('GitHub Copilot is not available.');
      }
      return await this.copilotService.generateFieldSuggestions(workItemType, title, context);
    } else {
      // For Azure OpenAI, we'll just generate a description
      const suggestions: { description?: string; acceptanceCriteria?: string; tasks?: string[] } = {};

      if (this.openAiService.isConfigured()) {
        // Create a temporary work item object for description generation
        const tempWorkItem: WorkItem = {
          id: 0,
          rev: 1,
          url: '',
          fields: {
            'System.Id': 0,
            'System.Title': title,
            'System.WorkItemType': workItemType,
            'System.State': 'New',
            'System.CreatedDate': new Date().toISOString(),
            'System.ChangedDate': new Date().toISOString(),
            'System.AreaPath': '',
            'System.IterationPath': '',
            'System.Tags': context || ''
          }
        };

        suggestions.description = await this.openAiService.generateDescription(tempWorkItem);
      }

      return suggestions;
    }
  }
}
