package main

import (
	"html/template"
	"io/fs"
	"path"
)

// loadTemplates returns views for each language. Default views are keyed by "".
func loadTemplates(views fs.FS, languages []string) (map[string]*template.Template, error) {
	base, err := template.ParseFS(views, "*.html")
	if err != nil {
		return nil, err
	}

	sets := map[string]*template.Template{"": base}

	for _, lang := range languages {
		files, err := fs.Glob(views, path.Join(lang, "*.html"))
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

		if sets[lang], err = set.ParseFS(views, files...); err != nil {
			return nil, err
		}
	}

	return sets, nil
}
