/**
 * Base CSS styles shared across webviews.
 * These styles use VS Code CSS variables for theming.
 */
export const baseStyles = `
  body {
    font-family: var(--vscode-font-family);
    padding: 20px;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    line-height: 1.5;
  }

  /* Headers */
  .header {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 20px;
    margin-bottom: 20px;
  }

  h1, h2, h3 {
    color: var(--vscode-foreground);
    margin: 0 0 10px 0;
  }

  /* Sections */
  .section {
    margin: 20px 0;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 10px;
    color: var(--vscode-foreground);
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
    margin-right: 8px;
  }

  .type-badge {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  .state-badge {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }

  /* Fields */
  .field {
    margin: 12px 0;
    display: flex;
  }

  .field-label {
    font-weight: 600;
    min-width: 150px;
    color: var(--vscode-descriptionForeground);
  }

  .field-value {
    flex: 1;
  }

  /* Buttons */
  button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 8px 16px;
    margin: 5px 5px 5px 0;
    cursor: pointer;
    border-radius: 2px;
    font-size: 13px;
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

  button.danger {
    background-color: var(--vscode-inputValidation-errorBackground);
    color: var(--vscode-foreground);
  }

  /* Form elements */
  select {
    background-color: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 6px 12px;
    margin-right: 10px;
    border-radius: 2px;
    font-size: 13px;
  }

  input[type="text"],
  input[type="number"],
  textarea {
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 8px 12px;
    border-radius: 2px;
    font-size: 13px;
    font-family: var(--vscode-font-family);
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: 1px solid var(--vscode-focusBorder);
  }

  textarea {
    width: 100%;
    min-height: 100px;
    resize: vertical;
  }

  /* Links */
  a {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  /* Descriptions and quotes */
  .description {
    background-color: var(--vscode-textBlockQuote-background);
    border-left: 3px solid var(--vscode-textBlockQuote-border);
    padding: 15px;
    margin: 10px 0;
    white-space: pre-wrap;
  }

  /* Banners and alerts */
  .banner {
    border-radius: 4px;
    padding: 12px 16px;
    margin: 15px 0;
  }

  .banner-success {
    background-color: rgba(22, 163, 74, 0.15);
    border: 1px solid rgba(22, 163, 74, 0.4);
  }

  .banner-warning {
    background-color: var(--vscode-inputValidation-warningBackground);
    border: 1px solid var(--vscode-inputValidation-warningBorder);
  }

  .banner-error {
    background-color: var(--vscode-inputValidation-errorBackground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
  }

  .banner-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .banner-details {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.6;
  }

  /* Cards and containers */
  .card {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 10px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  /* Dialog/Modal styles */
  .dialog-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .dialog-overlay.show {
    display: block;
  }

  .dialog {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    padding: 20px;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    min-width: 300px;
  }

  .dialog.show {
    display: block;
  }

  /* Loading and progress */
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: var(--vscode-descriptionForeground);
  }

  .spinner {
    border: 2px solid var(--vscode-panel-border);
    border-top: 2px solid var(--vscode-button-background);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
    margin-right: 10px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* AI-specific styles */
  .ai-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 13px;
    font-weight: 500;
  }

  .ai-button:hover {
    background: linear-gradient(135deg, #5568d3 0%, #653a8a 100%);
  }

  /* Actions bar */
  .actions {
    margin: 20px 0;
    padding: 15px 0;
    border-top: 1px solid var(--vscode-panel-border);
  }

  /* Small icon buttons */
  .icon-button {
    background-color: transparent;
    border: 1px solid var(--vscode-button-secondaryBackground);
    color: var(--vscode-foreground);
    padding: 2px 6px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    margin: 0;
  }

  .icon-button:hover {
    background-color: var(--vscode-button-secondaryBackground);
  }

  .icon-button.danger {
    color: var(--vscode-errorForeground);
  }

  /* No data placeholder */
  .no-data {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    padding: 10px 0;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .field {
      flex-direction: column;
    }

    .field-label {
      min-width: auto;
      margin-bottom: 4px;
    }
  }
`;

/**
 * Get the complete style block for a webview
 */
export function getStyleBlock(additionalStyles: string = ''): string {
  return `<style>${baseStyles}${additionalStyles}</style>`;
}
