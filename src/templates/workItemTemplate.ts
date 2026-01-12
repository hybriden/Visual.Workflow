import { escapeHtml } from '../utils/htmlSanitizer';
import { baseStyles } from './baseStyles';
import { TimeLogRecord } from '../azureDevOps/timeLogApi';

/**
 * Work Item View template data
 */
export interface WorkItemTemplateData {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  description: string;
  assignedTo: string;
  createdDate: string;
  changedDate: string;
  areaPath: string;
  iterationPath: string;
  tags: string;
  remainingWork: number;
  stateOptions: string;
  isAiEnabled: boolean;
  isAiProviderAvailable: boolean;
  timeLogEnabled: boolean;
  parentInfo?: string;
  parentType?: string;
  estimateSummary?: {
    originalEstimate: number;
    completedWork: number;
    remainingWork: number;
    totalWork: number;
    overBy: number;
    percentage: number;
    isOver: boolean;
  };
  showAlerts: boolean;
  timeLogs: TimeLogRecord[];
  totalTimeDisplay: string;
  comments: Array<{
    id: number;
    createdBy?: { displayName: string };
    createdDate: string;
    text: string;
  }>;
}

/**
 * Additional styles specific to work item view
 */
const workItemStyles = `
  .work-item-id {
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
  }
  .work-item-title {
    font-size: 24px;
    font-weight: 600;
    margin: 10px 0;
  }
  .estimate-banner {
    border-radius: 4px;
    padding: 12px 16px;
    margin: 15px 0;
  }
  .estimate-banner-on-track {
    background-color: rgba(22, 163, 74, 0.15);
    border: 1px solid rgba(22, 163, 74, 0.4);
  }
  .estimate-banner-warning {
    background-color: var(--vscode-inputValidation-warningBackground);
    border: 1px solid var(--vscode-inputValidation-warningBorder);
  }
  .estimate-banner-severe {
    background-color: var(--vscode-inputValidation-errorBackground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
  }
  .description-textarea {
    width: 100%;
    min-height: 150px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 12px;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    border-radius: 2px;
    resize: vertical;
  }
  .description-textarea:focus {
    outline: 1px solid var(--vscode-focusBorder);
  }
  .ai-generate-btn {
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .ai-plan-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 500;
  }
  .ai-plan-btn:hover {
    background: linear-gradient(135deg, #5568d3 0%, #653a8a 100%);
  }
  .comments-container { margin-top: 10px; }
  .comment {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .comment-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .comment-author { font-weight: 600; }
  .comment-date { color: var(--vscode-descriptionForeground); font-size: 12px; }
  .comment-text { line-height: 1.5; white-space: pre-wrap; }
  .time-log-btn, .delete-comment-btn {
    background-color: transparent;
    border: 1px solid var(--vscode-button-secondaryBackground);
    padding: 2px 6px;
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    margin: 0;
  }
  .delete-comment-btn { color: var(--vscode-errorForeground); }
`;

/**
 * Render estimate banner
 */
function renderEstimateBanner(data: WorkItemTemplateData): string {
  if (!data.estimateSummary || data.estimateSummary.originalEstimate <= 0 || !data.showAlerts) {
    return '';
  }

  const { estimateSummary } = data;
  const bannerClass = !estimateSummary.isOver
    ? 'estimate-banner-on-track'
    : estimateSummary.percentage > 25
      ? 'estimate-banner-severe'
      : 'estimate-banner-warning';

  const title = !estimateSummary.isOver
    ? `✅ On Track - ${Math.abs(estimateSummary.percentage).toFixed(1)}% under original estimate`
    : `⚠️ Over Estimate Alert - ${estimateSummary.percentage.toFixed(1)}% over original estimate`;

  const overUnderText = estimateSummary.isOver
    ? `Over by: ${estimateSummary.overBy.toFixed(1)}h`
    : `Under by: ${Math.abs(estimateSummary.overBy).toFixed(1)}h`;

  return `
    <div class="estimate-banner ${bannerClass}">
      <div class="banner-title">${title}</div>
      <div class="banner-details">
        Original Estimate: ${estimateSummary.originalEstimate}h •
        Completed: ${estimateSummary.completedWork}h •
        Remaining: ${estimateSummary.remainingWork}h •
        Total: ${estimateSummary.totalWork}h •
        ${overUnderText}
      </div>
    </div>
  `;
}

/**
 * Render actions section
 */
function renderActions(data: WorkItemTemplateData): string {
  return `
    <div class="actions">
      <div class="section-title">Actions</div>
      <div style="margin-top: 15px;">
        <select id="stateSelect">
          <option value="">-- Change State --</option>
          ${data.stateOptions}
        </select>
        <button onclick="changeState()">Update State</button>
        ${data.timeLogEnabled ? `<button class="secondary" onclick="logTime()">⏱️ Log Time</button>` : ''}
        <button class="secondary" onclick="showEstimateDialog()">📊 Set Estimate</button>
        <button class="secondary" onclick="assignToMe()">👤 Assign to Me</button>
        <button class="secondary" onclick="refresh()">Refresh</button>
        <button class="secondary" onclick="openInBrowser()">Open in Browser</button>
        ${data.isAiProviderAvailable ? `<button class="ai-plan-btn" onclick="generatePlan()" title="Generate implementation plan with AI">🎯 Plan</button>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render description section
 */
function renderDescriptionSection(data: WorkItemTemplateData): string {
  return `
    <div class="section">
      <div class="section-title">Description</div>
      <textarea id="descriptionText" class="description-textarea" placeholder="Enter work item description...">${escapeHtml(data.description)}</textarea>
      <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
        <button onclick="saveDescription()">Save Description</button>
        ${data.isAiEnabled ? `<button class="ai-generate-btn" onclick="generateWithAI()" title="Generate description with AI">✨ Generate with AI</button>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render details section
 */
function renderDetailsSection(data: WorkItemTemplateData): string {
  const parentField = data.parentInfo
    ? `<div class="field">
        <div class="field-label">Parent ${escapeHtml(data.parentType || '')}:</div>
        <div class="field-value" style="cursor: pointer; color: var(--vscode-textLink-foreground);" onclick="openParent()">${escapeHtml(data.parentInfo)}</div>
       </div>`
    : '';

  const estimateFields = data.estimateSummary && data.estimateSummary.originalEstimate > 0
    ? `
      <div class="field"><div class="field-label">Original Estimate:</div><div class="field-value">${data.estimateSummary.originalEstimate}h</div></div>
      <div class="field"><div class="field-label">Completed Work:</div><div class="field-value">${data.estimateSummary.completedWork}h</div></div>
      <div class="field"><div class="field-label">Remaining Work:</div><div class="field-value">${data.estimateSummary.remainingWork}h</div></div>
      <div class="field"><div class="field-label">Total Work:</div><div class="field-value">${data.estimateSummary.totalWork}h</div></div>
    `
    : `<div class="field"><div class="field-label">Remaining Work:</div><div class="field-value">${data.remainingWork}h</div></div>`;

  return `
    <div class="section">
      <div class="section-title">Details</div>
      ${parentField}
      <div class="field"><div class="field-label">Assigned To:</div><div class="field-value">${escapeHtml(data.assignedTo)}</div></div>
      <div class="field"><div class="field-label">Area Path:</div><div class="field-value">${escapeHtml(data.areaPath)}</div></div>
      <div class="field"><div class="field-label">Iteration:</div><div class="field-value">${escapeHtml(data.iterationPath)}</div></div>
      <div class="field"><div class="field-label">Tags:</div><div class="field-value">${escapeHtml(data.tags)}</div></div>
      ${estimateFields}
      <div class="field"><div class="field-label">Created:</div><div class="field-value">${escapeHtml(data.createdDate)}</div></div>
      <div class="field"><div class="field-label">Last Updated:</div><div class="field-value">${escapeHtml(data.changedDate)}</div></div>
    </div>
  `;
}

/**
 * Render time log section
 */
function renderTimeLogSection(data: WorkItemTemplateData): string {
  if (!data.timeLogEnabled) return '';

  const totalMinutes = data.timeLogs.reduce((sum, log) => sum + log.minutes, 0);

  const entriesHtml = data.timeLogs.map(log => {
    const hours = Math.floor(log.minutes / 60);
    const mins = log.minutes % 60;
    const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const logDate = new Date(log.date).toLocaleDateString();
    const userName = log.userName || log.userEmail || 'Unknown';
    const commentHtml = log.comment ? `<div style="margin-top: 6px; font-size: 13px;">${escapeHtml(log.comment)}</div>` : '';
    const escapedComment = (log.comment || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");

    return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600;">${timeDisplay}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--vscode-descriptionForeground); font-size: 12px;">${logDate}</span>
            <button type="button" class="time-log-btn" onclick="editTimeLog('${log.timeLogId}', ${log.minutes}, '${escapedComment}', event)" title="Edit">✏️</button>
            <button type="button" class="time-log-btn" onclick="removeTimeLogEntry('${log.timeLogId}', event)" title="Delete">🗑️</button>
          </div>
        </div>
        <div style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 4px;">
          ${escapeHtml(userName)} • ${escapeHtml(log.timeTypeDescription || 'General')}
        </div>
        ${commentHtml}
      </div>
    `;
  }).join('');

  const entriesSection = data.timeLogs.length > 0
    ? `<details style="margin-top: 10px;">
        <summary style="cursor: pointer; color: var(--vscode-textLink-foreground); margin-bottom: 10px;">Show time log entries</summary>
        <div style="margin-top: 10px;">${entriesHtml}</div>
       </details>`
    : '<p class="no-data">No time logged yet.</p>';

  return `
    <div class="section">
      <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Time Logged${data.timeLogs.length > 0 ? ` (${data.timeLogs.length} entries)` : ''}</span>
        <span style="font-size: 18px; font-weight: bold; color: var(--vscode-textLink-foreground);">${totalMinutes > 0 ? data.totalTimeDisplay : '0m'}</span>
      </div>
      ${entriesSection}
    </div>
  `;
}

/**
 * Render comments section
 */
function renderCommentsSection(data: WorkItemTemplateData): string {
  const commentsHtml = data.comments.length > 0
    ? data.comments.map(comment => `
        <div class="comment">
          <div class="comment-header">
            <span class="comment-author">${escapeHtml(comment.createdBy?.displayName || 'Unknown')}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="comment-date">${new Date(comment.createdDate).toLocaleString()}</span>
              <button class="delete-comment-btn" onclick="deleteComment(${comment.id})" title="Delete comment">🗑️</button>
            </div>
          </div>
          <div class="comment-text">${comment.text}</div>
        </div>
      `).join('')
    : '<p class="no-data">No comments yet. Be the first to add one!</p>';

  return `
    <div class="section">
      <div class="section-title">Comments${data.comments.length > 0 ? ` (${data.comments.length})` : ''}</div>
      <div style="margin-bottom: 20px;">
        <textarea id="commentInput" class="description-textarea" placeholder="Add a comment..." style="min-height: 80px;"></textarea>
        <div style="margin-top: 10px;">
          <button onclick="addComment()">Add Comment</button>
        </div>
      </div>
      <div class="comments-container">${commentsHtml}</div>
    </div>
  `;
}

/**
 * Render dialogs
 */
function renderDialogs(remainingWork: number): string {
  return `
    <div class="dialog-overlay" id="estimateOverlay" onclick="closeEstimateDialog()"></div>
    <div class="dialog" id="estimateDialog">
      <h3 style="margin-top: 0;">Set Remaining Work Estimate</h3>
      <p style="color: var(--vscode-descriptionForeground); margin: 10px 0;">Enter the estimated remaining work in hours:</p>
      <input type="number" id="estimateInput" class="estimate-input" placeholder="Hours (e.g., 8)" min="0" step="0.5" value="${remainingWork || 0}" style="width: 100%; padding: 8px; margin: 10px 0; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px;" />
      <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="secondary" onclick="closeEstimateDialog()">Cancel</button>
        <button onclick="submitEstimate()">Set Estimate</button>
      </div>
    </div>
    <div class="dialog-overlay" id="deleteOverlay" onclick="closeDeleteDialog()"></div>
    <div class="dialog" id="deleteDialog">
      <h3 style="margin-top: 0;">Delete Time Log Entry</h3>
      <p style="color: var(--vscode-descriptionForeground); margin: 10px 0;">Are you sure you want to delete this time log entry?</p>
      <input type="hidden" id="deleteTimeLogId" value="" />
      <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="secondary" onclick="closeDeleteDialog()">Cancel</button>
        <button class="danger" onclick="confirmDelete()">Delete</button>
      </div>
    </div>
  `;
}

/**
 * Generate the scripts for the work item view
 */
function generateScripts(): string {
  return `
    const vscode = acquireVsCodeApi();

    function openInBrowser() { vscode.postMessage({ command: 'openInBrowser' }); }
    function changeState() {
      const select = document.getElementById('stateSelect');
      if (select.value) { vscode.postMessage({ command: 'changeState', newState: select.value }); }
    }
    function refresh() { vscode.postMessage({ command: 'refresh' }); }
    function generateWithAI() {
      const textarea = document.getElementById('descriptionText');
      vscode.postMessage({ command: 'generateDescription', existingDescription: textarea.value });
    }
    function saveDescription() {
      const textarea = document.getElementById('descriptionText');
      vscode.postMessage({ command: 'saveDescription', description: textarea.value });
    }
    function openParent() { vscode.postMessage({ command: 'openParent' }); }
    function generatePlan() { vscode.postMessage({ command: 'generatePlan' }); }
    function addComment() {
      const textarea = document.getElementById('commentInput');
      if (textarea.value.trim()) {
        vscode.postMessage({ command: 'addComment', commentText: textarea.value.trim() });
        textarea.value = '';
      }
    }
    function deleteComment(commentId) { vscode.postMessage({ command: 'deleteComment', commentId: commentId }); }
    function showEstimateDialog() {
      document.getElementById('estimateDialog').classList.add('show');
      document.getElementById('estimateOverlay').classList.add('show');
      setTimeout(() => { const input = document.getElementById('estimateInput'); input.focus(); input.select(); }, 100);
    }
    function closeEstimateDialog() {
      document.getElementById('estimateDialog').classList.remove('show');
      document.getElementById('estimateOverlay').classList.remove('show');
    }
    function submitEstimate() {
      const input = document.getElementById('estimateInput');
      if (input.value !== '') {
        vscode.postMessage({ command: 'setEstimate', hours: input.value });
        closeEstimateDialog();
      }
    }
    function assignToMe() { vscode.postMessage({ command: 'assignToMe' }); }
    function logTime() { vscode.postMessage({ command: 'logTime' }); }
    function removeTimeLogEntry(timeLogId, event) {
      if (event) event.stopPropagation();
      document.getElementById('deleteTimeLogId').value = timeLogId;
      document.getElementById('deleteDialog').classList.add('show');
      document.getElementById('deleteOverlay').classList.add('show');
    }
    function closeDeleteDialog() {
      document.getElementById('deleteDialog').classList.remove('show');
      document.getElementById('deleteOverlay').classList.remove('show');
      document.getElementById('deleteTimeLogId').value = '';
    }
    function confirmDelete() {
      const timeLogId = document.getElementById('deleteTimeLogId').value;
      if (timeLogId) { vscode.postMessage({ command: 'deleteTimeLog', timeLogId: timeLogId }); }
      closeDeleteDialog();
    }
    function editTimeLog(timeLogId, currentMinutes, currentComment, event) {
      if (event) event.stopPropagation();
      vscode.postMessage({ command: 'editTimeLog', timeLogId: timeLogId, currentMinutes: currentMinutes, currentComment: currentComment });
    }
    document.addEventListener('DOMContentLoaded', function() {
      const estimateInput = document.getElementById('estimateInput');
      if (estimateInput) { estimateInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') submitEstimate(); }); }
    });
  `;
}

/**
 * Generate the complete work item HTML
 */
export function generateWorkItemHtml(data: WorkItemTemplateData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Work Item #${data.id}</title>
  <style>${baseStyles}${workItemStyles}</style>
</head>
<body>
  ${renderDialogs(data.remainingWork)}
  <div class="header">
    <div class="work-item-id">Work Item #${data.id}</div>
    <h1 class="work-item-title">${escapeHtml(data.title)}</h1>
    <div>
      <span class="badge type-badge">${escapeHtml(data.workItemType)}</span>
      <span class="badge state-badge">${escapeHtml(data.state)}</span>
    </div>
  </div>
  ${renderEstimateBanner(data)}
  ${renderActions(data)}
  ${renderDescriptionSection(data)}
  ${renderDetailsSection(data)}
  ${renderTimeLogSection(data)}
  ${renderCommentsSection(data)}
  <script>${generateScripts()}</script>
</body>
</html>`;
}
