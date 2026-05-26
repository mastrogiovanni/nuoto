#!/usr/bin/env python3
"""
CLI to rank swimmers by best time in a season.

Usage:
  python ranking.py --sex M --stroke rana --distance 100 --categoria 330
  python ranking.py -s F --stroke farfalla -d 50
  python ranking.py --sex M --stroke "stile libero" -d 200 --season 2025
  python ranking.py --sex M --stroke rana -d 100 --region lazio
  python ranking.py --sex F --stroke dorso -d 50 --region RM
"""

import argparse
import json
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data_federnuoto"

MONTH_MAP = {
    "Gennaio": 1, "Febbraio": 2, "Marzo": 3, "Aprile": 4,
    "Maggio": 5, "Giugno": 6, "Luglio": 7, "Agosto": 8,
    "Settembre": 9, "Ottobre": 10, "Novembre": 11, "Dicembre": 12,
}

STROKE_ALIASES = {
    "rana": "Rana",
    "breaststroke": "Rana",
    "farfalla": "Farfalla",
    "delfino": "Farfalla",
    "butterfly": "Farfalla",
    "dorso": "Dorso",
    "backstroke": "Dorso",
    "stile libero": "Stile Libero",
    "stile": "Stile Libero",
    "sl": "Stile Libero",
    "freestyle": "Stile Libero",
    "misti": "Misti",
    "mx": "Misti",
    "im": "Misti",
    "medley": "Misti",
}

# Maps Italian region names (lowercase, no accents) and abbreviations to their
# constituent province codes.
REGION_TO_PROVINCES: dict[str, set[str]] = {
    "abruzzo":              {"AQ", "CH", "PE", "TE"},
    "basilicata":           {"MT", "PZ"},
    "calabria":             {"CS", "CZ", "KR", "RC", "VV"},
    "campania":             {"AV", "BN", "CE", "NA", "SA"},
    "emilia romagna":       {"BO", "FC", "FE", "MO", "PC", "PR", "RA", "RE", "RN"},
    "emilia-romagna":       {"BO", "FC", "FE", "MO", "PC", "PR", "RA", "RE", "RN"},
    "friuli venezia giulia":{"GO", "PN", "TS", "UD"},
    "friuli-venezia giulia":{"GO", "PN", "TS", "UD"},
    "lazio":                {"FR", "LT", "RI", "RM", "VT"},
    "liguria":              {"GE", "IM", "SP", "SV"},
    "lombardia":            {"BG", "BS", "CO", "CR", "LC", "LO", "MB", "MI", "MN", "PV", "SO", "VA"},
    "marche":               {"AN", "AP", "FM", "MC", "PU"},
    "molise":               {"CB", "IS"},
    "piemonte":             {"AL", "AT", "BI", "CN", "NO", "TO", "VB", "VC"},
    "puglia":               {"BA", "BAT", "BR", "FG", "LE", "TA"},
    "sardegna":             {"CA", "NU", "OR", "SS", "SU"},
    "sicilia":              {"AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP"},
    "toscana":              {"AR", "FI", "GR", "LI", "LU", "MS", "PI", "PO", "PT", "SI"},
    "trentino alto adige":  {"BZ", "TN"},
    "trentino-alto adige":  {"BZ", "TN"},
    "umbria":               {"PG", "TR"},
    "valle d'aosta":        {"AO"},
    "valle daosta":         {"AO"},
    "veneto":               {"BL", "PD", "RO", "TV", "VE", "VI", "VR"},
}

# Build reverse map: province code → canonical region name
PROVINCE_TO_REGION: dict[str, str] = {}
for _region, _provinces in REGION_TO_PROVINCES.items():
    if "-" not in _region:  # skip duplicate hyphenated keys
        for _p in _provinces:
            PROVINCE_TO_REGION[_p] = _region


def resolve_region(value: str) -> set[str]:
    """Return the set of province codes for a region name or a single province code."""
    v = value.strip()
    # Try as a two-letter province code first
    if re.fullmatch(r"[A-Za-z]{2}", v):
        code = v.upper()
        if code in PROVINCE_TO_REGION:
            return {code}
        print(f"Unknown province code '{code}'.", file=sys.stderr)
        sys.exit(1)
    # Try as a region name
    key = v.lower()
    if key in REGION_TO_PROVINCES:
        return REGION_TO_PROVINCES[key]
    known_regions = ", ".join(sorted(k for k in REGION_TO_PROVINCES if "-" not in k))
    print(f"Unknown region '{v}'. Known regions: {known_regions}", file=sys.stderr)
    sys.exit(1)


def province_from_location(location: str) -> str | None:
    """Extract the two-letter province code from a location string like 'Roma (RM)'."""
    m = re.search(r"\(([A-Z]{2})\)", location)
    return m.group(1) if m else None


def normalize_stroke(stroke: str) -> str:
    key = stroke.lower().strip()
    if key not in STROKE_ALIASES:
        known = ", ".join(sorted(set(STROKE_ALIASES.keys())))
        print(f"Unknown stroke '{stroke}'. Known: {known}", file=sys.stderr)
        sys.exit(1)
    return STROKE_ALIASES[key]


def parse_time(t: str) -> float:
    """Convert time string to total seconds for comparison."""
    t = t.strip()
    if ":" in t:
        parts = t.split(":")
        return int(parts[0]) * 60 + float(parts[1])
    return float(t)


def challenge_date(dates: list[dict]) -> str:
    """Return ISO-ish date string for sorting/display (first date)."""
    if not dates:
        return "???"
    d = dates[0]
    month = MONTH_MAP.get(d.get("month", ""), 0)
    return f"{d['year']}-{month:02d}-{int(d['day']):02d}"


def scan_season(
    season: str,
    stile_key: str,
    sex: str,
    categoria: str | None,
    province_filter: set[str] | None,
    birth_filter: set[str] | None = None,
    pool_filter: str | None = None,
):
    """
    Yield (athlete_name, societa, time_str, challenge_name, date_str, location)
    for every matching result in the season folder.
    """
    season_dir = DATA_DIR / season
    if not season_dir.is_dir():
        print(f"Season folder not found: {season_dir}", file=sys.stderr)
        sys.exit(1)

    for challenge_dir in sorted(season_dir.iterdir()):
        if not challenge_dir.is_dir():
            continue

        info_path = challenge_dir / "info.json"
        if not info_path.exists():
            continue

        try:
            info = json.loads(info_path.read_text())
        except Exception:
            continue

        location = info.get("location", "")
        pool = info.get("pool", "")

        if province_filter is not None:
            if province_from_location(location) not in province_filter:
                continue

        if pool_filter is not None and pool != pool_filter:
            continue

        challenge_name = info.get("name", challenge_dir.name)
        date_str = challenge_date(info.get("dates", []))

        for athlete_path in challenge_dir.glob("*.json"):
            if athlete_path.name == "info.json":
                continue
            try:
                data = json.loads(athlete_path.read_text())
            except Exception:
                continue

            atleta = data.get("atleta", {})
            nome = atleta.get("nome", "?")
            societa = atleta.get("societa", "")
            anno = atleta.get("anno", "")

            if birth_filter and anno not in birth_filter:
                continue

            for entry in data.get("tempi", []):
                if entry.get("stile", "") != stile_key:
                    continue
                if entry.get("sesso", "").upper() != sex.upper():
                    continue
                if categoria and entry.get("id_categoria", "") != categoria:
                    continue

                time_str = entry.get("tempo", "")
                if not time_str:
                    continue

                yield nome, societa, time_str, challenge_name, date_str, location


def main():
    parser = argparse.ArgumentParser(
        description="Rank swimmers by best time in a season."
    )
    parser.add_argument("--sex", "-s", required=True, choices=["M", "F", "m", "f"],
                        help="Sex: M or F")
    parser.add_argument("--stroke", required=True,
                        help="Stroke: rana, farfalla, delfino, dorso, stile libero, misti")
    parser.add_argument("--distance", "-d", required=True,
                        help="Distance in meters: 50, 100, 200, 400, 800, 1500")
    parser.add_argument("--categoria", "-c", default=None,
                        help="Category id filter (e.g. 330)")
    parser.add_argument("--region", "-r", default=None,
                        help="Filter by competition location: region name (e.g. lazio) "
                             "or province code (e.g. RM)")
    parser.add_argument("--birth", "-b", default=None,
                        help="Filter by birth year(s), comma-separated (e.g. 2011,2012)")
    parser.add_argument("--pool", "-p", default=None, choices=["25", "50"],
                        help="Filter by pool length in metres: 25 or 50")
    parser.add_argument("--season", default="2025",
                        help="Season folder year (default: 2025 = 2025-2026 season)")
    parser.add_argument("--top", "-n", type=int, default=None,
                        help="Show only top N results")
    args = parser.parse_args()

    sex = args.sex.upper()
    stroke = normalize_stroke(args.stroke)
    try:
        distance = int(args.distance)
    except ValueError:
        print(f"Invalid distance: {args.distance}", file=sys.stderr)
        sys.exit(1)

    stile_key = f"{distance} {stroke}"
    province_filter = resolve_region(args.region) if args.region else None
    pool_filter = f"Vasca da {args.pool}m" if args.pool else None

    birth_filter: set[str] | None = None
    if args.birth:
        try:
            birth_filter = {str(int(y.strip())) for y in args.birth.split(",")}
        except ValueError:
            print(f"Invalid birth year(s): '{args.birth}'. Use comma-separated years, e.g. 2011,2012", file=sys.stderr)
            sys.exit(1)

    # Collect best time per athlete
    best: dict[str, tuple] = {}

    for nome, societa, time_str, challenge_name, date_str, location in scan_season(
        args.season, stile_key, sex, args.categoria, province_filter, birth_filter, pool_filter
    ):
        try:
            secs = parse_time(time_str)
        except ValueError:
            continue

        key = nome.upper()
        if key not in best or secs < best[key][0]:
            best[key] = (secs, time_str, challenge_name, date_str, location, nome, societa)

    if not best:
        region_label = f" | region={args.region}" if args.region else ""
        birth_label = f" | birth={args.birth}" if args.birth else ""
        pool_label = f" | pool={args.pool}m" if args.pool else ""
        print(f"No results found for: {stile_key} | sex={sex}{region_label}{birth_label}{pool_label} | season={args.season}")
        return

    ranked = sorted(best.values(), key=lambda x: x[0])
    if args.top:
        ranked = ranked[: args.top]

    # Print header
    cat_label = f" | categoria={args.categoria}" if args.categoria else ""
    region_label = f" | {args.region}" if args.region else ""
    birth_label = f" | nati {args.birth}" if args.birth else ""
    pool_label = f" | {args.pool}m" if args.pool else ""
    print(f"\nRanking: {stile_key} | {sex}{cat_label}{region_label}{birth_label}{pool_label} | Stagione {args.season}-{int(args.season)+1}")
    print(f"{'#':<4} {'Atleta':<30} {'Società':<30} {'Tempo':<10} {'Data':<12} {'Gara'}")
    print("-" * 110)

    for rank, (_, time_str, challenge_name, date_str, location, nome, societa) in enumerate(ranked, 1):
        print(f"{rank:<4} {nome:<30} {societa:<30} {time_str:<10} {date_str:<12} {challenge_name}")


if __name__ == "__main__":
    main()
