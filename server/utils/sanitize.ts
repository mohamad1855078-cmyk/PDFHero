import he from 'he';

/**
 * Escape any user-provided value into a safe HTML-escaped string.
 * Always returns a string. Null/undefined => empty string.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  // ensure a string and trim incidental whitespace
  const s = String(input);
  // Use he to properly encode characters to HTML entities
  return he.encode(s, { allowUnsafeSymbols: false });
}

/**
 * Simple template replacer that only substitutes already-escaped values.
 * Template tokens must be in the form {{key}}. This helper does not
 * perform any escaping itself — values must be pre-escaped using
 * `escapeHtml` before being passed in.
 */
export function buildSafeHtml(template: string, values: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
    // Missing value: replace with empty string to avoid inserting raw tokens
    return '';
  });
}

export default {
  escapeHtml,
  buildSafeHtml,
};
