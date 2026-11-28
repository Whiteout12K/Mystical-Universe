import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenizeCharacterText,editableTokenPattern} from '../assets/js/skill-editor-tokens.js';
const avery={name:'Avery Obtainia',nickname:'Avery',gender:'male'};
test('pasted names become nickname tokens without replacing partial names or protected text',()=>{
 assert.equal(tokenizeCharacterText('Avery Obtainia and Avery gain power. Averyson remains.',avery),'{{nickname}} and {{nickname}} gain power. Averyson remains.');
 assert.equal(tokenizeCharacterText('{{nickname:c2}} [Avery] https://example.org/Avery/he',avery),'{{nickname:c2}} [Avery] https://example.org/Avery/he');
 assert.equal(tokenizeCharacterText("Avery’s shield is ready.",avery),'{{nickname}}’s shield is ready.');
});
test('gendered pronouns become role tokens while neutral and plural pronouns stay literal',()=>{
 assert.equal(tokenizeCharacterText('He heals him with his skill. She heals herself; the shield is hers.',avery),'{{Subject}} heals {{object}} with {{possessive}} skill. {{Subject}} heals {{reflexive}}; the shield is {{possessive_pronoun}}.');
 const neutral='They heal them with their skills. Theirs, themselves, themself, it, its, itself, you and your.';
 assert.equal(tokenizeCharacterText(neutral,avery),neutral);
 assert.equal(tokenizeCharacterText("He's ready. She’ll heal her allies.",avery),'{{Subject}} is ready. {{Subject}} will heal {{possessive}} allies.');
});
test('her and his are distinguished by grammatical context',()=>{
 assert.equal(tokenizeCharacterText('Heal her. Increase her attack. Give her a shield. This is his.',avery),'Heal {{object}}. Increase {{possessive}} attack. Give {{object}} a shield. This is {{possessive_pronoun}}.');
 assert.equal(tokenizeCharacterText('Gives her [Shield]. Her own defense increases.',avery),'Gives {{object}} [Shield]. {{Possessive}} own defense increases.');
});
test('token fields recognize current and cross-character pronouns without capturing effects',()=>{
 assert.deepEqual([...('{{nickname}} {{Subject:c11:2}} {{possessive_pronoun}} {{effect:shield}}').matchAll(editableTokenPattern)].map(m=>m[1]),['nickname','Subject:c11:2','possessive_pronoun']);
});

test('visual token fields show names and pronouns while cross-character and variant references remain distinct',async()=>{
 const {tokenDisplayText}=await import('../assets/js/skill-editor-tokens.js');
 const roster={c1:{nickname:'Avery',gender:'male'},c5:{nickname:'River',gender:'female'},c11:{nickname:'Subordinates',gender:'neutral',skill_variants:[{nickname:'Tony',gender:'male'},{nickname:'Ellie',gender:'female'}]}};
 assert.equal(tokenDisplayText('nickname',roster,'c1'),'Avery');
 assert.equal(tokenDisplayText('Subject',roster,'c1'),'He');
 assert.equal(tokenDisplayText('possessive',roster,'c5'),'her');
 assert.equal(tokenDisplayText('nickname:c5',roster,'c1'),'River');
 assert.equal(tokenDisplayText('reflexive:c11:1',roster,'c1'),'herself');
 assert.equal(tokenDisplayText('nickname',roster,'c11',1),'Ellie');
 assert.equal(tokenDisplayText('Subject:c11',roster,'c1'),'They');
});
