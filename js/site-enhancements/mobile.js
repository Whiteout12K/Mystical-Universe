import {readyWhen} from './core.js';
export function init(){document.documentElement.classList.add('ml-mobile-navigation');
 if(!/\/webpages\/game-c(?:\.html)?$/.test(location.pathname))return;
 readyWhen('#skills-view',section=>{
  const sidebar=document.getElementById('skillSidebar');if(!sidebar)return;
  const enhance=()=>{sidebar.setAttribute('role','group');sidebar.setAttribute('aria-label','Choose a skill');sidebar.querySelectorAll('.skill-btn').forEach(button=>{const label=button.title||button.querySelector('img')?.alt||'Skill';button.setAttribute('role','button');button.tabIndex=0;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(button.classList.contains('active')));});};enhance();
  sidebar.addEventListener('keydown',event=>{const current=event.target.closest('.skill-btn');if(!current)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();current.click();}if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const buttons=[...sidebar.querySelectorAll('.skill-btn')],index=buttons.indexOf(current),next=buttons[(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];next.focus();next.scrollIntoView({block:'nearest',inline:'nearest'});}});
  const observer=new MutationObserver(enhance);observer.observe(sidebar,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 });
}
