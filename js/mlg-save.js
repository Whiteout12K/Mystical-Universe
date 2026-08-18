
async function uploadSave() {

  const username = document.getElementById("username").value
  const file = document.getElementById("fileInput").files[0]

  if (!username || !file) {
    alert("Enter username and select a file")
    return
  }

  const formData = new FormData()

  formData.append("username", username)
  formData.append("file", file)

  const response = await fetch("/api/save", {
    method: "POST",
    body: formData
  })

  const text = await response.text()

  alert(text)
}


async function loadSave() {

  const username = document.getElementById("username").value

  if (!username) {
    alert("Enter username")
    return
  }

  const response = await fetch("/api/save?username=" + username)

  if (!response.ok) {
    alert("Save not found")
    return
  }

  const saveText = await response.text()

  document.getElementById("saveOutput").textContent = saveText
}