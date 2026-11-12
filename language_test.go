package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolve(t *testing.T) {
	r := newLanguageResolver([]string{"en", "zh-TW"})

	for _, c := range []struct {
		query, acceptLanguage, want string
	}{
		// The app passes its own language, such as zh-Hant, in the query.
		{"zh-Hant", "", "zh-TW"},
		{"zh-Hant", "en-US", "zh-TW"},
		{"en", "zh-TW", "en"},
		// Browsers send Accept-Language.
		{"", "zh-TW,zh;q=0.9,en-US;q=0.8", "zh-TW"},
		{"", "zh-HK", "zh-TW"},
		{"", "zh-CN", "zh-TW"},
		{"", "en-US,en;q=0.9", "en"},
		{"", "ja-JP,zh-TW;q=0.5", "zh-TW"},
		// A lang the show can't use falls through to Accept-Language.
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
	assert.Empty(t, newLanguageResolver(nil).Resolve("zh-Hant", "zh-TW"))
}

func TestLoadTemplates(t *testing.T) {
	views := t.TempDir()
	write := func(name, content string) {
		path := filepath.Join(views, name)
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o700))
		require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	}
	write("index.html", `{{define "title"}}Program{{end}}index: {{template "title"}}`)
	write("live.html", `live`)
	write("zh-TW/index.html", `{{define "title"}}節目單{{end}}索引：{{template "title"}}`)

	sets, err := loadTemplates(views, []string{"en", "zh-TW"})
	require.NoError(t, err)

	for _, c := range []struct{ lang, name, want string }{
		{"", "index.html", "index: Program"},
		{"en", "index.html", "index: Program"},
		{"zh-TW", "index.html", "索引：節目單"},
		// Views that haven't been localized to the language fall back to the default.
		{"zh-TW", "live.html", "live"},
	} {
		var buf bytes.Buffer
		require.NoError(t, sets[c.lang].ExecuteTemplate(&buf, c.name, nil), "%q %s", c.lang, c.name)
		assert.Equal(t, c.want, buf.String(), "%q %s", c.lang, c.name)
	}
}
