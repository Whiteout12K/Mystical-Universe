#!/usr/bin/env python3
"""Remove disposable local caches without touching tracked files or development databases."""
import sys
sys.dont_write_bytecode = True
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def clean():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    candidates = [ROOT / name for name in ('scripts/__pycache__', 'tests/__pycache__', 'books/epub/__pycache__')]
    try:
        active = subprocess.run(['pgrep', '-f', '(node|workerd).*wrangler'], capture_output=True).returncode
    except FileNotFoundError:
        active = 0  # Leave Wrangler's files alone when its activity cannot be checked.
    if active == 1:
        candidates.extend(ROOT / name for name in ('.wrangler/cache', '.wrangler/tmp'))
    removed = 0
    for path in candidates:
        relative = path.relative_to(ROOT).as_posix()
        if path.is_symlink() or not path.is_dir():
            continue
        if any(name == relative or name.startswith(relative + '/') for name in tracked):
            continue
        removed += sum(file.stat().st_size for file in path.rglob('*') if file.is_file() and not file.is_symlink())
        shutil.rmtree(path)
    return removed

if __name__ == '__main__':
    removed = clean()
    if '--quiet' not in sys.argv:
        print(f'Removed {removed:,} bytes of disposable caches. Active Wrangler files and local databases are preserved.')
