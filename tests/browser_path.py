"""Resolve an installed browser; never download one implicitly."""
from pathlib import Path
import os
import shutil

def chromium_path() -> str:
    override = os.environ.get('CHROMIUM_PATH')
    if override:
        if not Path(override).is_file():
            raise RuntimeError('CHROMIUM_PATH does not name an existing browser executable.')
        return override
    for name in ('chromium', 'chromium-browser', 'google-chrome', 'chrome', 'msedge'):
        found = shutil.which(name)
        if found:
            return found
    for candidate in (
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ):
        if Path(candidate).is_file():
            return candidate
    raise RuntimeError('Install Chromium/Chrome separately or set CHROMIUM_PATH; this test never downloads a browser.')
