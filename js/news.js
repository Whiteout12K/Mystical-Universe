(() => {
  const container = document.getElementById('newsContainer');
  const more = document.getElementById('loadMoreBtn');
  if (!container || !more) return;
  const bar = document.getElementById('tagBar');
  const search = document.getElementById('searchInput');
  const titleTags = {'mlg hub':'Game', 'mystical legends book series':'Series'};
  const pageTag = Object.entries(titleTags).find(([key]) => document.title.toLowerCase().includes(key))?.[1];
  let articles = [], count = 2, tag = pageTag || 'all', query = '', ready = false;
  const status = document.createElement('p');
  status.setAttribute('role', 'status'); container.before(status);
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'fantasy-button'; retry.textContent = 'Retry loading news'; retry.hidden = true;
  container.after(retry); retry.addEventListener('click', load);
  async function metadata(file) {
    const response = await fetch(file);
    if (!response.ok) throw new Error('Article unavailable');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const meta = name => doc.querySelector(`meta[name="news-${name}"]`)?.content;
    const title = meta('title') || doc.title;
    const date = meta('date');
    if (!title || !date || !Number.isFinite(Date.parse(date))) throw new Error('Missing article metadata');
    const tags = (meta('tags') || '').split(',').map(t => t.trim()).filter(Boolean);
    for (const [key, value] of Object.entries(titleTags)) if (doc.title.toLowerCase().includes(key)) tags.push(value);
    return {file, title, date, image:meta('image') ? new URL(meta('image'), new URL(file, location.href)).href : null, tags:[...new Set(tags)]};
  }
  function render() {
    if (!ready) return;
    const filtered = articles.filter(a => (tag === 'all' || a.tags.includes(tag)) && a.title.toLowerCase().includes(query));
    container.replaceChildren();
    for (const item of filtered.slice(0, count)) {
      const link = document.createElement('a'); link.className = 'news-card'; link.href = item.file;
      if (item.image) { const image = document.createElement('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.width = 640; image.height = 360; link.append(image); }
      const heading = document.createElement('h3'); heading.textContent = item.title; link.append(heading); container.append(link);
    }
    more.style.display = count < filtered.length ? 'block' : 'none';
    status.textContent = filtered.length ? '' : query || tag !== 'all' ? 'No matching news. Try another search or category.' : 'No news has been published yet.';
  }
  function buildTags() {
    if (!bar) return;
    bar.replaceChildren(); bar.style.display = pageTag ? 'none' : 'flex';
    if (pageTag) return;
    for (const value of ['all', ...new Set(articles.flatMap(a => a.tags))]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tag-btn'; button.textContent = value === 'all' ? 'All' : value;
      button.classList.toggle('active', value === tag); button.setAttribute('aria-pressed', String(value === tag));
      button.addEventListener('click', () => { tag = value; count = 2; buildTags(); render(); }); bar.append(button);
    }
  }
  async function load() {
    ready = false; more.style.display = 'none'; retry.hidden = true; status.textContent = 'Loading news…'; container.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/webpages/list-news.json'); if (!response.ok) throw new Error('News unavailable');
      const files = await response.json(); if (!Array.isArray(files)) throw new Error('Invalid news list');
      const results = await Promise.allSettled(files.map(metadata));
      articles = results.filter(r => r.status === 'fulfilled').map(r => r.value).sort((a,b) => Date.parse(b.date)-Date.parse(a.date));
      if (files.length && !articles.length) throw new Error('No articles could be loaded');
      ready = true; buildTags(); render();
      if (results.some(r => r.status === 'rejected')) { status.textContent = 'Some news could not be loaded. Available stories are shown below.'; retry.hidden = false; }
    } catch { status.textContent = 'News could not be loaded. Please try again.'; retry.hidden = false; }
    finally { container.setAttribute('aria-busy', 'false'); }
  }
  more.addEventListener('click', () => { count += 2; render(); });
  search?.addEventListener('input', () => { query = search.value.trim().toLowerCase(); count = 2; render(); });
  const section = document.querySelector('.news-section'), floating = document.getElementById('floatingSearch');
  if (section && floating && 'IntersectionObserver' in window) new IntersectionObserver(entries => floating.classList.toggle('active', entries[0].isIntersecting), {threshold:.2}).observe(section);
  load();
})();
