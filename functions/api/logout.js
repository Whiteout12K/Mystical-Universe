export async function onRequestPost() {

    return new Response(
        JSON.stringify({
            success: true
        }),
        {
            headers: {
                "Content-Type":
                    "application/json",

                "Set-Cookie":
                    "username=; Path=/; Max-Age=0"
            }
        }
    );
}