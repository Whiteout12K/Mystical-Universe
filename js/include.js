function loadComponent(id, file) {
  fetch(file)
    .then(res => res.text())
    .then(data => {
      document.getElementById(id).innerHTML = data;
    });
}

loadComponent("header-placeholder", "index/header.html");
loadComponent("footer-placeholder", "index/footer.html");

loadComponent("subheader-placeholder", "../index/header.html");
loadComponent("subfooter-placeholder", "../index/footer.html");

loadComponent("sub4header-placeholder", "../../../../index/header.html");
loadComponent("sub4footer-placeholder", "../../../../index/footer.html");
