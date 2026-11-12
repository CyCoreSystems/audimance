package i18n_test

import (
	"testing"

	"github.com/CyCoreSystems/audimance/internal/i18n"
	"github.com/stretchr/testify/assert"
)

func TestResolve(t *testing.T) {
	r := i18n.NewResolver([]string{"en", "zh-TW"})

	for _, c := range []struct {
		query, acceptLanguage, want string
	}{
		// The app passes its own language as a query parameter.
		{"zh-Hant", "", "zh-TW"},
		{"zh-Hant", "en-US", "zh-TW"},
		{"en", "zh-TW", "en"},
		// Browsers send Accept-Language.
		{"", "zh-TW,zh;q=0.9,en-US;q=0.8", "zh-TW"},
		{"", "zh-HK", "zh-TW"},
		{"", "zh-CN", "zh-TW"},
		{"", "en-US,en;q=0.9", "en"},
		{"", "ja-JP,zh-TW;q=0.5", "zh-TW"},
		// If the lang query parameter doesn't contain a supported language, Accept-Language should be used instead.
		{"fr", "zh-TW", "zh-TW"},
		{"not a tag!", "zh-TW", "zh-TW"},
		// Anything else gets the default.
		{"", "fr-FR", "en"},
		{"", "", "en"},
	} {
		assert.Equal(t, c.want, r.Resolve(c.query, c.acceptLanguage), "Resolve(%q, %q)", c.query, c.acceptLanguage)
	}
}

func TestResolveWithoutLanguages(t *testing.T) {
	assert.Empty(t, i18n.NewResolver(nil).Resolve("zh-Hant", "zh-TW"))
}
