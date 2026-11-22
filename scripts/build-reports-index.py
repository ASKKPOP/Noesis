#!/usr/bin/env python3
"""Build docs/reports/index.html — the list served at https://noesiis.com/reports/.

Every HTML report for Noēsis lives in docs/reports/. This script reads each page's
<title>, its optional <meta name="description">, and the date in its file name
(either a `YYYY-MM-DD-` prefix or a `-YYYY-MM-DD` suffix) and writes one
self-contained index page, newest first.

The output is deterministic: no build time, no host names. Running it twice on
the same folder gives the same bytes, so the served file can be compared to
main by hash.

    python3 scripts/build-reports-index.py           # write the index
    python3 scripts/build-reports-index.py --check   # exit 1 if it is stale
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "docs" / "reports"
INDEX = REPORTS / "index.html"

DATE_RE = re.compile(r"(?:^|-)(\d{4}-\d{2}-\d{2})(?:-|$)")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
DESC_RE = re.compile(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', re.I | re.S)


def read_entry(path: Path) -> dict:
    head = path.read_text(encoding="utf-8", errors="replace")[:20000]
    title_m = TITLE_RE.search(head)
    desc_m = DESC_RE.search(head)
    date_m = DATE_RE.search(path.stem)
    title = html.unescape(re.sub(r"\s+", " ", title_m.group(1)).strip()) if title_m else path.stem
    desc = html.unescape(re.sub(r"\s+", " ", desc_m.group(1)).strip()) if desc_m else ""
    return {
        "file": path.name,
        "title": title,
        "desc": desc,
        "date": date_m.group(1) if date_m else "",
        "kb": max(1, round(path.stat().st_size / 1024)),
    }


def build() -> str:
    entries = [read_entry(p) for p in sorted(REPORTS.glob("*.html")) if p.name != "index.html"]
    entries.sort(key=lambda e: (e["date"], e["file"]), reverse=True)
    rows = []
    for e in entries:
        desc = f'<div class="d">{html.escape(e["desc"])}</div>' if e["desc"] else ""
        rows.append(
            f'<a class="row" href="{html.escape(e["file"])}">'
            f'<span class="date">{html.escape(e["date"] or "undated")}</span>'
            f'<span class="body"><span class="t">{html.escape(e["title"])}</span>{desc}'
            f'<span class="f">{html.escape(e["file"])} · {e["kb"]} KB</span></span></a>'
        )
    newest = entries[0]["date"] if entries else "—"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Noēsis — Reports</title>
<meta name="description" content="Every report, discussion sheet and result page for the Noēsis project.">
<style>
:root{{--bg:#0a0e14;--surface:#121a25;--border:#22303f;--soft:#1a2633;--text:#e6edf3;--muted:#a9b6c4;--muted2:#6b7b8c;--accent:#5fb0e8;--accent2:#46e0d0;
--mono:'SFMono-Regular',ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.6;font-size:15.5px}}
.wrap{{max-width:920px;margin:0 auto;padding:48px 20px 80px}}
.k{{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted2)}}
h1{{font-size:32px;margin:8px 0 6px}}
p{{color:var(--muted);margin:8px 0 26px}}
.row{{display:flex;gap:18px;padding:16px 18px;margin:10px 0;background:var(--surface);border:1px solid var(--border);border-radius:10px;text-decoration:none;color:inherit}}
.row:hover{{border-color:var(--accent)}}
.date{{font-family:var(--mono);font-size:12px;color:var(--accent2);white-space:nowrap;padding-top:3px;min-width:92px}}
.body{{display:flex;flex-direction:column;gap:4px;min-width:0}}
.t{{font-weight:600;color:var(--text)}}
.d{{color:var(--muted);font-size:14px}}
.f{{font-family:var(--mono);font-size:11px;color:var(--muted2);word-break:break-all}}
footer{{margin-top:50px;border-top:1px solid var(--soft);padding-top:14px;font-family:var(--mono);font-size:11px;color:var(--muted2)}}
@media(max-width:560px){{.row{{flex-direction:column;gap:6px}}}}
</style>
</head>
<body>
<div class="wrap">
<div class="k">NOĒSIS · REPORTS</div>
<h1>Reports</h1>
<p>{len(entries)} page{"s" if len(entries) != 1 else ""}, newest first. Latest: {html.escape(newest)}. Each page is one self-contained file.</p>
{chr(10).join(rows)}
<footer>Built by scripts/build-reports-index.py from docs/reports/ · served at /reports/</footer>
</div>
</body>
</html>
"""


def main() -> int:
    out = build()
    if "--check" in sys.argv:
        current = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""
        if current != out:
            print("docs/reports/index.html is stale — run: python3 scripts/build-reports-index.py")
            return 1
        print("docs/reports/index.html is up to date")
        return 0
    INDEX.write_text(out, encoding="utf-8")
    print(f"wrote {INDEX.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
