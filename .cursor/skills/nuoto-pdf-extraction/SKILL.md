---
name: nuoto-pdf-extraction
description: >-
  Extends the Nuoto Python PDF result extractor — plugin system, RESULT_COLUMNS,
  federnuoto format, and CLI. Use when adding PDF plugins, parsing competition
  PDFs, or integrating PDF output with Federnuoto scrapers.
---

# Nuoto PDF extraction

Location: `pdf/` — semi-independent Python subsystem used by Federnuoto scraping.

## Docs

- [pdf/README.md](../../pdf/README.md) — CLI usage
- [pdf/PLUGINS.md](../../pdf/PLUGINS.md) — full plugin developer guide
- Legacy Claude skills: `pdf/.claude/skills/pdf-structure.md`, `pdf-new-plugin.md`

## CLI

```bash
cd pdf
uv run python main.py list-plugins
uv run python main.py detect file.pdf
uv run python main.py parse file.pdf --output results.csv
uv run python main.py parse file.pdf --format json --output results.json
```

## Plugin architecture

| File | Role |
|------|------|
| `plugins/base.py` | `PDFPlugin` ABC, `RESULT_COLUMNS` |
| `plugins/__init__.py` | Registry: `register`, `detect`, `get_plugin` |
| `plugins/federnuoto.py` | FederNuoto / GesNuoto format |
| `main.py` | CLI entry |

Auto-discovery: any module in `plugins/` with `@register`.

## Output columns (one row per athlete per event)

`event_distance`, `event_style`, `event_type`, `sex`, `category`, `position`, `surname`, `firstname`, `year`, `nationality`, `society`, `splits`, `final_time`, `status`

Always end `parse()` with `return cls._ensure_columns(df)`.

## New plugin checklist

1. Create `plugins/<slug>.py`
2. `@register` class with unique `name`
3. `can_handle(pdf_path)` — fast, ≤4KB text, never raises
4. `parse(pdf_path)` → DataFrame with all columns
5. Verify: `detect`, `parse`, column completeness

## Text extraction for development

```bash
uv run python -c "
from markitdown import MarkItDown
print(MarkItDown().convert('file.pdf').text_content[:3000])
"
```

## Design rules

- `can_handle`: fast signature check, return False on error
- `parse`: drop bad rows silently, don't crash
- Missing columns → empty string, not omitted
- `status`: OK / NP / AB / RIT / DNS / DNF

## Integration with pipeline

PDF output feeds Federnuoto scraper raw JSON — aggregated format differs. When changing PDF columns, verify downstream Federnuoto → aggregator conversion still maps correctly. See `nuoto-aggregator` skill.
