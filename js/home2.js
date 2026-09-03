document.addEventListener("DOMContentLoaded", () => {
  const charList = document.getElementById("char-list");
  const charThumbs = Array.from(document.querySelectorAll(".char-thumb"));
  const charImg = document.getElementById("char-img");
  const charName = document.getElementById("char-name");
  const charDesc = document.getElementById("char-desc");
  const slideshowToggle = document.getElementById("slideshow-toggle");

  if (!charList || !charThumbs.length || !charImg || !charName || !charDesc) return;

  /*
   * SETTINGS
   */
  const ROTATION_TIME = 3500;
  const FADE_TIME = 450;

  /*
   * STATE
   */
  let currentIndex = 0;
  let activeThumb = null;
  let rotationTimer = null;
  let rotationIndex = 0;
  let imageList = [];
  let imageGeneration = 0;
  let slideshowRunning = true;

  /*
   * ---------------------------------------------------------
   * CHARACTER FADE
   * ---------------------------------------------------------
   */

  const fadeIn = () => {
    requestAnimationFrame(() => {
      charImg.classList.add("show");
      charName.classList.add("show");
      charDesc.classList.add("show");
    });
  };

  const fadeOut = () => {
    charImg.classList.remove("show");
    charName.classList.remove("show");
    charDesc.classList.remove("show");
  };

  /*
   * ---------------------------------------------------------
   * CENTER CHARACTER THUMBNAIL
   * ---------------------------------------------------------
   */

  const centerThumb = thumb => {
    if (!thumb) return;

    const offset =
      thumb.offsetLeft -
      charList.offsetWidth / 2 +
      thumb.offsetWidth / 2;

    charList.scrollTo({
      left: offset,
      behavior: "smooth"
    });
  };

  /*
   * ---------------------------------------------------------
   * GET COSTUME IMAGES
   * ---------------------------------------------------------
   */

  function getImages(thumb) {
    if (!thumb) return [];

    try {
      const images = JSON.parse(thumb.dataset.images || "[]");

      if (!Array.isArray(images)) return [];

      return images.filter(Boolean);
    } catch (error) {
      console.warn(
        "Invalid data-images for character:",
        thumb.dataset.name,
        error
      );

      return [];
    }
  }

  /*
   * ---------------------------------------------------------
   * PRELOAD IMAGES
   * ---------------------------------------------------------
   */

  function preloadImages(images) {
    images.forEach(src => {
      const preload = new Image();
      preload.src = src;
    });
  }

  /*
   * ---------------------------------------------------------
   * UPDATE SLIDESHOW BUTTON
   * ---------------------------------------------------------
   */

  function updateSlideshowButton() {
    if (!slideshowToggle) return;

    slideshowToggle.textContent = slideshowRunning
      ? "Press to STOP slideshow."
      : "Press to start slideshow.";
  }

  /*
   * ---------------------------------------------------------
   * STOP SLIDESHOW TIMER
   * ---------------------------------------------------------
   */

  function stopRotation() {
    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  /*
   * ---------------------------------------------------------
   * SHOW A COSTUME IMAGE
   * ---------------------------------------------------------
   */

  function showImage(src, generation) {
    if (!src || generation !== imageGeneration) return;

    const nextImage = new Image();

    nextImage.onload = () => {
      if (generation !== imageGeneration) return;

      charImg.classList.remove("show");

      setTimeout(() => {
        if (generation !== imageGeneration) return;

        charImg.src = src;

        charImg.alt =
          activeThumb?.dataset.name ||
          charImg.alt;

        requestAnimationFrame(() => {
          if (generation !== imageGeneration) return;
          charImg.classList.add("show");
        });
      }, FADE_TIME);
    };

    nextImage.onerror = () => {
      console.warn(
        "Character image could not be loaded:",
        src
      );
    };

    nextImage.src = src;
  }

  /*
   * ---------------------------------------------------------
   * START / PREPARE ACTIVE CHARACTER
   * ---------------------------------------------------------
   */

  function prepareCharacter(thumb, resetImage = true) {
    if (!thumb) return;

    stopRotation();

    activeThumb = thumb;

    imageList = getImages(thumb);

    /*
     * Fall back to data-img if data-images is empty.
     */
    if (!imageList.length && thumb.dataset.img) {
      imageList = [thumb.dataset.img];
    }

    /*
     * Always start the selected character
     * at their first costume.
     */
    rotationIndex = 0;

    /*
     * Invalidate all previous image transitions.
     */
    imageGeneration++;

    const generation = imageGeneration;

    /*
     * Immediately reset the image when requested.
     */
    if (resetImage && imageList.length) {
      charImg.src = imageList[0];

      charImg.alt =
        thumb.dataset.name ||
        charImg.alt;
    }

    /*
     * Preload all costumes.
     */
    preloadImages(imageList);

    /*
     * Update button state.
     */
    updateSlideshowButton();

    /*
     * Do not start a timer if slideshow is disabled.
     */
    if (!slideshowRunning) return;

    /*
     * One image means no slideshow is needed.
     */
    if (imageList.length < 2) return;

    /*
     * Start a completely fresh cycle.
     */
    rotationTimer = setInterval(() => {
      if (generation !== imageGeneration) return;
      if (!slideshowRunning) return;

      rotationIndex =
        (rotationIndex + 1) %
        imageList.length;

      showImage(
        imageList[rotationIndex],
        generation
      );
    }, ROTATION_TIME);
  }

  /*
   * ---------------------------------------------------------
   * UPDATE ACTIVE CHARACTER
   * ---------------------------------------------------------
   */

  function updateActive(index, animate = true) {
    const thumb = charThumbs[index];

    if (!thumb) return;

    currentIndex = index;

    /*
     * Immediately invalidate anything belonging
     * to the previous character.
     */
    imageGeneration++;
    stopRotation();

    /*
     * Update active thumbnail.
     */
    charThumbs.forEach(item => {
      item.classList.remove("active");
    });

    thumb.classList.add("active");

    /*
     * Get character information.
     */
    const name =
      thumb.getAttribute("data-name") || "";

    const image =
      thumb.getAttribute("data-img") || "";

    const description =
      thumb.getAttribute("data-desc") || "";

    const images =
      getImages(thumb);

    const firstImage =
      images[0] ||
      image;

    /*
     * -------------------------------------------------------
     * PREPARE NEW CHARACTER IMMEDIATELY
     * -------------------------------------------------------
     */

    activeThumb = thumb;

    imageList = images.length
      ? images
      : image
        ? [image]
        : [];

    rotationIndex = 0;

    /*
     * Update text immediately.
     */
    charName.textContent = name;
    charDesc.innerHTML = description;

    /*
     * Set the new image immediately.
     *
     * This prevents the previous character from
     * remaining visible during the fade.
     */
    charImg.src = firstImage;
    charImg.alt = name;

    /*
     * Center selected character.
     */
    centerThumb(thumb);

    /*
     * -------------------------------------------------------
     * FADE NEW CHARACTER IN
     * -------------------------------------------------------
     *
     * The old character is replaced immediately.
     * The new character starts hidden and fades in.
     */
    if (animate) {
      fadeOut();

      requestAnimationFrame(() => {
        /*
         * Force the browser to recognize the hidden state
         * before showing the new character.
         */
        requestAnimationFrame(() => {
          charImg.classList.add("show");
          charName.classList.add("show");
          charDesc.classList.add("show");
        });
      });
    } else {
      fadeIn();
    }

    /*
     * Start the new character's slideshow cycle.
     *
     * resetImage is false because the image was already
     * changed above.
     */
    prepareCharacter(thumb, false);
  }

  /*
   * ---------------------------------------------------------
   * CHARACTER CLICK EVENTS
   * ---------------------------------------------------------
   */

  charThumbs.forEach((thumb, index) => {
    thumb.addEventListener("click", () => {

      /*
       * Do nothing if already selected.
       */
      if (
        index === currentIndex &&
        thumb.classList.contains("active")
      ) {
        return;
      }

      /*
       * Immediately switch and fade in the new character.
       */
      updateActive(index, true);
    });
  });

  /*
   * ---------------------------------------------------------
   * SLIDESHOW STOP / START BUTTON
   * ---------------------------------------------------------
   */

  if (slideshowToggle) {
    slideshowToggle.addEventListener("click", event => {
      event.preventDefault();

      slideshowRunning =
        !slideshowRunning;

      if (!slideshowRunning) {
        /*
         * STOP
         */
        stopRotation();

      } else {
        /*
         * START
         *
         * Resume from the current costume instead
         * of jumping back to costume #1.
         */
        if (
          activeThumb &&
          imageList.length > 1
        ) {
          const generation =
            imageGeneration;

          stopRotation();

          rotationTimer = setInterval(() => {
            if (
              generation !== imageGeneration ||
              !slideshowRunning
            ) {
              return;
            }

            rotationIndex =
              (rotationIndex + 1) %
              imageList.length;

            showImage(
              imageList[rotationIndex],
              generation
            );
          }, ROTATION_TIME);
        }
      }

      updateSlideshowButton();
    });
  }

  /*
   * ---------------------------------------------------------
   * HORIZONTAL CHARACTER SCROLL
   * ---------------------------------------------------------
   */

  charList.addEventListener(
    "wheel",
    event => {
      if (
        Math.abs(event.deltaY) >
        Math.abs(event.deltaX)
      ) {
        event.preventDefault();

        charList.scrollLeft +=
          event.deltaY;
      }
    },
    {
      passive: false
    }
  );

  /*
   * ---------------------------------------------------------
   * ALWAYS START WITH FIRST CHARACTER
   * ---------------------------------------------------------
   */

  charThumbs.forEach(item => {
    item.classList.remove("active");
  });

  currentIndex = 0;

  const firstCharacter =
    charThumbs[0];

  if (firstCharacter) {
    firstCharacter.classList.add("active");

    const firstName =
      firstCharacter.dataset.name || "";

    const firstDescription =
      firstCharacter.dataset.desc || "";

    const firstImages =
      getImages(firstCharacter);

    const firstFallback =
      firstCharacter.dataset.img || "";

    charName.textContent =
      firstName;

    charDesc.innerHTML =
      firstDescription;

    charImg.src =
      firstImages[0] ||
      firstFallback;

    charImg.alt =
      firstName;

    centerThumb(firstCharacter);

    activeThumb =
      firstCharacter;

    prepareCharacter(
      firstCharacter,
      true
    );

    charImg.classList.add("show");
    charName.classList.add("show");
    charDesc.classList.add("show");
  }

  /*
   * ---------------------------------------------------------
   * INITIAL BUTTON STATE
   * ---------------------------------------------------------
   */

  updateSlideshowButton();

  /*
   * ---------------------------------------------------------
   * CLEANUP
   * ---------------------------------------------------------
   */

  window.addEventListener(
    "pagehide",
    () => {
      stopRotation();
    }
  );
});