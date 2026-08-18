
export async function onRequest(context) {

  const { request, env } = context
  const url = new URL(request.url)

  // -----------------------
  // UPLOAD SAVE FILE
  // -----------------------

  if (request.method === "POST") {

    const form = await request.formData()

    const username = form.get("username")
    const file = form.get("file")

    if (!username || !file) {
      return new Response("Missing username or file", { status: 400 })
    }

    const saveText = await file.text()

    // store save
    await env.SAVES.put(username, saveText)

    return new Response("Save uploaded successfully")
  }

  // -----------------------
  // LOAD SAVE FILE
  // -----------------------

  if (request.method === "GET") {

    const username = url.searchParams.get("username")

    if (!username) {
      return new Response("Username required", { status: 400 })
    }

    const save = await env.SAVES.get(username)

    if (!save) {
      return new Response("Save not found", { status: 404 })
    }

    return new Response(save)
  }

  return new Response("Invalid request", { status: 400 })
}