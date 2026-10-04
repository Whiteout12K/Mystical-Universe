// Preserve old query-based bookmarks; article pages are now editable HTML.
export function onRequestGet({ request, next }) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page');
  if (!page || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(page)) return next();
  url.pathname = `/wiki/${page.replace(/-/g, '_')}`;
  url.search = '';
  return Response.redirect(url.href, 301);
}
