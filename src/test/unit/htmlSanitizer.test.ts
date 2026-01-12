import { expect } from 'chai';
import {
  escapeHtml,
  sanitizeHtml,
  stripHtml,
  sanitizePrDescription
} from '../../utils/htmlSanitizer';

describe('htmlSanitizer', () => {

  describe('escapeHtml', () => {
    it('should return empty string for null/undefined input', () => {
      expect(escapeHtml('')).to.equal('');
      expect(escapeHtml(null as any)).to.equal('');
      expect(escapeHtml(undefined as any)).to.equal('');
    });

    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).to.equal('&lt;script&gt;');
      expect(escapeHtml('"quotes"')).to.equal('&quot;quotes&quot;');
      expect(escapeHtml("'apostrophe'")).to.equal('&#039;apostrophe&#039;');
      expect(escapeHtml('a & b')).to.equal('a &amp; b');
    });

    it('should handle mixed content', () => {
      const input = '<div class="test">Hello & goodbye</div>';
      const expected = '&lt;div class=&quot;test&quot;&gt;Hello &amp; goodbye&lt;/div&gt;';
      expect(escapeHtml(input)).to.equal(expected);
    });

    it('should handle already escaped content', () => {
      expect(escapeHtml('&amp;')).to.equal('&amp;amp;');
    });
  });

  describe('sanitizeHtml', () => {
    it('should return empty string for empty input', () => {
      expect(sanitizeHtml('')).to.equal('');
      expect(sanitizeHtml(null as any)).to.equal('');
    });

    it('should allow safe tags', () => {
      expect(sanitizeHtml('<p>Hello</p>')).to.include('<p>');
      expect(sanitizeHtml('<strong>Bold</strong>')).to.include('<strong>');
      expect(sanitizeHtml('<em>Italic</em>')).to.include('<em>');
      expect(sanitizeHtml('<br>')).to.include('<br');
      expect(sanitizeHtml('<br/>')).to.include('<br');
    });

    it('should remove script tags completely', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const result = sanitizeHtml(input);
      expect(result).to.not.include('<script>');
      expect(result).to.include('<p>');
      // Note: The text content inside script tags gets escaped and preserved as text
      // This is safe because it's just text, not executable code
    });

    it('should remove dangerous tags', () => {
      expect(sanitizeHtml('<iframe src="evil.com"></iframe>')).to.not.include('<iframe>');
      expect(sanitizeHtml('<object data="evil.swf"></object>')).to.not.include('<object>');
      expect(sanitizeHtml('<embed src="evil.swf">')).to.not.include('<embed>');
      expect(sanitizeHtml('<form action="evil.com"></form>')).to.not.include('<form>');
    });

    it('should sanitize href attributes', () => {
      // Safe URLs should be preserved
      const safeLink = sanitizeHtml('<a href="https://example.com">Link</a>');
      expect(safeLink).to.include('href="https://example.com"');

      // Dangerous URLs should be removed - the href attribute is stripped
      const jsLink = sanitizeHtml('<a href="javascript:alert(1)">Link</a>');
      expect(jsLink).to.not.include('href="javascript:');

      // For data URLs, the href with dangerous protocol is stripped
      const dataLink = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">Link</a>');
      // The href attribute itself should not contain executable content
      expect(dataLink).to.not.include('href="data:text/html');
    });

    it('should add security attributes to links', () => {
      const result = sanitizeHtml('<a href="https://example.com">Link</a>');
      expect(result).to.include('target="_blank"');
      expect(result).to.include('rel="noopener noreferrer"');
    });

    it('should sanitize style attributes', () => {
      // Safe styles should be preserved
      const safeStyle = sanitizeHtml('<span style="color: red;">Text</span>');
      expect(safeStyle).to.include('color');

      // Dangerous styles should be removed
      const urlStyle = sanitizeHtml('<span style="background: url(evil.com);">Text</span>');
      expect(urlStyle).to.not.include('url(');

      const exprStyle = sanitizeHtml('<span style="behavior: expression(alert(1));">Text</span>');
      expect(exprStyle).to.not.include('expression');
    });

    it('should handle nested tags', () => {
      const input = '<div><p><strong>Nested</strong> content</p></div>';
      const result = sanitizeHtml(input);
      expect(result).to.include('<p>');
      expect(result).to.include('<strong>');
    });

    it('should preserve text content when removing tags', () => {
      const input = '<custom-tag>Important text</custom-tag>';
      const result = sanitizeHtml(input);
      expect(result).to.include('Important text');
      expect(result).to.not.include('<custom-tag>');
    });

    it('should handle event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeHtml(input);
      expect(result).to.not.include('onclick');
      expect(result).to.not.include('alert');
    });

    it('should handle malformed HTML gracefully', () => {
      expect(() => sanitizeHtml('<div><p>Unclosed')).to.not.throw();
      expect(() => sanitizeHtml('</div>Extra close')).to.not.throw();
      expect(() => sanitizeHtml('<<>>')).to.not.throw();
    });
  });

  describe('stripHtml', () => {
    it('should return empty string for empty input', () => {
      expect(stripHtml('')).to.equal('');
    });

    it('should remove all HTML tags', () => {
      expect(stripHtml('<p>Hello</p>')).to.equal('Hello');
      expect(stripHtml('<div><span>Nested</span></div>')).to.include('Nested');
    });

    it('should convert br tags to newlines', () => {
      expect(stripHtml('Line 1<br>Line 2')).to.include('\n');
      expect(stripHtml('Line 1<br/>Line 2')).to.include('\n');
      expect(stripHtml('Line 1<br />Line 2')).to.include('\n');
    });

    it('should decode HTML entities', () => {
      expect(stripHtml('&lt;tag&gt;')).to.equal('<tag>');
      expect(stripHtml('&amp;')).to.equal('&');
      expect(stripHtml('text&nbsp;here')).to.include('text');
      expect(stripHtml('&quot;')).to.equal('"');
    });

    it('should clean up excessive whitespace', () => {
      const input = '<p>Line 1</p><p></p><p></p><p>Line 2</p>';
      const result = stripHtml(input);
      expect(result).to.not.include('\n\n\n');
    });
  });

  describe('sanitizePrDescription', () => {
    it('should return placeholder for empty description', () => {
      const result = sanitizePrDescription('');
      expect(result).to.include('No description provided');
    });

    it('should return placeholder for null description', () => {
      const result = sanitizePrDescription(null as any);
      expect(result).to.include('No description provided');
    });

    it('should sanitize actual description content', () => {
      const input = '<p>This is a <strong>PR description</strong></p>';
      const result = sanitizePrDescription(input);
      expect(result).to.include('<p>');
      expect(result).to.include('<strong>');
    });

    it('should remove XSS attempts from PR descriptions', () => {
      const input = '<p>Description</p><script>alert("xss")</script>';
      const result = sanitizePrDescription(input);
      expect(result).to.not.include('<script>');
      // The script tag content becomes escaped text (safe, not executable)
      expect(result).to.include('<p>');
    });
  });

  describe('XSS attack vectors', () => {
    const xssVectors = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<iframe src="javascript:alert(1)">',
      '<a href="javascript:alert(1)">click</a>',
      '<div style="background:url(javascript:alert(1))">',
      '<input onfocus=alert(1) autofocus>',
      '<marquee onstart=alert(1)>',
      '<video><source onerror=alert(1)>',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>',
      "'-alert(1)-'",
      '<img src="x" onerror="alert(1)">',
      '<div onmouseover="alert(1)">hover</div>',
      '<a href="data:text/html,<script>alert(1)</script>">click</a>',
      '<base href="javascript:alert(1)//">',
      '<object data="data:text/html,<script>alert(1)</script>">',
      '<!--<script>alert(1)</script>-->',
      '<![CDATA[<script>alert(1)</script>]]>',
    ];

    xssVectors.forEach((vector, index) => {
      it(`should neutralize XSS vector #${index + 1}`, () => {
        const result = sanitizeHtml(vector);
        expect(result).to.not.include('<script>');
        expect(result).to.not.include('onerror');
        expect(result).to.not.include('onload');
        expect(result).to.not.include('onclick');
        expect(result).to.not.include('onmouseover');
        expect(result).to.not.include('onfocus');
        expect(result).to.not.include('onstart');
        expect(result).to.not.include('javascript:');
        // Note: some vectors may still contain 'alert' as text, which is safe
      });
    });
  });
});
