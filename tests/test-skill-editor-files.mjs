import test from 'node:test';
import assert from 'node:assert/strict';
import {folderStore, ensureFolderPermission, writeCharacterFile} from '../assets/js/skill-editor-files.js';

test('approved folder saves repeatedly without requesting permission again', async () => {
  let prompts = 0, state = 'prompt';
  const directory = {queryPermission: async () => state, requestPermission: async () => { prompts++; state = 'granted'; return state; }};
  await ensureFolderPermission(directory);
  await ensureFolderPermission(directory);
  await ensureFolderPermission(directory);
  assert.equal(prompts, 1);
});
test('permission denial is reported before attempting a write', async () => {
  await assert.rejects(ensureFolderPermission({queryPermission: async () => 'prompt', requestPermission: async () => 'denied'}), /remembered Characters folder/);
});
test('saving uses the character folder and closes the write, with no picker', async () => {
  const calls = [];
  const writer = {write: async text => calls.push(text), close: async () => calls.push('closed')};
  const directory = {getDirectoryHandle: async (name, options) => {
    assert.equal(name, 'C2'); assert.equal(options.create, true);
    return {getFileHandle: async name => { assert.equal(name, 'c2.json'); return {createWritable: async () => writer}; }};
  }};
  await writeCharacterFile(directory, 'c2', '{"B1":{}}');
  assert.deepEqual(calls, ['{"B1":{}}', 'closed']);
});
test('failed writes release the file lock', async () => {
  let aborted = false;
  const writer = {write: async () => { throw Error('Disk error'); }, abort: async () => { aborted = true; }};
  const directory = {getDirectoryHandle: async () => ({getFileHandle: async () => ({createWritable: async () => writer})})};
  await assert.rejects(writeCharacterFile(directory, 'c1', '{}'), /Disk error/);
  assert.equal(aborted, true);
});

test('folder handle persists and restores through separate database connections', async () => {
  const values = new Map(), previous = globalThis.indexedDB;
  let connections = 0;
  globalThis.indexedDB = {open(name) {
    assert.equal(name, 'mystical-skill-editor');
    connections++;
    const request = {};
    const db = {close() {}, transaction() {
      const transaction = {objectStore: () => ({
        put(value, key) { values.set(key, value); queueMicrotask(() => transaction.oncomplete()); return {result: key}; },
        get(key) { queueMicrotask(() => transaction.oncomplete()); return {result: values.get(key)}; }
      })};
      return transaction;
    }};
    queueMicrotask(() => { request.result = db; request.onsuccess(); });
    return request;
  }};
  try {
    const handle = {kind: 'directory', name: 'Characters'};
    await folderStore(handle);
    assert.equal(await folderStore(), handle);
    assert.equal(connections, 2);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test('Save JSON enables only for edits and disables during writes or after saving', async () => {
  const {readFileSync} = await import('node:fs');
  const {runInNewContext} = await import('node:vm');
  const {parseDocument} = await import('../assets/js/skill-editor-model.js');
  const source = readFileSync(new URL('../assets/js/skill-editor.js', import.meta.url), 'utf8');
  const button = {}, sourceInput = {value: '{"B1":{"description":"Original"}}'};
  const entry = {data: {B1: {description: 'Original'}}, saved: '{"B1":{"description":"Original"}}'};
  const state = {current: () => entry, directory: {}, sourceDirty: false, saving: false, $: id => id === 'source' ? sourceInput : button, parseDocument, colorSkillDocument: value => value, colorHTML: value => value};
  runInNewContext(source.slice(source.indexOf('function updateSaveButton()'), source.indexOf('function refreshState()')), state);
  state.updateSaveButton(); assert.equal(button.disabled, true);
  entry.data.B1.description = 'Edited';
  state.updateSaveButton(); assert.equal(button.disabled, false);
  state.saving = true;
  state.updateSaveButton(); assert.equal(button.disabled, true);
  entry.saved = JSON.stringify(entry.data); state.saving = false;
  state.updateSaveButton(); assert.equal(button.disabled, true);
  state.sourceDirty = true; sourceInput.value = '{"B1":{"description":"Source edit"}}';
  state.updateSaveButton(); assert.equal(button.disabled, false);
  state.directory = null;
  state.updateSaveButton(); assert.equal(button.disabled, true);
});
