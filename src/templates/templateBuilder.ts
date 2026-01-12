import { escapeHtml } from '../utils/htmlSanitizer';
import { getStyleBlock } from './baseStyles';

/**
 * Template builder for creating HTML content in webviews.
 * Provides type-safe, reusable components for common UI patterns.
 */

/**
 * Create a complete HTML document for a webview
 */
export function createHtmlDocument(options: {
  title: string;
  body: string;
  additionalStyles?: string;
  scripts?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  ${getStyleBlock(options.additionalStyles || '')}
</head>
<body>
  ${options.body}
  ${options.scripts ? `<script>${options.scripts}</script>` : ''}
</body>
</html>`;
}

/**
 * Create a header section with title and badges
 */
export function createHeader(options: {
  id?: string | number;
  title: string;
  badges?: Array<{ text: string; className?: string }>;
  subtitle?: string;
}): string {
  const idLine = options.id !== undefined
    ? `<div class="work-item-id">Work Item #${escapeHtml(String(options.id))}</div>`
    : '';

  const badgesHtml = options.badges
    ? options.badges.map(b =>
        `<span class="badge ${b.className || 'type-badge'}">${escapeHtml(b.text)}</span>`
      ).join('')
    : '';

  const subtitleHtml = options.subtitle
    ? `<div class="subtitle">${escapeHtml(options.subtitle)}</div>`
    : '';

  return `
    <div class="header">
      ${idLine}
      <h1 class="work-item-title">${escapeHtml(options.title)}</h1>
      ${badgesHtml ? `<div>${badgesHtml}</div>` : ''}
      ${subtitleHtml}
    </div>
  `;
}

/**
 * Create a section with title and content
 */
export function createSection(options: {
  title: string;
  content: string;
  headerRight?: string;
  className?: string;
}): string {
  const headerRight = options.headerRight
    ? `<span>${options.headerRight}</span>`
    : '';

  return `
    <div class="section ${options.className || ''}">
      <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>${escapeHtml(options.title)}</span>
        ${headerRight}
      </div>
      ${options.content}
    </div>
  `;
}

/**
 * Create a field row (label + value)
 */
export function createField(label: string, value: string, options?: {
  escape?: boolean;
  className?: string;
  onClick?: string;
}): string {
  const escapedValue = options?.escape !== false ? escapeHtml(value) : value;
  const clickAttr = options?.onClick ? `onclick="${options.onClick}" style="cursor: pointer; color: var(--vscode-textLink-foreground);"` : '';

  return `
    <div class="field ${options?.className || ''}">
      <div class="field-label">${escapeHtml(label)}:</div>
      <div class="field-value" ${clickAttr}>${escapedValue}</div>
    </div>
  `;
}

/**
 * Create a button
 */
export function createButton(options: {
  text: string;
  onClick: string;
  className?: string;
  title?: string;
  icon?: string;
}): string {
  const icon = options.icon ? `${options.icon} ` : '';
  const title = options.title ? `title="${escapeHtml(options.title)}"` : '';

  return `<button class="${options.className || ''}" onclick="${options.onClick}" ${title}>${icon}${escapeHtml(options.text)}</button>`;
}

/**
 * Create an action bar with multiple buttons
 */
export function createActionBar(buttons: Array<{
  text: string;
  onClick: string;
  className?: string;
  title?: string;
  icon?: string;
}>): string {
  const buttonsHtml = buttons.map(b => createButton(b)).join('\n');

  return `
    <div class="actions">
      <div class="section-title">Actions</div>
      <div style="margin-top: 15px;">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

/**
 * Create a select dropdown
 */
export function createSelect(options: {
  id: string;
  placeholder?: string;
  options: Array<{ value: string; label: string; selected?: boolean }>;
}): string {
  const placeholder = options.placeholder
    ? `<option value="">${escapeHtml(options.placeholder)}</option>`
    : '';

  const optionsHtml = options.options.map(o =>
    `<option value="${escapeHtml(o.value)}" ${o.selected ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
  ).join('\n');

  return `
    <select id="${options.id}">
      ${placeholder}
      ${optionsHtml}
    </select>
  `;
}

/**
 * Create a textarea
 */
export function createTextarea(options: {
  id: string;
  placeholder?: string;
  value?: string;
  rows?: number;
  className?: string;
}): string {
  return `
    <textarea
      id="${options.id}"
      class="${options.className || 'description-textarea'}"
      placeholder="${escapeHtml(options.placeholder || '')}"
      style="min-height: ${(options.rows || 5) * 20}px;"
    >${escapeHtml(options.value || '')}</textarea>
  `;
}

/**
 * Create a banner/alert
 */
export function createBanner(options: {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  details?: string;
  icon?: string;
}): string {
  const typeClass = {
    success: 'banner-success',
    warning: 'banner-warning',
    error: 'banner-error',
    info: ''
  }[options.type];

  const icon = options.icon || {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  }[options.type];

  return `
    <div class="banner ${typeClass}">
      <div class="banner-title">${icon} ${escapeHtml(options.title)}</div>
      ${options.details ? `<div class="banner-details">${escapeHtml(options.details)}</div>` : ''}
    </div>
  `;
}

/**
 * Create a card container
 */
export function createCard(options: {
  header?: { left: string; right?: string };
  content: string;
  className?: string;
}): string {
  const headerHtml = options.header
    ? `
      <div class="card-header">
        <span>${options.header.left}</span>
        ${options.header.right ? `<span>${options.header.right}</span>` : ''}
      </div>
    `
    : '';

  return `
    <div class="card ${options.className || ''}">
      ${headerHtml}
      ${options.content}
    </div>
  `;
}

/**
 * Create a dialog/modal
 */
export function createDialog(options: {
  id: string;
  title: string;
  content: string;
  buttons: Array<{ text: string; onClick: string; className?: string }>;
}): string {
  const buttonsHtml = options.buttons.map(b =>
    `<button class="${b.className || ''}" onclick="${b.onClick}">${escapeHtml(b.text)}</button>`
  ).join('\n');

  return `
    <div class="dialog-overlay" id="${options.id}Overlay" onclick="close${options.id}()"></div>
    <div class="dialog" id="${options.id}">
      <h3 style="margin-top: 0;">${escapeHtml(options.title)}</h3>
      ${options.content}
      <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

/**
 * Create a loading indicator
 */
export function createLoading(message: string = 'Loading...'): string {
  return `
    <div class="loading">
      <div class="spinner"></div>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * Create a no-data placeholder
 */
export function createNoData(message: string): string {
  return `<p class="no-data">${escapeHtml(message)}</p>`;
}

/**
 * Create the VS Code API script initialization
 */
export function createVsCodeApiScript(): string {
  return `const vscode = acquireVsCodeApi();`;
}

/**
 * Create a message handler function
 */
export function createMessageHandler(command: string, body: string): string {
  return `
    function ${command}() {
      ${body}
    }
  `;
}

/**
 * Join multiple script functions
 */
export function joinScripts(...scripts: string[]): string {
  return scripts.join('\n\n');
}
