import {readCloudSave} from './player-data.js';
import {
    checkPlayerBackup, downloadPlayerBackup, makePlayerBackup, readPlayerBackupFile
} from '/JScratch/js/player-save-format.mjs';
import {el, link} from './site-enhancements/core.js';

const store = globalThis.PlayerStore;

async function backupRequest(action, text, revision) {
    const headers = {};
    if (text !== undefined) headers['Content-Type'] = 'text/plain; charset=utf-8';
    if (revision) headers['If-Match'] = `"${revision}"`;
    const response = await fetch('/api/player-backup?action=' + action, {
        method: 'POST', cache: 'no-store', headers, body: text
    });
    if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'The D1 backup service could not complete the request.');
    }
    return action === 'export' ? response.text() : response.json();
}

export function playerBackups(player) {
    const local = !player.connected;
    const section = el('section', {class: 'account-fieldset account-backups', 'aria-labelledby': 'player-backup-title'});
    const heading = el('h2', {id: 'player-backup-title'}, 'Player saves');
    const help = el('p', {class: 'account-help'}, local
        ? 'Export this browser’s game progress or check and restore a backup for your local profile.'
        : 'Export your current D1 game progress. To restore it, check an original Account export for this username.');
    const file = el('input', {id: 'player-backup-file', type: 'file', accept: '.txt,.json'});
    const download = el('button', {type: 'button'}, 'Export .txt');
    const exportDraft = el('button', {type: 'button', hidden: ''}, 'Export browser progress');
    const check = el('button', {type: 'button'}, 'Check backup');
    const restore = el('button', {type: 'button'}, 'Restore save');
    const actions = el('div', {class: 'account-backup-actions'});
    const message = el('p', {role: 'status', 'aria-live': 'polite'});
    actions.append(check, restore);
    section.append(heading, help, download, exportDraft, el('label', {for: file.id}, 'Backup file'), file, actions, message);

    let verified;
    let cloudAccount;
    let busy = false;
    const update = () => {
        download.disabled = file.disabled = exportDraft.disabled = busy;
        exportDraft.hidden = !cloudAccount || !store.record(cloudAccount)?.dirty;
        check.disabled = busy || !file.files.length;
        restore.disabled = busy || !verified;
    };
    const session = () => {
        const active = store.localAccount();
        if (active?.id !== player.id || active.mode !== player.mode) throw new Error('The selected player changed. Reopen Account to continue.');
        return active;
    };
    const run = async handler => {
        if (busy) return;
        busy = true;
        update();
        try { await handler(); }
        catch (error) { message.textContent = error.message; }
        finally { busy = false; update(); }
    };
    file.onchange = () => { verified = null; message.textContent = ''; update(); };
    download.onclick = () => run(async () => {
        message.textContent = 'Preparing your backup…';
        const active = session();
        const text = local ? makePlayerBackup(active.username, store.record(active)?.data ?? {}) :
            await backupRequest('export');
        checkPlayerBackup(text, player.username, {online: !local});
        downloadPlayerBackup(text);
        message.textContent = 'Backup exported.';
    });
    if (!local) {
        const refresh = async () => {
            try {
                const snapshot = await readCloudSave();
                if (!section.isConnected || !snapshot?.authenticated || snapshot.username !== player.username) return;
                if (!store.matchesCloud(player, snapshot)) return;
                cloudAccount = player;
                store.acceptCloud(snapshot, player);
                update();
            } catch {}
        };
        queueMicrotask(refresh);
        window.addEventListener('focus', refresh);
        window.addEventListener('storage', () => { if (section.isConnected) update(); });
        exportDraft.onclick = () => run(async () => {
            const saved = store.record(cloudAccount);
            if (!saved?.dirty) return;
            const backup = makePlayerBackup(cloudAccount.username, saved.data);
            checkPlayerBackup(backup, cloudAccount.username);
            downloadPlayerBackup(backup);
            message.textContent = 'Browser progress exported for a localhost restore.';
        });
    }
    check.onclick = () => run(async () => {
        verified = null;
        message.textContent = 'Checking your backup…';
        session();
        const text = await readPlayerBackupFile(file.files[0]);
        const backup = checkPlayerBackup(text, player.username, {online: !local});
        const state = local ? null : await backupRequest('check', text);
        if (!local && state.username !== player.username) throw new Error('The signed-in website account changed.');
        verified = {text, data: backup.data, state};
        message.textContent = `Valid backup for ${player.username}. Choose Restore save to replace your ${local ? 'local' : 'D1'} game progress.`;
    });
    restore.onclick = () => run(async () => {
        const checked = verified;
        const active = session();
        if (!confirm(`Replace the ${local ? 'local' : 'D1'} player save for ${player.username}?`)) return;
        verified = null;
        if (local) {
            store.stage(active, checked.data);
            message.textContent = 'Local player save restored.';
        } else {
            if (checked.state.userId !== player.userId) throw new Error("The signed-in website account changed.");
            const target = active;
            const before = store.record(target);
            const snapshot = await backupRequest('restore', checked.text, checked.state.revision);
            try {
                message.textContent = store.acceptRestore(snapshot, before, target) ? 'D1 player save restored.' :
                    'D1 player save restored. Newer changes made in this browser during restore were kept.';
            } catch {
                message.textContent = 'D1 player save restored. This browser could not refresh its local copy.';
            }
        }
        file.value = '';
    });
    update();
    return section;
}

