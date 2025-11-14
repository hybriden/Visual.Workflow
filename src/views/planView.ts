import * as vscode from 'vscode';
import { WorkItem } from '../models/workItem';

/**
 * Webview panel for displaying implementation plans
 */
export class PlanViewPanel {
  public static currentPanel: PlanViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private workItem: WorkItem;
  private plan: string;

  private constructor(panel: vscode.WebviewPanel, workItem: WorkItem, plan: string) {
    this._panel = panel;
    this.workItem = workItem;
    this.plan = plan;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'copyPlan':
            await vscode.env.clipboard.writeText(this.plan);
            vscode.window.showInformationMessage('Plan copied to clipboard!');
            break;
          case 'openWorkItem':
            vscode.commands.executeCommand('azureDevOps.viewWorkItemDetails', this.workItem);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(workItem: WorkItem, plan: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, update it
    if (PlanViewPanel.currentPanel) {
      PlanViewPanel.currentPanel.workItem = workItem;
      PlanViewPanel.currentPanel.plan = plan;
      PlanViewPanel.currentPanel._update();
      PlanViewPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'planView',
      `Plan: ${workItem.fields['System.Title']}`,
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    PlanViewPanel.currentPanel = new PlanViewPanel(panel, workItem, plan);
  }

  public dispose() {
    PlanViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = `Plan: #${this.workItem.id} - ${this.workItem.fields['System.Title']}`;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const fields = this.workItem.fields;
    const workItemType = fields['System.WorkItemType'];
    const title = fields['System.Title'];
    const id = fields['System.Id'];

    // Convert markdown to HTML (basic conversion)
    const planHtml = this.convertMarkdownToHtml(this.plan);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Implementation Plan</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          line-height: 1.6;
        }
        .header {
          border-bottom: 2px solid var(--vscode-panel-border);
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .work-item-info {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-textLink-activeForeground);
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .work-item-id {
          color: var(--vscode-descriptionForeground);
          font-size: 13px;
          font-weight: 500;
        }
        .work-item-title {
          font-size: 18px;
          font-weight: 600;
          margin: 8px 0;
          color: var(--vscode-foreground);
        }
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .plan-container {
          background-color: var(--vscode-editor-background);
          padding: 20px;
          border-radius: 6px;
          border: 1px solid var(--vscode-panel-border);
        }
        .plan-content {
          color: var(--vscode-foreground);
        }
        .plan-content h1 {
          font-size: 22px;
          font-weight: 600;
          margin-top: 25px;
          margin-bottom: 15px;
          color: var(--vscode-textLink-activeForeground);
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 8px;
        }
        .plan-content h2 {
          font-size: 18px;
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 12px;
          color: var(--vscode-textLink-foreground);
        }
        .plan-content h3 {
          font-size: 15px;
          font-weight: 600;
          margin-top: 15px;
          margin-bottom: 10px;
        }
        .plan-content ul, .plan-content ol {
          margin: 10px 0;
          padding-left: 25px;
        }
        .plan-content li {
          margin: 6px 0;
        }
        .plan-content p {
          margin: 10px 0;
        }
        .plan-content code {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: var(--vscode-editor-font-family);
          font-size: 12px;
        }
        .plan-content pre {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 12px;
          border-radius: 4px;
          overflow-x: auto;
          border: 1px solid var(--vscode-panel-border);
        }
        .plan-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .plan-content strong {
          font-weight: 600;
          color: var(--vscode-textLink-foreground);
        }
        .plan-content blockquote {
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          background-color: var(--vscode-textBlockQuote-background);
          padding: 10px 15px;
          margin: 15px 0;
          font-style: italic;
        }
        .actions {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid var(--vscode-panel-border);
          display: flex;
          gap: 10px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 10px 20px;
          cursor: pointer;
          border-radius: 3px;
          font-size: 13px;
          font-weight: 500;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="ai-badge">
          ✨ Generated by GitHub Copilot
        </div>
        <h1 style="margin: 10px 0 20px 0; font-size: 26px;">Implementation Plan</h1>

        <div class="work-item-info">
          <div class="work-item-id">Work Item #${id}</div>
          <div class="work-item-title">${this.escapeHtml(title)}</div>
          <span class="badge">${workItemType}</span>
        </div>
      </div>

      <div class="plan-container">
        <div class="plan-content">
          ${planHtml}
        </div>
      </div>

      <div class="actions">
        <button onclick="copyPlan()">📋 Copy Plan</button>
        <button class="secondary" onclick="openWorkItem()">🔗 Open Work Item</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function copyPlan() {
          vscode.postMessage({ command: 'copyPlan' });
        }

        function openWorkItem() {
          vscode.postMessage({ command: 'openWorkItem' });
        }
      </script>
    </body>
    </html>`;
  }

  private convertMarkdownToHtml(markdown: string): string {
    // Basic markdown to HTML conversion
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```(\w*)\n?/g, '').replace(/```$/g, '');
      return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Lists (ordered)
    html = html.replace(/^\d+\.\s(.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

    // Lists (unordered)
    html = html.replace(/^[-*]\s(.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, (match) => {
      if (!match.includes('<ol>')) {
        return '<ul>' + match + '</ul>';
      }
      return match;
    });

    // Blockquotes
    html = html.replace(/^>\s(.+)$/gim, '<blockquote>$1</blockquote>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up extra p tags
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<[huo][1-6lp]>)/g, '$1');
    html = html.replace(/(<\/[huo][1-6lp]>)<\/p>/g, '$1');

    return html;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
