import * as vscode from 'vscode';
import { AiServiceManager } from '../ai/aiServiceManager';
import { SprintBoardProvider, MyWorkItemsProvider } from '../views/sprintPanel';

/**
 * Register AI-related commands
 */
export function registerAiCommands(
  context: vscode.ExtensionContext,
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): void {
  const aiManager = AiServiceManager.getInstance();

  // Select AI Provider
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.selectAiProvider', async () => {
      await aiManager.selectAiProvider();
    })
  );

  // Show AI Provider Status
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.showAiStatus', async () => {
      await aiManager.showProviderStatus();
    })
  );

  // Toggle AI Suggestions
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.toggleAiSuggestions', async () => {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const currentValue = config.get<boolean>('enableAiSuggestions', true);

      await config.update('enableAiSuggestions', !currentValue, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `AI suggestions ${!currentValue ? 'enabled' : 'disabled'}`
      );
    })
  );

  // Generate Work Item Description (can be called from context menu or command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.generateDescription', async (workItem?: any) => {
      if (!workItem) {
        vscode.window.showWarningMessage('Please select a work item first.');
        return;
      }

      if (!aiManager.isAiEnabled()) {
        const enable = await vscode.window.showInformationMessage(
          'AI suggestions are disabled. Would you like to enable them?',
          'Enable',
          'Cancel'
        );

        if (enable !== 'Enable') {
          return;
        }

        const config = vscode.workspace.getConfiguration('azureDevOps');
        await config.update('enableAiSuggestions', true, vscode.ConfigurationTarget.Global);
      }

      // Check if provider is available
      const provider = aiManager.getConfiguredProvider();
      if (!await aiManager.isProviderAvailable(provider)) {
        await aiManager.selectAiProvider();
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating description with AI...',
            cancellable: false
          },
          async () => {
            const existingDescription = workItem.fields['System.Description'];
            const description = await aiManager.generateDescription(workItem, existingDescription);

            // Show the generated description and allow user to accept or reject
            const action = await vscode.window.showInformationMessage(
              `Generated Description:\n\n${description}\n\nWould you like to use this description?`,
              { modal: true },
              'Accept',
              'Edit',
              'Cancel'
            );

            if (action === 'Accept') {
              // Update the work item (this would be handled by the WorkItemViewPanel)
              vscode.window.showInformationMessage('Description generated successfully!');
              // Emit an event or callback to update the work item
              vscode.commands.executeCommand('azureDevOps.updateWorkItemDescription', workItem.id, description);
            } else if (action === 'Edit') {
              // Open an input box to edit the description
              const editedDescription = await vscode.window.showInputBox({
                prompt: 'Edit the generated description',
                value: description,
                placeHolder: 'Enter description...'
              });

              if (editedDescription) {
                vscode.commands.executeCommand('azureDevOps.updateWorkItemDescription', workItem.id, editedDescription);
              }
            }
          }
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Failed to generate description: ${error.message || 'Unknown error'}`
        );
      }
    })
  );
}
