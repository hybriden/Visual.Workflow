import * as vscode from 'vscode';
import { ProjectPicker } from '../azureDevOps/projectPicker';
import { SprintBoardProvider, MyWorkItemsProvider } from '../views/sprintPanel';

/**
 * Register project switching commands
 */
export function registerProjectSwitcher(
  context: vscode.ExtensionContext,
  sprintBoardProvider: SprintBoardProvider,
  myWorkItemsProvider: MyWorkItemsProvider
): void {

  // Switch Project Command
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.switchProject', async () => {
      const projectPicker = new ProjectPicker();

      const configured = await projectPicker.pickProject();

      if (configured) {
        vscode.window.showInformationMessage('Project switched! Reloading work items...');

        // Reload work items for new project
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Loading work items from new project...',
            cancellable: false
          },
          async () => {
            await Promise.all([
              sprintBoardProvider.loadWorkItems(),
              myWorkItemsProvider.loadWorkItems()
            ]);
          }
        );
      }
    })
  );

  // Quick Switch to Recent Projects
  context.subscriptions.push(
    vscode.commands.registerCommand('azureDevOps.quickSwitchProject', async () => {
      const config = vscode.workspace.getConfiguration('azureDevOps');
      const currentProject = config.get<string>('project', '');

      // Get recent projects from workspace state
      const recentProjects = context.workspaceState.get<string[]>('recentProjects', []);

      if (recentProjects.length === 0) {
        // No recent projects, use full picker
        await vscode.commands.executeCommand('azureDevOps.switchProject');
        return;
      }

      // Show quick pick of recent projects
      const items = recentProjects.map(project => ({
        label: project,
        description: project === currentProject ? '$(check) Current' : '',
        project: project
      }));

      // Add "Browse all projects..." option
      items.push({
        label: '$(search) Browse all projects...',
        description: '',
        project: '__browse__'
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Current: ${currentProject}. Select a project to switch to...`
      });

      if (!selected) {
        return;
      }

      if (selected.project === '__browse__') {
        // Show full project picker
        await vscode.commands.executeCommand('azureDevOps.switchProject');
        return;
      }

      if (selected.project === currentProject) {
        vscode.window.showInformationMessage('Already on this project!');
        return;
      }

      // Switch to selected project
      await config.update('project', selected.project, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(`Switched to project: ${selected.project}`);

      // Reload work items
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Loading work items...',
          cancellable: false
        },
        async () => {
          await Promise.all([
            sprintBoardProvider.loadWorkItems(),
            myWorkItemsProvider.loadWorkItems()
          ]);
        }
      );
    })
  );
}

/**
 * Track recently used projects
 */
export function trackRecentProject(context: vscode.ExtensionContext, projectName: string): void {
  const recentProjects = context.workspaceState.get<string[]>('recentProjects', []);

  // Remove if already exists
  const filtered = recentProjects.filter(p => p !== projectName);

  // Add to front
  filtered.unshift(projectName);

  // Keep only last 10
  const updated = filtered.slice(0, 10);

  context.workspaceState.update('recentProjects', updated);
}
