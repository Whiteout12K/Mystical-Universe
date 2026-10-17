#!/usr/bin/env python3
"""Compatibility entry point for existing Cloudflare build commands.

The generator lives in scripts/sitemap_gen.py. Both commands work from the root.
"""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "scripts" / "sitemap_gen.py"), run_name="__main__")
