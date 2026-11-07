(() => {
  const boxes = '.character-filter-panel, .filter-dropdown-menu, .character-no-results';
  function decorate(root) {
    const targets = [...root.querySelectorAll(boxes)];
    if (root.matches?.(boxes)) targets.unshift(root);
    for (const box of targets) {
      if (box.dataset.ornamented) continue;
      box.dataset.ornamented = 'true';
      if (box.matches('.news-card')) {
        const image = box.querySelector(':scope > img');
        if (image) {
          const frame = document.createElement('div');
          frame.className = 'news-card-image';
          image.before(frame);
          frame.append(image);
        }
      }
      for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        const ornament = document.createElement('span');
        ornament.className = `hub-ornament hub-ornament-${corner}`;
        ornament.setAttribute('aria-hidden', 'true');
        box.append(ornament);
      }
    }
  }
  decorate(document);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) decorate(node);
      }
    }
  });
  for (const id of ['newsContainer']) {
    const container = document.getElementById(id);
    if (container) observer.observe(container, {childList: true});
  }
})();
