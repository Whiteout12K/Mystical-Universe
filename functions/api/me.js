import { jsonResponse } from "../_utils.js";


function getCookie(request, name) {

    const cookies =
        request.headers.get("Cookie") || "";

    for (const cookie of cookies.split(";")) {

        const [key, ...value] =
            cookie.trim().split("=");

        if (key === name) {

            return decodeURIComponent(
                value.join("=")
            );
        }
    }

    return null;
}


export async function onRequestGet(context) {

    const { request, env } = context;

    // Get the persistent session ID from the browser
    const sessionId =
        getCookie(
            request,
            "session_id"
        );


    // No session cookie = not logged in
    if (!sessionId) {

        return jsonResponse({
            authenticated: false
        }, 401);

    }


    // Find the user associated with this session
    const user =
        await env.DB
            .prepare(`
                SELECT
                    users.id,
                    users.username
                FROM sessions
                JOIN users
                    ON users.id = sessions.user_id
                WHERE sessions.id = ?
            `)
            .bind(sessionId)
            .first();


    // Session doesn't exist or is no longer valid
    if (!user) {

        return jsonResponse({
            authenticated: false
        }, 401);

    }


    // User is authenticated
    return jsonResponse({
        authenticated: true,
        username: user.username,
        userId: user.id
    });
}