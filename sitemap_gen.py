#!/usr/bin/env python3

from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode
from html.parser import HTMLParser
from datetime import datetime, timezone
import html
import re

# ============================================================
# CONFIG
# ============================================================

ROOT = Path(__file__).resolve().parent
DOMAIN = "https://mysticallegends.org"
OUTPUT = ROOT / "sitemap.xml"

REMOVE_HTML_EXTENSION = True

PAGE_EXTENSIONS = {".html", ".htm"}

# Files whose source code can contain URLs.
SCAN_EXTENSIONS = {
    ".html",
    ".htm",
    ".js",
    ".json"
}

IGNORE_DIRS = {
    ".git",
    ".github",
    ".idea",
    ".vscode",
    "node_modules",
    "__pycache__",
    "vendor",
    "private",
    "admin",
}

IGNORE_FILES = {
    "404.html",
    "403.html",
    "500.html",
}

IGNORE_PARAMETERS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
}

# File/resource extensions that should never appear as sitemap pages.
RESOURCE_EXTENSIONS = {
    ".css",
    ".js",
    ".json",
    ".xml",
    ".txt",

    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",

    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",

    ".mp4",
    ".webm",
    ".mov",

    ".pdf",

    ".woff",
    ".woff2",
    ".ttf",
    ".otf",

    ".zip",
    ".rar",
    ".7z",
}


# ============================================================
# HTML PARSER
# ============================================================

class PageParser(HTMLParser):

    def __init__(self):
        super().__init__()

        self.links = []
        self.noindex = False
        self.canonical = None
        self.is_document = False

    def handle_starttag(self, tag, attrs):

        attrs = dict(attrs)

        if tag == "html":
            self.is_document = True

        # Normal HTML links
        if tag == "a":

            href = attrs.get("href")

            if href:
                self.links.append(href.strip())

        # noindex detection
        elif tag == "meta":

            name = attrs.get("name", "").lower()
            content = attrs.get("content", "").lower()

            if name == "robots" and "noindex" in content:
                self.noindex = True

        # Canonical detection
        elif tag == "link":

            rel = attrs.get("rel", "").lower()

            if "canonical" in rel:
                self.canonical = attrs.get("href")


# ============================================================
# FILE HELPERS
# ============================================================

def ignored(path: Path):

    try:
        relative = path.relative_to(ROOT)
    except ValueError:
        return True

    if any(part in IGNORE_DIRS or part.startswith(".") for part in relative.parts):
        return True

    if path.name in IGNORE_FILES:
        return True

    if path.name.startswith("."):
        return True

    return False


def read_text(path: Path):

    try:
        return path.read_text(
            encoding="utf-8",
            errors="ignore"
        )

    except Exception as exc:

        print(
            f"[WARNING] Could not read "
            f"{path.relative_to(ROOT)}: {exc}"
        )

        return ""


def modification_date(path: Path):

    timestamp = path.stat().st_mtime

    return datetime.fromtimestamp(
        timestamp,
        timezone.utc
    ).date().isoformat()


# ============================================================
# URL CONVERSION
# ============================================================

def normalize_path(path: str):

    if not path:
        return "/"

    # Remove .html
    if REMOVE_HTML_EXTENSION:

        path = re.sub(
            r"\.html?$",
            "",
            path,
            flags=re.I
        )

        if path.endswith("/index"):
            path = path[:-6]

    if not path:
        path = "/"

    if not path.startswith("/"):
        path = "/" + path

    # Avoid duplicate slashes.
    path = re.sub(r"/+", "/", path)

    return path


def normalize_query(query: str):

    params = parse_qsl(
        query,
        keep_blank_values=True
    )

    params = [
        (key, value)
        for key, value in params
        if key.lower() not in IGNORE_PARAMETERS
    ]

    return urlencode(
        params,
        doseq=True
    )


def normalize_url(url: str):

    if not url:
        return None

    url = url.strip()

    # Ignore anchors.
    if url.startswith("#"):
        return None

    lower = url.lower()

    # Ignore non-page protocols.
    if lower.startswith((
        "javascript:",
        "mailto:",
        "tel:",
        "data:",
        "blob:",
    )):
        return None

    parsed = urlparse(url)

    # External site.
    if parsed.scheme and parsed.scheme.lower() not in {"http", "https"}:
        return None

    if parsed.netloc:

        site_domain = urlparse(DOMAIN).netloc.lower()

        if parsed.netloc.lower() != site_domain:
            return None

    path = parsed.path

    if not path:
        path = "/"

    # Check whether URL points at a resource.
    suffix = Path(path).suffix.lower()

    if suffix in RESOURCE_EXTENSIONS:
        return None

    path = normalize_path(path)
    query = normalize_query(parsed.query)

    result = DOMAIN + path

    if query:
        result += "?" + query

    return result


def file_to_url(path: Path):

    relative = path.relative_to(ROOT).as_posix()

    if relative.lower() in {
        "index.html",
        "index.htm"
    }:
        return DOMAIN + "/"

    relative = re.sub(
        r"/index\.html?$",
        "/",
        relative,
        flags=re.I
    )

    if REMOVE_HTML_EXTENSION:

        relative = re.sub(
            r"\.html?$",
            "",
            relative,
            flags=re.I
        )

    return DOMAIN + "/" + relative.lstrip("/")


# ============================================================
# FIND REAL HTML PAGES
# ============================================================

def find_pages():

    pages = []

    for path in ROOT.rglob("*"):

        if not path.is_file():
            continue

        if ignored(path):
            continue

        if path.suffix.lower() not in PAGE_EXTENSIONS:
            continue

        text = read_text(path)

        if not text:
            continue

        parser = PageParser()

        try:
            parser.feed(text)
        except Exception:
            pass

        # Shared header/footer fragments are not standalone search pages.
        if not parser.is_document:
            continue

        if parser.noindex:

            print(
                "[NOINDEX]",
                path.relative_to(ROOT)
            )

            continue

        url = file_to_url(path)
        if parser.canonical:
            canonical = normalize_url(parser.canonical)
            # A copied canonical must not make a different wiki article disappear.
            if canonical and urlparse(canonical).path.rstrip("/") == urlparse(url).path.rstrip("/"):
                url = canonical
            else:
                print(f"[CANONICAL MISMATCH] {path.relative_to(ROOT)}: using {url}")

        pages.append({
            "file": path,
            "url": url,
            "lastmod": modification_date(path),
            "text": text,
            "parser": parser,
        })

    return pages


# ============================================================
# URL DISCOVERY
# ============================================================

def extract_source_urls(text: str):
    """
    Search complete source code for internal URLs.

    Finds:

        href="/page.html"

        "/webpages/game-c?char=c1"

        '/webpages/game-c?char=c2'

        window.location.href="/page?id=1"

        const x="/page?c=c1"

        "/ml-game/apps/map.html"

    This is what allows JavaScript objects such as
    characterLinks to be discovered.
    """

    urls = set()

    # --------------------------------------------------------
    # Strings beginning with /
    # --------------------------------------------------------

    pattern = r"""["'](\/[^"'<> \t\r\n]+)["']"""

    for match in re.finditer(pattern, text):

        value = match.group(1)

        urls.add(value)

    # --------------------------------------------------------
    # Full mysticallegends.org URLs
    # --------------------------------------------------------

    domain_pattern = (
        r"""["']("""
        + re.escape(DOMAIN)
        + r"""[^"'<> \t\r\n]*)["']"""
    )

    for match in re.finditer(
        domain_pattern,
        text,
        re.I
    ):

        urls.add(match.group(1))

    return urls


# ============================================================
# DETERMINE WHETHER BASE PAGE EXISTS
# ============================================================

def known_page_paths(pages):

    result = set()

    for page in pages:

        parsed = urlparse(page["url"])

        path = parsed.path.rstrip("/") or "/"

        result.add(path)

    return result


def base_page_exists(url, paths):

    parsed = urlparse(url)

    path = parsed.path.rstrip("/") or "/"

    return path in paths


# ============================================================
# SCAN ENTIRE PROJECT
# ============================================================

def discover_urls(pages):

    discovered = {}

    paths = known_page_paths(pages)

    # --------------------------------------------------------
    # Actual HTML pages
    # --------------------------------------------------------

    for page in pages:

        discovered[page["url"]] = {
            "url": page["url"],
            "lastmod": page["lastmod"],
            "source": page["file"],
            "type": "page",
        }

    # --------------------------------------------------------
    # Scan HTML + JS + JSON
    # --------------------------------------------------------

    for path in ROOT.rglob("*"):

        if not path.is_file():
            continue

        if ignored(path):
            continue

        if path.suffix.lower() not in SCAN_EXTENSIONS:
            continue

        text = read_text(path)

        if not text:
            continue

        found = extract_source_urls(text)

        for raw_url in found:

            normalized = normalize_url(raw_url)

            if not normalized:
                continue

            parsed = urlparse(normalized)

            # Wiki articles use one clean, canonical URL per HTML file.
            # Old template query URLs and arbitrary wiki query variants are excluded.
            if parsed.path.startswith("/wiki/") and parsed.query:
                continue

            # --------------------------------------------
            # Parameterized URL
            # --------------------------------------------

            if parsed.query:

                if not base_page_exists(
                    normalized,
                    paths
                ):
                    print(
                        "[PARAM BASE NOT FOUND]",
                        normalized,
                        "->",
                        path.relative_to(ROOT)
                    )

                    continue

                url_type = "parameter"

            # --------------------------------------------
            # Normal URL
            # --------------------------------------------

            else:

                page_path = (
                    parsed.path.rstrip("/")
                    or "/"
                )

                # Only add actual known HTML pages.
                if page_path not in paths:
                    continue

                url_type = "linked-page"

            # Don't overwrite a real page entry.
            if normalized not in discovered:

                discovered[normalized] = {
                    "url": normalized,
                    "lastmod": modification_date(path),
                    "source": path,
                    "type": url_type,
                }

    return discovered


# ============================================================
# GENERATE XML
# ============================================================

def create_sitemap(discovered):

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset '
        'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "",
    ]

    for url in sorted(discovered):

        info = discovered[url]

        safe_url = html.escape(
            url,
            quote=True
        )

        lines.extend([
            "  <url>",
            f"    <loc>{safe_url}</loc>",
            f"    <lastmod>{info['lastmod']}</lastmod>",
            "  </url>",
            "",
        ])

    lines.append("</urlset>")
    lines.append("")

    OUTPUT.write_text(
        "\n".join(lines),
        encoding="utf-8"
    )


# ============================================================
# REPORT
# ============================================================

def print_report(discovered):

    pages = []
    parameters = []

    for info in discovered.values():

        if info["type"] == "parameter":
            parameters.append(info)

        else:
            pages.append(info)

    print()
    print("========================================")
    print(" STANDARD PAGES")
    print("========================================")

    for info in sorted(
        pages,
        key=lambda x: x["url"]
    ):
        print("+", info["url"])

    print()
    print("========================================")
    print(" PARAMETERIZED PAGES")
    print("========================================")

    if not parameters:
        print("None found.")

    for info in sorted(
        parameters,
        key=lambda x: x["url"]
    ):

        print("+", info["url"])

        print(
            "    Found in:",
            info["source"].relative_to(ROOT)
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("========================================")
    print(" Mystical Legends Sitemap Generator")
    print("========================================")
    print()

    print("Root:")
    print(ROOT)

    print()
    print("Scanning website...")
    print()

    pages = find_pages()

    print(
        f"Found {len(pages)} "
        f"indexable HTML files."
    )

    discovered = discover_urls(pages)

    create_sitemap(discovered)

    print_report(discovered)

    parameter_count = sum(
        1
        for x in discovered.values()
        if x["type"] == "parameter"
    )

    print()
    print("========================================")
    print(" COMPLETE")
    print("========================================")

    print(
        f"HTML pages:       {len(pages)}"
    )

    print(
        f"Parameter pages:  {parameter_count}"
    )

    print(
        f"Sitemap URLs:     {len(discovered)}"
    )

    print()
    print("Created:")
    print(OUTPUT)
    print()


if __name__ == "__main__":
    main()