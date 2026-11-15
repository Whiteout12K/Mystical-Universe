import {loadPlayerSession} from './player-data.js';

const store=globalThis.PlayerStore;
const preferenceKey=account=>'jscratch:player:v1:preferences:'+account.id;
const readLocal=account=>JSON.parse(localStorage.getItem(preferenceKey(account)))??{};
const storeLocal=(account,value)=>localStorage.setItem(preferenceKey(account),JSON.stringify(value));

async function localAccountPayload(account, edits) {
 if(!account)return {authenticated:false};
 const key=preferenceKey(account),before=localStorage.getItem(key);
 const saved=readLocal(account),data=store.record(account)?.data??{};
 const defaults={wiki_theme:'cookie',avatar:Number(data.avatar)||1,background:Number(data.bg)||1};
 let preferences={...defaults,...saved.preferences},pending={...saved.pending};
 if(edits){
  for(const [name,value] of Object.entries(edits))if(preferences[name]!==value)pending[name]=value;
  preferences={...preferences,...edits};
  storeLocal(account,{preferences,pending});
 }
 const expected=edits?localStorage.getItem(key):before;
 if(account.connected){
  if(store.localAccount()?.id===account.id&&store.localAccount()?.mode===account.mode){
   try{
    const changed=Object.keys(pending).length;
    const response=await fetch('/api/account',{
     cache:'no-store',signal:AbortSignal.timeout(2500),
     headers:{'X-Player-Account':String(account.userId),...(changed?{'Content-Type':'application/json'}:{})},
     ...(changed?{method:'POST',body:JSON.stringify(pending)}:{})
    });
    const result=await response.json();
    if(response.ok&&result.username===account.username&&localStorage.getItem(key)===expected){
     preferences=result.preferences;pending={};
     storeLocal(account,{preferences,pending});
    }
   }catch{}
  }
 }
 if(store.localAccount()?.id!==account.id)return {authenticated:false};
 const styles=await fetch('/images/mlg-assets/account-styles.json',{cache:'no-cache'}).then(r=>r.json());
 for(const [field,group] of [['avatar','avatar'],['background','background']]){
  if(!Object.hasOwn(styles[group],'img_'+preferences[field]))preferences[field]=1;
 }
 return {...account,authenticated:true,preferences,pendingPreferences:Boolean(Object.keys(pending).length),
  appearance:{avatar_url:styles.avatar['img_'+preferences.avatar],background_url:styles.background['img_'+preferences.background]}};
}

let sessionPromise,activeAccount={authenticated:false};
export function cookieWikiTheme(){return document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith('wiki_theme='))?.split('=')[1]==='light'?'light':'dark';}
export function effectiveWikiTheme(account=activeAccount){return account?.authenticated&&['light','dark'].includes(account.preferences?.wiki_theme)?account.preferences.wiki_theme:cookieWikiTheme();}
export function applyWikiTheme(account=activeAccount){const theme=effectiveWikiTheme(account);document.documentElement.dataset.wikiTheme=theme;document.dispatchEvent(new CustomEvent('ml-wiki-theme-change',{detail:{theme}}));return theme;}
function update(account){activeAccount=account;sessionPromise=Promise.resolve(account);applyWikiTheme(account);const image=document.getElementById('profileImage');if(image&&account.authenticated){image.src=account.appearance.avatar_url;image.alt=account.username+' profile';}document.dispatchEvent(new CustomEvent('ml-account-change',{detail:account}));return account;}
export function loadAccountPreferences({refresh=false}={}){
 if(sessionPromise&&!refresh)return sessionPromise;

 sessionPromise=loadPlayerSession().then(account=>localAccountPayload(account)).then(update).catch(error=>{sessionPromise=null;throw error;});return sessionPromise;
}
export async function saveAccountPreferences(preferences){
 const account=activeAccount;
 const session=await loadPlayerSession();
 if(!session||session.id!==account.id||session.mode!==account.mode||session.username!==account.username)throw new Error('The active profile changed. Reload Account before saving.');
 return update(await localAccountPayload(session,preferences));
}
export function currentAccount(){return activeAccount;}
