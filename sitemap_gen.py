#!/usr/bin/env python3
"""Update sitemap.xml using the generator in scripts/sitemap_gen.py.

From the repository root, run either:
    python3 sitemap_gen.py
    ./sitemap_gen.py

Paths are resolved relative to this file, independently of the working directory.
"""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "scripts" / "sitemap_gen.py"), run_name="__main__")

# Just use python3 sitemap_gen.py. 