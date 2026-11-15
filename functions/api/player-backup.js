import {checkPlayerBackup, makePlayerBackup, maxBackupBytes} from "../../JScratch/js/player-save-format.mjs";
import {currentPlayerUser, digest, playerResponse, sameOrigin} from "../_player-session.js";
import {readSaveText, replacePlayerSave} from "../_player-save.js";

const fail = (error, status) => playerResponse({error}, status);

async function ensureBackupReceipts(env) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS jscratch_backup_receipts (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_hash TEXT NOT NULL,
        PRIMARY KEY (user_id, file_hash)
    ) WITHOUT ROWID`).run();
}

export async function onRequestPost({request, env}) {
    if (!sameOrigin(request)) return fail("Use the same website to manage your backup.", 403);
    if (!env.DB) return fail("D1 is unavailable on this server.", 503);
    const user = await currentPlayerUser(request, env);
    if (!user) return fail("Sign out and sign back in to use D1 backups.", 401);
    const action = new URL(request.url).searchParams.get("action");

    if (action === "export") {
        let text;
        try {
            text = makePlayerBackup(user.username, JSON.parse(user.save_data), true);
            checkPlayerBackup(text, user.username, {online: true});
        } catch {
            return fail("The D1 save could not be exported as a valid backup.", 422);
        }
        // Record the exact file contents against the authenticated D1 account.
        await ensureBackupReceipts(env);
        await env.DB.prepare("INSERT OR IGNORE INTO jscratch_backup_receipts (user_id, file_hash) VALUES (?, ?)")
            .bind(user.id, await digest(text)).run();
        return new Response(text, {headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": 'attachment; filename="jscratch-player-save.txt"',
            "Cache-Control": "no-store", Vary: "Cookie"
        }});
    }
    if (action !== "check" && action !== "restore") return fail("Choose a backup action.", 400);
    if (request.headers.get("Content-Type")?.split(";")[0] !== "text/plain") {
        return fail("Send the original .txt backup.", 415);
    }
    const text = await readSaveText(request, maxBackupBytes);
    if (text === null) return fail("The backup is missing, too large, or invalid UTF-8.", 400);

    let backup;
    try { backup = checkPlayerBackup(text, user.username, {online: true}); }
    catch (error) { return fail(error.message, 400); }

    await ensureBackupReceipts(env);
    const receipt = await env.DB.prepare("SELECT 1 FROM jscratch_backup_receipts WHERE user_id = ? AND file_hash = ?")
        .bind(user.id, await digest(text)).first();
    if (!receipt) return fail("D1 could not verify this file. Use the original, unedited Account export.", 422);

    const revision = await digest(user.save_data);
    if (action === "check") return playerResponse({username: user.username, userId: user.id, revision});
    if (request.headers.get("If-Match") !== `"${revision}"`) {
        return fail("Your D1 save changed. Check the backup again before restoring.", 409);
    }
    const data = JSON.stringify(backup.data);
    if (data !== user.save_data && !await replacePlayerSave(env, user, data)) {
        return fail("Your D1 save changed. Check the backup again before restoring.", 409);
    }
    return playerResponse({authenticated: true, username: user.username, userId: user.id,
        data: backup.data, revision: await digest(data)});
}
