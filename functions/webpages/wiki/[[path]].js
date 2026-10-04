// Preserve bookmarks from before the wiki moved to the website root.
export function onRequestGet({ request }) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page');
  if (page && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(page)) {
    url.pathname = `/wiki/${page.replace(/-/g, '_')}`;
    url.search = '';
  } else {
    url.pathname = url.pathname.replace(/^\/webpages\/wiki/, '/wiki');
  }
  return Response.redirect(url.href, 301);
}
