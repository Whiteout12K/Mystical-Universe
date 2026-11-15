export const maxSaveBytes = 1024 * 1024;
export const maxBackupBytes = maxSaveBytes + 1024;
const format = "jscratch-player-save";

export function makePlayerBackup(username, data, online = false) {
    return JSON.stringify(online ? {format, version: 2, source: "d1", username, data} :
        {format, version: 1, username, data});
}

export function checkPlayerBackup(text, username, {online = false} = {}) {
    const encoder = new TextEncoder();
    if (encoder.encode(text).length > maxBackupBytes) throw new Error("That backup is too large.");
    let backup;
    try { backup = JSON.parse(text); }
    catch { throw new Error("The backup does not contain valid JSON."); }
    const portable = backup?.version === 1;
    const fromD1 = backup?.version === 2 && backup.source === "d1";
    if (backup?.format !== format || (!portable && !fromD1) ||
        typeof backup.username !== "string" || !backup.username.trim() ||
        !backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) {
        throw new Error("Choose a valid JScratch player backup.");
    }
    if (backup.username !== username) throw new Error("This backup belongs to a different username.");
    if (online && !fromD1) throw new Error("Online restores require an original backup exported from Account.");
    // JSON.parse accepts numbers outside the finite JS range. Reject them before they can become null on restore.
    const pending = [backup.data];
    while (pending.length) {
        const item = pending.pop();
        if (item && typeof item === "object") {
            for (const key of Object.keys(item)) pending.push(item[key]);
        } else if (typeof item === "number" && !Number.isFinite(item)) {
            throw new Error("The backup contains an invalid number.");
        }
    }
    try {
        if (encoder.encode(JSON.stringify(backup.data)).length <= maxSaveBytes) return backup;
    } catch {
        throw new Error("The backup data is nested too deeply.");
    }
    throw new Error("The backup data exceeds 1 MB.");
}

export async function readPlayerBackupFile(file) {
    if (file.size > maxBackupBytes) throw new Error("That backup is too large.");
    const bytes = await file.arrayBuffer();
    try { return new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes); }
    catch { throw new Error("The backup is not valid UTF-8 text."); }
}

export function downloadPlayerBackup(text) {
    const url = URL.createObjectURL(new Blob([text], {type: "text/plain"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "jscratch-player-save.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
