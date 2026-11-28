import {dynamicValueParts} from './skill-editor-values.js';
import {tokenizeCharacterText,editableTokenPattern,tokenDisplayText} from './skill-editor-tokens.js';
import {clone, isObject, parseDocument, serializeDocument, validateDocument, skillWarnings, groupSkillParagraphs, splitSkillParagraph, indentSkillParagraph} from './skill-editor-model.js';

import {createBracketColorizer, colorSkillDocument, bracketClassMap, resolveBracketClass} from './skill-editor-colors.js';
let colorHTML = html => html;
let bracketNames = new Map();

import {folderStore, ensureFolderPermission, writeCharacterFile} from './skill-editor-files.js';

const $ = id => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const documents = new Map();
let roster = {}, effects = {}, currentId = '', sourceId = '', selectedSkill = '', view = 'visual';
let saving = false;
let directory = null, loadVersion = 0, previewReady = false, previewURL = '', previewTimer;
let activeEditor = null, savedRange = null, skillAction = 'new', sourceDirty = false, storageFailed = false;
const current = () => documents.get(sourceId);
const skill = () => current()?.data[selectedSkill];
const storageKey = id => 'ml-skill-editor-draft-v1:' + id;

function status(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error(`Could not load ${path} (${response.status}).`);
  return response.json();
}
function remember() {
  const entry = current();
  try {
    if (JSON.stringify(entry.data) === entry.saved) localStorage.removeItem(storageKey(sourceId));
    else localStorage.setItem(storageKey(sourceId), JSON.stringify(entry.data));
    storageFailed = false;
  } catch {
    storageFailed = true;
    status('This browser cannot keep a local draft. Copy, download, or save your JSON before leaving.', true);
  }
}
function updateSaveButton() {
  const entry = current();
  let changed = entry && JSON.stringify(entry.data) !== entry.saved;
  if (entry && sourceDirty) {
    try {
      const source = colorSkillDocument(parseDocument($('source').value), colorHTML);
      changed = JSON.stringify(source) !== entry.saved;
    } catch {
      changed = true;
    }
  }
  $('save-file').disabled = !directory || !entry || saving || !changed;
}
function refreshState() {
  const entry = current();
  if (!entry) return;
  const changed = JSON.stringify(entry.data) !== entry.saved;
  $('change-state').textContent = changed ? 'Unsaved changes' : 'Loaded JSON';
  const selectedOption = $('skill-select').selectedOptions[0];
  if (selectedOption && skill()) selectedOption.textContent = selectedSkill + (skill().name ? ' · ' + skill().name : '');
  $('undo').disabled = !entry.undo.length;
  $('redo').disabled = !entry.redo.length;
  updateSaveButton();
  $('open-folder').textContent = directory ? 'Change folder' : 'Open Characters Folder';
  const warnings = skillWarnings(entry.data, effects);
  $('warnings').replaceChildren(...warnings.map(text => el('li', text)));
  updatePreview();
}
function change(mutate, render = false) {
  const entry = current();
  const previous = clone(entry.data);
  mutate(entry.data);
  if (JSON.stringify(previous) === JSON.stringify(entry.data)) return;
  entry.undo.push(previous);
  if (entry.undo.length > 100) entry.undo.shift();
  entry.redo = [];
  remember();
  if (render) renderEditor();
  else refreshState();
}
function history(direction) {
  if (!applySource()) return;
  const entry = current();
  const from = entry[direction], to = entry[direction === 'undo' ? 'redo' : 'undo'];
  if (!from.length) return;
  to.push(clone(entry.data));
  entry.data = from.pop();
  remember();
  renderEditor();
}
function applySource() {
  if (!sourceDirty) return true;
  try {
    const data = colorSkillDocument(parseDocument($('source').value), colorHTML);
    change(() => { current().data = data; });
    sourceDirty = false;
    renderEditor();
    status('JSON applied.');
    return true;
  } catch (error) {
    status(error.message, true);
    return false;
  }
}
function renderCharacters() {
  const query = $('character-search').value.trim().toLowerCase();
  $('character-list').replaceChildren();
  for (const [id, character] of Object.entries(roster)) {
    if (!/^c\d+[a-z]?$/i.test(id) || ![id, character.name].join(' ').toLowerCase().includes(query)) continue;
    const button = el('button');
    button.type = 'button';
    button.setAttribute('aria-current', String(id === currentId));
    if (character.profile_image) {
      const image = el('img');
      image.src = character.profile_image;
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
    }
    const label = el('span', character.name || id);
    label.append(el('small', id.toUpperCase()));
    button.append(label);
    button.addEventListener('click', () => selectCharacter(id));
    $('character-list').append(button);
  }
}
async function selectCharacter(id) {
  if (!applySource()) return;
  const version = ++loadVersion;
  currentId = id;
  sourceId = roster[id]?.base_character || id;
  const fileId = sourceId;
  $('workspace').hidden = true;
  $('character-title').textContent = roster[id]?.name || id;
  $('file-path').textContent = `images/mlg-assets/Characters/${fileId.toUpperCase()}/${fileId}.json`;
  $('open-character').href = '/webpages/game-c.html?char=' + id;
  $('open-character').hidden = false;
  renderCharacters();
  status('Loading skills…');
  try {
    if (!documents.has(fileId)) {
      let data, missing = false;
      const path = `/images/mlg-assets/Characters/${fileId.toUpperCase()}/${fileId}.json`;
      const response = await fetch(path);
      if (response.status === 404) { data = {}; missing = true; }
      else {
        if (!response.ok) throw Error(`Could not load ${path} (${response.status}).`);
        data = validateDocument(await response.json());
      }
      const saved = JSON.stringify(data);
      let restored = false;
      try {
        const draft = localStorage.getItem(storageKey(fileId));
        if (draft) { data = parseDocument(draft); restored = true; }
      } catch { /* The source file remains available if browser storage is unavailable. */ }
      const colored = colorSkillDocument(data, colorHTML);
      documents.set(fileId, {data: colored, saved, undo: JSON.stringify(colored) === JSON.stringify(data) ? [] : [clone(data)], redo: [], missing, restored});
    }
    if (version !== loadVersion) return;
    const entry = current();
    selectedSkill = Object.keys(entry.data)[0] || '';
    sourceDirty = false;
    $('variant-select').replaceChildren();
    const variants = roster[id]?.skill_variants || [];
    variants.forEach((variant, index) => {
      const option = el('option', variant.name || variant.nickname || `Variant ${index + 1}`);
      option.value = index;
      $('variant-select').append(option);
    });
    $('variant-control').hidden = !variants.length;
    $('workspace').hidden = false;
    for (const key of ['copy-character', 'download', 'import']) $(key).disabled = false;
    remember();
    renderEditor();
    const inherited = fileId !== id ? `This form shares ${fileId.toUpperCase()}'s skill file. ` : '';
    status(inherited + (entry.restored ? 'Local draft restored.' : entry.missing ? 'No skill file exists yet. Add a skill or import JSON.' : 'Ready to edit. Local drafts save automatically.'));
  } catch (error) {
    if (version === loadVersion) status(error.message, true);
  }
}
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(sendPreview, 180);
}
function sendPreview() {
  const data = skill();
  if (!data) {
    $('preview').hidden = true;
    $('preview-status').textContent = 'Add or select a skill to preview.';
    return;
  }
  const dupe = /^Dupes/i.test(selectedSkill);
  $('preview-level-label').textContent = dupe ? 'Star' : 'Level';
  $('preview-level').max = dupe ? 16 : data.max_level || 10;
  $('preview-level').value = Math.min(Number($('preview-level').max), Math.max(1, Math.trunc(Number($('preview-level').value)) || 1));
  const params = new URLSearchParams({editor: '1', char: sourceId, form: currentId, variant: $('variant-select').value || '0'});
  const url = '/webpages/apps/skill.html?' + params;
  $('preview').hidden = false;
  if (url !== previewURL) {
    previewURL = url;
    previewReady = false;
    $('preview-status').textContent = 'Loading skill renderer…';
    $('preview').src = url;
  }
  if (previewReady) {
    $('preview-status').textContent = 'Updating preview…';
    $('preview').contentWindow.postMessage({type: 'ml-skill-preview', skills: current().data, skill: selectedSkill, level: Number($('preview-level').value)}, location.origin);
  }
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== $('preview').contentWindow) return;
  if (event.data?.type === 'ml-skill-preview-ready') { previewReady = true; sendPreview(); }
  if (event.data?.type === 'ml-skill-preview-rendered') $('preview-status').textContent = 'Live preview';
  if (event.data?.type === 'ml-skill-preview-error') $('preview-status').textContent = event.data.message;
});

// Keep existing HTML, token text, and scaling keys editable without changing the data schema.
function cleanHTML(html) {
  const template = el('template');
  template.innerHTML = html;
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'A', 'SUB', 'SUP']);
  for (const node of [...template.content.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(node.tagName)) { node.remove(); continue; }
    if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); continue; }
    for (const attribute of [...node.attributes]) {
      const key = attribute.name;
      if (key === 'href' && /^(https?:|\/|#)/i.test(attribute.value)) continue;
      if (['class', 'data-dmg'].includes(key)) continue;
      if (key === 'style') {
        const color = node.style.color;
        node.removeAttribute('style');
        if (color) node.style.color = color;
        continue;
      }
      node.removeAttribute(key);
    }
  }
  return template.innerHTML;
}
function tokenizePastedHTML(html){
  const holder=el('div');holder.innerHTML=cleanHTML(html);
  const base=roster[currentId]||{},character={...base,...base.skill_variants?.[Number($('variant-select').value||0)]},walker=document.createTreeWalker(holder,NodeFilter.SHOW_TEXT),texts=[];
  while(walker.nextNode())texts.push(walker.currentNode);
  for(const text of texts)text.textContent=tokenizeCharacterText(text.textContent,character);
  return holder.innerHTML;
}
function dynamicSourceHTML(html){
  const holder=el('div');holder.innerHTML=html;
  const walker=document.createTreeWalker(holder,NodeFilter.SHOW_TEXT),texts=[];
  while(walker.nextNode())texts.push(walker.currentNode);
  for(const text of texts){
    if(text.parentElement.closest('[data-dmg]'))continue;
    const parts=dynamicValueParts(text.textContent,skill()?.base_damage||{});
    if(!parts.some(part=>part.key))continue;
    const fragment=document.createDocumentFragment();
    for(const part of parts){if(part.key){const value=el('span');value.dataset.dmg=part.key;fragment.append(value);if(part.percent)fragment.append('%');}else fragment.append(document.createTextNode(part.text));}
    text.replaceWith(fragment);
  }
  return holder.innerHTML;
}
function visualHTML(html) {
  const holder = el('div');
  holder.innerHTML = cleanHTML(html);
  holder.querySelectorAll('b[class],strong[class],span[class]').forEach(node => {
    const term = node.textContent.match(/^\[([^\[\]]+)\]$/);
    if (term && node.childNodes.length === 1 && !node.style.color && node.classList.contains(resolveBracketClass(term[1], bracketNames))) node.dataset.editorBracket = node.textContent;
  });
  holder.querySelectorAll('[data-dmg]').forEach(node => {
    let next=node;
    while(next&&!next.nextSibling&&next.parentNode!==holder)next=next.parentNode;
    next=next?.nextSibling;
    const suffix=next?.nodeType===Node.TEXT_NODE?next.textContent.match(/^\s*%/):null;
    if(suffix)next.textContent=next.textContent.slice(suffix[0].length);
    node.replaceWith(document.createTextNode('['+node.dataset.dmg+(suffix?'%':'')+']'));
  });
  const walker=document.createTreeWalker(holder,NodeFilter.SHOW_TEXT),texts=[];
  while(walker.nextNode())texts.push(walker.currentNode);
  for(const text of texts){
    const fragment=document.createDocumentFragment();let last=0;
    for(const match of text.textContent.matchAll(editableTokenPattern)){
      fragment.append(document.createTextNode(text.textContent.slice(last,match.index)));
      const field=el('span',tokenDisplayText(match[1],roster,currentId,$('variant-select').value||0));field.dataset.editorToken=match[1];field.dataset.editorDisplay=field.textContent;fragment.append(field);last=match.index+match[0].length;
    }
    if(last){fragment.append(document.createTextNode(text.textContent.slice(last)));text.replaceWith(fragment);}
  }
  return holder.innerHTML;
}
function sourceHTML(editor) {
  const holder = editor.cloneNode(true);
  holder.querySelectorAll('[data-editor-token]').forEach(node=>node.replaceWith(document.createTextNode(node.textContent===node.dataset.editorDisplay?'{{'+node.dataset.editorToken+'}}':node.textContent)));
  // Browsers may extend the last bold/color span as typing continues after ].
  // Recolor only its bracketed terms so the following sentence stays plain.
  holder.querySelectorAll('[data-editor-bracket]').forEach(node => {
    if (node.textContent !== node.dataset.editorBracket) node.replaceWith(...node.childNodes);
    else node.removeAttribute('data-editor-bracket');
  });
  return dynamicSourceHTML(tokenizePastedHTML(cleanHTML(holder.innerHTML)));
}
function rememberSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const node = selection.anchorNode?.parentElement?.closest('.rich-text');
  if (!node) return;
  activeEditor = node;
  savedRange = selection.getRangeAt(0).cloneRange();
}
document.addEventListener('selectionchange', rememberSelection);
function restoreSelection() {
  if (!activeEditor?.isConnected) { status('Click inside a paragraph first.', true); return false; }
  activeEditor.focus();
  const selection = window.getSelection();
  selection.removeAllRanges();
  if (savedRange && activeEditor.contains(savedRange.commonAncestorContainer)) selection.addRange(savedRange);
  else {
    const range = document.createRange();
    range.selectNodeContents(activeEditor);
    range.collapse(false);
    selection.addRange(range);
  }
  return true;
}
function insertHTML(html) {
  if (!restoreSelection()) return;
  document.execCommand('insertHTML', false, html);
  activeEditor.dispatchEvent(new Event('input', {bubbles: true}));
  rememberSelection();
}
function wrapSelection(className, color) {
  if (!restoreSelection()) return;
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  if (range.collapsed) { status('Select text to apply its color or style.', true); return; }
  const wrapper = el('span');
  if (className) wrapper.className = className;
  if (color) wrapper.style.color = color;
  wrapper.append(range.extractContents());
  range.insertNode(wrapper);
  range.selectNodeContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(range);
  activeEditor.dispatchEvent(new Event('input', {bubbles: true}));
  rememberSelection();
}
function inputField(label, value, callback, type = 'text') {
  const wrapper = el('label', label);
  const input = el('input');
  input.type = type;
  input.value = value ?? '';
  if (type === 'number') input.step = 'any';
  input.addEventListener('input', () => {
    if (type === 'number' && input.value !== '' && !input.validity.valid) return;
    callback(type === 'number' && input.value !== '' ? Number(input.value) : input.value);
  });
  wrapper.append(input);
  return wrapper;
}
function button(text, action, label) {
  const node = el('button', text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', action);
  return node;
}
const styleFields = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'fontSize', 'lineHeight', 'width', 'textAlign'];
function applyWritingStyle(editor,entry){
 const style={...(entry?.style||{}),...Object.fromEntries(styleFields.filter(key=>entry?.[key]!==undefined).map(key=>[key,entry[key]]))};
 editor.style.paddingLeft=Math.max(8,Math.min(128,8+(Number(style.paddingLeft)||0)))+'px';
 editor.style.marginTop=Math.max(0,Math.min(24,Number(style.paddingTop)||0))+'px';
 editor.style.textAlign=style.textAlign||'';
 editor.style.fontSize=style.fontSize?Math.max(12,Math.min(28,Number(style.fontSize)*2))+'px':'';
 editor.style.lineHeight=style.lineHeight?String(style.lineHeight):'';
}
function splitWritingLine(editor){
 const selection=window.getSelection();
 if(!selection.rangeCount)return null;
 const range=selection.getRangeAt(0);if(!editor.contains(range.commonAncestorContainer))return null;
 const before=range.cloneRange(),after=range.cloneRange();before.selectNodeContents(editor);before.setEnd(range.startContainer,range.startOffset);after.selectNodeContents(editor);after.setStart(range.endContainer,range.endOffset);
 const left=el('div'),right=el('div');left.append(before.cloneContents());right.append(after.cloneContents());
 return [sourceHTML(left),sourceHTML(right)];
}
function renderBlock(host, label, get, set, options = {}) {
  const box = el('section', undefined, options.connected?'writing-line':'block');
  const head = el('div', undefined, 'block-head');
  head.append(el('strong', label));
  const initial = get();
  let starOptions;
  if (options.stage) head.append(inputField('Name', initial.name, value => change(() => set({...get(), name: value}))));
  if (options.dupe) {
    const field = inputField(initial?.level!==undefined?'Star Level':'New star (optional)', initial?.level, value => {
      if (value !== '' && (!Number.isInteger(value) || value < 1 || value > 16)) return;
      change(() => {
        const entry = typeof get() === 'string' ? {text: get()} : {...get()};
        if (value === '') delete entry.level;
        else entry.level = value;
        set(entry);
      });
    }, 'number');
    field.querySelector('input').min = 1;
    field.querySelector('input').max = 16;
    if(initial?.level!==undefined)head.append(field);else{starOptions=el('details',undefined,'star-entry-options');starOptions.append(el('summary','Start a Star Level'),field);}
  }
  if (options.move) {
    for (const [delta, text] of [[-1, '↑'], [1, '↓']]) {
      const move = button(text, () => options.move(delta), `Move ${label} ${delta < 0 ? 'up' : 'down'}`);
      move.disabled = delta < 0 ? options.first : options.last;
      head.append(move);
    }
    if(options.connected)head.append(button('Duplicate',options.duplicate),button('Remove',options.remove));
    else{const actions=el('details',undefined,'action-menu block-actions');actions.append(el('summary','More'));
    const menu=el('div',undefined,'action-menu-panel');menu.append(button('Duplicate',options.duplicate),button('Remove',options.remove));actions.append(menu);head.append(actions);}
  }
  const editor = el('div', undefined, 'rich-text');
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true');
  editor.setAttribute('aria-label', label + ' text');
  const text = typeof initial === 'string' ? initial : initial.text ?? initial.description ?? '';
  editor.innerHTML = visualHTML(text);
  if(options.connected)applyWritingStyle(editor,initial);
  const htmlDetails = el('details');
  htmlDetails.append(el('summary', 'HTML / tokens'));
  const html = el('textarea', undefined, 'html-source');
  html.setAttribute('aria-label', label + ' HTML');
  html.value = text;
  html.spellcheck = false;
  const updateText = value => change(() => {
    value = colorHTML(dynamicSourceHTML(value));
    const entry = get();
    if (typeof entry === 'string') set(value);
    else set({...entry, [Object.hasOwn(entry, 'description') && !Object.hasOwn(entry, 'text') ? 'description' : 'text']: value});
  });
  if(options.newLine)editor.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){const parts=splitWritingLine(editor);if(parts){event.preventDefault();options.newLine(parts);}}
    if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();change(()=>set(indentSkillParagraph(get(),event.shiftKey?-15:15)));applyWritingStyle(editor,get());}
  });
  editor.addEventListener('focus', () => { activeEditor = editor; });
  editor.addEventListener('input', () => {
    const raw = sourceHTML(editor);
    html.value = colorHTML(raw);
    updateText(html.value);
    if (html.value !== raw) {
      const selection = window.getSelection();
      const range = selection.rangeCount ? selection.getRangeAt(0) : null;
      const before = range?.cloneRange();
      let offset = 0;
      if (before && editor.contains(range.startContainer)) {
        before.selectNodeContents(editor);
        before.setEnd(range.startContainer, range.startOffset);
        offset = before.toString().length;
      }
      editor.innerHTML = visualHTML(html.value);
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (offset <= node.length) {
          const caret = document.createRange();
          const coloredTerm = node.parentElement?.closest('b[class],span[class]');
          if (offset === node.length && node.textContent.endsWith(']') && coloredTerm) caret.setStartAfter(coloredTerm);
          else caret.setStart(node, offset);
          caret.collapse(true);
          selection.removeAllRanges();
          selection.addRange(caret);
          break;
        }
        offset -= node.length;
      }
      rememberSelection();
    }
  });
  editor.addEventListener('paste', event => {
    event.preventDefault();
    const markup = event.clipboardData.getData('text/html');
    const plain=el('div');plain.textContent=event.clipboardData.getData('text/plain');
    const incoming=markup||plain.innerHTML.replace(/\n/g,'<br>');
    document.execCommand('insertHTML',false,visualHTML(tokenizePastedHTML(incoming)));
    editor.dispatchEvent(new Event('input', {bubbles: true}));
  });
  html.addEventListener('paste',event=>{event.preventDefault();const text=tokenizePastedHTML(event.clipboardData.getData('text/plain'));html.setRangeText(text,html.selectionStart,html.selectionEnd,'end');html.dispatchEvent(new Event('input',{bubbles:true}));});
  html.addEventListener('input', () => { updateText(html.value); editor.innerHTML = visualHTML(colorHTML(html.value)); });
  htmlDetails.append(html);
  const styles = el('details');
  styles.append(el('summary', 'Spacing and text size'));
  const grid = el('div', undefined, 'style-grid');
  for (const property of styleFields) {
    const value = initial?.[property] ?? initial?.style?.[property] ?? '';
    grid.append(inputField(property.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase()), value, next => change(() => {
      const entry = typeof get() === 'string' ? {text: get()} : clone(get());
      const target = Object.hasOwn(entry, property) ? entry : (entry.style ||= {});
      if (next === '') delete target[property];
      else target[property] = /^-?\d+(\.\d+)?$/.test(next) ? Number(next) : next;
      set(entry);
      if(options.connected)applyWritingStyle(editor,entry);
    })));
  }
  styles.append(grid);
  const advanced=el('details',undefined,'block-advanced');advanced.append(el('summary','Paragraph options'),htmlDetails,styles);if(starOptions)advanced.append(starOptions);
  if(options.connected){
    const menu=el('details',undefined,'action-menu writing-line-options'),summary=el('summary','⋯');summary.title=label+' options';summary.setAttribute('aria-label',label+' options');
    const panel=el('div',undefined,'action-menu-panel writing-options-panel');panel.append(head,advanced);menu.append(summary,panel);
    if(options.stage)box.append(el('span',initial.name||label,'writing-stage-name'));
    box.append(editor,menu);
  }else box.append(head,editor,advanced);
  if(options.index!==undefined){box.dataset.list=options.list;box.dataset.index=options.index;}
  host.append(box);
}
function renderList(host, key, heading) {
  const top = el('div', undefined, 'section-top');
  top.append(el('h3', heading));
  const actions = el('div');
  const append = entry => change(() => { (skill()[key] ||= []).push(entry); }, true);
  actions.append(button('Add paragraph', () => append(key === 'stages' ? {name: 'Stage ' + ((skill().stages?.length || 0) + 1), text: '', style: {paddingLeft: 15, paddingTop: 7}} : {text: '', style: {paddingTop: 7}})));
  if (key === 'additional') {
    actions.append(button('Add cooldown', () => append({text: 'Cooldown: 15 seconds', style: {paddingTop: 15, fontSize: 7}})));
    if (/^Dupes/i.test(selectedSkill)) actions.append(button('Add Star Level', () => {
      const levels = (skill().additional || []).map(entry => Number(entry?.level) || 0);
      append({level: Math.min(16, Math.max(0, ...levels) + 1), text: '', style: {paddingTop: 5}});
    }));
  }
  top.append(actions);
  host.append(top);
  const list=skill()[key]||[],starMode=key==='additional'&&/^Dupes/i.test(selectedSkill);
  const groups=starMode?groupSkillParagraphs(list):[{level:null,entries:list.map((entry,index)=>({entry,index}))}];
  for(const group of groups){
    let target=host;
    if(starMode){
      const section=el('details',undefined,'star-level-group');section.open=true;
      section.dataset.panel='star-'+(group.level??'base');
      section.append(el('summary',group.level===null?'Base passive':'Star Level '+group.level));
      target=el('div',undefined,'star-level-body');section.append(target);host.append(section);
    }
    const surface=el('div',undefined,'writing-surface');target.append(surface);
    for(const {entry,index}of group.entries){
      renderBlock(surface,key==='stages'?`Stage ${index+1}`:`Paragraph ${index+1}`,()=>skill()[key][index],value=>{skill()[key][index]=value;},{
        connected:true,index,list:key,
        newLine:([before,after])=>{change(()=>{const items=skill()[key],entries=splitSkillParagraph(items[index],before,after);if(key==='stages')entries[1].name='Stage '+(index+2);items.splice(index,1,...entries);if(key==='stages')items.forEach((item,position)=>{if(/^Stage \d+$/.test(item.name||''))item.name='Stage '+(position+1);});},true);const next=$('skill-fields').querySelector('[data-list="'+key+'"][data-index="'+(index+1)+'"] .rich-text');if(next){next.focus();const caret=document.createRange();caret.selectNodeContents(next);caret.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(caret);}},
        stage:key==='stages',dupe:starMode,first:index===0,last:index===list.length-1,
        move:delta=>change(()=>{const items=skill()[key];[items[index],items[index+delta]]=[items[index+delta],items[index]];},true),
        duplicate:()=>change(()=>{skill()[key].splice(index+1,0,clone(skill()[key][index]));},true),
        remove:()=>change(()=>{skill()[key].splice(index,1);},true)
      });
    }
    if(starMode)target.append(button('Add paragraph',()=>change(()=>{
      skill()[key].splice(group.entries.at(-1).index+1,0,{text:'',style:{paddingTop:7}});
    },true)));
  }
}
function renderScaling(host) {
  const box = el('section', undefined, 'block');
  box.append(el('h3', 'Level scaling'));
  const row = el('div', undefined, 'scaling-row');
  const number = (key, value) => {
    if (value === '') change(() => { delete skill()[key]; });
    else if (key !== 'max_level' || Number.isInteger(value) && value >= 1) change(() => { skill()[key] = value; });
    renderValueOutputs();
  };
  row.append(inputField('Maximum skill level', skill().max_level ?? '', value => number('max_level', value), 'number'), inputField('Multiplier per level (0.1 = 10%)', skill().level_multiplier ?? '', value => number('level_multiplier', value), 'number'));
  box.append(row, el('p', 'Value = base × (1 + multiplier × (level − 1)). Blank multiplier uses 0.1.', 'help'));
  for (const [key, base] of Object.entries(skill().base_damage || {})) {
    const valueRow = el('div', undefined, 'value-row');
    const output = el('output');
    output.dataset.valueKey = key;
    valueRow.append(el('code', key), inputField('Base', base, value => {
      if (typeof value === 'number') change(() => { skill().base_damage[key] = value; });
      renderValueOutputs();
    }, 'number'), output, button('Insert', () => insertHTML(visualHTML(`<b><span data-dmg="${key}"></span></b>`))), button('Remove', () => change(() => { delete skill().base_damage[key]; }, true)));
    box.append(valueRow);
  }
  box.append(button('Add / insert dynamic value', openValueDialog));
  host.append(box);
}
function renderValueOutputs() {
  const data = skill();
  if (!data) return;
  const level = Math.min(Number($('preview-level').value) || 1, /^Dupes/i.test(selectedSkill) ? 16 : data.max_level || 10);
  for (const output of document.querySelectorAll('[data-value-key]')) output.textContent = `Level ${level}: ${(data.base_damage[output.dataset.valueKey] * (1 + (data.level_multiplier ?? 0.1) * (level - 1))).toFixed(1)}`;
}
function renderTiers(host) {
  if (!/^Dupes/i.test(selectedSkill) && !skill().star_tiers) return;
  if (!skill().star_tiers) {
    host.append(button('Add named star tiers', () => change(() => { skill().star_tiers = []; }, true)));
    return;
  }
  const heading = el('div', undefined, 'section-top');
  heading.append(el('h3', 'Named star tiers'), button('Add tier', () => change(() => { skill().star_tiers.push({name: 'New tier', stars: []}); }, true)));
  host.append(heading);
  skill().star_tiers.forEach((tier, tierIndex) => {
    const box = el('section', undefined, 'block');
    box.append(inputField('Tier name', tier.name, value => change(() => { skill().star_tiers[tierIndex].name = value; })), button('Remove tier', () => change(() => { skill().star_tiers.splice(tierIndex, 1); }, true)));
    (tier.stars || []).forEach((star, index) => {
      box.append(inputField('Star label', star.label, value => change(() => { skill().star_tiers[tierIndex].stars[index].label = value; })));
      renderBlock(box, `Tier ${tierIndex + 1}, star ${index + 1}`, () => skill().star_tiers[tierIndex].stars[index], value => { skill().star_tiers[tierIndex].stars[index] = value; });
      box.append(button('Remove star', () => change(() => { skill().star_tiers[tierIndex].stars.splice(index, 1); }, true)));
    });
    box.append(button('Add tier star', () => change(() => { (skill().star_tiers[tierIndex].stars ||= []).push({label: 'Star', text: ''}); }, true)));
    host.append(box);
  });
}
function renderEditor() {
  const panelStates=new Map([...$('skill-fields').querySelectorAll('details[data-panel]')].map(node=>[node.dataset.panel,node.open]));
  const data = current().data;
  if (!Object.hasOwn(data, selectedSkill)) selectedSkill = Object.keys(data)[0] || '';
  $('skill-select').replaceChildren();
  for (const [id, entry] of Object.entries(data)) {
    const option = el('option', id + (entry.name ? ' · ' + entry.name : ''));
    option.value = id;
    $('skill-select').append(option);
  }
  $('skill-select').value = selectedSkill;
  $('preview-level').max = /^Dupes/i.test(selectedSkill) ? 16 : skill()?.max_level || 10;
  $('preview-level-label').textContent = /^Dupes/i.test(selectedSkill) ? 'Star' : 'Level';
  $('preview-level').value = Math.min(Number($('preview-level').max), Math.max(1, Math.trunc(Number($('preview-level').value)) || 1));
  for (const id of ['duplicate-skill', 'rename-skill', 'delete-skill', 'copy-skill']) $(id).disabled = !skill();
  $('visual-panel').hidden = view !== 'visual';
  $('source-panel').hidden = view !== 'source';
  $('visual-tab').setAttribute('aria-selected', String(view === 'visual'));
  $('source-tab').setAttribute('aria-selected', String(view === 'source'));
  $('source').value = serializeDocument(data);
  sourceDirty = false;
  activeEditor = null;
  savedRange = null;
  const host = $('skill-fields');
  host.replaceChildren();
  if (skill()) {
    const fields = el('div', undefined, 'field-row');
    fields.append(inputField('Skill name', skill().name, value => change(() => { skill().name = value; })), inputField('Skill type', skill().type, value => change(() => { skill().type = value; })));
    host.append(fields);
    renderBlock(host, 'Description', () => ({text: skill().description || '', style: skill().description_style || {}}), value => {
      skill().description = value.text;
      if (Object.keys(value.style || {}).length || Object.hasOwn(skill(), 'description_style')) skill().description_style = value.style;
    });
    if (!/^Dupes/i.test(selectedSkill)) renderList(host, 'stages', 'Stages');
    renderList(host, 'additional', /^Dupes/i.test(selectedSkill) ? 'Star Levels' : 'Additional content');
    const settings=el('details',undefined,'skill-settings');settings.dataset.panel='settings';settings.append(el('summary','Level scaling & advanced settings'));
    const settingsBody=el('div',undefined,'skill-settings-body');renderScaling(settingsBody);renderTiers(settingsBody);settings.append(settingsBody);host.append(settings);
  } else host.append(el('p', 'Add a skill or paste a character JSON document to begin.'));
  for(const node of host.querySelectorAll('details[data-panel]'))if(panelStates.has(node.dataset.panel))node.open=panelStates.get(node.dataset.panel);
  renderValueOutputs();
  refreshState();
}

function openValueDialog() {
  if (!skill()) return;
  rememberSelection();
  $('value-keys').replaceChildren(...Object.keys(skill().base_damage || {}).map(key => { const option = el('option'); option.value = key; return option; }));
  $('value-dialog').showModal();
}
$('value-key').addEventListener('input', () => {
  const base = skill()?.base_damage?.[$('value-key').value];
  if (base !== undefined) $('value-base').value = base;
});
$('value-form').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('value-key').value.trim(), base = Number($('value-base').value);
  change(() => { (skill().base_damage ||= {})[key] = base; });
  $('value-dialog').close();
  if (activeEditor?.isConnected) insertHTML(visualHTML(`<b><span data-dmg="${key}"></span>${$('value-percent').checked ? '%' : ''}</b>`));
  else renderEditor();
});
$('value-cancel').onclick = () => $('value-dialog').close();
function openSkillDialog(action) {
  if (!applySource()) return;
  skillAction = action;
  $('skill-dialog-title').textContent = action === 'rename' ? 'Change skill ID' : action === 'duplicate' ? 'Duplicate skill' : 'Add skill';
  $('new-id').value = action === 'rename' ? selectedSkill : '';
  $('skill-error').textContent = '';
  $('skill-dialog').showModal();
}
$('skill-form').addEventListener('submit', event => {
  event.preventDefault();
  const raw = $('new-id').value.trim();
  const id = /^dupes$/i.test(raw) ? 'Dupes' : raw.toUpperCase();
  if (Object.hasOwn(current().data, id) && (skillAction !== 'rename' || id !== selectedSkill)) { $('skill-error').textContent = 'That skill ID already exists.'; return; }
  const previous = selectedSkill;
  change(data => {
    if (skillAction === 'rename') {
      current().data = Object.fromEntries(Object.entries(data).map(([key, value]) => [key === previous ? id : key, value]));
    } else data[id] = skillAction === 'duplicate' ? clone(data[previous]) : id === 'Dupes' ? {description: '', additional: []} : {name: '', type: /^B/.test(id) ? 'Basic Skill' : /^S/.test(id) ? 'Special Skill' : /^U/.test(id) ? 'Ultimate Skill' : 'Technical Skill', description: '', description_style: {paddingTop: 7}, additional: []};
    selectedSkill = id;
  }, true);
  $('skill-dialog').close();
});
$('skill-cancel').onclick = () => $('skill-dialog').close();
$('new-skill').onclick = () => openSkillDialog('new');
$('duplicate-skill').onclick = () => openSkillDialog('duplicate');
$('rename-skill').onclick = () => openSkillDialog('rename');
$('delete-skill').onclick = () => { if (applySource() && confirm(`Remove ${selectedSkill}? You can undo this change.`)) change(data => { delete data[selectedSkill]; }, true); };
$('skill-select').onchange = event => {
  const next = event.target.value;
  if (!applySource()) { event.target.value = selectedSkill; return; }
  selectedSkill = next;
  if (/^Dupes/i.test(next)) $('preview-level').value = 16;
  const variant = next.match(/-(\d+)$/);
  if (variant && roster[currentId]?.skill_variants?.[Number(variant[1]) - 1]) $('variant-select').value = Number(variant[1]) - 1;
  renderEditor();
};
$('visual-tab').onclick = () => { if (applySource()) { view = 'visual'; renderEditor(); } };
$('source-tab').onclick = () => { if (view === 'source') return; if (applySource()) { view = 'source'; renderEditor(); } };
$('source').oninput = () => { sourceDirty = true; $('change-state').textContent = 'JSON changes awaiting Apply'; updateSaveButton(); };
$('apply-source').onclick = applySource;
$('undo').onclick = () => history('undo');
$('redo').onclick = () => history('redo');
$('character-search').oninput = renderCharacters;
$('preview-level').oninput = () => { updatePreview(); renderValueOutputs(); };
$('preview-max').onclick = () => { $('preview-level').value = /^Dupes/i.test(selectedSkill) ? 16 : skill()?.max_level || 10; updatePreview(); renderValueOutputs(); };
$('variant-select').onchange = ()=>{for(const field of $('skill-fields').querySelectorAll('[data-editor-token]')){if(field.textContent===field.dataset.editorDisplay){field.textContent=tokenDisplayText(field.dataset.editorToken,roster,currentId,$('variant-select').value||0);field.dataset.editorDisplay=field.textContent;}}updatePreview();};
for (const node of document.querySelectorAll('[data-command]')) {
  node.addEventListener('mousedown', event => event.preventDefault());
  node.onclick = () => { if (restoreSelection()) { document.execCommand(node.dataset.command); activeEditor.dispatchEvent(new Event('input', {bubbles: true})); } };
}
for(const kind of ['effect','token','style']){
  $('open-'+kind+'-menu').onclick=()=>{rememberSelection();$(kind+'-menu').showModal();};
  $(kind+'-menu').addEventListener('click',event=>{if(event.target===$(kind+'-menu'))$(kind+'-menu').close();});
}
function closeInsertMenu(kind){$(kind+'-menu').close();}
$('text-class').onchange = () => { if ($('text-class').value) {closeInsertMenu('style');wrapSelection($('text-class').value);} $('text-class').value = ''; };
$('apply-color').onclick = () => {closeInsertMenu('style');wrapSelection('', $('text-color').value);};
$('token-character').onchange = () => {
  const variants = roster[$('token-character').value]?.skill_variants || [];
  $('token-variant-control').hidden = !variants.length;
  $('token-variant').replaceChildren();
  const base = el('option', 'Character');
  base.value = '';
  $('token-variant').append(base);
  variants.forEach((variant, index) => {
    const option = el('option', variant.name || variant.nickname || String(index));
    option.value = index;
    $('token-variant').append(option);
  });
};
$('insert-token').onclick = () => {
  closeInsertMenu('token');
  const person = $('token-character').value;
  const variant = person && !$('token-variant-control').hidden ? $('token-variant').value : '';
  const raw='{{' + $('token').value + (person ? ':' + person + (variant !== '' ? ':' + variant : '') : '') + '}}';
  insertHTML(visualHTML(raw));
};
$('effect-inline').onclick = () => {
  closeInsertMenu('effect');
  const id = $('effect-select').value, effect = effects[id];
  if (!effect) return;
  const bold = el('b', '[' + effect.name + ']');
  bold.className = effect.class || '';
  insertHTML(bold.outerHTML);
};
$('effect-block').onclick = () => {closeInsertMenu('effect');insertHTML('{{effect:' + $('effect-select').value + '}}');};
$('insert-value').onclick = openValueDialog;

async function copyJSON(selected = false) {
  if (!applySource()) return;
  const text = serializeDocument(selected ? {[selectedSkill]: skill()} : current().data);
  try { await navigator.clipboard.writeText(text); status(selected ? 'Skill JSON copied with its ID.' : 'Character JSON copied.'); }
  catch { view = 'source'; renderEditor(); $('source').focus(); $('source').select(); status('Clipboard unavailable. Copy the selected character JSON.'); }
}
$('copy-character').onclick = () => copyJSON();
$('copy-skill').onclick = () => copyJSON(true);
$('download').onclick = () => {
  if (!applySource()) return;
  const url = URL.createObjectURL(new Blob([serializeDocument(current().data)], {type: 'application/json'}));
  const anchor = el('a');
  anchor.href = url;
  anchor.download = sourceId + '.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('JSON downloaded.');
};
$('paste-json').onclick = () => {
  if (!applySource()) return;
  $('json-input').value = '';
  $('json-error').textContent = '';
  $('json-dialog').showModal();
};
$('json-confirm').onclick = () => {
  try {
    const parsed = JSON.parse($('json-input').value);
    const single = isObject(parsed) && ['description', 'name', 'type', 'additional', 'stages', 'base_damage'].some(key => Object.hasOwn(parsed, key));
    if (single && !selectedSkill) throw Error('Add or select a skill before pasting an unkeyed skill object.');
    const data = colorSkillDocument(validateDocument(single ? {[selectedSkill]: parsed} : parsed), colorHTML);
    change(document => { for (const [id, entry] of Object.entries(data)) Object.defineProperty(document, id, {value: entry, writable: true, enumerable: true, configurable: true}); }, true);
    $('json-dialog').close();
    status('Pasted skills applied. Matching skill IDs were replaced. Undo is available.');
  } catch (error) { $('json-error').textContent = error.message; }
};
$('import').onclick = () => { if (applySource()) $('import-file').click(); };
$('import-file').onchange = async event => {
  const file = event.target.files[0], targetId = sourceId;
  if (!file) return;
  try {
    const data = colorSkillDocument(parseDocument(await file.text()), colorHTML);
    if (targetId !== sourceId) { status('Import cancelled because the selected character changed.'); return; }
    change(() => { current().data = data; }, true);
    status('Character JSON imported. Undo is available.');
  } catch (error) { status(error.message, true); }
  event.target.value = '';
};
$('open-folder').onclick = async () => {
  if (!window.showDirectoryPicker) { status('Folder saving is available in Chrome or Edge on localhost or HTTPS. Copy or download JSON in this browser.'); return; }
  try {
    const chosen = await window.showDirectoryPicker({mode: 'readwrite'});
    let charactersFolder;
    if (chosen.name === 'Characters') charactersFolder = chosen;
    else {
      try { charactersFolder = await (await (await chosen.getDirectoryHandle('images')).getDirectoryHandle('mlg-assets')).getDirectoryHandle('Characters'); }
      catch { throw Error('Choose the Characters folder, or the Mystical-Universe repository folder.'); }
    }
    directory = charactersFolder;
    updateSaveButton();
    $('open-folder').textContent = 'Change folder';
    try {
      await folderStore(directory);
      status('Folder remembered. Use Save JSON for future changes.');
    } catch {
      status('Folder connected for this visit. Browser storage could not remember it for future visits.', true);
    }
  } catch (error) { if (error.name !== 'AbortError') status(error.message, true); }
};
$('save-file').onclick = async () => {
  if (saving || !directory || !applySource()) return;
  const entry = current(), id = sourceId, targetDirectory = directory, text = serializeDocument(entry.data), snapshot = JSON.stringify(entry.data);
  if (snapshot === entry.saved) { updateSaveButton(); return; }
  saving = true;
  updateSaveButton();
  try {
    await ensureFolderPermission(targetDirectory);
    await writeCharacterFile(targetDirectory, id, text);
    entry.saved = snapshot;
    if (sourceId === id) { remember(); refreshState(); status('Saved ' + id.toUpperCase() + '/' + id + '.json.'); }
  } catch (error) { status('Could not save: ' + error.message, true); }
  finally { saving = false; updateSaveButton(); }
};
window.addEventListener('beforeunload', event => {
  if (sourceDirty || storageFailed) { event.preventDefault(); event.returnValue = ''; }
});
async function start() {
  try {
    const rememberedFolder = folderStore().catch(() => null);
    const cssRequest = fetch('/assets/css/mlg.css').then(response => response.text());
    [roster, effects] = await Promise.all([json('/images/mlg-assets/data-character.json'), json('/images/mlg-assets/data-effects.json')]);
    for (const [id, character] of Object.entries(roster)) {
      if (!/^c\d+[a-z]?$/i.test(id)) continue;
      const option = el('option', character.name || id);
      option.value = id;
      $('token-character').append(option);
    }
    for (const [id, effect] of Object.entries(effects).sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)))) {
      const option = el('option', effect.name || id);
      option.value = id;
      $('effect-select').append(option);
    }
    const css = await cssRequest;
    colorHTML = createBracketColorizer(css, effects);
    bracketNames = bracketClassMap(css, effects).names;
    const classes = bracketClassMap(css, effects).classes;
    for (const effect of Object.values(effects)) if (effect.class) classes.add(effect.class);
    classes.add('undim');
    for (const name of [...classes].sort()) {
      const option = el('option', name);
      option.value = name;
      $('text-class').append(option);
    }
    directory = await rememberedFolder;
    renderCharacters();
    const requested = new URLSearchParams(location.search).get('char') || 'c1';
    await selectCharacter(Object.hasOwn(roster, requested) ? requested : 'c1');
  } catch (error) { status(error.message, true); }
}
start();

// Shared menu behavior avoids repeated dismissal handlers on every paragraph.
document.addEventListener('toggle',event=>{
 const menu=event.target;
 if(!menu.matches?.('.action-menu')||!menu.open)return;
 document.querySelectorAll('.action-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});
},true);
document.addEventListener('click',event=>{
 document.querySelectorAll('.action-menu[open]').forEach(menu=>{if(!menu.contains(event.target)||event.target.closest('button'))menu.open=false;});
});
const header=document.querySelector('.app-header');
new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',header.offsetHeight+'px')).observe(header);
