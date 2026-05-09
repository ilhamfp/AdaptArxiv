#!/usr/bin/env python3
"""Smoke-test the dev server: load /, collect console + network errors, snapshot."""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3411/"
SHOT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/tmp/adaptarxiv-home.png")

console_errors: list[str] = []
console_warnings: list[str] = []
failed_requests: list[str] = []

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    page.on(
        "console",
        lambda msg: (
            console_errors.append(f"{msg.type}: {msg.text}")
            if msg.type == "error"
            else console_warnings.append(f"{msg.type}: {msg.text}")
            if msg.type == "warning"
            else None
        ),
    )
    page.on("pageerror", lambda exc: console_errors.append(f"pageerror: {exc}"))
    page.on(
        "requestfailed",
        lambda req: failed_requests.append(
            f"{req.method} {req.url} → {req.failure}"
        ),
    )

    response = page.goto(URL, wait_until="networkidle", timeout=30000)
    status = response.status if response else None

    # Allow framer-motion entrance choreography (1.0s + 0.45s delay) to settle.
    page.wait_for_timeout(2000)
    page.screenshot(path=str(SHOT), full_page=True)
    title = page.title()
    browser.close()

print(f"URL: {URL}")
print(f"Status: {status}")
print(f"Title: {title!r}")
print(f"Console errors ({len(console_errors)}):")
for e in console_errors:
    print(f"  - {e}")
print(f"Console warnings ({len(console_warnings)}):")
for w in console_warnings[:10]:
    print(f"  - {w}")
print(f"Failed requests ({len(failed_requests)}):")
for f in failed_requests:
    print(f"  - {f}")
print(f"Screenshot: {SHOT}")

sys.exit(1 if console_errors or failed_requests or (status and status >= 400) else 0)
