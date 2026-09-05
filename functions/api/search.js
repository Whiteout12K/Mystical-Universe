import { jsonResponse } from "../_utils.js";

export async function onRequestGet(context) {
    const result =
        await context.env.DB
            .prepare(`
                SELECT username, save_data
                FROM users
                ORDER BY username COLLATE NOCASE ASC
            `)
            .all();

    const users =
        (result.results || []).map(user => {
            let data = {};

            try {
                data = JSON.parse(user.save_data || "{}");
            } catch {}

            const avatar = Number(data.avatar);
            const avatarFrame = Number(data.avatar_frame);

            return {
                username: user.username,
                avatar: Number.isFinite(avatar) ? avatar : 1,
                avatar_frame: Number.isFinite(avatarFrame) ? avatarFrame : 1
            };
        });

    return jsonResponse({users});
}