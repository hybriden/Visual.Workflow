import { escapeHtml, sanitizePrDescription } from '../utils/htmlSanitizer';
import { baseStyles } from './baseStyles';
import { PullRequest, getVoteIcon, getVoteDisplay, getBranchName } from '../models/pullRequest';
import { WorkItem } from '../models/workItem';

/**
 * Pull Request View template data
 */
export interface PullRequestTemplateData {
  pr: PullRequest;
  linkedWorkItems: WorkItem[];
  changedFiles: Array<{ path: string; changeType: string }>;
  aiReview: {
    summary: string;
    codeSmells: Array<{ severity: string; message: string; file?: string }>;
    suggestions: string[];
  } | null;
  aiReviewLoading: boolean;
  aiReviewError: string | null;
}

/**
 * Additional styles specific to pull request view
 */
export const pullRequestStyles = `
  .pr-id { color: var(--vscode-descriptionForeground); font-size: 14px; }
  .pr-title { font-size: 24px; font-weight: 600; margin: 10px 0; }
  .status-badge { color: white; }
  .draft-badge {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .branch-info {
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-family: monospace;
  }
  .reviewer {
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .reviewer:last-child { border-bottom: none; }
  .reviewer-vote { margin-right: 10px; font-size: 16px; }
  .reviewer-name { flex: 1; }
  .reviewer-status { color: var(--vscode-descriptionForeground); font-size: 12px; margin-left: 10px; }
  .required-badge {
    background-color: var(--vscode-inputValidation-warningBackground);
    color: var(--vscode-foreground);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    margin-left: 8px;
  }
  .work-item {
    display: flex;
    align-items: center;
    padding: 8px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .work-item:hover { background-color: var(--vscode-list-hoverBackground); }
  .wi-type {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    margin-right: 8px;
  }
  .wi-id { color: var(--vscode-textLink-foreground); margin-right: 8px; }
  .wi-title { flex: 1; }
  .changed-file {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .changed-file:hover { background-color: var(--vscode-list-hoverBackground); }
  .file-icon { margin-right: 8px; }
  .file-path { flex: 1; font-family: monospace; font-size: 12px; }
  .ai-review-section { margin-top: 20px; padding: 15px; border-radius: 4px; background-color: var(--vscode-textBlockQuote-background); }
  .ai-loading { color: var(--vscode-descriptionForeground); font-style: italic; }
  .ai-error { color: var(--vscode-errorForeground); }
  .ai-summary { margin-bottom: 15px; line-height: 1.5; }
  .ai-suggestions { margin-top: 10px; }
  .code-smell {
    padding: 8px;
    margin: 5px 0;
    border-left: 3px solid;
    background-color: var(--vscode-editor-background);
  }
  .smell-high { border-color: var(--vscode-errorForeground); }
  .smell-medium { border-color: var(--vscode-editorWarning-foreground); }
  .smell-low { border-color: var(--vscode-textLink-foreground); }
  .vote-buttons { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
  .vote-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: white;
  }
  .vote-approve { background-color: #107c10; }
  .vote-approve-suggestions { background-color: #107c10; }
  .vote-wait { background-color: #ff9800; }
  .vote-reject { background-color: #d32f2f; }
  .vote-reset { background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
`;

/**
 * Get status color for PR status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#0078d4';
    case 'completed': return '#107c10';
    case 'abandoned': return '#8a8886';
    default: return '#0078d4';
  }
}

/**
 * Render reviewers section
 */
export function renderReviewers(reviewers: PullRequest['reviewers']): string {
  if (!reviewers || reviewers.length === 0) {
    return '<p class="no-data">No reviewers assigned</p>';
  }

  return reviewers.map(r => `
    <div class="reviewer">
      <span class="reviewer-vote">${getVoteIcon(r.vote)}</span>
      <span class="reviewer-name">${escapeHtml(r.displayName)}</span>
      <span class="reviewer-status">${getVoteDisplay(r.vote)}</span>
      ${r.isRequired ? '<span class="required-badge">Required</span>' : ''}
    </div>
  `).join('');
}

/**
 * Render linked work items section
 */
export function renderLinkedWorkItems(workItems: WorkItem[]): string {
  if (workItems.length === 0) {
    return '<p class="no-data">No linked work items</p>';
  }

  return workItems.map(wi => `
    <div class="work-item" onclick="openWorkItem(${wi.id})">
      <span class="wi-type">${escapeHtml(wi.fields['System.WorkItemType'])}</span>
      <span class="wi-id">#${wi.id}</span>
      <span class="wi-title">${escapeHtml(wi.fields['System.Title'])}</span>
    </div>
  `).join('');
}

/**
 * Render changed files section
 */
export function renderChangedFiles(files: Array<{ path: string; changeType: string }>): string {
  if (files.length === 0) {
    return '<p class="no-data">No changed files</p>';
  }

  const getFileIcon = (changeType: string): string => {
    switch (changeType.toLowerCase()) {
      case 'add': return '➕';
      case 'delete': return '➖';
      case 'edit': return '✏️';
      default: return '📄';
    }
  };

  return files.map(f => `
    <div class="changed-file" onclick="openFileDiff('${escapeHtml(f.path).replace(/'/g, "\\'")}')">
      <span class="file-icon">${getFileIcon(f.changeType)}</span>
      <span class="file-path" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>
    </div>
  `).join('');
}

/**
 * Render AI review section
 */
export function renderAiReview(
  aiReview: PullRequestTemplateData['aiReview'],
  loading: boolean,
  error: string | null
): string {
  if (loading) {
    return `
      <div class="ai-review-section">
        <div class="section-title">🤖 AI Code Review</div>
        <div class="ai-loading">
          <span class="spinner"></span> Analyzing code changes...
        </div>
      </div>
    `;
  }

  if (error) {
    return `
      <div class="ai-review-section">
        <div class="section-title">🤖 AI Code Review</div>
        <div class="ai-error">${escapeHtml(error)}</div>
        <button class="secondary" onclick="requestAiReview()" style="margin-top: 10px;">Retry</button>
      </div>
    `;
  }

  if (!aiReview) {
    return `
      <div class="ai-review-section">
        <div class="section-title">🤖 AI Code Review</div>
        <p class="no-data">Click to generate an AI-powered code review</p>
        <button class="ai-button" onclick="requestAiReview()">Generate Review</button>
      </div>
    `;
  }

  const suggestionsHtml = aiReview.suggestions.length > 0
    ? `<div class="ai-suggestions">
        <strong>Suggestions:</strong>
        <ul>${aiReview.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
       </div>`
    : '';

  const smellsHtml = aiReview.codeSmells.length > 0
    ? `<div style="margin-top: 15px;">
        <strong>Code Issues (${aiReview.codeSmells.length}):</strong>
        ${aiReview.codeSmells.map(smell => `
          <div class="code-smell smell-${smell.severity.toLowerCase()}">
            <div class="smell-message">${escapeHtml(smell.message)}</div>
            ${smell.file ? `<div class="smell-file">${escapeHtml(smell.file)}</div>` : ''}
          </div>
        `).join('')}
       </div>`
    : '';

  return `
    <div class="ai-review-section">
      <div class="section-title">🤖 AI Code Review</div>
      <div class="ai-summary">${escapeHtml(aiReview.summary)}</div>
      ${suggestionsHtml}
      ${smellsHtml}
    </div>
  `;
}

/**
 * Capitalizes first letter
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
