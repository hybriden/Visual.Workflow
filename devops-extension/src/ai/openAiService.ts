import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { WorkItem } from '../models/workItem';

/**
 * Service for generating work item descriptions using Azure OpenAI
 */
export class OpenAiService {
  private static instance: OpenAiService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  public static getInstance(): OpenAiService {
    if (!OpenAiService.instance) {
      OpenAiService.instance = new OpenAiService();
    }
    return OpenAiService.instance;
  }

  /**
   * Check if Azure OpenAI is configured
   */
  public isConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const endpoint = config.get<string>('azureOpenAiEndpoint', '');
    const apiKey = config.get<string>('azureOpenAiKey', '');
    const deployment = config.get<string>('azureOpenAiDeployment', '');

    return endpoint.trim() !== '' && apiKey.trim() !== '' && deployment.trim() !== '';
  }

  /**
   * Get the configured endpoint
   */
  private getEndpoint(): string {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    let endpoint = config.get<string>('azureOpenAiEndpoint', '');
    // Remove trailing slash if present
    endpoint = endpoint.trim().replace(/\/$/, '');
    return endpoint;
  }

  /**
   * Get the configured API key
   */
  private getApiKey(): string {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<string>('azureOpenAiKey', '');
  }

  /**
   * Get the configured deployment name
   */
  private getDeployment(): string {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<string>('azureOpenAiDeployment', 'gpt-4o-mini');
  }

  /**
   * Generate a description for a work item
   */
  public async generateDescription(workItem: WorkItem): Promise<string> {
    const endpoint = this.getEndpoint();
    const apiKey = this.getApiKey();
    const deployment = this.getDeployment();

    if (!endpoint || !apiKey || !deployment) {
      throw new Error('Azure OpenAI not configured');
    }

    const fields = workItem.fields;
    const title = fields['System.Title'];
    const workItemType = fields['System.WorkItemType'];
    const areaPath = fields['System.AreaPath'] || 'Unknown';
    const iterationPath = fields['System.IterationPath'] || 'Unknown';
    const tags = fields['System.Tags'] || 'None';

    // Build context-rich prompt
    const prompt = this.buildPrompt(title, workItemType, areaPath, iterationPath, tags);

    // Build Azure OpenAI API URL
    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

    try {
      const response = await this.axiosInstance.post(
        url,
        {
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that writes clear, concise descriptions for Azure DevOps work items. Write 2-3 sentences describing what needs to be done and why. Be specific and actionable.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        },
        {
          headers: {
            'api-key': apiKey
          }
        }
      );

      const description = response.data.choices[0]?.message?.content?.trim();

      if (!description) {
        throw new Error('No description generated');
      }

      return description;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Azure OpenAI API key. Please check your configuration.');
      } else if (error.response?.status === 404) {
        throw new Error('Azure OpenAI deployment not found. Please check your endpoint and deployment name.');
      } else if (error.response?.status === 429) {
        throw new Error('Azure OpenAI rate limit exceeded. Please try again later.');
      } else if (error.response?.data?.error?.message) {
        throw new Error(`Azure OpenAI API error: ${error.response.data.error.message}`);
      } else {
        throw new Error(`Failed to generate description: ${error.message}`);
      }
    }
  }

  /**
   * Build the prompt for Azure OpenAI
   */
  private buildPrompt(
    title: string,
    workItemType: string,
    areaPath: string,
    iterationPath: string,
    tags: string
  ): string {
    return `Generate a concise 2-3 sentence description for this Azure DevOps work item:

Type: ${workItemType}
Title: ${title}
Area: ${areaPath}
Iteration: ${iterationPath}
Tags: ${tags}

Write a clear description of what needs to be done and why. Be specific and actionable.`;
  }

  /**
   * Prompt user to configure Azure OpenAI
   */
  public async promptForApiKey(): Promise<boolean> {
    const action = await vscode.window.showInformationMessage(
      'Azure OpenAI not configured. Would you like to configure it now?',
      'Configure',
      'Cancel'
    );

    if (action !== 'Configure') {
      return false;
    }

    // Prompt for endpoint
    const endpoint = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI endpoint URL',
      placeHolder: 'https://your-resource.openai.azure.com',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Endpoint cannot be empty';
        }
        if (!value.startsWith('https://')) {
          return 'Endpoint must start with https://';
        }
        return null;
      }
    });

    if (!endpoint) {
      return false;
    }

    // Prompt for API key
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI API key',
      placeHolder: 'Your API key...',
      password: true,
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'API key cannot be empty';
        }
        return null;
      }
    });

    if (!apiKey) {
      return false;
    }

    // Prompt for deployment name
    const deployment = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI deployment name',
      placeHolder: 'gpt-4o-mini',
      value: 'gpt-4o-mini',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Deployment name cannot be empty';
        }
        return null;
      }
    });

    if (!deployment) {
      return false;
    }

    // Save configuration
    const config = vscode.workspace.getConfiguration('azureDevOps');
    await config.update('azureOpenAiEndpoint', endpoint, vscode.ConfigurationTarget.Global);
    await config.update('azureOpenAiKey', apiKey, vscode.ConfigurationTarget.Global);
    await config.update('azureOpenAiDeployment', deployment, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage('Azure OpenAI configured successfully!');
    return true;
  }
}
