import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bracketClassMap, colorSkillDocument, resolveBracketClass} from '../assets/js/skill-editor-colors.js';
const css = readFileSync(new URL('../assets/css/mlg.css', import.meta.url), 'utf8');
const effects = JSON.parse(readFileSync(new URL('../images/mlg-assets/data-effects.json', import.meta.url), 'utf8'));
test('bracket names resolve CSS classes and effect aliases, including curly apostrophes and tiers', () => {
  const {names} = bracketClassMap(css, effects);
  for (const [name, expected] of [['water','water'],['empowered','empowered'],['mystical legends','mystical-legends'],['goddess blessing','goddess-blessing'],['attack down ii','attack-down'],['freeze','freeze']]) assert.equal(names.get(name), expected, name);
  assert.equal(names.get('not an effect'), undefined);
  assert.equal(names.get('rarity ssr'), undefined);
});
test('automatic colors affect skill content without changing IDs, scaling, tokens or unknown metadata', () => {
  const input = {B1:{name:'[Water]',description:'[Water] {{nickname}}',additional:['[Freeze]',{level:16,text:'{{effect:freeze}} [Freeze]',style:{fontSize:7}}],base_damage:{dmg1:100},custom:'[Water]'}};
  const output = colorSkillDocument(input, text => text.replaceAll('[Water]', '<b class="water">[Water]</b>').replaceAll('[Freeze]', '<b class="freeze">[Freeze]</b>'));
  assert.equal(output.B1.name, '[Water]');
  assert.equal(output.B1.custom, '[Water]');
  assert.match(output.B1.description, /class="water"/);
  assert.match(output.B1.additional[0], /class="freeze"/);
  assert.equal(output.B1.additional[1].level, 16);
  assert.equal(output.B1.additional[1].style.fontSize, 7);
  assert.equal(output.B1.base_damage.dmg1, 100);
  assert.match(output.B1.additional[1].text, /\{\{effect:freeze\}\}/);
  assert.equal(input.B1.description, '[Water] {{nickname}}');
});

test('all bracket terms resolve lowercase hyphenated classes, including element labels and future CSS names', () => {
  const {names} = bracketClassMap(css, effects);
  assert.equal(resolveBracketClass('Lightning Element', names), 'lightning-element');
  assert.equal(resolveBracketClass('Water Element', names), 'water-element');
  assert.equal(resolveBracketClass('New Special Effect', names), 'new-special-effect');
  assert.equal(resolveBracketClass('  Multi   Word Label  ', names), 'multi-word-label');
  assert.equal(resolveBracketClass('Attack Down II', names), 'attack-down');
});
