export function renderMarkdown(text) {
  if (!text) return '';
  let h = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g,(_,l,c)=>`<pre><code class="language-${l}">${c.trimEnd()}</code></pre>`)
    .replace(/`([^`\n]+)`/g,'<code>$1</code>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawUrl) => {
      let safe = '#';
      try {
        const parsed = new URL(rawUrl.trim());
        if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
          safe = parsed.href.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;');
        }
      } catch { /* unsafe or malformed destinations remain inert */ }
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    })
    .replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>')
    .replace(/^\s*[-*] (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm,'<li>$1</li>')
    .replace(/^---$/gm,'<hr>')
    .replace(/\n{2,}/g,'</p><p>')
    .replace(/\n/g,'<br>');
  return `<p>${h}</p>`;
}
