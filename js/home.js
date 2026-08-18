


document.addEventListener('contextmenu', function (e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
    }
});


document.addEventListener('DOMContentLoaded', () => {

  // Collect all data-img values
  const preloadImages = [];
  document.querySelectorAll('.char-thumb').forEach(thumb => {
    const img = thumb.getAttribute('data-img');
    if (img) preloadImages.push(img);
  });

  // Preload them
  preloadImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });

});