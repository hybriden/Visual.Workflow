/**
 * HTML Sanitizer utility for safely rendering user-provided HTML content.
 * Uses a whitelist approach to allow only safe tags and attributes.
 */

/**
 * Allowed HTML tags that are considered safe for rendering
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'
]);

/**
 * Allowed attributes per tag (whitelist approach)
 */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  'a': new Set(['href', 'title', 'target', 'rel']),
  'span': new Set(['class', 'style']),
  'div': new Set(['class', 'style']),
  'code': new Set(['class']),
  'pre': new Set(['class'])
};

/**
 * Safe URL protocols for href attributes
 */
const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if a URL is safe (uses allowed protocols)
 */
function isSafeUrl(url: string): boolean {
  if (!url) return false;

  try {
    // Handle relative URLs
    if (url.startsWith('/') || url.startsWith('#')) {
      return true;
    }

    const parsed = new URL(url, 'https://example.com');
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Parse an HTML tag and extract its name and attributes
 */
function parseTag(tagString: string): { name: string; attributes: Map<string, string>; isClosing: boolean; isSelfClosing: boolean } | null {
  const isClosing = tagString.startsWith('</');
  const isSelfClosing = tagString.endsWith('/>') || /^<(br|hr|img)\b/i.test(tagString);

  // Extract tag name
  const nameMatch = tagString.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
  if (!nameMatch) return null;

  const name = nameMatch[1].toLowerCase();
  const attributes = new Map<string, string>();

  // Extract attributes using a proper parser approach
  const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = attrRegex.exec(tagString)) !== null) {
    const attrName = match[1].toLowerCase();
    const attrValue = match[2] ?? match[3] ?? match[4] ?? '';
    attributes.set(attrName, attrValue);
  }

  return { name, attributes, isClosing, isSelfClosing };
}

/**
 * Sanitize HTML content using a whitelist approach.
 * Only allows safe tags and attributes, removes potentially dangerous content.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  const result: string[] = [];
  let lastIndex = 0;

  // Match all HTML tags
  const tagRegex = /<\/?[a-zA-Z][^>]*>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    // Add text content before this tag (escaped)
    if (match.index > lastIndex) {
      const textContent = html.slice(lastIndex, match.index);
      result.push(decodeAndEscapeText(textContent));
    }

    const tagString = match[0];
    const parsed = parseTag(tagString);

    if (parsed && ALLOWED_TAGS.has(parsed.name)) {
      if (parsed.isClosing) {
        // Closing tag - just output it
        result.push(`</${parsed.name}>`);
      } else {
        // Opening tag - filter attributes
        const allowedAttrs = ALLOWED_ATTRIBUTES[parsed.name] || new Set();
        const safeAttrs: string[] = [];

        for (const [attrName, attrValue] of parsed.attributes) {
          // Check if attribute is allowed for this tag
          if (!allowedAttrs.has(attrName)) continue;

          // Special handling for href - validate URL
          if (attrName === 'href') {
            if (!isSafeUrl(attrValue)) continue;
            safeAttrs.push(`href="${escapeHtml(attrValue)}"`);
            // Force safe target and rel for links
            safeAttrs.push('target="_blank"');
            safeAttrs.push('rel="noopener noreferrer"');
          } else if (attrName === 'style') {
            // Sanitize style attribute - only allow safe properties
            const safeStyle = sanitizeStyle(attrValue);
            if (safeStyle) {
              safeAttrs.push(`style="${escapeHtml(safeStyle)}"`);
            }
          } else if (attrName === 'class') {
            // Allow class but escape the value
            safeAttrs.push(`class="${escapeHtml(attrValue)}"`);
          } else {
            safeAttrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
          }
        }

        const attrsString = safeAttrs.length > 0 ? ' ' + safeAttrs.join(' ') : '';
        const selfClose = parsed.isSelfClosing ? ' /' : '';
        result.push(`<${parsed.name}${attrsString}${selfClose}>`);
      }
    }
    // If tag is not allowed, it's simply omitted (its content is preserved)

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text content
  if (lastIndex < html.length) {
    result.push(decodeAndEscapeText(html.slice(lastIndex)));
  }

  return result.join('');
}

/**
 * Decode HTML entities and then escape for safe output
 */
function decodeAndEscapeText(text: string): string {
  // First decode common HTML entities
  let decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Then escape for safe output
  return escapeHtml(decoded);
}

/**
 * Sanitize inline CSS style attribute
 * Only allows safe CSS properties
 */
function sanitizeStyle(style: string): string {
  const SAFE_STYLE_PROPERTIES = new Set([
    'color', 'background-color', 'font-size', 'font-weight', 'font-style',
    'text-align', 'text-decoration', 'margin', 'padding', 'border',
    'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding-top', 'padding-bottom', 'padding-left', 'padding-right'
  ]);

  const safeParts: string[] = [];
  const parts = style.split(';');

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;

    const property = part.slice(0, colonIndex).trim().toLowerCase();
    const value = part.slice(colonIndex + 1).trim();

    // Check if property is allowed
    if (!SAFE_STYLE_PROPERTIES.has(property)) continue;

    // Check for dangerous values (url(), expression(), javascript:, etc.)
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('url(') ||
        lowerValue.includes('expression(') ||
        lowerValue.includes('javascript:') ||
        lowerValue.includes('behavior:')) {
      continue;
    }

    safeParts.push(`${property}: ${value}`);
  }

  return safeParts.join('; ');
}

/**
 * Strip all HTML tags and return plain text
 * Useful when you need text-only content
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  return html
    // Convert block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<(p|div|h[1-6]|li|tr)[^>]*>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanitize content for display in PR descriptions
 * More lenient than general sanitization but still safe
 */
export function sanitizePrDescription(html: string): string {
  if (!html) return '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No description provided</p>';

  // Use the whitelist sanitizer
  let sanitized = sanitizeHtml(html);

  // Clean up multiple line breaks
  sanitized = sanitized.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

  return sanitized || '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No description provided</p>';
}
