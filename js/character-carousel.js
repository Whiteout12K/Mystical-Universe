document.addEventListener("DOMContentLoaded", () => {
  const charList = document.getElementById("char-list");
  const charThumbs = Array.from(document.querySelectorAll(".char-thumb"));
  const charImg = document.getElementById("char-img");
  const charName = document.getElementById("char-name");
  const charDesc = document.getElementById("char-desc");

  if (!charList || !charThumbs.length || !charImg || !charName || !charDesc) {
    return;
  }

  let currentIndex = charThumbs.findIndex(
    thumb => thumb.classList.contains("active")
  );

  if (currentIndex === -1) {
    currentIndex = 0;
  }

  const fadeIn = () => {
    charImg.classList.add("show");
    charName.classList.add("show");
    charDesc.classList.add("show");
  };

  const fadeOut = callback => {
    charImg.classList.remove("show");
    charName.classList.remove("show");
    charDesc.classList.remove("show");

    setTimeout(callback, 600);
  };

  const centerThumb = thumb => {
    const offset =
      thumb.offsetLeft -
      charList.offsetWidth / 2 +
      thumb.offsetWidth / 2;

    charList.scrollTo({
      left: offset,
      behavior: "smooth"
    });
  };

  const updateActive = index => {
    fadeOut(() => {
      const thumb = charThumbs[index];

      if (!thumb) {
        return;
      }

      charThumbs.forEach(item => {
        item.classList.remove("active");
      });

      thumb.classList.add("active");

      const name = thumb.getAttribute("data-name") || "";
      const image = thumb.getAttribute("data-img") || "";
      const description = thumb.getAttribute("data-desc") || "";

      charName.textContent = name;
      charImg.src = image;
      charImg.alt = name;
      charDesc.innerHTML = description;

      centerThumb(thumb);

      requestAnimationFrame(() => {
        setTimeout(fadeIn, 10);
      });
    });
  };

  charThumbs.forEach((thumb, index) => {
    thumb.addEventListener("click", () => {
      currentIndex = index;
      updateActive(currentIndex);
    });
  });

  charList.addEventListener(
    "wheel",
    event => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        charList.scrollLeft += event.deltaY;
      }
    },
    { passive: false }
  );

  updateActive(currentIndex);
});