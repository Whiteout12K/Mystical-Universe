/* Search existing wiki articles, including pages in nested folders. */
window.initializeWikiSearch = () => {
  const host = document.getElementById('wiki-search');
  if (!host || host.dataset.initialized) return;
  host.dataset.initialized = 'true';
  const input = document.getElementById('wiki-search-input');
  const dropdown = document.getElementById('wiki-search-dropdown');
  const results = document.getElementById('wiki-search-results');
  const status = document.getElementById('wiki-search-status');
  let articles = [], loading, pending = false, failed = false, selected = -1;
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]/g, ' ');
  const close = () => {
    dropdown.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    selected = -1;
  };
  function select(index) {
    selected = index;
    [...results.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    const option = results.children[index];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({block:'nearest'});
    } else input.removeAttribute('aria-activedescendant');
  }
  function render() {
    results.replaceChildren(); selected = -1;
    input.removeAttribute('aria-activedescendant');
    const terms = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    const matches = articles.filter(article => terms.every(term => article.search.includes(term)));
    for (const [index, article] of matches.entries()) {
      const row = document.createElement('li'), link = document.createElement('a');
      row.id = `wiki-search-option-${index}`;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', 'false');
      link.href = article.path; link.tabIndex = -1;
      const name = document.createElement('span'); name.textContent = article.title;
      link.append(name);
      if (article.description) {
        const summary = document.createElement('small'); summary.textContent = article.description; link.append(summary);
      }
      row.append(link); results.append(row);
    }
    status.textContent = pending ? 'Loading wiki pages…' : failed ? 'Wiki search is unavailable. Click here again to retry.' : !matches.length ? 'No matching wiki pages.' : `${matches.length} wiki ${matches.length === 1 ? 'page' : 'pages'}`;
  }
  async function loadArticles() {
    try {
      const response = await fetch('/sitemap.xml', {cache:'no-cache'});
      if (!response.ok) throw Error('Archive unavailable');
      const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
      const paths = [...new Set([...xml.getElementsByTagName('loc')].map(node => {
        const url = new URL(node.textContent);
        return url.pathname;
      }).filter(path => path.startsWith('/wiki/') && !path.startsWith('/wiki/wiki-code/')))].sort();
      const found = [];
      let cursor = 0, errors = 0;
      await Promise.all(Array.from({length:Math.min(4, paths.length)}, async () => {
        while (cursor < paths.length) {
          const path = paths[cursor++];
          try {
            let destination = path;
            let response = await fetch(path, {cache:'no-cache'});
            if (response.status === 404 && !/\.html?$/i.test(path)) {
              destination = path + '.html';
              response = await fetch(destination, {cache:'no-cache'});
            }
            if (!response.ok) throw Error('Page unavailable');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const source = doc.querySelector('script[type="text/x-wiki"]');
            if (!source) continue;
            const title = source.textContent.match(/\|title\s*=([^\n|}]+)/)?.[1]?.trim() || doc.title.replace(/\s*\|.*$/, '');
            const description = window.wikiArticleSummary(source.textContent);
            found.push({path:destination, title, description, search:normalize(title + ' ' + path)});
          } catch { errors++; }
        }
      }));
      if (paths.length && !found.length && errors) throw Error('Pages unavailable');
      articles = found.sort((a, b) => a.title.localeCompare(b.title));
      failed = false;
    } catch { failed = true; }
    pending = false;
    if (!dropdown.hidden) render();
  }
  function open() {
    dropdown.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (!loading || failed) {
      failed = false; pending = true; render();
      loading = loadArticles();
    } else render();
  }
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', open);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (dropdown.hidden) open();
      const count = results.children.length;
      if (count) select(event.key === 'ArrowDown' ? (selected + 1) % count : selected < 0 ? count - 1 : (selected - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!dropdown.hidden) results.children[selected < 0 ? 0 : selected]?.querySelector('a')?.click();
    }
  });
  document.addEventListener('click', event => { if (!host.contains(event.target)) close(); });
  host.addEventListener('focusout', event => { if (!host.contains(event.relatedTarget)) close(); });
  document.getElementById('navbarNav')?.addEventListener('hide.bs.collapse', close);
};
