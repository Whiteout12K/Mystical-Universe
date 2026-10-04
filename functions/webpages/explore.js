// Keep old Start Your Journey bookmarks useful after the page was retired.
export function onRequestGet({ request }) {
  return Response.redirect(new URL('/wiki/home', request.url).href, 301);
}
