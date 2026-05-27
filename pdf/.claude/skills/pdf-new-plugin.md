---
name: pdf-new-plugin
description: Guided workflow for creating a new PDF result format plugin for the swimming extraction system
---

# Create a New PDF Plugin

You are helping write a new plugin for the swimming PDF extraction system.

## Context

- Plugin interface: `plugins/base.py` — `PDFPlugin` ABC with `can_handle` and `parse`
- Registry: `plugins/__init__.py` — auto-discovers modules in `plugins/` at startup
- Canonical output columns: `RESULT_COLUMNS` in `plugins/base.py`
- Example plugin: `plugins/federnuoto.py`
- Full reference: `PLUGINS.md`

## Steps to follow

### 1. Identify the format

Ask the user (or inspect the PDF):
- What software generated this PDF? (GesNuoto, SwimRankings, Lenex, custom?)
- Is there a unique string, logo text, or header that identifies this format?
- What does the athlete row look like? What columns exist?
- Are split times present? Is there a category / age-group hierarchy?

### 2. Extract a text sample

```bash
uv run python -c "
from markitdown import MarkItDown
text = MarkItDown().convert('file.pdf').text_content
print(text[:3000])
"
```

Use this to identify the `can_handle` signature and design the parsing logic.

### 3. Create the plugin file

Create `plugins/<slug>.py` using this template:

```python
"""Plugin for <Format Name> PDF result files.

<Short description of the format, what software produces it, and any known quirks.>
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import re
import pandas as pd
from markitdown import MarkItDown

from plugins import register
from plugins.base import PDFPlugin, RESULT_COLUMNS


# ─── Format-specific patterns ─────────────────────────────────────────────────

_SIGNATURE = 'UNIQUE STRING IN THIS FORMAT'  # used by can_handle

# Add re.compile patterns here as needed


# ─── Helpers ──────────────────────────────────────────────────────────────────

# Add parsing helpers here


# ─── Plugin ───────────────────────────────────────────────────────────────────

@register
class MyFormatPlugin(PDFPlugin):
    name = '<slug>'           # unique, lowercase, hyphenated
    description = '<one-line description>'

    @classmethod
    def can_handle(cls, pdf_path: str) -> bool:
        try:
            text = MarkItDown().convert(pdf_path).text_content[:4096]
            return _SIGNATURE in text  # or use a regex
        except Exception:
            return False

    @classmethod
    def parse(cls, pdf_path: str) -> pd.DataFrame:
        md = MarkItDown()
        result = md.convert(pdf_path)
        lines = result.text_content.split('\n')

        rows: list[dict] = []
        current_event: dict = {}
        current_category: str = ''

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # TODO: detect event headers → populate current_event
            # TODO: detect category headers → update current_category
            # TODO: detect athlete rows → parse and append to rows

        df = pd.DataFrame(rows)
        return cls._ensure_columns(df)
```

### 4. Verify

```bash
# Check detection
uv run python main.py detect file.pdf

# Parse and inspect
uv run python main.py parse file.pdf --output test_out.csv
head test_out.csv

# Check column completeness
uv run python -c "
import pandas as pd
df = pd.read_csv('test_out.csv')
print(df.dtypes)
print(df.head(3).to_string())
"
```

### 5. Checklist

- [ ] `can_handle` returns `False` on error (never raises)
- [ ] `can_handle` returns `False` for a different format's PDF
- [ ] `parse` calls `cls._ensure_columns(df)` before return
- [ ] All `RESULT_COLUMNS` are present (even if empty)
- [ ] `status` is one of `OK / NP / AB / RIT / DNS / DNF`
- [ ] `position` is `None` / empty for non-classified athletes
- [ ] Plugin file is in `plugins/` (auto-discovered — no other registration needed)

## Key design rules

- `can_handle` must be **fast** (≤ first 4 KB of text) and **never raise**
- `parse` should silently drop unparseable rows, not crash
- Columns absent in the source format → empty string, not omitted
- `name` must be globally unique across all plugins
