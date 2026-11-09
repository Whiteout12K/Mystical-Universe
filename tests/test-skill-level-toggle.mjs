import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const skill=readFileSync(new URL('../webpages/apps/skill.html',import.meta.url),'utf8'),game=readFileSync(new URL('../webpages/game-c.html',import.meta.url),'utf8');
const setup=skill.slice(skill.indexOf('    const maxLevel=data.max_level||10;'),skill.indexOf('\n  }catch(error)',skill.indexOf('    const maxLevel=data.max_level||10;')));
test('embedded skill level API recalculates level-dependent values and announces readiness',()=>{
 const renders=[],events=[],window={},state={data:{max_level:10},level:1,effects:{},window,document:{dispatchEvent:event=>events.push(event.type)},Event:class{constructor(type){this.type=type;}},renderSkill:(_,level)=>renders.push(level)};
 runInNewContext(setup,state);assert.deepEqual(events,['ml-skill-level-ready']);window.setMLSkillLevel(10);window.setMLSkillLevel(1);assert.deepEqual(renders,[1,10,1]);assert.equal(state.level,1);assert.equal(events.at(-1),'ml-skill-level-change');
});
test('the shortcut button and its styling are created only by game-c',()=>{
 assert.doesNotMatch(skill,/<button[^>]*(?:skill-level-toggle|Max Level)/);assert.match(game,/function attachSkillLevelToggle\(iframe\)/);assert.match(game,/attachSkillLevelToggle\(iframe\);/);assert.match(game,/===10\?"Initial Level":"Max Level"/);
});
test('skill and character page inline scripts parse',()=>{
 for(const html of [skill,game])for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new Script(match[1]);
});
