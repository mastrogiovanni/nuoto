package strutil

import (
	"regexp"
	"strings"
	"unicode"
)

var nonAlphanumRe = regexp.MustCompile(`[^a-z0-9]+`)

// Normalize transliterates Latin-extended and accented characters to ASCII,
// then replaces any remaining non-alphanumeric characters with underscores.
// This handles both properly encoded text (à → a) and mojibake artifacts.
func Normalize(s string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(s) {
		lo := unicode.ToLower(r)
		if lo >= 'a' && lo <= 'z' || lo >= '0' && lo <= '9' {
			b.WriteRune(lo)
			continue
		}
		switch lo {
		case 'à', 'á', 'â', 'ã', 'ä', 'å':
			b.WriteByte('a')
		case 'è', 'é', 'ê', 'ë':
			b.WriteByte('e')
		case 'ì', 'í', 'î', 'ï':
			b.WriteByte('i')
		case 'ò', 'ó', 'ô', 'õ', 'ö', 'ø':
			b.WriteByte('o')
		case 'ù', 'ú', 'û', 'ü':
			b.WriteByte('u')
		case 'ý', 'ÿ':
			b.WriteByte('y')
		case 'ñ':
			b.WriteByte('n')
		case 'ç':
			b.WriteByte('c')
		default:
			b.WriteByte('_')
		}
	}
	result := nonAlphanumRe.ReplaceAllString(b.String(), "_")
	return strings.Trim(result, "_")
}
