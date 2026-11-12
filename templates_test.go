package main

import (
	"bytes"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadTemplates(t *testing.T) {
	sets, err := loadTemplates(os.DirFS("testdata/views"), []string{"en", "zh-TW"})
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
		assert.Equal(t, c.want, strings.TrimSpace(buf.String()), "%q %s", c.lang, c.name)
	}
}
