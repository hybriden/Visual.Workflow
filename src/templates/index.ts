/**
 * Template utilities for building webview HTML content.
 *
 * This module provides reusable components and utilities for creating
 * consistent, type-safe HTML content for VS Code webviews.
 *
 * @example
 * ```typescript
 * import { createHtmlDocument, createHeader, createSection } from '../templates';
 *
 * const html = createHtmlDocument({
 *   title: 'My Webview',
 *   body: createHeader({ title: 'Hello' }) + createSection({ title: 'Content', content: '...' })
 * });
 * ```
 */

export * from './baseStyles';
export * from './templateBuilder';
export * from './workItemTemplate';
export * from './pullRequestTemplate';
