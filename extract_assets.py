#!/usr/bin/env python3
"""Extract inline base64 data URIs from miko-quest.html into assets/ and
rewrite the HTML to reference them by path. Identical payloads are
deduplicated so they share a single file."""
import re, base64, hashlib, os, collections

SRC = "miko-quest.html"
ASSETS = "assets"
os.makedirs(ASSETS, exist_ok=True)

with open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
}

# data:<mime>;base64,<payload>  (payload is base64 chars until a quote/paren)
pattern = re.compile(r'data:([a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)')

def derive_name(text, start):
    """Look backwards from the data URI for a sensible name."""
    pre = text[max(0, start-160):start]
    # JS map key:  "name": "  or  'name': '
    m = re.search(r'["\']([A-Za-z0-9_]+)["\']\s*:\s*["\']$', pre)
    if m:
        return m.group(1)
    # id="..." somewhere before a src="
    m = re.search(r'id=["\']([A-Za-z0-9_-]+)["\'][^>]*$', pre)
    if m:
        return m.group(1)
    return None

used = collections.Counter()
by_hash = {}      # payload hash -> filename
name_counts = collections.Counter()

result = []
last = 0
seq = 0
manifest = []

for m in pattern.finditer(html):
    mime = m.group(1)
    payload = m.group(2)
    ext = EXT.get(mime, mime.split("/")[-1])
    h = hashlib.md5(payload.encode()).hexdigest()

    if h in by_hash:
        fname = by_hash[h]
    else:
        base = derive_name(html, m.start())
        if not base:
            base = f"{mime.split('/')[0]}_{seq}"
        # sanitize
        base = re.sub(r'[^A-Za-z0-9_-]', '_', base)
        candidate = f"{base}.{ext}"
        if name_counts[candidate]:
            candidate = f"{base}_{name_counts[candidate]}.{ext}"
        name_counts[f"{base}.{ext}"] += 1
        fname = candidate
        by_hash[h] = fname
        # write the file
        try:
            data = base64.b64decode(payload)
        except Exception as e:
            data = base64.b64decode(payload + "=" * (-len(payload) % 4))
        with open(os.path.join(ASSETS, fname), "wb") as out:
            out.write(data)
        manifest.append((fname, mime, len(data)))
    seq += 1

    result.append(html[last:m.start()])
    result.append(f"{ASSETS}/{fname}")
    last = m.end()
    used[fname] += 1

result.append(html[last:])
new_html = "".join(result)

with open(SRC, "w", encoding="utf-8") as f:
    f.write(new_html)

print(f"Total data URIs replaced: {sum(used.values())}")
print(f"Unique asset files written: {len(manifest)}")
print(f"New HTML size: {len(new_html):,} bytes")
print("--- assets ---")
for fname, mime, size in sorted(manifest):
    print(f"  {fname:32s} {mime:14s} {size:>10,} bytes  (refs: {used[fname]})")
