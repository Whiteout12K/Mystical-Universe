/* Account preferences override the cookie for signed-in readers. */
(async () => {
  const account=await import('/assets/js/account-preferences.js');
  try{await account.loadAccountPreferences();}catch{}
  const toggle=document.createElement('button');toggle.type='button';toggle.className='wiki-theme-toggle';
  const message=document.createElement('span');message.className='wiki-theme-status';message.setAttribute('role','status');
  const apply=()=>{const light=document.documentElement.dataset.wikiTheme==='light';toggle.textContent=light?'Dark Mode':'Light Mode';toggle.setAttribute('aria-label',`Switch to ${light?'dark':'light'} mode`);};
  toggle.addEventListener('click',async()=>{
    const theme=document.documentElement.dataset.wikiTheme==='light'?'dark':'light';message.textContent='';toggle.disabled=true;
    try{
      const user=account.currentAccount();
      if(user.authenticated)await account.saveAccountPreferences({wiki_theme:theme});
      else{document.cookie=`wiki_theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;account.applyWikiTheme();}
    }catch(error){message.textContent=error.message||'Theme could not save. Try again.';}
    finally{toggle.disabled=false;apply();}
  });
  document.addEventListener('ml-wiki-theme-change',apply);apply();
  const anchor=document.querySelector('[data-wiki-back-to-top]');if(anchor){anchor.after(toggle);toggle.after(message);}
})();
