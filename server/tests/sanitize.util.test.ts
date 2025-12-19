import { escapeHtml, buildSafeHtml } from '../utils/sanitize';

describe('sanitize util', () => {
  test('escapeHtml escapes script tags and special chars', () => {
    const input = `<script>alert(1)</script> & " ' /`;
    const out = escapeHtml(input);
    expect(out).not.toContain('<script>');
    // he encodes using numeric entities like &#x3C; for '<'
    expect(out).toContain('&#x3C;script&#x3E;');
    expect(out).toContain('&#x26;');
    expect(out).toContain('&#x22;');
  });

  test('buildSafeHtml replaces tokens with provided escaped values', () => {
    const tmpl = '<div>{{name}}</div><p>{{bio}}</p>';
    const values = { name: escapeHtml('<b>A</b>'), bio: escapeHtml('<i>B</i>') };
    const html = buildSafeHtml(tmpl, values);
    expect(html).toContain('&#x3C;b&#x3E;A&#x3C;/b&#x3E;');
    expect(html).toContain('&#x3C;i&#x3E;B&#x3C;/i&#x3E;');
  });
});
