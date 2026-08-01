"""Convert a PDF to a plain text file using MarkItDown.

MarkItDown renders the PDF content as Markdown-flavoured plain text,
preserving the logical reading order of paragraphs and tables.  The
result is written to a UTF-8 encoded `.txt` file.

Usage
-----
    python pdf_to_text.py <input.pdf> [output.txt]

Arguments
---------
input.pdf   Path to the source PDF file.  Required.
output.txt  Path for the output text file.  Optional; when omitted the
            output is placed next to the input file with the `.txt`
            extension (e.g. ``report.pdf`` → ``report.txt``).

Output
------
A plain-text file whose content mirrors the Markdown representation
produced by MarkItDown.  Tables in the PDF are rendered as pipe-
delimited Markdown tables; regular paragraphs and headers appear as
plain text lines.

Examples
--------
Convert a PDF, writing next to the source:

    python pdf_to_text.py document.pdf

Convert a PDF, specifying the output path:

    python pdf_to_text.py document.pdf /tmp/output.txt

Dependencies
------------
- markitdown  (``pip install markitdown``)
"""

import sys
from pathlib import Path
from markitdown import MarkItDown


def convert(pdf_path: str) -> str:
    """Return the plain-text content of *pdf_path* via MarkItDown."""
    md = MarkItDown()
    result = md.convert(pdf_path)
    return result.text_content


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <input.pdf> [output.txt]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else Path(pdf_path).with_suffix('.txt')

    text = convert(pdf_path)
    Path(out_path).write_text(text, encoding='utf-8')
    print(f"Saved {len(text)} characters to {out_path}")


if __name__ == '__main__':
    main()
