import {loadPlayerSession} from '../player-data.js';
const cookieKey = id => 'ml_build_' + id;
let queue = Promise.resolve();
export async function loadCharacterBuild(id) {
  const account = await loadPlayerSession();
  if (account) return globalThis.PlayerStore.record(account)?.data?.character_builds?.[id] || {};
  try {
    const value = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(cookieKey(id) + '='));
    return value ? JSON.parse(decodeURIComponent(value.slice(value.indexOf('=') + 1))) : {};
  } catch { return {}; }
}
export function saveCharacterBuild(id, changes) {
  const task = queue.catch(() => {}).then(async () => {
    if (!/^c\d+$/.test(id)) throw new Error('Invalid character.');
    const account = await loadPlayerSession(), store = globalThis.PlayerStore;
    if (!account) {
      const value = {...await loadCharacterBuild(id), ...changes};
      const encoded = encodeURIComponent(JSON.stringify(value));
      if (encoded.length > 3800) throw new Error('Build is too large for a cookie.');
      document.cookie = cookieKey(id) + '=' + encoded + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
      if (!document.cookie.split(';').some(s => s.trim() === cookieKey(id) + '=' + encoded)) throw new Error('Cookies are disabled.');
      return 'Build saved in this browser’s cookie.';
    }
    if (store.localAccount()?.id !== account.id) throw new Error('Profile changed.');
    const before = store.record(account), data = before?.data || {};
    const sent = store.stage(account, {...data, character_builds: {...data.character_builds,
      [id]: {...data.character_builds?.[id], ...changes}}});
    if (!account.connected) return 'Build saved to your offline profile.';
    try {
      const response = await fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:account.userId,revision:sent.revision,data:sent.data}), signal:AbortSignal.timeout(5000)});
      const result = await response.json();
      if (response.ok && result.success) {
        store.markUploaded(account,sent,result.revision,account.userId);
        return 'Build saved to your D1 profile.';
      }
    } catch {}
    return 'Build saved offline; upload your browser save from Account to sync D1.';
  });
  queue = task;
  return task;
}
