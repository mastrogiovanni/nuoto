"""
Extract swimmer results from FederNuoto PDF result files.

PDF structure:
  - Competition header (title, date)
  - Per-event sections: "NNN m Style - Type Sex" header
    - Per-category subsections: "Ragazzi/Juniores/Cadetti/Seniores Femmine/Maschi"
      - Athlete rows: POS SURNAME Firstname YEAR NAT Society TIME... FINAL_TIME
      - Non-classified section: "NON CLASSIFICATI" + athletes ending with NP/AB/etc.
  - Page headers/footers (skipped)

MarkItDown renders the PDF as markdown where some rows are plain text and others
are markdown table rows (when the PDF layout broke a row across table columns).
Continuation rows carry year/nationality/society that belong to the previous athlete.
"""

import re
import sys
import pandas as pd
from markitdown import MarkItDown

# ─── Compiled patterns ─────────────────────────────────────────────────────

TIME_RE = re.compile(r"\d{1,2}'\d{2}\.\d{2}|\d{2}\.\d{2}")

YEAR_NAT_RE = re.compile(r'\b(\d{4})\s+([A-Z]{3})\b')

EVENT_RE = re.compile(
    r'(\d+)\s+m\s+'
    r'(Stile Libero|Dorso|Rana|Farfalla|Misti|Delfino|Stile)\b'
    r'.*?[-–]\s*'
    r'(Assoluti|Categoria|Promozionale|Open)\s+'
    r'(Femmine|Maschi)',
    re.IGNORECASE,
)

CATEGORY_RE = re.compile(
    r'^(Ragazzi|Juniores|Cadetti|Seniores|Esordienti|Allievi|Assoluti)\s+(Femmine|Maschi)$',
    re.IGNORECASE,
)

PAGE_NOISE_RE = re.compile(
    r'Stampata il|Pubblicata:|^\s*Page\s+\d+|'
    r"POS\s+COGNOME|ANNO\s+NAZ\s+SOCIE|SuperbaNuoto|Swim Contest|"
    r"V\.\s*\d+\s*m\s*$|^Risultati$|^Albenga\b",
    re.IGNORECASE,
)

STATUS_RE = re.compile(r'\b(NP|AB|Rit\.?|RT|DNS|DNF|RIT)\s*$', re.IGNORECASE)

NON_CLASS_RE = re.compile(r'NON\s+CLASSIFICATI', re.IGNORECASE)


# ─── Helpers ───────────────────────────────────────────────────────────────

def is_separator(line: str) -> bool:
    """True only for lines like |---|---| where every cell contains only dashes/colons."""
    s = line.strip()
    if '|' not in s:
        return False
    cells = [c.strip() for c in s.strip('|').split('|')]
    return bool(cells) and all(re.match(r'^[-:\s]*$', c) for c in cells)


def extract_cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip('|').split('|')]


def only_numbers(text: str) -> bool:
    """True when text contains only digits, times, punctuation – no letters."""
    return not re.search(r'[A-Za-z]', text)


def split_name(name_text: str) -> tuple[str, str]:
    """
    Split 'SURNAME Firstname [More]' into (surname, firstname).
    Surname = leading run of all-uppercase words; firstname = remainder.
    """
    words = name_text.split()
    surn, first = [], []
    in_first = False
    for w in words:
        if not in_first and re.match(r"^[A-Z][A-Z'\-\.]*$", w):
            surn.append(w)
        else:
            in_first = True
            first.append(w)
    return ' '.join(surn), ' '.join(first)


# ─── Pre-processing: flatten markdown, merge split rows ────────────────────

def preprocess(lines: list[str]) -> list[tuple[str, str]]:
    """
    Convert raw markdown lines into a sequence of (tag, text) tuples.

    Tags: 'event' | 'category' | 'non_classified_header' | 'athlete' | 'skip'

    Split athlete rows (where year/society appear on the next line due to PDF
    column wrapping) are merged into a single 'athlete' entry.
    """
    result: list[tuple[str, str]] = []

    for raw in lines:
        line = raw.strip()

        if not line or is_separator(line):
            continue

        if PAGE_NOISE_RE.search(line):
            continue

        # ── Table line ──
        if '|' in line:
            cells = extract_cells(line)
            first = cells[0] if cells else ''
            third = cells[2] if len(cells) > 2 else ''

            # Continuation: first cell empty, third contains YEAR NAT [Society]
            # Some table formats split year+nat and society into separate columns
            # (e.g. 50m events use 5 columns: name | - | year+nat | society | time)
            if not first and YEAR_NAT_RE.search(third):
                if result and result[-1][0] == 'athlete':
                    fourth = cells[3] if len(cells) > 3 else ''
                    merged = (third + ' ' + fourth).strip()
                    result[-1] = ('athlete', result[-1][1] + ' ' + merged)
                continue

            # Continuation for 200m/400m: first cell is society text (non-digit),
            # other cells are split times only
            if (first
                    and not re.match(r'^\d', first)
                    and not CATEGORY_RE.match(first)
                    and not EVENT_RE.search(first)
                    and not NON_CLASS_RE.search(first)):
                if result and result[-1][0] == 'athlete':
                    prev = result[-1][1]
                    # Add society only when it's missing from the previous record
                    if not re.search(r'[a-z]', prev.split(str(YEAR_NAT_RE.search(prev).group()))[-1] if YEAR_NAT_RE.search(prev) else ''):
                        result[-1] = ('athlete', prev + ' ' + first)
                continue

            text = ' '.join(c for c in cells if c)
        else:
            text = line

        if not text:
            continue

        # Split-time-only lines (all numbers/punctuation, no letters)
        if only_numbers(text):
            continue

        # Non-classified header
        if NON_CLASS_RE.search(text):
            result.append(('non_classified_header', text))
            continue

        # Year+NAT continuation for 400m (e.g. "2012 ITA" on its own line)
        if re.match(r'^\d{4}\s+[A-Z]{3}(\s+|$)', text):
            if result and result[-1][0] == 'athlete':
                result[-1] = ('athlete', result[-1][1] + ' ' + text)
            continue

        # Event header
        m = EVENT_RE.search(text)
        if m:
            result.append(('event', text))
            continue

        # Category header
        if CATEGORY_RE.match(text):
            result.append(('category', text))
            continue

        # Athlete row: starts with position number then uppercase letter
        if re.match(r'^\d+\s+[A-Z]', text):
            result.append(('athlete', text))
            continue

        # Non-classified athlete (no position, but has YEAR NAT and ends with status)
        if YEAR_NAT_RE.search(text) and STATUS_RE.search(text):
            result.append(('athlete', '__NC__ ' + text))
            continue

        # Fallback: plain text that doesn't match anything else and follows an athlete
        # is treated as a society continuation (e.g. "Superba Nuoto ssd" on its own line
        # after year+nat appeared on the previous line for 400m+ events).
        if (result and result[-1][0] == 'athlete'
                and not re.match(r'^\d', text)
                and re.search(r'[A-Za-z]', text)):
            result[-1] = ('athlete', result[-1][1] + ' ' + text)

    return result


# ─── Athlete row parsing ───────────────────────────────────────────────────

def parse_athlete(text: str, event: dict, category: str, non_classified: bool) -> dict | None:
    """
    Parse one consolidated athlete text into a result dict.
    Handles both positioned athletes and non-classified (NP/AB/…) entries.
    """
    text = text.strip()

    # Non-classified prefix injected by preprocess()
    is_nc = text.startswith('__NC__ ')
    if is_nc:
        text = text[7:]
        pos_str = ''
        pos = None
        rest = text
    else:
        m = re.match(r'^(\d+)\s+(.*)', text)
        if not m:
            return None
        pos_str = m.group(1)
        pos = int(pos_str)
        rest = m.group(2).strip()

    # Find year + nationality
    yn = YEAR_NAT_RE.search(rest)
    if not yn:
        return None

    year = int(yn.group(1))
    nat = yn.group(2)

    # Name = everything before year+nat, minus any times that leaked in
    name_raw = rest[:yn.start()].strip()
    name_clean = TIME_RE.sub('', name_raw).strip()
    surname, firstname = split_name(name_clean)

    # Everything after year+nat
    after_yn = rest[yn.end():].strip()

    # Status code (NP, AB, …)
    status_m = STATUS_RE.search(after_yn)
    status = status_m.group(1).upper() if status_m else ('NP' if non_classified else 'OK')
    if status_m:
        after_yn = after_yn[:status_m.start()].strip()

    # Collect all times from the whole record (name part may have leaked times for 400m)
    all_times = TIME_RE.findall(rest)
    final_time = all_times[-1] if all_times else ''
    splits = all_times[:-1] if len(all_times) > 1 else []

    # Society = non-time text after year+nat (or before year+nat if times came first)
    society = TIME_RE.sub('', after_yn).strip()
    if not society:
        # 400m case: society comes before year+nat (was appended later)
        # It would be in the part before year+nat, after all uppercase name words
        before_yn = rest[:yn.start()]
        society_candidate = TIME_RE.sub('', before_yn).strip()
        # Remove the name tokens
        for w in (surname + ' ' + firstname).split():
            society_candidate = society_candidate.replace(w, '', 1).strip()
        society = society_candidate.strip()

    return {
        'event_distance': event.get('distance', ''),
        'event_style':    event.get('style', ''),
        'event_type':     event.get('type', ''),
        'sex':            event.get('sex', ''),
        'category':       category,
        'position':       pos,
        'surname':        surname,
        'firstname':      firstname,
        'year':           year,
        'nationality':    nat,
        'society':        society,
        'splits':         ','.join(splits),
        'final_time':     final_time,
        'status':         status,
    }


# ─── Top-level extraction ──────────────────────────────────────────────────

def extract(pdf_path: str) -> pd.DataFrame:
    md = MarkItDown()
    result = md.convert(pdf_path)
    lines = result.text_content.split('\n')

    records = preprocess(lines)

    current_event: dict = {}
    current_category: str = ''
    non_classified: bool = False
    rows: list[dict] = []

    for tag, text in records:
        if tag == 'event':
            m = EVENT_RE.search(text)
            if m:
                current_event = {
                    'distance': m.group(1),
                    'style':    m.group(2),
                    'type':     m.group(3),
                    'sex':      m.group(4),
                }
            non_classified = False
            current_category = ''

        elif tag == 'category':
            m = CATEGORY_RE.match(text)
            if m:
                current_category = m.group(1)
            non_classified = False

        elif tag == 'non_classified_header':
            non_classified = True

        elif tag == 'athlete':
            row = parse_athlete(text, current_event, current_category, non_classified)
            if row:
                rows.append(row)

    df = pd.DataFrame(rows)
    return df


# ─── CLI ──────────────────────────────────────────────────────────────────

def main():
    paths = sys.argv[1:] if len(sys.argv) > 1 else ['input.pdf']
    all_dfs = []

    for path in paths:
        print(f'Extracting {path} ...')
        df = extract(path)
        print(f'  → {len(df)} athlete records found')
        all_dfs.append(df)

    combined = pd.concat(all_dfs, ignore_index=True) if all_dfs else pd.DataFrame()

    out = 'results.csv'
    combined.to_csv(out, index=False)
    print(f'\nSaved {len(combined)} records to {out}')

    # Quick summary
    if not combined.empty:
        print('\nEvents found:')
        for _, grp in combined.groupby(['event_distance', 'event_style', 'sex']):
            first = grp.iloc[0]
            print(f"  {first['event_distance']}m {first['event_style']} {first['sex']}: "
                  f"{len(grp)} athletes")


if __name__ == '__main__':
    main()
