export const bracketName = value => String(value).normalize('NFKC').toLowerCase().replace(/[’']s\b/g, '').replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function bracketClassMap(css, effects) {
  const classes = new Set();
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(?:^|;)\s*color\s*:/i.test(rule[2])) continue;
    for (const selector of rule[1].split(',')) {
      const match = selector.trim().match(/^\.([a-z][a-z0-9_-]*)$/i);
      if (match) classes.add(match[1]);
    }
  }
  const names = new Map([...classes].map(name => [bracketName(name), name]));
  for (const [id, effect] of Object.entries(effects)) {
    if (!classes.has(effect.class)) continue;
    names.set(bracketName(id), effect.class);
    names.set(bracketName(effect.name || id), effect.class);
  }
  return {classes, names};
}

export function resolveBracketClass(text, names) {
  const name = bracketName(text);
  return names.get(name) || name.replaceAll(' ', '-');
}

export function createBracketColorizer(css, effects) {
  const {classes, names} = bracketClassMap(css, effects);
  return html => {
    if (typeof html !== 'string' || !html.includes('[')) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let changed = false;
    for (const text of nodes) {
      if (!text.textContent.includes('[') || text.parentElement?.closest('script,style,code,[data-dmg]')) continue;
      let parent = text.parentElement, colored = false;
      while (parent) {
        if (parent.style.color || [...parent.classList].some(name => classes.has(name)) || /^\[[^\[\]\n]+\]$/.test(parent.textContent) && parent.classList.contains(resolveBracketClass(parent.textContent.slice(1, -1), names))) { colored = true; break; }
        parent = parent.parentElement;
      }
      if (colored) continue;
      const matches = [...text.textContent.matchAll(/\[([^\[\]\n]+)\]/g)].filter(match => resolveBracketClass(match[1], names));
      if (!matches.length) continue;
      const bold = text.parentElement;
      if (matches.length === 1 && matches[0][0] === text.textContent && bold?.matches('b,strong') && bold.childNodes.length === 1) {
        bold.classList.add(resolveBracketClass(matches[0][1], names));
      } else {
        const fragment = document.createDocumentFragment();
        let position = 0;
        for (const match of matches) {
          fragment.append(text.textContent.slice(position, match.index));
          const span = document.createElement(text.parentElement?.closest('b,strong') ? 'span' : 'b');
          span.className = resolveBracketClass(match[1], names);
          span.textContent = match[0];
          fragment.append(span);
          position = match.index + match[0].length;
        }
        fragment.append(text.textContent.slice(position));
        text.replaceWith(fragment);
      }
      changed = true;
    }
    return changed ? template.innerHTML : html;
  };
}

export function colorSkillDocument(value, colorHTML) {
  function visit(node, textList = false) {
    if (Array.isArray(node)) return node.map(item => typeof item === 'string' && textList ? colorHTML(item) : visit(item));
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(Object.entries(node).map(([key, item]) => [key,
      typeof item === 'string' && (key === 'text' || /^description\d*$/.test(key)) ? colorHTML(item) : visit(item, key === 'additional' || key === 'stages')
    ]));
  }
  return visit(value);
}
