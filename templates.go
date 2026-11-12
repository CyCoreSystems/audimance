package main

import (
	"html/template"
	"path/filepath"
)

// loadTemplates returns views for each language. Default views are keyed by "".
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
