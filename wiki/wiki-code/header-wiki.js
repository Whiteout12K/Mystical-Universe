(async () => {
  'use strict';
  const host = document.getElementById('wiki-header-placeholder');
  if (!host) return;
  // Reuse the website's existing account initialization without changing it.
  await loadComponent('wiki-header-placeholder', '/index/header-wiki.html');
  const navigation = document.getElementById('wiki-navigation');
  if (!navigation) return;
  const safeHref = href => {
    try { const url = new URL(href, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const makeLink = item => {
    const a = document.createElement('a'); a.textContent = item.label;
    const href = safeHref(item.href); if (href) a.href = href;
    if (href && new URL(href).origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  };
  function branch(items) {
    const list = document.createElement('ul'); list.className = 'wiki-nav-tree';
    for (const item of items || []) {
      const row = document.createElement('li');
      if (item.children?.length) {
        const details = document.createElement('details'), summary = document.createElement('summary');
        summary.textContent = item.label; details.append(summary);
        if (item.href) { const a = makeLink({...item, label:`View ${item.label}`}); a.className = 'wiki-nav-category-link'; details.append(a); }
        details.append(branch(item.children)); row.append(details);
      } else row.append(makeLink(item));
      list.append(row);
    }
    return list;
  }
  const openMenus = [];
  function closeMenus(except) { for (const menu of openMenus) if (menu !== except) { menu.panel.hidden = true; menu.button.setAttribute('aria-expanded', 'false'); } }
  try {
    const response = await fetch('/wiki/navigation.json', {cache:'no-cache'});
    if (!response.ok) throw Error('Navigation unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw Error('Invalid navigation');
    data.items.forEach((item, index) => {
      const row = document.createElement('li'); row.className = 'nav-item wiki-nav-item';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'nav-link wiki-nav-toggle'; button.textContent = item.label; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', `wiki-nav-panel-${index}`);
      const panel = document.createElement('div'); panel.className = 'wiki-nav-panel'; panel.id = `wiki-nav-panel-${index}`; panel.hidden = true; panel.append(branch(item.children));
      const menu = {button, panel}; openMenus.push(menu);
      button.addEventListener('click', () => { const opening = panel.hidden; closeMenus(menu); panel.hidden = !opening; button.setAttribute('aria-expanded', String(opening)); });
      button.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); closeMenus(menu); panel.hidden = false; button.setAttribute('aria-expanded', 'true'); panel.querySelector('summary, a[href]')?.focus(); } });
      row.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeMenus(); button.focus(); } });
      row.append(button, panel); navigation.append(row);
    });
    document.addEventListener('click', event => { if (!event.target.closest('.wiki-nav-item')) closeMenus(); });
  } catch (error) {
    console.warn(error); const row = document.createElement('li'); row.className = 'nav-item'; const a = makeLink({label:'Explore',href:'/wiki/home.html'}); a.className = 'nav-link'; row.append(a); navigation.append(row);
  }
})();
