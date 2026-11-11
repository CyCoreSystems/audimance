package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
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
		if got := r.Resolve(c.query, c.acceptLanguage); got != c.want {
			t.Errorf("Resolve(%q, %q) = %q, want %q", c.query, c.acceptLanguage, got, c.want)
		}
	}
}

func TestResolveWithoutLanguages(t *testing.T) {
	if got := newLanguageResolver(nil).Resolve("zh-Hant", "zh-TW"); got != "" {
		t.Errorf("Resolve for a show without languages = %q, want \"\"", got)
	}
}

func TestLoadTemplates(t *testing.T) {
	views := t.TempDir()
	write := func(name, content string) {
		path := filepath.Join(views, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("index.html", `{{define "title"}}Program{{end}}index: {{template "title"}}`)
	write("live.html", `live`)
	write("zh-TW/index.html", `{{define "title"}}節目單{{end}}索引：{{template "title"}}`)

	sets, err := loadTemplates(views, []string{"en", "zh-TW"})
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range []struct{ lang, name, want string }{
		{"", "index.html", "index: Program"},
		{"en", "index.html", "index: Program"},
		{"zh-TW", "index.html", "索引：節目單"},
		// Views that haven't been localized to the language fall back to the default.
		{"zh-TW", "live.html", "live"},
	} {
		var buf bytes.Buffer
		if err := sets[c.lang].ExecuteTemplate(&buf, c.name, nil); err != nil {
			t.Fatalf("%q %s: %v", c.lang, c.name, err)
		}
		if got := buf.String(); got != c.want {
			t.Errorf("%q %s = %q, want %q", c.lang, c.name, got, c.want)
		}
	}
}
