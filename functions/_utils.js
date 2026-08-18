export function jsonResponse(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
}


export function getUsernameFromPath(params) {
    return decodeURIComponent(params.username);
}


export async function getUser(env, username) {
    return await env.DB
        .prepare(`
            SELECT *
            FROM users
            WHERE username = ?
        `)
        .bind(username)
        .first();
}