import {currentPlayerUser, digest, playerResponse, sameOrigin} from "../_player-session.js";

import {maxSaveBytes, maxBackupBytes} from "../../JScratch/js/player-save-format.mjs";
import {readSaveText, replacePlayerSave} from "../_player-save.js";

function readData(raw) {
    try {
        const value = JSON.parse(raw);
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

export async function onRequestGet({request, env}) {
    if (!env.DB) return playerResponse({error: "D1 is unavailable."}, 503);
    const user = await currentPlayerUser(request, env);
    if (!user) return playerResponse({authenticated: false});
    return playerResponse({authenticated: true, username: user.username, userId: user.id,
        data: readData(user.save_data), revision: await digest(user.save_data)});
}

export async function onRequestPost({request, env}) {
    if (!sameOrigin(request)) {
        return playerResponse({success: false, error: "Use the same website to upload saves."}, 403);
    }
    if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json") {
        return playerResponse({success: false, error: "Send save data as JSON."}, 415);
    }
    if (!env.DB) return playerResponse({success: false, error: "D1 is unavailable."}, 503);
    const user = await currentPlayerUser(request, env);
    if (!user) return playerResponse({success: false, error: "Sign in to the website again to upload."}, 401);

    let upload;
    try { upload = JSON.parse(await readSaveText(request, maxBackupBytes)); } catch {}
    if (!upload?.data || typeof upload.data !== "object" || Array.isArray(upload.data) ||
        !/^[a-f0-9]{64}$/.test(upload.revision ?? "")) {
        return playerResponse({success: false, error: "Invalid save data or revision."}, 400);
    }
    if (upload.userId !== user.id) {
        return playerResponse({success: false, error: "The signed-in website account has changed."}, 403);
    }

    const data = JSON.stringify(upload.data);
    if (new TextEncoder().encode(data).length > maxSaveBytes) {
        return playerResponse({success: false, error: "Save data exceeds 1 MB."}, 413);
    }
    const revision = await digest(data);
    const currentRevision = await digest(user.save_data);
    if (revision === currentRevision) return playerResponse({success: true, revision});
    const conflict = () => playerResponse({success: false, error: "D1 has a newer save. Export your browser save before resolving the conflict."}, 409);
    if (upload.revision !== currentRevision) return conflict();

    return await replacePlayerSave(env, user, data) ? playerResponse({success: true, revision}) : conflict();
}
