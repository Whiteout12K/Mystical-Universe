(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = new URL('../../', location.href);
  let characters = [], selectedIndex = 0, imageReady = Promise.resolve(false), renderVersion = 0;
  const say = message => { $('status').textContent = message; };
  function validate(data) {
    const list = Array.isArray(data) ? data : data?.characters;
    if (!Array.isArray(list) || !list.length) throw Error('JSON must contain a nonempty "characters" list.');
    return list.map((character, index) => {
      if (!character || typeof character.name !== 'string' || !character.name.trim()) throw Error(`Character ${index + 1} needs a name.`);
      if (!Array.isArray(character.fields)) throw Error(`${character.name} needs a "fields" list.`);
      for (const field of character.fields) {
        if (!field || typeof field.label !== 'string' || !['string','number','boolean'].includes(typeof field.value) && !Array.isArray(field.value)) throw Error(`${character.name}: each field needs a label and a text, number, or list value.`);
        if (Array.isArray(field.value) && field.value.some(value => !['string','number','boolean'].includes(typeof value))) throw Error('Field lists must contain plain text or numbers.');
      }
      return character;
    });
  }
  function resizePreview() {
    const scale = Math.min(1, $('page-holder').parentElement.clientWidth / 800);
    $('page-holder').style.transform = `scale(${scale})`;
    $('page-holder').parentElement.style.height = `${$('character-page').offsetHeight * scale}px`;
  }
  function trimTransparentMargins(image) {
    // Only remove empty alpha margins; the original artwork file stays untouched.
    try {
      const ratio = Math.min(1, 400 / image.naturalWidth, 600 / image.naturalHeight);
      const probe = document.createElement('canvas');
      probe.width = Math.ceil(image.naturalWidth * ratio); probe.height = Math.ceil(image.naturalHeight * ratio);
      const context = probe.getContext('2d', {willReadFrequently:true});
      context.drawImage(image, 0, 0, probe.width, probe.height);
      const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
      let left = probe.width, top = probe.height, right = -1, bottom = -1;
      for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
        if (pixels[(y * probe.width + x) * 4 + 3] > 0) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      }
      if (right < 0 || (left < 4 && top < 4 && right > probe.width - 5 && bottom > probe.height - 5)) return null;
      // A little breathing room preserves soft glows at the edges.
      left = Math.max(0, left - 4); top = Math.max(0, top - 4); right = Math.min(probe.width, right + 5); bottom = Math.min(probe.height, bottom + 5);
      const sx = left / probe.width * image.naturalWidth, sy = top / probe.height * image.naturalHeight;
      const sw = (right - left) / probe.width * image.naturalWidth, sh = (bottom - top) / probe.height * image.naturalHeight;
      const output = document.createElement('canvas'), scale = Math.min(1, 2500 / sh);
      output.width = Math.ceil(sw * scale); output.height = Math.ceil(sh * scale);
      output.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, output.width, output.height);
      return output.toDataURL('image/png');
    } catch { return null; }
  }
  function render() {
    const version = ++renderVersion, character = characters[selectedIndex], image = $('character-splash');
    $('character-name').textContent = character.name;
    $('page-subtitle').textContent = character.subtitle || '';
    $('page-footer-text').textContent = character.footer || '';
    $('page-number').textContent = character.pageNumber ?? '';
    $('character-description').textContent = character.description || '';
    $('character-description').hidden = !character.description;
    $('character-fields').replaceChildren();
    for (const field of character.fields) {
      const value = Array.isArray(field.value) ? field.value.join('\n') : String(field.value);
      if (!field.label.trim() || !value.trim()) continue;
      const row = document.createElement('div'), label = document.createElement('dt'), detail = document.createElement('dd');
      label.textContent = field.label;
      for (const text of value.replace(/\r\n?/g, '\n').split('\n')) {
        const line = document.createElement('span'); line.className = 'field-line'; line.textContent = text; detail.append(line);
      }
      row.append(label, detail); $('character-fields').append(row);
    }
    delete image.dataset.trimmed; image.hidden = true; image.removeAttribute('src'); image.alt = `${character.name} character splash`;
    $('image-placeholder').hidden = false;
    $('image-placeholder').textContent = 'Add a splash image path to this character’s JSON.';
    $('export-png').disabled = true;
    imageReady = new Promise(resolve => {
      if (!character.image) { resolve(false); $('export-png').disabled = false; return; }
      let url;
      try { url = new URL(String(character.image).replace(/^\//, ''), root); if (!['http:','https:','file:'].includes(url.protocol)) throw Error('Unsupported image URL.'); }
      catch (error) { say(error.message); resolve(false); $('export-png').disabled = false; return; }
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (version !== renderVersion) { resolve(false); return; }
        if (!image.dataset.trimmed) { image.dataset.trimmed = 'true'; const trimmed = trimTransparentMargins(image); if (trimmed) { image.src = trimmed; return; } }
        image.hidden = false; $('image-placeholder').hidden = true; $('export-png').disabled = false;
        say('Ready to export · 1800 px wide · the complete splash is preserved.'); resizePreview(); resolve(true);
      };
      image.onerror = () => {
        if (version === renderVersion) { $('image-placeholder').textContent = 'Splash image could not be loaded. Check its JSON path.'; say('Image unavailable. Fix the image path before exporting.'); $('export-png').disabled = true; }
        resolve(false);
      };
      image.src = url.href;
    });
    resizePreview();
    if (!character.image) say('No splash image set. You can export a text-only page.');
  }
  function load(data) {
    const next = validate(data);
    characters = next; selectedIndex = 0;
    $('character-select').replaceChildren(...characters.map((character, index) => {
      const option = document.createElement('option'); option.value = index; option.textContent = character.name; return option;
    }));
    render();
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $('character-select').addEventListener('change', event => { selectedIndex = Number(event.target.value); render(); });
  $('color-art').addEventListener('change', event => { document.querySelector('.artwork').classList.toggle('monochrome', !event.target.checked); });
  $('open-json').onclick = () => $('json-file').click();
  $('json-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try { load(JSON.parse(await file.text())); } catch (error) { say(error.message); }
    event.target.value = '';
  };
  $('export-png').onclick = async () => {
    const button = $('export-png'), version = renderVersion, name = characters[selectedIndex].name;
    button.disabled = true; button.textContent = 'Exporting…'; $('character-select').disabled = true; $('color-art').disabled = true; $('open-json').disabled = true;
    try {
      if (typeof html2canvas !== 'function') throw Error('PNG exporter could not load. Open this page through your local website server.');
      await imageReady; await document.fonts.ready;
      await Promise.all([...$('character-page').querySelectorAll('img')].filter(image => !image.hidden).map(image => image.decode().catch(() => {})));
      if (version !== renderVersion) throw Error('The character changed. Please export again.');
      const page = $('character-page');
      // Rasterize the decorative SVGs at export resolution so their view boxes
      // and rotations survive html2canvas's image handling consistently.
      const ornaments = new Map();
      for (const image of page.querySelectorAll('img')) {
        if (!image.src.split('?')[0].endsWith('.svg') || !image.complete || !image.naturalWidth) continue;
        const raster = document.createElement('canvas');
        raster.width = Math.max(1, Math.ceil(image.clientWidth * 3));
        raster.height = Math.max(1, Math.ceil(image.clientHeight * 3));
        raster.getContext('2d').drawImage(image, 0, 0, raster.width, raster.height);
        ornaments.set(image.src, raster.toDataURL('image/png'));
      }
      const canvas = await html2canvas(page, {
        scale:2.25, backgroundColor:'#fffdf8', useCORS:true, logging:false,
        width:800, height:page.offsetHeight, windowWidth:1000, windowHeight:Math.max(1400,page.offsetHeight + 100), scrollX:0, scrollY:0,
        onclone: doc => { for (const image of doc.getElementById('character-page').querySelectorAll('img')) { if (ornaments.has(image.src)) image.src = ornaments.get(image.src); } const holder = doc.getElementById('page-holder'); holder.style.transform = 'none'; holder.parentElement.style.height = 'auto'; holder.parentElement.style.overflow = 'visible'; holder.parentElement.style.width = '800px'; }
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Could not create PNG. Use a splash image from this website or an image host that allows exports.');
      download(blob, name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-character-page.png');
      say(`PNG exported · ${canvas.width} × ${canvas.height} px. Insert into Word as a picture.`);
    } catch (error) { say(error.message || 'Export failed. Check the splash image path.'); }
    finally { button.disabled = false; button.textContent = 'Export PNG'; $('character-select').disabled = false; $('color-art').disabled = false; $('open-json').disabled = false; }
  };
  new ResizeObserver(resizePreview).observe($('character-page'));
  window.addEventListener('resize', resizePreview);
  fetch('characters.json').then(response => { if (!response.ok) throw Error('Could not open characters.json.'); return response.json(); }).then(load).catch(error => say(error.message + ' Use Open JSON, or open this page through your local server.'));
})();
