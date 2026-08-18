export async function onRequestGet(context) {
    const url = new URL(context.request.url);

    const username = url.searchParams.get("username");

    if (!username) {
        return Response.json(
            {
                error: "Username is required"
            },
            {
                status: 400
            }
        );
    }

    const player = await context.env.DB
        .prepare(
            "SELECT id, username, game_data FROM players WHERE username = ?"
        )
        .bind(username)
        .first();

    if (!player) {
        return Response.json(
            {
                error: "Player not found"
            },
            {
                status: 404
            }
        );
    }

    return Response.json({
        id: player.id,
        username: player.username,
        gameData: JSON.parse(player.game_data)
    });
}