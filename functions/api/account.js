import {accountResponse,currentAccountUser,readAccountPreferences,validStyle,accountPayload} from '../_account.js';

export async function onRequestGet(context){
 try{const user=await currentAccountUser(context);if(!user)return accountResponse({authenticated:false,error:'Sign in to manage your account.'},401);return accountResponse(accountPayload(user,await readAccountPreferences(context.env,user)));}
 catch(error){console.error('Account preferences could not load:',error);return accountResponse({error:'Account settings could not load. Try again.'},500);}
}
export async function onRequestPost(context){
 const origin=context.request.headers.get('Origin');if(origin&&origin!==new URL(context.request.url).origin)return accountResponse({error:'Account changes must be made from this website.'},403);
 if(!(context.request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return accountResponse({error:'Send account settings as JSON.'},415);
 try{
  const user=await currentAccountUser(context);if(!user)return accountResponse({authenticated:false,error:'Sign in to manage your account.'},401);
  let body;try{body=await context.request.json();}catch{return accountResponse({error:'Invalid settings JSON.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['wiki_theme','avatar','background'].includes(key)))return accountResponse({error:'Only wiki theme, profile image, and background settings can be changed here.'},400);
  if(!Object.keys(body).length||Object.hasOwn(body,'wiki_theme')&&!['cookie','light','dark'].includes(body.wiki_theme)||Object.hasOwn(body,'avatar')&&!validStyle('avatar',body.avatar)||Object.hasOwn(body,'background')&&!validStyle('background',body.background))return accountResponse({error:'Choose a valid theme, profile image, and background.'},400);
  const current=await readAccountPreferences(context.env,user),preferences={...current,...body};
  await context.env.DB.prepare(`INSERT INTO user_account_preferences (user_id,wiki_theme,avatar,background) VALUES (?,?,?,?)
   ON CONFLICT(user_id) DO UPDATE SET
   wiki_theme=CASE WHEN ? THEN excluded.wiki_theme ELSE user_account_preferences.wiki_theme END,
   avatar=CASE WHEN ? THEN excluded.avatar ELSE user_account_preferences.avatar END,
   background=CASE WHEN ? THEN excluded.background ELSE user_account_preferences.background END,
   updated_at=CURRENT_TIMESTAMP`).bind(user.id,preferences.wiki_theme,preferences.avatar,preferences.background,Number(Object.hasOwn(body,'wiki_theme')),Number(Object.hasOwn(body,'avatar')),Number(Object.hasOwn(body,'background'))).run();
  return accountResponse(accountPayload(user,await readAccountPreferences(context.env,user)));
 }catch(error){console.error('Account preferences could not save:',error);return accountResponse({error:'Account settings could not save. Try again.'},500);}
}
