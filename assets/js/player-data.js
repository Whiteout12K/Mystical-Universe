// Main-site adapter. JScratch itself depends only on its own runtime.
import '../../JScratch/js/player-store.js';
import {createInitialData, registrationError} from '../../data/player-registration.mjs';

const store = globalThis.PlayerStore;
let cloudRequest;
export function readCloudSave() {
    if (!cloudRequest) {
        cloudRequest = (async () => {
            try {
                const response = await fetch('/api/save', {cache: 'no-store', signal: AbortSignal.timeout(2500)});
                if (response.ok) return await response.json();
            } catch {}
            return null;
        })().finally(() => { cloudRequest = null; });
    }
    return cloudRequest;
}

function requestUnavailable(response) {
    return !response || response.status >= 500 || [404, 405].includes(response.status);
}

async function postCredentials(path, username, password) {
    try {
        return await fetch(path, {method: 'POST', cache: 'no-store',
            signal: AbortSignal.timeout(5000), headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})});
    } catch {
        return null;
    }
}

export async function registerPlayer(username, password) {
    username = username.trim();
    password = password.trim();
    const error = registrationError(username, password);
    if (error) throw new Error(error);
    const pending = store.isOfflineRegistration(username);
    if (pending) await store.verifyOfflineCredentials(username, password, true);
    const response = await postCredentials('/api/create-user', username, password);
    if (requestUnavailable(response)) {
        if (pending) throw new Error('D1 is unavailable. Your offline account is still available.');
        await store.createOfflineAccount(username, password, createInitialData());
        return {connected: false};
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.error || 'Account registration could not be confirmed.');
    try {
        await signInPlayer(username, password, {requireD1: true});
    } catch {
        throw new Error('Your D1 account was created. Open Account and sign in when the connection is ready.');
    }
    return {connected: true};
}

export async function signInPlayer(username, password, {requireD1 = false} = {}) {
    username = username.trim();
    password = password.trim();
    if (!username || !password) throw new Error('Username and password are required.');
    // Finish any pre-login session read before requesting the new session.
    await cloudRequest;
    const response = await postCredentials('/api/login', username, password);
    if (response?.ok) {
        const snapshot = await readCloudSave();
        if (!snapshot?.authenticated || snapshot.username !== username) {
            throw new Error('D1 accepted the login but the player profile could not load. Try signing in again.');
        }
        return store.rememberCloudLogin(snapshot, password);
    }
    if (!requireD1 && response?.status === 401 && store.isOfflineRegistration(username)) {
        return store.signInOffline(username, password, true);
    }
    if (!requestUnavailable(response)) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Sign-in was rejected.');
    }
    if (requireD1) throw new Error("D1 is unavailable.");
    return store.signInOffline(username, password);
}

export async function signOutPlayer() {
    store.signOutLocal();
    try { await fetch('/api/logout', {method: 'POST', signal: AbortSignal.timeout(2500)}); } catch {}
}

export async function loadPlayerSession() {
    if (store.isSignedOut()) return null;
    const snapshot = await readCloudSave();
    if (store.isSignedOut()) return null;
    const online = store.activateCloud(snapshot);
    const player = online?.account ?? store.localAccount();
    return player ? {...player, authenticated: true, connected: Boolean(online),
        offlineRegistration: store.isOfflineRegistration(player.username),
        userId: online ? snapshot.userId : undefined, data: (online?.saved ?? store.record(player))?.data ?? {}} : null;
}

export async function loadPlayerProfile(username) {
    const cached = typeof window !== "undefined" && store.localAccount();
    const session = cached?.username === username || store.isLocal() ? await loadPlayerSession() : null;
    if (session?.username === username && (!session.connected || store.isLocal())) {
        const {loadAccountPreferences} = await import('./account-preferences.js');
        const {preferences} = await loadAccountPreferences();
        return {username, data: {...session.data, avatar: preferences?.avatar ?? session.data.avatar,
            bg: preferences?.background ?? session.data.bg}};
    }
    const response = await fetch('/api/user/' + encodeURIComponent(username), {cache: 'no-store'});
    return response.ok ? response.json() : null;
}
