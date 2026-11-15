import {accountUsername} from "../_account.js";
import {playerResponse} from "../_player-session.js";

export async function onRequestGet({request, env}) {
    const username = accountUsername(request);
    if (!username) return playerResponse({authenticated: false}, 401);

    const user = await env.DB.prepare(
        "SELECT id, username, save_data FROM users WHERE username = ?"
    ).bind(username).first();
    if (!user) return playerResponse({authenticated: false}, 401);

    return playerResponse({
        authenticated: true, username: user.username, userId: user.id, data: user.save_data
    });
}
