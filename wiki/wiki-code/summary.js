/* Use the first article paragraph, excluding infoboxes and other templates. */
window.wikiArticleSummary = source => {
  let body = '', depth = 0;
  for (let i = 0; i < source.length; i++) {
    const pair = source.slice(i, i + 2);
    if (pair === '{{') { if (!depth) body += ' '; depth++; i++; }
    else if (pair === '}}' && depth) { depth--; i++; }
    else if (!depth) body += source[i];
  }
  body = body.replace(/\[\[(?:Category|File):[^\]]*\]\]/gi, '');
  const plain = value => {
    const text = value
      .replace(/\[\[([^\]]+)\]\]/g, (_, inside) => {
        const parts = inside.split('|');
        return (parts[1] || parts[0]).replace(/^fandom:/, '');
      })
      .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
      .replace(/'{2,5}/g, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '');
    const decoder = document.createElement('textarea');
    decoder.innerHTML = text;
    return decoder.value.replace(/\s+/g, ' ').trim();
  };
  let paragraph = [];
  for (const line of body.split('\n')) {
    if (!line.trim() || /^\s*(?:\|tab\s*=|={2,5}|[*#])/.test(line)) {
      const summary = plain(paragraph.join(' '));
      if (summary) return summary;
      paragraph = [];
    } else paragraph.push(line.trim());
  }
  return plain(paragraph.join(' '));
};
