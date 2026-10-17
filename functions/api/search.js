import {ensureAccountTable} from "../_account.js";
import { jsonResponse } from "../_utils.js";

export async function onRequestGet(context) {
    await ensureAccountTable(context.env);
    const result =
        await context.env.DB
            .prepare(`
                SELECT users.username, users.save_data, preferences.avatar AS account_avatar
                FROM users LEFT JOIN user_account_preferences AS preferences ON preferences.user_id=users.id
                ORDER BY users.username COLLATE NOCASE ASC
            `)
            .all();

    const users =
        (result.results || []).map(user => {
            let data = {};

            try {
                data = JSON.parse(user.save_data || "{}");
            } catch {}

            const avatar = Number(user.account_avatar ?? data.avatar);
            const avatarFrame = Number(data.avatar_frame);

            return {
                username: user.username,
                avatar: Number.isFinite(avatar) ? avatar : 1,
                avatar_frame: Number.isFinite(avatarFrame) ? avatarFrame : 1
            };
        });

    return jsonResponse({users});
}