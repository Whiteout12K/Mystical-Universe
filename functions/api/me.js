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

    const username =
        getCookie(
            context.request,
            "username"
        );


    if (!username) {

        return jsonResponse({
            authenticated: false
        }, 401);

    }


    const user =
        await context.env.DB
            .prepare(`
                SELECT id, username
                FROM users
                WHERE username = ?
            `)
            .bind(username)
            .first();


    if (!user) {

        return jsonResponse({
            authenticated: false
        }, 401);

    }


    return jsonResponse({
        authenticated: true,
        username: user.username,
        userId: user.id
    });
}