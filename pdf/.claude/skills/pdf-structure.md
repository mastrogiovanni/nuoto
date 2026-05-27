---
name: pdf-structure
description: Quick reference for the swimming PDF extraction data model, plugin system, and output format
---

# Swimming PDF Extraction — Data Structure Reference

## Output: one row per athlete result

Every plugin returns a flat table. Each row represents one athlete competing in one event (gara).

### Columns

| Column           | Type        | Source meaning                                               |
|------------------|-------------|--------------------------------------------------------------|
| `event_distance` | str         | Distance in metres (e.g. `"100"`, `"400"`)                   |
| `event_style`    | str         | Stroke (e.g. `"Stile Libero"`, `"Dorso"`, `"Rana"`, `"Farfalla"`, `"Misti"`) |
| `event_type`     | str         | Competition tier (`"Assoluti"`, `"Categoria"`, `"Promozionale"`, `"Open"`) |
| `sex`            | str         | `"Femmine"` or `"Maschi"`                                    |
| `category`       | str         | Age/skill band within the event (`"Seniores"`, `"Juniores"`, `"Ragazzi"`, `"Cadetti"`, `"Esordienti"`) |
| `position`       | int or None | Finishing rank; empty for non-classified athletes            |
| `surname`        | str         | Athlete surname (UPPERCASE in source PDFs)                   |
| `firstname`      | str         | Athlete first name                                           |
| `year`           | int         | Birth year (4 digits)                                        |
| `nationality`    | str         | 3-letter code (e.g. `"ITA"`)                                 |
| `society`        | str         | Club / team name                                             |
| `splits`         | str         | Intermediate times, comma-separated (may be empty)           |
| `final_time`     | str         | Race result (e.g. `"1'04.36"` or `"58.21"`)                  |
| `status`         | str         | `"OK"` = finished; `"NP"` = no-show; `"AB"` = abandoned; `"RIT"`/`"DNS"`/`"DNF"` = did not start/finish |

### Canonical order
Defined in `plugins/base.py → RESULT_COLUMNS`. Call `cls._ensure_columns(df)` in every plugin's `parse()` to guarantee order and completeness.

## Concept hierarchy

```
Competition
└── Gara (event)  →  (event_distance, event_style, event_type, sex)
    └── Category  →  category column (optional subdivision by age/skill)
        └── AthleteResult  →  one row in the output table
```

## Files

| File                     | Purpose                                              |
|--------------------------|------------------------------------------------------|
| `plugins/base.py`        | `PDFPlugin` ABC + `RESULT_COLUMNS` list              |
| `plugins/__init__.py`    | Registry: `register`, `detect`, `get_plugin`, `list_plugins` |
| `plugins/federnuoto.py`  | FederNuoto / GesNuoto format plugin                  |
| `extraction.py`          | Low-level extraction logic used by `federnuoto.py`   |
| `main.py`                | CLI: `list-plugins`, `detect`, `parse`               |
| `PLUGINS.md`             | Full developer guide for adding new plugins          |

## CLI quick reference

```bash
uv run python main.py list-plugins
uv run python main.py detect file.pdf
uv run python main.py parse  file.pdf --output results.csv
uv run python main.py parse  file.pdf --format json --output results.json
uv run python main.py parse  file.pdf --plugin federnuoto --output results.csv
```

## Adding a plugin — minimum steps

1. Create `plugins/<slug>.py`
2. Import `register` from `plugins` and `PDFPlugin` from `plugins.base`
3. Decorate class with `@register`, set `name` and `description`
4. Implement `can_handle(cls, pdf_path)` → bool (fast, never raises)
5. Implement `parse(cls, pdf_path)` → DataFrame, end with `return cls._ensure_columns(df)`

Full guide: `PLUGINS.md`; skeleton: ask `/pdf-new-plugin`
