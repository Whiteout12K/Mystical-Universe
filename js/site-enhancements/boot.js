import {flagsReady,el,link,readyWhen} from './core.js';
const flags=await flagsReady;
const stylesheet=el('link',{rel:'stylesheet',href:'/css/site-enhancements.css'});document.head.append(stylesheet);
if(flags.visualConsistency)document.documentElement.classList.add('ml-visual-consistency');
if(flags.mobileNavigation)import('./mobile.js').then(m=>m.init()).catch(console.error);
if(flags.characterConnections)import('./connections.js').then(m=>m.init(flags)).catch(console.error);
if(flags.readingContinuity)import('./reading.js').then(m=>m.init()).catch(console.error);
function populateExplore(menu){
 const wiki=menu.classList.contains('wiki-nav-tree');
 function entry(label,href,action){
  const row=el('li'),item=link(label,href);if(!wiki)item.className='dropdown-item';
  if(action)item.addEventListener('click',async event=>{
   event.preventDefault();
   const trigger=menu.closest('.nav-item')?.querySelector('.nav-explore,.wiki-nav-toggle');
   if(trigger?.getAttribute('aria-expanded')==='true')trigger.click();
   trigger?.focus();await action();
  });
  row.append(item);menu.append(row);
 }
 if(flags.unifiedSearch)entry('Search','/webpages/search.html',async()=>{const {openSearch}=await import('./search.js');openSearch();});
 if(flags.effectsGlossary)entry('Game Codex','/webpages/game-codex.html');
 if(flags.characterComparison)entry('Compare','/webpages/compare.html');
}
readyWhen('#site-explore-menu',populateExplore);
readyWhen('#wiki-nav-panel-0 > .wiki-nav-tree',populateExplore);

if(flags.unifiedSearch)document.addEventListener('keydown',async event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();const {openSearch}=await import('./search.js');openSearch();}});
