package main

import (
	"html/template"
	"path/filepath"

	"golang.org/x/text/language"
)

// languageResolver chooses which language to use for a request.
type languageResolver struct {
	supported []string
	matcher   language.Matcher
}

func newLanguageResolver(supported []string) *languageResolver {
	tags := make([]language.Tag, len(supported))
	for i, lang := range supported {
		tags[i] = language.Make(lang)
	}

	return &languageResolver{
		supported: supported,
		matcher:   language.NewMatcher(tags),
	}
}

// Resolve returns the language to use, given a request's lang query
// parameter and Accept-Language header. Returns "" for shows that don't list any languages.
func (r *languageResolver) Resolve(query, acceptLanguage string) string {
	if len(r.supported) == 0 {
		return ""
	}

	// Ignore the returned tag, which can have extra parts like "en-u-rg-gbzzzz".
	_, index := language.MatchStrings(r.matcher, query, acceptLanguage)

	return r.supported[index]
}

// loadTemplates returns the views for each language. Defaults views are keyed by "".
func loadTemplates(viewDir string, languages []string) (map[string]*template.Template, error) {
	base, err := template.ParseGlob(filepath.Join(viewDir, "*.html"))
	if err != nil {
		return nil, err
	}

	sets := map[string]*template.Template{"": base}

	for _, lang := range languages {
		files, err := filepath.Glob(filepath.Join(viewDir, lang, "*.html"))
		if err != nil {
			return nil, err
		}

		if len(files) == 0 {
			sets[lang] = base
			continue
		}

		set, err := base.Clone()
		if err != nil {
			return nil, err
		}

		if sets[lang], err = set.ParseFiles(files...); err != nil {
			return nil, err
		}
	}

	return sets, nil
}
