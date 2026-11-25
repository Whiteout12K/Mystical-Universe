import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseDocument, serializeDocument, skillWarnings} from '../assets/js/skill-editor-model.js';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
for (const id of ['c1', 'c2']) {
  test(`${id} editor JSON round trip preserves HTML, tokens, stages, styles and star group continuations`, () => {
    const original = JSON.parse(read(`images/mlg-assets/Characters/${id.toUpperCase()}/${id}.json`));
    assert.deepEqual(parseDocument(serializeDocument(original)), original);
    const effects = JSON.parse(read('images/mlg-assets/data-effects.json'));
    assert.deepEqual(skillWarnings(original, effects), []);
  });
}
test('editor preserves unknown fields, named tiers and string paragraphs', () => {
  const data = {Dupes: {description: '', additional: ['Intro', {level: 16, text: '{{effect:shield}}', paddingLeft: 15, custom: true}], star_tiers: [{name: 'Rainbow', stars: [{label: 'First', text: 'Text'}]}], future: {rule: 'keep'}}};
  assert.deepEqual(parseDocument(serializeDocument(data)), data);
});
test('invalid imports fail before replacing a character document', () => {
  for (const text of ['[]', 'null', '{', '{"B1":null}', '{"B1":{"stages":{}}}', '{"B1":{"base_damage":{"dmg1":"100"}}}', '{"Dupes":{"additional":[{"level":17,"text":"bad"}]}}']) assert.throws(() => parseDocument(text));
});
test('editor identifies unresolved dynamic values and effects', () => {
  const data = {B1: {description: '<b><span data-dmg="missing"></span></b>{{effect:unknown}}', base_damage: {known: 10}}};
  const warnings = skillWarnings(data, {});
  assert.equal(warnings.length, 2);
  assert(warnings.some(text => text.includes('missing')));
  assert(warnings.some(text => text.includes('unknown')));
});
test('preview accepts only the same-origin parent and renders successive drafts using the skill renderer', async () => {
  const source = read('webpages/apps/skill.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, {style: {}, innerHTML: '', textContent: ''}); return nodes.get(id); };
  const damage = {dataset: {dmg: 'dmg1'}, textContent: ''};
  let ready, message;
  const sent = [], requests = [];
  const parent = {postMessage: event => sent.push(event.type)};
  const window = {parent, addEventListener: (event, callback) => { if (event === 'message') message = callback; }};
  const context = {URLSearchParams, console, window, location: {search: '?editor=1&char=c1', origin: 'https://example.test'}, document: {addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') ready = callback; }, createElement: () => ({}), head: {append() {}}, getElementById: get, querySelectorAll: selector => selector === '[data-dmg]' ? [damage] : []}, fetch: async path => {
    requests.push(path);
    return {ok: true, json: async () => path.includes('data-character') ? {c1: {nickname: 'Avery', gender: 'male'}} : path.includes('site-features') ? {} : {}};
  }};
  runInNewContext(source, context);
  await ready();
  assert.equal(sent[0], 'ml-skill-preview-ready');
  assert(!requests.some(path => path.includes('/Characters/')));
  const data = {type: 'ml-skill-preview', skill: 'B1', level: 10, skills: {B1: {name: 'Draft', description: '{{nickname}} <span data-dmg="dmg1"></span>', base_damage: {dmg1: 100}, level_multiplier: 0}}};
  message({origin: 'https://other.test', source: parent, data});
  assert.equal(get('skill-content').innerHTML, '');
  message({origin: context.location.origin, source: parent, data});
  assert.match(get('skill-content').innerHTML, /Avery/);
  assert.equal(damage.textContent, '100.0');
  data.skills.B1.level_multiplier = 0.1;
  message({origin: context.location.origin, source: parent, data});
  assert.equal(damage.textContent, '190.0');
  data.skill = 'Dupes';
  data.skills.Dupes = {additional: [{level: 16, text: 'Last star'}]};
  message({origin: context.location.origin, source: parent, data});
  assert.match(get('skill-content').innerHTML, /Star-16.svg/);
  assert.match(get('skill-content').innerHTML, /Last star/);
  assert.equal(sent.at(-1), 'ml-skill-preview-rendered');
});
