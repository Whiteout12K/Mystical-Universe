/* DON'T TOUCH: shared enhancements for editable HTML wiki articles.
   All article text and facts live in each article's HTML, not in this script. */
(() => {
  'use strict';
  const toc = document.getElementById('wiki-toc-links');
  if (toc) {
    const used = new Set([...document.querySelectorAll('[id]')].map(node => node.id));
    for (const heading of document.querySelectorAll('#wiki-body .wiki-section > :is(h2,h3,h4,h5,h6):not([data-wiki-toc-exclude]), #wiki-body li > [data-wiki-list-heading]:not([data-wiki-toc-exclude])')) {
      if (!heading.id && heading.textContent==='Mystical Rank and Heritage') heading.id='heritage';
      if (!heading.id && heading.textContent==='Tools and Equipment') heading.id='equipment';
      if (!heading.id) {
        const base = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
        let id = base, i = 2; while (used.has(id)) id = `${base}-${i++}`;
        heading.id = id; used.add(id);
      }
      const a = document.createElement('a'); a.href = `#${heading.id}`; a.textContent = heading.textContent;
      const depth = heading.dataset.wikiTocDepth===undefined?Number(heading.tagName.slice(1))-2:Number(heading.dataset.wikiTocDepth);
      a.dataset.headingLevel = heading.tagName.slice(1);
      a.style.setProperty('--wiki-toc-depth', String(depth));
      if (depth > 0) a.className = 'wiki-toc-child';
      toc.append(a);
    }
    toc.closest('details').hidden = !toc.children.length;
  }
  // Optional virtual views stay in the same HTML and use shareable section hashes.
  const source = document.querySelector('script[type="text/x-wiki"]')?.textContent || '';
  const viewIds = (source.match(/\|views\s*=([^\n|}]+)/)?.[1] || '').split(',').map(id => id.trim()).filter(Boolean);
  const markedTabs = [...document.querySelectorAll('[data-wiki-tab]')];
  const overviewTab = markedTabs[0];
  const viewStarts = markedTabs.length ? markedTabs.slice(1) : viewIds.map(id => document.getElementById(id)?.closest('.wiki-section')).filter(Boolean);
  // A view includes following sibling sections, even when they also use H2.
  // The next configured view starts a new group; the last runs to the body end.
  const starts = new Set(viewStarts);
  const views = viewStarts.map(start => {
    if (start.dataset.wikiTab) return start;
    const group = document.createElement('div'); group.className = 'wiki-view-content';
    start.before(group);
    let section = start;
    while (section && (section === start || !starts.has(section))) {
      const next = section.nextElementSibling;
      group.append(section); section = next;
    }
    return group;
  });
  if (views.length) {
    const article = document.getElementById('wiki-body'), box = document.getElementById('wiki-infobox');
    const layout = article.closest('.wiki-layout'), title = document.getElementById('wiki-title');
    const originalTitle = title.textContent, originalDocumentTitle = document.title;
    const footer = article.querySelector('.wiki-article-footer');
    const viewHost = document.createElement('div'); viewHost.className = 'wiki-virtual-view';
    views.forEach(view => viewHost.append(view)); article.insertBefore(viewHost, footer);
    const overviewNodes = [...article.children].filter(node => node !== viewHost && node !== footer && node !== toc);
    // The TOC is inside a details element, so keep it shared across all views.
    const sharedTOC = toc?.closest('details');
    const overview = overviewNodes.filter(node => node !== sharedTOC);
    const links = toc ? [...toc.children] : [];
    function applyView() {
      let target; try {target = document.getElementById(decodeURIComponent(location.hash.slice(1)));} catch {}
      const active = views.find(view => target && view.contains(target));
      overview.forEach(node => { node.hidden = Boolean(active); });
      viewHost.hidden = !active; views.forEach(view => { view.hidden = view !== active; });
      if(box) box.hidden = Boolean(active);
      layout.classList.toggle('wiki-layout-no-infobox', Boolean(active) || !box);
      title.textContent = active ? `${originalTitle} — ${active.dataset.wikiTab || active.querySelector('h2,h3')?.textContent || 'Article'}` : originalTitle;
      document.title = active ? `${title.textContent} | Mystical Legends Wiki` : originalDocumentTitle;
      links.forEach(link => {
        const heading = document.getElementById(link.hash.slice(1));
        const inView = views.find(view => heading && view.contains(heading));
        link.hidden = active ? inView !== active : Boolean(inView);
      });
      if(sharedTOC) sharedTOC.hidden = !links.some(link => !link.hidden);
      document.querySelectorAll('.wiki-related a').forEach(link => {
        const isActive = active ? link.hash === '#' + (active.dataset.wikiTab ? active.id : active.querySelector('h2,h3')?.id) : link.hash === '#wiki-title' || (overviewTab && link.hash === '#' + overviewTab.id);
        if(isActive) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
      });
      requestAnimationFrame(() => { (active && (target === active || target === active.querySelector('h2,h3')) ? title : target)?.scrollIntoView({block:'start'}); });
    }
    window.addEventListener('hashchange', applyView); applyView();
  } else if(location.hash) requestAnimationFrame(() => {try {const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));const details=target?.closest('.wiki-disclosure');if(details)details.open=true;target?.scrollIntoView();}catch {}});
  // Scrolling to the top must not change the hash that selects a virtual view.
  document.querySelector('[data-wiki-back-to-top]')?.addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('wiki-title')?.scrollIntoView({block:'start', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  });
  // Portraits are ordinary editable figures; only the active one is displayed.
  for (const button of document.querySelectorAll('[data-wiki-portrait]')) {
    button.addEventListener('click', () => {
      const box = button.closest('.wiki-infobox');
      const target = document.getElementById(button.dataset.wikiPortrait);
      if (!box || !target || !box.contains(target)) return;
      box.querySelectorAll('.wiki-portrait').forEach(figure => { figure.hidden = figure !== target; });
      box.querySelectorAll('[data-wiki-portrait]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    });
  }
  // Native details provide independent, keyboard-accessible inline spoilers.
  // Text switches via CSS, so revealing spoilers also works without JavaScript.
  let printedDetails = [];
  window.addEventListener('beforeprint', () => {
    printedDetails = [...document.querySelectorAll('#wiki-content details:not([open])')];
    printedDetails.forEach(details => { details.open = true; });
  });
  window.addEventListener('afterprint', () => {
    printedDetails.forEach(details => { details.open = false; }); printedDetails = [];
  });
})();
