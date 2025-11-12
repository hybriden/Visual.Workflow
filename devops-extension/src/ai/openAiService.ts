import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { WorkItem } from '../models/workItem';

/**
 * Service for generating work item descriptions using OpenAI
 */
export class OpenAiService {
  private static instance: OpenAiService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.openai.com/v1',
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
   * Check if OpenAI is configured
   */
  public isConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    const apiKey = config.get<string>('openAiApiKey', '');
    return apiKey.trim() !== '';
  }

  /**
   * Get the configured API key
   */
  private getApiKey(): string {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<string>('openAiApiKey', '');
  }

  /**
   * Get the configured model
   */
  private getModel(): string {
    const config = vscode.workspace.getConfiguration('azureDevOps');
    return config.get<string>('openAiModel', 'gpt-4o-mini');
  }

  /**
   * Generate a description for a work item
   */
  public async generateDescription(workItem: WorkItem): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const fields = workItem.fields;
    const title = fields['System.Title'];
    const workItemType = fields['System.WorkItemType'];
    const areaPath = fields['System.AreaPath'] || 'Unknown';
    const iterationPath = fields['System.IterationPath'] || 'Unknown';
    const tags = fields['System.Tags'] || 'None';

    // Build context-rich prompt
    const prompt = this.buildPrompt(title, workItemType, areaPath, iterationPath, tags);

    try {
      const response = await this.axiosInstance.post(
        '/chat/completions',
        {
          model: this.getModel(),
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
            'Authorization': `Bearer ${apiKey}`
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
        throw new Error('Invalid OpenAI API key. Please check your configuration.');
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else if (error.response?.data?.error?.message) {
        throw new Error(`OpenAI API error: ${error.response.data.error.message}`);
      } else {
        throw new Error(`Failed to generate description: ${error.message}`);
      }
    }
  }

  /**
   * Build the prompt for OpenAI
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
   * Prompt user to configure OpenAI API key
   */
  public async promptForApiKey(): Promise<boolean> {
    const action = await vscode.window.showInformationMessage(
      'OpenAI API key not configured. Would you like to add one now?',
      'Add API Key',
      'Cancel'
    );

    if (action !== 'Add API Key') {
      return false;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI API key',
      placeHolder: 'sk-...',
      password: true,
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'API key cannot be empty';
        }
        if (!value.startsWith('sk-')) {
          return 'Invalid API key format (should start with sk-)';
        }
        return null;
      }
    });

    if (!apiKey) {
      return false;
    }

    // Save API key
    await vscode.workspace.getConfiguration('azureDevOps').update(
      'openAiApiKey',
      apiKey,
      vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage('OpenAI API key configured successfully!');
    return true;
  }
}
