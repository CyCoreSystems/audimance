package i18n

import (
	"golang.org/x/text/language"
)

// Resolver chooses which language to use for a request.
type Resolver struct {
	supported []string
	matcher   language.Matcher
}

// NewResolver returns a Resolver for the specified list of languages. The first language is the default.
func NewResolver(supported []string) *Resolver {
	tags := make([]language.Tag, len(supported))
	for i, lang := range supported {
		tags[i] = language.Make(lang)
	}

	return &Resolver{
		supported: supported,
		matcher:   language.NewMatcher(tags),
	}
}

// Resolve returns the language to use, given a request's lang query
// parameter and Accept-Language header. Returns "" for shows that don't list any languages.
func (r *Resolver) Resolve(query, acceptLanguage string) string {
	if len(r.supported) == 0 {
		return ""
	}

	// Ignore the returned tag, which can have extra parts like "en-u-rg-gbzzzz".
	_, index := language.MatchStrings(r.matcher, query, acceptLanguage)

	return r.supported[index]
}
