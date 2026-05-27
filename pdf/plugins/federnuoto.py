"""Plugin for FederNuoto / GesNuoto PDF result files.

Supports the standard FederNuoto competition result format produced by the
GesNuoto software.  Characteristic markers:
  - Event headers like "100 m Stile Libero - Assoluti Femmine"
  - Category lines like "Seniores Femmine", "Juniores Maschi"
  - Footer text "Software GESNUOTO" or "Stampata il"

Detection strategy: convert the first portion of the PDF text and search for
the EVENT_RE pattern or the GesNuoto software signature.
"""

import sys
from pathlib import Path

# Allow direct import of top-level modules when plugins/ is a sub-package
sys.path.insert(0, str(Path(__file__).parent.parent))

import extraction  # noqa: E402 (top-level extraction module)
from plugins import register  # noqa: E402
from plugins.base import PDFPlugin  # noqa: E402

try:
    from markitdown import MarkItDown as _MarkItDown
    _MARKITDOWN_AVAILABLE = True
except ImportError:
    _MARKITDOWN_AVAILABLE = False

# Signature patterns unique to the GesNuoto format
_GESNUOTO_SIGNATURES = [
    'GESNUOTO',
    'GesNuoto',
    'Stampata il',
    'ANNO NAZ SOCIETA',
]


@register
class FederNuotoPlugin(PDFPlugin):
    name = 'federnuoto'
    description = 'FederNuoto / GesNuoto competition results (Italian swimming federation)'

    @classmethod
    def can_handle(cls, pdf_path: str) -> bool:
        if not _MARKITDOWN_AVAILABLE:
            return False
        try:
            md = _MarkItDown()
            result = md.convert(pdf_path)
            # Only inspect the first 4 KB to stay fast
            text = result.text_content[:4096]
            # Match either the event header pattern or the software signature
            if extraction.EVENT_RE.search(text):
                return True
            return any(sig in text for sig in _GESNUOTO_SIGNATURES)
        except Exception:
            return False

    @classmethod
    def parse(cls, pdf_path: str) -> 'pd.DataFrame':
        import pandas as pd  # local import keeps module lightweight
        df = extraction.extract(pdf_path)
        return cls._ensure_columns(df)
