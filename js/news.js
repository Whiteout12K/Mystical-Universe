let allArticles = [];
let filteredArticles = [];
let visibleCount = 2;
let activeTag = "all";
let searchTerm = "";

// Permanent tag assignments by keyword in title
const TITLE_TAGS = {
  "MLG hub": "Game",
  "mystical legends book series": "Series",
};

// Detect permanent tag for current page based on title
const CURRENT_TITLE = document.title.toLowerCase();
let PAGE_TAG = null;

for (const keyword in TITLE_TAGS) {
  if (CURRENT_TITLE.includes(keyword.toLowerCase())) {
    PAGE_TAG = TITLE_TAGS[keyword];
    activeTag = PAGE_TAG;
    break;
  }
}

fetch("/news-index.json")
  .then(res => res.json())
  .then(files => {
    Promise.all(files.map(loadMeta))
      .then(results => {
        allArticles = results.sort(
          (a,b) => new Date(b.date) - new Date(a.date)
        );
        applyFilters();
        buildTags();
        render();
      });
  });

function loadMeta(file) {
  return fetch(file)
    .then(res => res.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html,"text/html");

      // Tags from HTML meta
      let metaTags = [];
      const tagMeta = doc.querySelector('meta[name="news-tags"]');
      if (tagMeta) {
        metaTags = tagMeta.content.split(",").map(t => t.trim());
      }

      // Merge with permanent tags from title keywords
      let permanentTags = [];
      for (const keyword in TITLE_TAGS) {
        if (doc.title.toLowerCase().includes(keyword.toLowerCase())) {
          permanentTags.push(TITLE_TAGS[keyword]);
        }
      }

      // Merge & remove duplicates
      const tags = [...new Set([...metaTags, ...permanentTags])];

      return {
        title: doc.querySelector('meta[name="news-title"]').content,
        image: doc.querySelector('meta[name="news-image"]').content,
        date: doc.querySelector('meta[name="news-date"]').content,
        tags,
        file
      };
    });
}

function applyFilters() {
  filteredArticles = allArticles.filter(article => {

    const matchesTag =
      activeTag === "all" || article.tags.includes(activeTag);

    const matchesSearch =
      article.title.toLowerCase()
        .includes(searchTerm.toLowerCase());

    return matchesTag && matchesSearch;
  });
}

function render() {
  const container = document.getElementById("newsContainer");
  container.innerHTML = "";

  filteredArticles.slice(0,visibleCount).forEach(item=>{
    const a = document.createElement("a");
    a.className="news-card";
    a.href=item.file;

    a.innerHTML=`
      <img src="${item.image}" loading="lazy">
      <h3>${item.title}</h3>
    `;

    container.appendChild(a);
  });

  document.getElementById("loadMoreBtn").style.display =
    visibleCount >= filteredArticles.length ? "none" : "block";
}

/* LOAD MORE */
document.getElementById("loadMoreBtn").onclick = ()=>{
  visibleCount += 2;
  render();
};

/* TAGS */
function buildTags() {
  const bar = document.getElementById("tagBar");
  const set = new Set();

  allArticles.forEach(a=>a.tags.forEach(t=>set.add(t)));

  // No tags exist
  if (set.size === 0) {
    bar.style.display = "none";
    return;
  }

  // 🔒 Page is locked to a permanent tag
  if (PAGE_TAG) {
    bar.style.display = "none";
    return;
  }

  bar.style.display = "flex";
  bar.innerHTML =
    `<button class="tag-btn active" onclick="setTag('all',this)">All</button>`;

  set.forEach(tag=>{
    bar.innerHTML +=
      `<button class="tag-btn" onclick="setTag('${tag}',this)">${tag}</button>`;
  });
}

function setTag(tag,btn) {
  activeTag = tag;
  visibleCount = 2;

  document.querySelectorAll(".tag-btn")
    .forEach(b=>b.classList.remove("active"));

  btn.classList.add("active");

  applyFilters();
  render();
}

/* SEARCH */
document.getElementById("searchInput")
  .addEventListener("input", e=>{
    searchTerm = e.target.value;
    visibleCount = 2;
    applyFilters();
    render();
  });

/* FLOATING SEARCH VISIBILITY */
const newsSection = document.querySelector(".news-section");
const floatingSearch = document.getElementById("floatingSearch");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        floatingSearch.classList.add("active");
      } else {
        floatingSearch.classList.remove("active");
      }
    });
  },
  {
    threshold: 0.2
  }
);

observer.observe(newsSection);
