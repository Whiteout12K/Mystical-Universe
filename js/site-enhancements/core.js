export const flagsReady=fetch('/data/site-features.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Feature settings unavailable');return r.json();}).catch(()=>({}));
export const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function el(tag,attrs={},text){const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='class')node.className=value;else node.setAttribute(key,value);}if(text!==undefined)node.textContent=text;return node;}
export const link=(text,href)=>el('a',{href},text);
export async function json(path){const response=await fetch(path);if(!response.ok)throw Error('Unable to load '+path);return response.json();}
export function status(host,message){host.replaceChildren(el('p',{role:'status'},message));}
export function saved(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function readyWhen(selector,callback){const node=document.querySelector(selector);if(node){callback(node);return;}const observer=new MutationObserver(()=>{const found=document.querySelector(selector);if(found){observer.disconnect();callback(found);}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),30000);}
export function formURL(id){return id==='c1b'?'/webpages/game-c.html?char=c1#b':'/webpages/game-c.html?char='+encodeURIComponent(id);}
export function resolveCharacter(roster,id){const own=roster[id];if(!own)return null;const base=roster[own.base_character]||{};const shared=Object.fromEntries(Object.entries(base).filter(([key])=>!/^costume_\d+$/.test(key)));return {...shared,...own,skills:Array.isArray(own.skills)?own.skills:[...(base.skills||[]).map(key=>own.skill_overrides?.[key]||key),...(own.additional_skills||[])]};}
export function skillURL(roster,id,skill){const source=roster[id]?.base_character||id;return '/ml-game/apps/skill.html?'+new URLSearchParams({char:source,form:id,skill,id:skill.toLowerCase().startsWith('dupes')?'5':'1'});}
// Only retain the formatting used by local effect definitions; no executable markup.
export function rich(html){const template=document.createElement('template');template.innerHTML=String(html||'');for(const node of [...template.content.querySelectorAll('*')]){if(!['B','STRONG','I','EM','U','SPAN','BR','P'].includes(node.tagName)){node.replaceWith(document.createTextNode(node.textContent));continue;}for(const attr of [...node.attributes])if(attr.name!=='class')node.removeAttribute(attr.name);}return template.content;}
