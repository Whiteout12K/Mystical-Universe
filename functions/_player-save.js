export async function readSaveText(request, maxBytes) {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const decoder = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});
    let size = 0, text = "";
    try {
        for (;;) {
            const {value, done} = await reader.read();
            if (done) return text + decoder.decode();
            size += value.byteLength;
            if (size > maxBytes) {
                await reader.cancel();
                return null;
            }
            text += decoder.decode(value, {stream: true});
        }
    } catch {
        await reader.cancel().catch(() => {});
        return null;
    } finally {
        reader.releaseLock();
    }
}

export async function replacePlayerSave(env, user, data) {
    const result = await env.DB.prepare(`UPDATE users SET save_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND save_data = ?`).bind(data, user.id, user.save_data).run();
    return Boolean(result.meta.changes);
}
