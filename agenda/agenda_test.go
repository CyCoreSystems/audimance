package agenda

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const bilingual = `
languages: [en, zh-TW]
rooms:
  - name: stage
    pointsOfInterest:
      - name: Downstage center
    sources:
      - name: Choreography
        labels:
          zh-TW: 編舞
`

func TestLabelsFallBackToNames(t *testing.T) {
	a, err := New(strings.NewReader(`
rooms:
  - name: stage
    pointsOfInterest:
      - name: Downstage center
    sources:
      - name: Choreography
`))
	require.NoError(t, err)

	assert.Empty(t, a.defaultLanguage())

	room := a.Rooms[0]
	assert.Equal(t, "Downstage center", room.PointsOfInterest[0].Label)
	assert.Equal(t, "Choreography", room.Sources[0].Label)
}

func TestLocalizedLabels(t *testing.T) {
	a, err := New(strings.NewReader(bilingual))
	require.NoError(t, err)

	assert.Equal(t, "en", a.defaultLanguage())

	zh := a.Localized("zh-TW")
	source, original := zh.Rooms[0].Sources[0], a.Rooms[0].Sources[0]

	assert.Equal(t, "編舞", source.Label)
	assert.Equal(t, "Downstage center", zh.Rooms[0].PointsOfInterest[0].Label, "untranslated labels fall back to the name")
	assert.Equal(t, original.ID, source.ID)
	assert.Equal(t, original.Name, source.Name)
	assert.Equal(t, "Choreography", original.Label, "localizing changed the original")
}

func TestLabelInJSON(t *testing.T) {
	a, err := New(strings.NewReader(bilingual))
	require.NoError(t, err)

	data, err := json.Marshal(a.Localized("zh-TW").Rooms[0].Sources[0])
	require.NoError(t, err)

	assert.Contains(t, string(data), `"label":"編舞"`)
	assert.NotContains(t, string(data), `"labels"`)
}

func TestRejectsLabelInUnlistedLanguage(t *testing.T) {
	_, err := New(strings.NewReader(strings.Replace(bilingual, "zh-TW: 編舞", "zh-Hant: 編舞", 1)))
	assert.Error(t, err)
}

func TestRejectsInvalidLanguage(t *testing.T) {
	_, err := New(strings.NewReader(strings.Replace(bilingual, "languages: [en, zh-TW]", "languages: [en, \"not a tag!\"]", 1)))
	assert.Error(t, err)
}
