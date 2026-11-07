let sessionPromise,activeAccount={authenticated:false};
export function cookieWikiTheme(){return document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith('wiki_theme='))?.split('=')[1]==='light'?'light':'dark';}
export function effectiveWikiTheme(account=activeAccount){return account?.authenticated&&['light','dark'].includes(account.preferences?.wiki_theme)?account.preferences.wiki_theme:cookieWikiTheme();}
export function applyWikiTheme(account=activeAccount){const theme=effectiveWikiTheme(account);document.documentElement.dataset.wikiTheme=theme;document.dispatchEvent(new CustomEvent('ml-wiki-theme-change',{detail:{theme}}));return theme;}
function update(account){activeAccount=account;sessionPromise=Promise.resolve(account);applyWikiTheme(account);const image=document.getElementById('profileImage');if(image&&account.authenticated){image.src=account.appearance.avatar_url;image.alt=account.username+' profile';}document.dispatchEvent(new CustomEvent('ml-account-change',{detail:account}));return account;}
export function loadAccountPreferences({refresh=false}={}){
 if(sessionPromise&&!refresh)return sessionPromise;
 sessionPromise=fetch('/api/account',{credentials:'same-origin',cache:'no-store'}).then(async response=>{if(response.status===401)return update({authenticated:false});if(!response.ok)throw Error('Account settings could not load.');const account=await response.json();if(!account.authenticated||!account.preferences||!account.appearance)throw Error('Invalid account settings response.');return update(account);}).catch(error=>{sessionPromise=null;throw error;});return sessionPromise;
}
export async function saveAccountPreferences(preferences){
 const response=await fetch('/api/account',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(preferences)});const account=await response.json();if(response.status===401)update({authenticated:false});if(!response.ok)throw Error(account.error||'Account settings could not save.');return update(account);
}
export function currentAccount(){return activeAccount;}
