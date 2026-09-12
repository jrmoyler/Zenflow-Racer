#!/usr/bin/env bash
set -euo pipefail
# Optional offline art/review tool; never ships to browsers.
blender_root="${ZENFLOW_TOOLS_DIR:-$PWD/.tools}"
mkdir -p "$blender_root"
curl -fL 'https://download.blender.org/release/Blender4.5/blender-4.5.0-linux-x64.tar.xz' -o "$blender_root/blender-4.5.0.tar.xz"
# Streaming file copies avoid truncated executables on virtualized filesystems.
# Validate every regular member before using the downloaded tool.
python3 - "$blender_root" <<'PYEXTRACT'
import os, pathlib, shutil, sys, tarfile
base = pathlib.Path(sys.argv[1]).resolve()
with tarfile.open(base / 'blender-4.5.0.tar.xz', mode='r|xz') as archive:
    for member in archive:
        target = base / member.name
        if not target.resolve().is_relative_to(base):
            raise RuntimeError('Unsafe archive member: ' + member.name)
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
        elif member.isfile():
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(member) as source, target.open('wb') as output:
                shutil.copyfileobj(source, output, 1024 * 1024)
            if target.stat().st_size != member.size:
                raise RuntimeError('Incomplete extraction: ' + member.name)
            os.chmod(target, member.mode)
        elif member.issym():
            if not (target.parent / member.linkname).resolve().is_relative_to(base):
                raise RuntimeError('Unsafe archive symlink: ' + member.name)
            target.unlink(missing_ok=True)
            target.symlink_to(member.linkname)
PYEXTRACT
"$blender_root/blender-4.5.0-linux-x64/blender" --version
