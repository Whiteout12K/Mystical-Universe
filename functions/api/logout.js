export async function onRequestPost() {
    return new Response(
        JSON.stringify({
            success: true
        }),
        {
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie":
                    "username=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
            }
        }
    );
}