package i18n_test

import (
	"testing"

	"github.com/CyCoreSystems/audimance/internal/i18n"
	"github.com/stretchr/testify/assert"
)

func TestResolve(t *testing.T) {
	t.Run("empty-languages", func(t *testing.T) {
		assert.Empty(t, i18n.NewResolver(nil).Resolve("zh-Hant", "zh-TW"))
	})

	t.Run("populated-languages", func(t *testing.T) {
		r := i18n.NewResolver([]string{"en", "zh-TW"})

		for _, c := range []struct {
			query, acceptLanguage, want string
		}{
			// The iOS app passes its preferred localization as a query parameter.
			{"zh-Hant", "", "zh-TW"},
			{"en", "zh-TW", "en"},
			// If the lang query parameter doesn't contain a supported language, Accept-Language should be used instead.
			{"fr", "zh-TW", "zh-TW"},
			{"not a tag!", "zh-TW", "zh-TW"},
			// For zh-CN, the language library's matched tag is zh-TW-u-rg-cnzzzz.
			// This checks that Resolve returns zh-TW as listed in the agenda.
			{"", "zh-CN", "zh-TW"},
			// Anything else gets the default.
			{"", "fr-FR", "en"},
			{"", "", "en"},
		} {
			assert.Equal(t, c.want, r.Resolve(c.query, c.acceptLanguage), "Resolve(%q, %q)", c.query, c.acceptLanguage)
		}
	})
}
