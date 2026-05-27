"""Abstract base class for PDF result plugins."""

from abc import ABC, abstractmethod
import pandas as pd


RESULT_COLUMNS = [
    'event_distance',  # e.g. "100"
    'event_style',     # e.g. "Stile Libero", "Dorso", "Rana", "Farfalla", "Misti"
    'event_type',      # e.g. "Assoluti", "Categoria", "Promozionale", "Open"
    'sex',             # "Femmine" | "Maschi"
    'category',        # e.g. "Seniores", "Juniores", "Ragazzi", "Cadetti", "Esordienti"
    'position',        # integer rank, or None/empty if non-classified
    'surname',         # athlete surname (UPPERCASE in source)
    'firstname',       # athlete first name
    'year',            # birth year (integer)
    'nationality',     # 3-letter ISO code, e.g. "ITA"
    'society',         # club / team name
    'splits',          # comma-separated intermediate split times (may be empty)
    'final_time',      # race result time, e.g. "1'04.36" or "58.21"
    'status',          # "OK" | "NP" (no show) | "AB" (abandoned) | "RIT"/"DNS"/"DNF"
]


class PDFPlugin(ABC):
    """Base class every PDF-format plugin must extend."""

    name: str = ''
    description: str = ''

    @classmethod
    @abstractmethod
    def can_handle(cls, pdf_path: str) -> bool:
        """Return True if this plugin recognises and can parse the given file.

        Must be fast: check only a small portion of the document (first few
        pages / first few KB of extracted text). Never raise; return False on
        any error.
        """
        ...

    @classmethod
    @abstractmethod
    def parse(cls, pdf_path: str) -> pd.DataFrame:
        """Parse pdf_path and return a DataFrame with exactly RESULT_COLUMNS.

        Each row is one athlete result.  Rows that cannot be parsed are
        silently dropped.  Columns not available in the source format should
        be filled with empty strings / NaN.
        """
        ...

    @classmethod
    def _ensure_columns(cls, df: pd.DataFrame) -> pd.DataFrame:
        """Add missing columns and reorder to RESULT_COLUMNS. Call from parse()."""
        for col in RESULT_COLUMNS:
            if col not in df.columns:
                df[col] = ''
        return df[RESULT_COLUMNS].copy()
