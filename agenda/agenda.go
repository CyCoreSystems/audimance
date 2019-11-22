package agenda

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"time"

	"github.com/gofrs/uuid"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"
)

var fileFormats = []string{"mp3", "m4a", "webm"}

// New attempts to load an agenda from the given filename
func New(filename string) (*Agenda, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read agenda from file")
	}

	a := new(Agenda)
	err = yaml.Unmarshal(data, a)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read YAML")
	}

	// If the agenda has its own set of file formats, use them instead of the default
	if len(a.Formats) > 0 {
		fileFormats = a.Formats
	}

	// Generate all IDs
	for _, c := range a.Cues {
		if err = c.generateID(); err != nil {
			return nil, errors.Wrapf(err, "failed to generate cue %s", c.Name)
		}
	}
	for _, r := range a.Rooms {
		if err = r.generateIDs(); err != nil {
			return nil, errors.Wrapf(err, "failed to generate room %s", r.Name)
		}
	}
	for _, ann := range a.Announcements {
		if err = ann.generateID(); err != nil {
			return nil, errors.Wrapf(err, "failed to generate announcement %s", ann.Name)
		}
	}
	return a, err
}

// Agenda describes the order of service and details of a performance
type Agenda struct {

	// Title is the title of the performance
	Title string `json:"title" yaml:"title"`

	// Formats defines the set of audio file formats to be supported.  This is optional and if not specified, "webm" will be assumed.
	Formats []string `json:"formats" yaml:"formats"`

	// Cues describe specific points in time in a performance
	Cues []*Cue `json:"cues" yaml:"cues"`

	// Rooms describe virtual rooms in which audio may be played
	Rooms []*Room `json:"rooms" yaml:"rooms"`

	// Announcements describe broadcast messages which will be played across any
	// number of rooms
	Announcements []*Announcement `json:"announcements" yaml:"announcements"`

	// PerformanceURL is the URL to which clients should be redirected when the
	// performance is about to start.  Generally, it will be of the form:
	// `https://yourserver.com/live`, as `live` is the path at which Audimance's
	// live interface may be found.
	//
	// This setting is optional but recommended.
	PerformanceURL string
}

// AllTracks returns the list of all tracks for all rooms and announcements so
// that they may be prefetched.
func (a *Agenda) AllTracks() (out []*Track) {
	// Track already-seen audio files so that we do not list them twice
	var seen []string
	unseen := func(id string) bool {
		for _, i := range seen {
			if i == id {
				return false
			}
		}
		return true
	}

	// Load Announcements first
	for _, ann := range a.Announcements {
		if unseen(ann.ID) {
			out = append(out, &ann.Track)
			seen = append(seen, ann.ID)
		}
	}

	// Load tracks from Rooms next
	for _, r := range a.Rooms {
		for _, t := range r.AllTracks() {
			if unseen(t.ID) {
				out = append(out, t)
				seen = append(seen, t.ID)
			}
		}
	}

	return
}

// Cue describes a specific point in time, with respect to the performance
// timeline
type Cue struct {

	// ID is the generated unique identifier
	ID string `json:"id" yaml:"-"`

	// Name is the unique, human-friendly name for this cue
	Name string `json:"name" yaml:"name"`

	// QLabID is the unique identifier for this cue in QLab (informational only;
	// not used by Audimance)
	QLabID string `json:"qlabID" yaml:"qlabID"`

	// Data is the expected data to be received on the QLab port to indicate
	// when this cue should be fired
	Data string `json:"data" yaml:"data"`

	// PerformanceRedirect indicates that when this cue is received, clients
	// should be transferred to the live PerformanceURL
	PerformanceRedirect bool `json:"performanceRedirect" yaml:"performanceRedirect"`

	// ReferenceSeconds is a reference count of the number of seconds the cue
	// should last before the next one.  This is informational only and will be
	// displayed in the administrative control panel if supplied.
	ReferenceSeconds int64 `json:"referenceSeconds" yaml:"referenceSeconds"`
}

// ID returns a unique hex ID for the cue
func (c *Cue) generateID() error {
	// If we don't have a name, generate one
	if c.Name == "" {
		c.Name = uuid.Must(uuid.NewV1()).String()
	}

	c.ID = hashString(fmt.Sprintf("cue-%s", c.Name))

	return nil
}

// FormattedReferenceTime returns the human-readable format of the cue's ReferenceSeconds, if there is one
func (c *Cue) FormattedReferenceTime() string {
	if c.ReferenceSeconds > 0 {
		dur := time.Duration(c.ReferenceSeconds) * time.Second
		return dur.String()
	}
	return ""
}

// Room describes a virtual room in which audio may be played
type Room struct {

	// ID is the generated unique identifier
	ID string `json:"id" yaml:"-"`

	// Name is the unique, human-friendly name for this room
	Name string `json:"name" yaml:"name"`

	// LabelText indicates the textual label to be displayed in the menu for
	// users to select this room
	LabelText string `json:"labelText" yaml:"labelText"`

	// Sources describes the set of locations and audio files which will be
	// played.
	Sources []*Source `json:"sources" yaml:"sources"`

	// RoomTracks is a list of audio tracks to be played in a room, sourced from
	// everywhere.  This is generally exclusive with Sources.
	RoomTracks []*Track `json:"roomTracks" yaml:"roomTracks"`
}

func (r *Room) generateIDs() error {
	err := r.generateID()
	if err != nil {
		return err
	}

	for _, s := range r.Sources {
		err = s.generateIDs()
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *Room) generateID() error {
	// If we don't have a name, generate one
	if r.Name == "" {
		r.Name = uuid.Must(uuid.NewV1()).String()
	}

	r.ID = hashString(fmt.Sprintf("room-%s", r.Name))

	return nil
}

// AllTracks returns the list of all tracks for the room so that they may be
// preloaded.
func (r *Room) AllTracks() (out []*Track) {
	// Track already-seen audio files so that we do not list them twice
	var seen []string
	unseen := func(id string) bool {
		for _, i := range seen {
			if i == id {
				return false
			}
		}
		return true
	}

	// Iterate Sources first
	for _, s := range r.Sources {
		for _, t := range s.Tracks {
			if unseen(t.ID) {
				out = append(out, t)
				seen = append(seen, t.ID)
			}
		}
	}

	// Iterate RoomTracks next
	for _, t := range r.RoomTracks {
		if unseen(t.ID) {
			out = append(out, t)
			seen = append(seen, t.ID)
		}
	}

	return
}

// Source describes a unique audio sequence and location
type Source struct {

	// ID is the generated unique identifier
	ID string `json:"id" yaml:"-"`

	// Name is the unique, human-friendly name for this source
	Name string `json:"name" yaml:"name"`

	// Location indicates a specific 3-dimensional coordinate in the room from
	// which the audio of this source emanates
	Location Point `json:"location" yaml:"location"`

	// Tracks is the list of audio tracks which should be played upon reaching a
	// particular cue
	Tracks []*Track `json:"tracks" yaml:"tracks"`
}

func (s *Source) generateIDs() error {
	err := s.generateID()
	if err != nil {
		return err
	}

	for _, t := range s.Tracks {
		err = t.generateID()
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *Source) generateID() error {
	// If we don't have a name, generate one
	if s.Name == "" {
		s.Name = uuid.Must(uuid.NewV1()).String()
	}

	s.ID = hashString(fmt.Sprintf("source-%s", s.Name))

	return nil
}

// Track represents a single set of potentially-cued audio files
type Track struct {

	// ID is the generated unique identifier
	ID string `json:"id" yaml:"-"`

	// LoadCue indicates the cue at which the track should be loaded.  This will generally be the cue immediately preceding the Cue
	LoadCue string `json:"loadCue" yaml:"loadCue"`

	// LoadWindow indicates the amount of time (in seconds) to allow for the
	// random loading of the audio.  Tracks are loaded at random times between
	// LoadCue's trigger and LoadWindow's duration therefrom to prevent a
	// thundering herd.
	LoadWindow float64 `json:"loadWindow" yaml:"loadWindow"`

	// Cue is the unique identifier of the cue at which this track should be
	// played
	Cue string `json:"cue" yaml:"cue"`

	// KillCue indicates the cue at which the track should be killed whether it has finished or not
	KillCue string `json:"killCue" yaml:"killCue"`

	// AudioFilePrefix is the path/name prefix of the audio file locations,
	// relative to the filesystem `media/` directory.  The file extension will
	// be calculated based on the supplied format list of the agenda.
	AudioFilePrefix string `json:"audioFilePrefix" yaml:"audioFilePrefix"`

	// AudioFiles is the user-supplied location of the audio file, relative to
	// the filesystem `media/` directory.  Generally, this will be populated
	// automatically by the combination of AudioFilePrefix and the top-level
	// Formats list.
	AudioFiles []string `json:"audioFiles" yaml:"audioFiles"`

	// Repeat indicates whether the PlaySet should be repeated after it is
	// completed.  This will cause the PlaySet to be continually played.
	Repeat bool `json:"repeat" yaml:"repeat"`
}

// ID returns a unique hex ID for the track location.  Note that this is not
// required to be system-unique; only file-unique.  Thus the same track ID may
// be used multiple times (to play the same file at different times or
// locations).
func (t *Track) generateID() error {
	if t.AudioFilePrefix != "" && len(t.AudioFiles) > 0 {
		return errors.Errorf("please only specify one of AudioFilePrefix or AudioFiles")
	}

	// Calculate AudioFiles from prefix, if we are given one
	if t.AudioFilePrefix != "" {
		for _, f := range fileFormats {
			t.AudioFiles = append(t.AudioFiles, fmt.Sprintf("%s.%s", strings.TrimSuffix(t.AudioFilePrefix, "."), f))
		}
	}

	if len(t.AudioFiles) < 1 {
		return errors.New("track must have audio files")
	}

	// TODO: attempt to generate required files if they are missing

	// Validate each of the referenced audio files
	for _, fn := range t.AudioFiles {
		f, err := os.Open(fmt.Sprintf("media/%s", fn))
		if err != nil {
			return errors.Wrapf(err, "failed to open track audio file media/%s", fn)
		}
		fInfo, err := f.Stat()
		if err != nil {
			return errors.Wrapf(err, "failed to stat audio file media/%s", fn)
		}
		if fInfo.Size() == 0 {
			return errors.Errorf("track audio file media/%s has no data", fn)
		}
	}

	t.ID = hashString(fmt.Sprintf("audio-%s", t.AudioFiles[0]))

	return nil
}

// Point is a 3-dimensional point in space
type Point struct {
	X float64 `json:"x" yaml:"x"`
	Y float64 `json:"y" yaml:"y"`
	Z float64 `json:"z" yaml:"z"`
}

// Announcement is a set of audio tracks to be played to many rooms at a given
// cue
type Announcement struct {
	Track `json:"track" yaml:"track"`

	// Name is the unique, human-friendly name for this announcement
	Name string `json:"name" yaml:"name"`

	// ExcludeRooms is the list of room names in which this announcement should
	// NOT be played
	ExcludeRooms []string `json:"excludeRooms" yaml:"excludeRooms"`
}

func hashString(in string) (out string) {
	hasher := md5.New()
	if _, err := hasher.Write([]byte(in)); err != nil {
		panic("failed to write hash for " + out + ": " + err.Error())
	}

	return hex.EncodeToString(hasher.Sum(nil))
}
