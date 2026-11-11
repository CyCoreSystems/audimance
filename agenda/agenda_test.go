package agenda

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func load(t *testing.T, yaml string) (*Agenda, error) {
	t.Helper()

	path := filepath.Join(t.TempDir(), "agenda.yaml")
	if err := os.WriteFile(path, []byte(yaml), 0o600); err != nil {
		t.Fatal(err)
	}

	return New(path)
}

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
	a, err := load(t, `
rooms:
  - name: stage
    pointsOfInterest:
      - name: Downstage center
    sources:
      - name: Choreography
`)
	if err != nil {
		t.Fatal(err)
	}

	if lang := a.defaultLanguage(); lang != "" {
		t.Errorf("default language = %q, want none", lang)
	}

	room := a.Rooms[0]
	if got := room.PointsOfInterest[0].Label; got != "Downstage center" {
		t.Errorf("point of interest label = %q, want its name", got)
	}
	if got := room.Sources[0].Label; got != "Choreography" {
		t.Errorf("source label = %q, want its name", got)
	}
}

func TestLocalizedLabels(t *testing.T) {
	a, err := load(t, bilingual)
	if err != nil {
		t.Fatal(err)
	}

	if lang := a.defaultLanguage(); lang != "en" {
		t.Errorf("default language = %q, want en", lang)
	}

	zh := a.Localized("zh-TW")
	source, original := zh.Rooms[0].Sources[0], a.Rooms[0].Sources[0]

	if source.Label != "編舞" {
		t.Errorf("Chinese source label = %q, want 編舞", source.Label)
	}
	if got := zh.Rooms[0].PointsOfInterest[0].Label; got != "Downstage center" {
		t.Errorf("Chinese point of interest label = %q, want its name as the fallback", got)
	}
	if source.ID != original.ID || source.Name != original.Name {
		t.Errorf("localized source has ID %q and name %q, want the original's %q and %q", source.ID, source.Name, original.ID, original.Name)
	}
	if original.Label != "Choreography" {
		t.Errorf("localizing changed the original's label to %q", original.Label)
	}
}

func TestLabelInJSON(t *testing.T) {
	a, err := load(t, bilingual)
	if err != nil {
		t.Fatal(err)
	}

	data, err := json.Marshal(a.Localized("zh-TW").Rooms[0].Sources[0])
	if err != nil {
		t.Fatal(err)
	}

	if s := string(data); !strings.Contains(s, `"label":"編舞"`) || strings.Contains(s, `"labels"`) {
		t.Errorf("source JSON = %s, want the resolved label and no label map", s)
	}
}

func TestRejectsLabelInUnlistedLanguage(t *testing.T) {
	_, err := load(t, strings.Replace(bilingual, "zh-TW: 編舞", "zh-Hant: 編舞", 1))
	if err == nil {
		t.Error("loaded an agenda with a label in a language it doesn't list")
	}
}

func TestRejectsInvalidLanguage(t *testing.T) {
	_, err := load(t, strings.Replace(bilingual, "languages: [en, zh-TW]", "languages: [en, \"not a tag!\"]", 1))
	if err == nil {
		t.Error("loaded an agenda with an invalid language tag")
	}
}
