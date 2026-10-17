import styles from '../images/mlg-assets/account-styles.json' with {type:'json'};

export function accountResponse(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Cookie'}});}
export function accountUsername(request){
 for(const cookie of (request.headers.get('Cookie')||'').split(';')){const [key,...parts]=cookie.trim().split('=');if(key==='username'){try{return decodeURIComponent(parts.join('='));}catch{return null;}}}return null;
}
export async function currentAccountUser(context){const username=accountUsername(context.request);if(!username)return null;return context.env.DB.prepare('SELECT id,username,save_data FROM users WHERE username=?').bind(username).first();}
export async function ensureAccountTable(env){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_account_preferences (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 wiki_theme TEXT NOT NULL DEFAULT 'cookie' CHECK(wiki_theme IN ('cookie','light','dark')),
 avatar INTEGER NOT NULL DEFAULT 1,
 background INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`).run();}
export function validStyle(group,id){return Number.isInteger(id)&&id>0&&Object.hasOwn(styles[group],`img_${id}`);}
export function defaultAccountPreferences(user){let saved={};try{saved=JSON.parse(user.save_data||'{}')||{};}catch{}return {wiki_theme:'cookie',avatar:validStyle('avatar',Number(saved.avatar))?Number(saved.avatar):1,background:validStyle('background',Number(saved.bg))?Number(saved.bg):1};}
export async function readAccountPreferences(env,user){await ensureAccountTable(env);const row=await env.DB.prepare('SELECT wiki_theme,avatar,background FROM user_account_preferences WHERE user_id=?').bind(user.id).first();if(!row)return defaultAccountPreferences(user);return {wiki_theme:['light','dark','cookie'].includes(row.wiki_theme)?row.wiki_theme:'cookie',avatar:validStyle('avatar',row.avatar)?row.avatar:1,background:validStyle('background',row.background)?row.background:1};}
export function publicAppearance(preferences){return {avatar_url:styles.avatar[`img_${preferences.avatar}`]||styles.avatar.img_1,background_url:styles.background[`img_${preferences.background}`]||''};}
export function accountPayload(user,preferences){return {authenticated:true,username:user.username,preferences,appearance:publicAppearance(preferences)};}
