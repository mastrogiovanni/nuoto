# Swimming PDF Extractor

Extracts athlete results from swimming competition PDFs into structured CSV or JSON.
Supports multiple PDF formats through a plugin architecture — each format is an independent plugin that detects and parses its own files.

---

## Quick start

```bash
# See available plugins
uv run python main.py list-plugins

# Auto-detect format and extract to CSV
uv run python main.py parse results.pdf --output results.csv

# Extract to JSON
uv run python main.py parse results.pdf --format json --output results.json

# Check which plugin handles a file
uv run python main.py detect results.pdf
```

---

## Output format

Every command produces a flat table where **each row is one athlete result**.

| Column           | Type        | Description                                               | Example               |
|------------------|-------------|-----------------------------------------------------------|-----------------------|
| `event_distance` | str         | Race distance in metres                                   | `100`                 |
| `event_style`    | str         | Stroke                                                    | `Stile Libero`        |
| `event_type`     | str         | Competition tier                                          | `Assoluti`            |
| `sex`            | str         | `Femmine` or `Maschi`                                     | `Femmine`             |
| `category`       | str         | Age/skill band within the event                           | `Seniores`            |
| `position`       | int or None | Finishing rank; empty for non-classified athletes         | `3`                   |
| `surname`        | str         | Athlete surname                                           | `ROSSI`               |
| `firstname`      | str         | Athlete first name                                        | `Marco`               |
| `year`           | int         | Birth year                                                | `2008`                |
| `nationality`    | str         | 3-letter code                                             | `ITA`                 |
| `society`        | str         | Club / team name                                          | `Superba Nuoto ssd`   |
| `splits`         | str         | Intermediate split times, comma-separated (may be empty) | `30.61,33.50`         |
| `final_time`     | str         | Race result                                               | `1'04.11`             |
| `status`         | str         | `OK` / `NP` / `AB` / `RIT` / `DNS` / `DNF`               | `OK`                  |

A **gara** (event) is the combination `(event_distance, event_style, event_type, sex)`.
Athletes within a gara may be further grouped by `category` when the format supports age/skill bands.

---

## CLI reference

### `list-plugins`

```
uv run python main.py list-plugins
```

Lists all registered plugins with their names and descriptions.

### `detect <file>`

```
uv run python main.py detect <file.pdf>
```

Tries each plugin in registration order and prints the first one that claims it can handle the file.  
Exit code `1` if no plugin matches.

### `parse <file>`

```
uv run python main.py parse <file.pdf> [OPTIONS]
```

| Option           | Default | Description                                  |
|------------------|---------|----------------------------------------------|
| `--plugin NAME`  | auto    | Force a specific plugin (skip auto-detection)|
| `--format`       | `csv`   | Output format: `csv` or `json`               |
| `--output FILE`  | stdout  | Write results to a file                      |

When `--plugin` is omitted the tool auto-detects the format.  
When `--output` is omitted results are printed to stdout.

```bash
# Force a plugin, write JSON
uv run python main.py parse file.pdf --plugin federnuoto --format json --output out.json

# Pipe to another tool
uv run python main.py parse file.pdf | csvlook
```

---

## Plugins

### Available plugins

| Name          | Description                                              |
|---------------|----------------------------------------------------------|
| `federnuoto`  | FederNuoto / GesNuoto competition results (Italian swimming federation) |

### How detection works

When you run `parse` without `--plugin`, the CLI calls `can_handle()` on each registered plugin in turn and uses the first one that returns `True`.  
`can_handle` inspects only the first few KB of extracted text — it is fast and non-destructive.

### Adding a new plugin

See **[PLUGINS.md](PLUGINS.md)** for the full guide.  
Or invoke the `/pdf-new-plugin` skill inside Claude Code for a guided walkthrough.

The short version:

1. Create `plugins/<slug>.py`
2. Inherit from `PDFPlugin`, decorate with `@register`
3. Set `name` and `description`
4. Implement `can_handle(cls, pdf_path) -> bool` (fast, never raises)
5. Implement `parse(cls, pdf_path) -> pd.DataFrame`, end with `return cls._ensure_columns(df)`

No other wiring is needed — the plugin is auto-discovered at startup.

---

## Project structure

```
pdf/
├── plugins/
│   ├── __init__.py       # Registry: register, detect, get_plugin, list_plugins
│   ├── base.py           # PDFPlugin ABC + RESULT_COLUMNS
│   └── federnuoto.py     # FederNuoto / GesNuoto plugin
├── extraction.py          # Low-level extraction logic (used by federnuoto.py)
├── main.py               # CLI entry point
├── pyproject.toml
├── README.md             # This file
└── PLUGINS.md            # Plugin developer guide
```

---

## Requirements

- Python ≥ 3.13
- Dependencies managed with `uv` (see `pyproject.toml`):
  - `markitdown[all]` — PDF → markdown conversion
  - `pandas` — tabular output
  - `lxml`, `requests` — MarkItDown dependencies
