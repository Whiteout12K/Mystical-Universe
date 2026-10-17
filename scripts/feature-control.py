#!/usr/bin/env python3
"""Enable or disable one website improvement without changing other features."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['list','enable','disable']);p.add_argument('feature',nargs='?');args=p.parse_args();path=ROOT/'data/site-features.json';flags=json.loads(path.read_text())
if args.action=='list':
 for feature,value in flags.items():print(feature+': '+('enabled' if value else 'disabled'))
else:
 if args.feature not in flags:p.error('Choose one of: '+', '.join(flags))
 flags[args.feature]=args.action=='enable';path.write_text(json.dumps(flags,indent=2)+'\n');print(args.feature+': '+('enabled' if flags[args.feature] else 'disabled')+'. Refresh open pages to apply.')
