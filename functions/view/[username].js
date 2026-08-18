export async function onRequest(context) {

    const username =
        decodeURIComponent(
            context.params.username
        );


    return Response.redirect(
        new URL(
            "/view.html?username=" +
            encodeURIComponent(
                username
            ),
            context.request.url
        ),
        302
    );

}