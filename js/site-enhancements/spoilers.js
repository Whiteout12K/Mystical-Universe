import {el,saved,save,readyWhen} from './core.js';
const key='ml-spoiler-progress';let initialized=false,dialog;
function preference(){const value=saved(key,'hide');return value==='all'||value==='hide'||/^book:[1-9]\d*$/.test(value)?value:'hide';}
export function shouldReveal(value,book){return value==='all'||(/^book:\d+$/.test(value)&&Number.isInteger(book)&&book>0&&book<=Number(value.slice(5)));}
function apply(node){const book=Number(node.dataset.spoilerBook)||null;node.open=shouldReveal(preference(),book);}
function applyAll(){document.querySelectorAll('.wiki-spoiler').forEach(apply);}
export function init(){if(initialized)return;initialized=true;const seen=new WeakSet();const scan=()=>{document.querySelectorAll('.wiki-spoiler').forEach(node=>{if(!seen.has(node)){seen.add(node);apply(node);}});};scan();const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('storage',event=>{if(event.key===key)applyAll();});}
export function openSettings(){
 if(!dialog){dialog=el('dialog',{class:'ml-dialog','aria-labelledby':'ml-spoiler-title'});const header=el('div',{class:'ml-dialog-header'}),close=el('button',{type:'button'},'Close');close.onclick=()=>dialog.close();header.append(el('h2',{id:'ml-spoiler-title'},'Spoiler preferences'),close);
 const explanation=el('p',{},'Choose how far you have read. Marked spoilers through that book open automatically. You can still reveal individual entries yourself.');
 const select=el('select',{id:'ml-spoiler-level'});for(const [value,title]of [['hide','Hide all spoilers'],['book:1','Finished Book 1'],['book:2','Finished Book 2'],['book:3','Finished Book 3'],['all','Show all spoilers']])select.append(el('option',{value},title));
 const note=el('p',{class:'ml-muted'},'Entries without a known book level stay hidden until you choose “Show all spoilers.” Your preference is saved on this browser.');const message=el('p',{role:'status'});
 select.onchange=()=>{const persisted=save(key,select.value);applyAll();message.textContent=persisted?'Preference saved.':'This browser cannot save preferences. Storage may be blocked.';if(!persisted){const value=select.value;document.querySelectorAll('.wiki-spoiler').forEach(node=>{node.open=shouldReveal(value,Number(node.dataset.spoilerBook)||null);});}};
 dialog.append(header,explanation,el('label',{for:select.id},'Reading progress'),select,note,message);document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});}
 dialog.querySelector('select').value=preference();dialog.showModal();dialog.querySelector('select').focus();
}
