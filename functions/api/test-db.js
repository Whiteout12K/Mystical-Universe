export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const playerId = body.playerId;
        const gameData = body.gameData;

        if (!playerId || !gameData) {
            return Response.json(
                {
                    error: "Missing player ID or game data"
                },
                {
                    status: 400
                }
            );
        }

        await context.env.DB
            .prepare(
                "UPDATE players SET game_data = ? WHERE id = ?"
            )
            .bind(
                JSON.stringify(gameData),
                playerId
            )
            .run();

        return Response.json({
            success: true
        });

    } catch (error) {
        return Response.json(
            {
                error: "Invalid request"
            },
            {
                status: 400
            }
        );
    }
}