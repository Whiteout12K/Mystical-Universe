/* Shared wiki preference; dark is the default when no valid cookie exists. */
(() => {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'wiki-theme-toggle';
  const apply = () => {
    const light = document.documentElement.dataset.wikiTheme === 'light';
    toggle.textContent = light ? 'Dark Mode' : 'Light Mode';
    toggle.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} mode`);
  };
  toggle.addEventListener('click', () => {
    const theme = document.documentElement.dataset.wikiTheme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.wikiTheme = theme;
    document.cookie = `wiki_theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    apply();
  });
  apply();
  document.querySelector('[data-wiki-back-to-top]')?.after(toggle);
})();
