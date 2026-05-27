"""Plugin for GesNuoto Esordienti youth meet PDF result files.

Characteristic markers:
  - Event headers like "50 Stile Libero Esordienti A Femmine Turno 1/Gara 3  (Serie)"
  - Athlete rows: POSITION SURNAME Firstname YEAR SOCIETY [NAT] TIME [POINTS] [*]
  - Optional split lines: "50m  0'33.62 ()   100m  1'09.60 (35.98)"
  - Footer "Software GESNUOTO by M.L."

Detection: unique combination of "Esordienti" and "Turno N/Gara N" in event headers.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from plugins import register
from plugins.base import PDFPlugin

try:
    from markitdown import MarkItDown as _MarkItDown
    _MARKITDOWN_AVAILABLE = True
except ImportError:
    _MARKITDOWN_AVAILABLE = False

# ─── Patterns ──────────────────────────────────────────────────────────────

_EVENT_RE = re.compile(
    r'(\d+)\s+'
    r'(Stile Libero|Dorso|Rana|Farfalla|Misti)\s+'
    r'(Esordienti\s+[AB])\s+'
    r'(Femmine|Maschi)\s+'
    r'Turno\s+\d+/Gara\s+\d+',
    re.IGNORECASE,
)

_TIME_RE = re.compile(r"(?:\d+')?\d{2}\.\d{2}")
_YEAR_RE = re.compile(r'\b(\d{4})\b')
_NAT_RE = re.compile(r'\(([A-Z]{3})\)')
_POINTS_RE = re.compile(r'\b\d+,\d+\b')

_SPLIT_LINE_RE = re.compile(r'^\s+\d+m\s+')
_SEGUE_RE = re.compile(r'^Segue da\b', re.IGNORECASE)
_NOISE_RE = re.compile(
    r'Servizio elaborazione|Software GESNUOTO|Crono:|Per Falsa Partenza|'
    r'^[-—\s]{5,}$|^\s*$|Classifica Atleti|Comitato|Regionale|Toscano',
    re.IGNORECASE,
)

_POSITIONED_RE = re.compile(r'^\s*(\d+)\s+([A-Z])')
_SQ_RE = re.compile(r'^\s*SQ\s+([A-Z])', re.IGNORECASE)
_FGARA_RE = re.compile(r'\bF\.gara\b', re.IGNORECASE)
_SQUAL_RE = re.compile(r'\bSqual\.?\b', re.IGNORECASE)


# ─── Helpers ───────────────────────────────────────────────────────────────

def _split_name(text: str) -> tuple[str, str]:
    """Split 'SURNAME [SURNAME2] Firstname [more]' into (surname, firstname)."""
    words = text.split()
    surn, first = [], []
    past_upper = False
    for w in words:
        if not past_upper and re.match(r"^[A-Z][A-Z'\-\.]*$", w):
            surn.append(w)
        else:
            past_upper = True
            first.append(w)
    return ' '.join(surn), ' '.join(first)


def _parse_line(line: str, event: dict) -> dict | None:
    """Parse one athlete text line; return a result dict or None."""
    stripped = line.strip()

    # Determine position and status from line start
    pos = None
    status = 'OK'

    if _POSITIONED_RE.match(stripped):
        m = re.match(r'^(\d+)\s+(.*)', stripped)
        pos = int(m.group(1))
        rest = m.group(2).strip()
    elif _SQ_RE.match(stripped):
        m = re.match(r'^SQ\s+(.*)', stripped, re.IGNORECASE)
        rest = m.group(1).strip()
        status = 'SQ'
    elif _FGARA_RE.search(stripped):
        rest = stripped
        status = 'F.gara'
    else:
        return None

    # Anchor on year
    year_m = _YEAR_RE.search(rest)
    if not year_m:
        return None
    year = int(year_m.group(1))

    # Name is everything before year, stripped of any leaked times
    name_raw = _TIME_RE.sub('', rest[:year_m.start()]).strip()
    surname, firstname = _split_name(name_raw)

    # After year: society (NAT) time points * Squal F.gara
    after = rest[year_m.end():].strip()

    # Find last time — it is the final result
    time_matches = list(_TIME_RE.finditer(after))
    if not time_matches:
        return None
    last_time_m = time_matches[-1]
    final_time = last_time_m.group()

    # Society sits between year and the last time (minus optional nationality)
    before_time = after[:last_time_m.start()]
    nat_m = _NAT_RE.search(before_time)
    if nat_m:
        nationality = nat_m.group(1)
        society = (before_time[:nat_m.start()] + before_time[nat_m.end():]).strip()
    else:
        nationality = 'ITA'
        society = before_time.strip()

    return {
        'event_distance': event.get('distance', ''),
        'event_style':    event.get('style', ''),
        'event_type':     event.get('type', ''),
        'sex':            event.get('sex', ''),
        'category':       event.get('type', ''),
        'position':       pos,
        'surname':        surname,
        'firstname':      firstname,
        'year':           year,
        'nationality':    nationality,
        'society':        society,
        'splits':         '',
        'final_time':     final_time,
        'status':         status,
    }


# ─── Core parser ───────────────────────────────────────────────────────────

def _parse(pdf_path: str) -> pd.DataFrame:
    md = _MarkItDown()
    text = md.convert(pdf_path).text_content
    lines = text.split('\n')

    current_event: dict = {}
    rows: list[dict] = []

    for line in lines:
        # Event header — check before noise filter (header line also contains "Crono:")
        m = _EVENT_RE.search(line)
        if m:
            current_event = {
                'distance': m.group(1),
                'style':    m.group(2),
                'type':     m.group(3).strip(),
                'sex':      m.group(4),
            }
            continue

        # Skip noise and page-continuation headers
        if _NOISE_RE.search(line.strip()) or _SEGUE_RE.match(line.strip()):
            continue

        # Split line — attach intermediate cumulative times to the last row
        if _SPLIT_LINE_RE.match(line):
            if rows:
                # Strip parenthesised lap-time values before extracting cumulative times
                clean = re.sub(r'\([^)]*\)', '', line)
                split_times = _TIME_RE.findall(clean)
                # All cumulative times except the last (= final) are intermediate splits
                if len(split_times) > 1:
                    rows[-1]['splits'] = ','.join(split_times[:-1])
            continue

        if not current_event:
            continue

        row = _parse_line(line, current_event)
        if row:
            rows.append(row)

    return pd.DataFrame(rows)


# ─── Plugin ────────────────────────────────────────────────────────────────

@register
class EsordientePlugin(PDFPlugin):
    name = 'esordienti'
    description = 'GesNuoto Esordienti youth meet results (Turno/Gara series format)'

    @classmethod
    def can_handle(cls, pdf_path: str) -> bool:
        if not _MARKITDOWN_AVAILABLE:
            return False
        try:
            text = _MarkItDown().convert(pdf_path).text_content[:4096]
            return bool(_EVENT_RE.search(text))
        except Exception:
            return False

    @classmethod
    def parse(cls, pdf_path: str) -> pd.DataFrame:
        df = _parse(pdf_path)
        return cls._ensure_columns(df)
