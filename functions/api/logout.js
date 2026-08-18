export async function onRequestPost(context) {

    const { request, env } = context;

    // Get the session cookie
    const cookieHeader =
        request.headers.get("Cookie") || "";

    const match = cookieHeader.match(
        /(?:^|;\s*)session_id=([^;]+)/
    );

    // Delete the session from D1
    if (match) {

        const sessionId =
            decodeURIComponent(match[1]);

        await env.DB
            .prepare(`
                DELETE FROM sessions
                WHERE id = ?
            `)
            .bind(sessionId)
            .run();
    }

    // Remove the browser cookie
    return new Response(
        JSON.stringify({
            success: true
        }),
        {
            headers: {
                "Content-Type":
                    "application/json",

                "Set-Cookie":
                    "session_id=; " +
                    "Path=/; " +
                    "HttpOnly; " +
                    "Secure; " +
                    "SameSite=Lax; " +
                    "Max-Age=0"
            }
        }
    );
}