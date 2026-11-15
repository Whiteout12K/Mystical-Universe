import {deletePlayerSession, playerResponse, sameOrigin} from "../_player-session.js";

export async function onRequestPost({request, env}) {
    if (!sameOrigin(request)) return playerResponse({success: false}, 403);
    const headers = new Headers({"Content-Type": "application/json", "Cache-Control": "no-store"});
    headers.append("Set-Cookie", "username=; Path=/; SameSite=Lax; Max-Age=0");
    headers.append("Set-Cookie", await deletePlayerSession(request, env));
    return new Response(JSON.stringify({success: true}), {headers});
}
