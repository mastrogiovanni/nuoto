# PDF Plugin System

This project supports multiple PDF result formats through a plugin architecture.
Each plugin handles one format family and exposes two methods: `can_handle` and `parse`.

---

## Data Model

Every plugin outputs a flat table where **each row is one athlete result**.
The canonical columns are defined in `plugins/base.py`:

| Column           | Type         | Description                                               | Example              |
|------------------|--------------|-----------------------------------------------------------|----------------------|
| `event_distance` | `str`        | Distance in metres                                        | `"100"`              |
| `event_style`    | `str`        | Stroke / style name                                       | `"Stile Libero"`     |
| `event_type`     | `str`        | Competition tier                                          | `"Assoluti"`         |
| `sex`            | `str`        | `"Femmine"` or `"Maschi"`                                 | `"Femmine"`          |
| `category`       | `str`        | Age/skill category within the event                       | `"Seniores"`         |
| `position`       | `int\|None`  | Finishing position; `None`/empty for non-classified       | `3`                  |
| `surname`        | `str`        | Athlete surname (UPPERCASE in source)                     | `"ROSSI"`            |
| `firstname`      | `str`        | Athlete first name                                        | `"Marco"`            |
| `year`           | `int`        | Birth year                                                | `2008`               |
| `nationality`    | `str`        | 3-letter nationality code                                 | `"ITA"`              |
| `society`        | `str`        | Club / team name                                          | `"Superba Nuoto ssd"`|
| `splits`         | `str`        | Comma-separated intermediate split times (may be empty)   | `"31.41,32.95"`      |
| `final_time`     | `str`        | Final race time                                           | `"1'04.36"`          |
| `status`         | `str`        | `"OK"`, `"NP"`, `"AB"`, `"RIT"`, `"DNS"`, `"DNF"`        | `"OK"`               |

A **gara** (event) is the combination of `(event_distance, event_style, event_type, sex)`.
Results for each gara are grouped by `category` when the format includes age/skill categories.

---

## Plugin API

All plugins live in `plugins/` and must:

1. Inherit from `plugins.base.PDFPlugin`
2. Be decorated with `@plugins.register`
3. Set class attributes `name` (unique slug) and `description`
4. Implement `can_handle(cls, pdf_path: str) -> bool`
5. Implement `parse(cls, pdf_path: str) -> pd.DataFrame`
6. Call `cls._ensure_columns(df)` before returning from `parse()`

### `can_handle(cls, pdf_path: str) -> bool`

- Must **never raise**; catch all exceptions and return `False`.
- Should be **fast**: convert only a small portion of the document
  (first 2–4 KB of extracted text) and look for format-specific markers.
- Return `True` only when confident the plugin can produce correct output.

### `parse(cls, pdf_path: str) -> pd.DataFrame`

- Return a DataFrame with exactly the columns in `RESULT_COLUMNS` (see above).
- Call `cls._ensure_columns(df)` at the end to guarantee column presence and order.
- Silently drop rows that cannot be parsed.
- Columns unavailable in the source format should be empty strings or NaN.

---

## Adding a New Plugin

### Minimal skeleton

Create `plugins/my_format.py`:

```python
"""Plugin for My Format PDF result files."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from plugins import register
from plugins.base import PDFPlugin


@register
class MyFormatPlugin(PDFPlugin):
    name = 'my-format'
    description = 'My Format competition results'

    @classmethod
    def can_handle(cls, pdf_path: str) -> bool:
        try:
            # Quick heuristic: look for a unique string present in your format
            from markitdown import MarkItDown
            text = MarkItDown().convert(pdf_path).text_content[:4096]
            return 'MY FORMAT SIGNATURE' in text
        except Exception:
            return False

    @classmethod
    def parse(cls, pdf_path: str) -> pd.DataFrame:
        rows = []

        # --- parse logic here ---
        # Populate a list of dicts, each with the RESULT_COLUMNS keys.
        # rows.append({
        #     'event_distance': '100',
        #     'event_style': 'Stile Libero',
        #     ...
        # })

        df = pd.DataFrame(rows)
        return cls._ensure_columns(df)
```

The plugin is auto-discovered at startup — no registration outside the file is needed.

### Guidelines

- Use `markitdown.MarkItDown` to convert the PDF to markdown/text as the first step.
- Name the file after the format family (e.g. `lenex.py`, `swimrankings.py`).
- The `name` slug must be unique across all plugins.
- If your format has no concept of a column (e.g. no splits), leave it empty — do not omit it.

---

## CLI Reference

```
python main.py list-plugins
python main.py detect <file.pdf>
python main.py parse  <file.pdf> [--plugin NAME] [--format csv|json] [--output out.csv]
```

### `list-plugins`
Print all registered plugins and their descriptions.

### `detect <file>`
Try each plugin in registration order and print the first match.
Exit code 1 if no plugin matches.

### `parse <file>`
Auto-detect the plugin (or use `--plugin NAME`) and extract results.

| Option            | Default | Description                                  |
|-------------------|---------|----------------------------------------------|
| `--plugin NAME`   | auto    | Force a specific plugin by name              |
| `--format`        | `csv`   | Output format: `csv` or `json`               |
| `--output FILE`   | stdout  | Write to a file instead of printing          |

Examples:

```bash
# Auto-detect and write CSV
python main.py parse results.pdf --output out.csv

# Force plugin, JSON output
python main.py parse results.pdf --plugin federnuoto --format json --output out.json

# Pipe CSV to another tool
python main.py parse results.pdf | csvlook
```
