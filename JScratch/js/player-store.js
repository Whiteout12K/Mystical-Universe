// Shared by the game and website Account. Browser records are origin-scoped.
const PlayerStore = (() => {
    const prefix = "jscratch:player:v1:";
    const activeKey = prefix + "active-local";
    const signedOutKey = prefix + "signed-out";
    const isLocal = () => /^(localhost|.*\.localhost|127(?:\.\d{1,3}){3}|\[::1\])$/.test(globalThis.location?.hostname ?? "");
    const profileKey = name => prefix + "profile:" + name;
    const saveKey = account => prefix + account.mode + ":save:" + account.id;
    const cache = new Map();
    function read(key) {
        const raw = localStorage.getItem(key);
        const cached = cache.get(key);
        if (cached?.raw === raw) return cached.value;
        const value = JSON.parse(raw);
        cache.set(key, {raw, value});
        return value;
    }
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const record = account => read(saveKey(account));
    const put = (account, value) => write(saveKey(account), value);
    const isData = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
    const maxSaveBytes = 1024 * 1024;

    function localAccount() {
        const username = localStorage.getItem(activeKey);
        const profile = username && read(profileKey(username));
        return profile ? {mode: profile.mode ?? "local", id: profile.id, username} : null;
    }

    async function passwordHash(password, salt) {
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const hash = await crypto.subtle.deriveBits(
            {name: "PBKDF2", salt: new Uint8Array(salt), iterations: 600000, hash: "SHA-256"}, key, 256);
        return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    }

    function activate(username) {
        localStorage.setItem(activeKey, username);
        localStorage.removeItem(signedOutKey);
        return localAccount();
    }

    async function credentials(password) {
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
        return {salt, hash: await passwordHash(password, salt)};
    }

    function isOfflineRegistration(username) {
        return read(profileKey(username))?.offlineRegistration === true;
    }

    async function verifyOfflineCredentials(username, password, pendingOnly = false) {
        const profile = read(profileKey(username));
        if (!profile?.hash || (pendingOnly && !profile.offlineRegistration) ||
            (profile.cloudId == null && !profile.offlineRegistration)) {
            throw new Error("This account has no offline sign-in on this browser.");
        }
        if (await passwordHash(password, profile.salt) !== profile.hash) {
            throw new Error("Incorrect username or password.");
        }
        return profile;
    }

    async function signInOffline(username, password, pendingOnly = false) {
        await verifyOfflineCredentials(username, password, pendingOnly);
        return activate(username);
    }

    async function createOfflineAccount(username, password, data) {
        const key = profileKey(username);
        if (read(key)) throw new Error("That username already exists in this browser.");
        const verifier = await credentials(password);
        if (read(key)) throw new Error("That username already exists in this browser.");
        const id = crypto.randomUUID();
        put({mode: "local", id, username}, {data, dirty: false});
        write(key, {...verifier, mode: "local", id, offlineRegistration: true});
        return activate(username);
    }

    async function rememberCloudLogin(snapshot, password) {
        // Hash only credentials accepted by D1. Reconnecting uses the server session cookie.
        const verifier = await credentials(password);
        return activateCloud(snapshot, verifier, true);
    }

    const cloudAccount = snapshot => ({
        mode: "cloud", id: snapshot.userId, username: snapshot.username
    });

    const linkKey = account => prefix + "cloud-link:" + account.id;
    const linkedId = account => account?.mode === "local" ? read(linkKey(account)) : null;
    const matchesCloud = (account, snapshot) => snapshot?.authenticated &&
        snapshot.username === account.username && snapshot.userId === (account.mode === "cloud" ? account.id : linkedId(account));

    function activateCloud(snapshot, verifier, explicit = false) {
        if (!snapshot?.authenticated || !snapshot.username || snapshot.userId == null ||
            !isData(snapshot.data) || typeof snapshot.revision !== "string" ||
            (!explicit && localStorage.getItem(signedOutKey))) return null;
        const active = localAccount();
        if (!explicit && active && active.username !== snapshot.username) return null;
        const key = profileKey(snapshot.username);
        const known = read(key);
        if (known?.offlineRegistration && !explicit) return null;
        const local = isLocal() || known?.offlineRegistration === true || known?.mode === "local" && known.cloudId != null;
        const existing = known && (known.mode ?? "local") === (local ? "local" : "cloud") &&
            (known.cloudId == null || known.cloudId === snapshot.userId) ? known : null;
        const account = {mode: local ? "local" : "cloud",
            id: local ? existing?.id ?? crypto.randomUUID() : snapshot.userId, username: snapshot.username};
        const oldLink = linkedId(account);
        const reusable = existing?.cloudId === snapshot.userId ? existing : null;
        if (local && oldLink != null && oldLink !== snapshot.userId) account.id = crypto.randomUUID();
        write(key, {...(reusable && account.id === existing.id ? reusable : {}), ...verifier,
            mode: account.mode, id: account.id, cloudId: snapshot.userId});
        if (local) write(linkKey(account), snapshot.userId);
        activate(account.username);
        return {account, saved: acceptCloud(snapshot, account)};
    }

    function signOutLocal() {
        localStorage.setItem(signedOutKey, "1");
        localStorage.removeItem(activeKey);
    }

    const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    function fieldPath(path) {
        if (typeof path !== "string" || path.length > 512) throw new Error("Enter a player data key path.");
        const keys = path.replace(/\[["']?([^"'[\]]+)["']?\]/g, ".$1").split(".").map(key => key.trim());
        if (keys.some(key => !key || /[\[\]]/.test(key) || ["__proto__", "prototype", "constructor"].includes(key))) {
            throw new Error("Enter a safe, nonempty data key path.");
        }
        return keys;
    }

    function addMissingField(data, path, value) {
        const keys = fieldPath(path);
        let current = data;
        for (const [index, key] of keys.entries()) {
            if (!current || typeof current !== "object" ||
                (Array.isArray(current) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) > current.length))) {
                return false;
            }
            const last = index === keys.length - 1;
            if (!Object.hasOwn(current, key)) {
                current[key] = last ? value : keys[index + 1] === "0" ? [] : {};
                if (last) return true;
            } else if (last) {
                return false;
            }
            current = current[key];
        }
    }

    function acceptCloud(snapshot, account = cloudAccount(snapshot)) {
        const saved = record(account);
        if (saved && saved.revision === snapshot.revision) {
            if (saved.dirty && !saved.baseData) put(account, {...saved, baseData: snapshot.data});
            return record(account);
        }
        let data = snapshot.data;
        let dirty = false;
        if (saved?.dirty) {
            const base = saved.baseData ?? (saved.revision == null ? {} : null);
            if (base === null) return saved;
            data = {...snapshot.data};
            for (const key of new Set([...Object.keys(base), ...Object.keys(saved.data)])) {
                const before = Object.hasOwn(base, key) ? base[key] : undefined;
                const local = Object.hasOwn(saved.data, key) ? saved.data[key] : undefined;
                const remote = Object.hasOwn(snapshot.data, key) ? snapshot.data[key] : undefined;
                if (sameData(local, before)) continue;
                if (!sameData(remote, before) && !sameData(remote, local)) return saved;
                if (local === undefined) delete data[key];
                else Object.defineProperty(data, key, {value: local, enumerable: true, configurable: true, writable: true});
            }
            dirty = !sameData(data, snapshot.data);
        }
        const current = {data, revision: snapshot.revision, dirty,
            ...(dirty ? {baseData: snapshot.data} : {}),
            ...(account.mode === "local" ? {cloudId: snapshot.userId} : {})};
        put(account, current);
        return current;
    }

    function acceptRestore(snapshot, before, account = cloudAccount(snapshot)) {
        const current = record(account);
        if (current?.dirty && current !== before) return false;
        put(account, {data: snapshot.data, revision: snapshot.revision, dirty: false,
            ...(account.mode === "local" ? {cloudId: snapshot.userId} : {})});
        return true;
    }

    function stage(account, data, baseline = record(account)) {
        if (!isData(data)) throw new Error("Player save data must be a JSON object.");
        const baseData = baseline?.dirty ? baseline.baseData : baseline?.data;
        const next = {...baseline, data, dirty: true, baseData};
        if (new TextEncoder().encode(JSON.stringify(data)).length > maxSaveBytes) {
            throw new Error("Player save data exceeds 1 MB.");
        }
        put(account, next);
        return next;
    }

    function uploadBody(account, saved, revision = saved.revision) {
        return JSON.stringify({userId: account.id, revision, data: saved.data});
    }

    function markUploaded(account, sent, revision, cloudId) {
        const current = record(account);
        // Another tab may have saved or synced while the request was in flight.
        if (!current || current.revision !== sent.revision || current.cloudId !== sent.cloudId) return;
        const dirty = !sameData(current.data, sent.data);
        put(account, {...current, revision, ...(cloudId === undefined ? {} : {cloudId}),
            dirty, baseData: dirty ? sent.data : undefined});
    }

    return {isLocal, localAccount, signInOffline, verifyOfflineCredentials, isOfflineRegistration,
        createOfflineAccount, rememberCloudLogin, signOutLocal, activateCloud,
        isSignedOut: () => localStorage.getItem(signedOutKey) === "1", cloudAccount, matchesCloud,
        acceptCloud, acceptRestore, addMissingField, isData, maxSaveBytes, record, stage, uploadBody, markUploaded};
})();

// Also available to the main website, which loads this script as a module.
globalThis.PlayerStore = PlayerStore;
