package agenda_test

import (
	"testing"

	"github.com/CyCoreSystems/audimance/agenda"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLabelsFallBackToNames(t *testing.T) {
	a, err := agenda.Load("testdata/no-languages.yaml")
	require.NoError(t, err)

	room := a.Rooms[0]
	assert.Equal(t, "Downstage center", room.PointsOfInterest[0].Label)
	assert.Equal(t, "Choreography", room.Sources[0].Label)
}

func TestLocalizedLabels(t *testing.T) {
	a, err := agenda.Load("testdata/bilingual.yaml")
	require.NoError(t, err)

	zh := a.Localized("zh-TW")
	source, original := zh.Rooms[0].Sources[0], a.Rooms[0].Sources[0]

	assert.Equal(t, "編舞", source.Label)
	assert.Equal(t, "Downstage center", zh.Rooms[0].PointsOfInterest[0].Label, "untranslated labels fall back to the name")
	assert.Equal(t, original.ID, source.ID)
	assert.Equal(t, original.Name, source.Name)
	assert.Equal(t, "Choreography", original.Label, "localizing changed the original")
}

func TestLabelsDefaultToFirstLanguage(t *testing.T) {
	a, err := agenda.Load("testdata/chinese-first.yaml")
	require.NoError(t, err)

	assert.Equal(t, "編舞", a.Rooms[0].Sources[0].Label)
}

func TestRejectsLabelInUnlistedLanguage(t *testing.T) {
	_, err := agenda.Load("testdata/label-in-unlisted-language.yaml")
	assert.ErrorIs(t, err, agenda.ErrUnlistedLanguage)
}
