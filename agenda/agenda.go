package agenda

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"path"

	"github.com/pkg/errors"
	uuid "github.com/satori/go.uuid"
	yaml "gopkg.in/yaml.v2"
)

// New attempts to load an agenda from the given filename
func New(filename string) (*Agenda, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read agenda from file")
	}

	a := new(Agenda)
	err = yaml.Unmarshal(data, a)
	return a, err
}

// Agenda describes the order of service and details of a performance
type Agenda struct {

	// Cues describe specific points in time in a performance
	Cues []Cue `json:"cues" yaml:"cues"`

	// Rooms describe virtual rooms in which audio may be played
	Rooms []Room `json:"rooms" yaml:"rooms"`

	// Announcements describe broadcast messages which will be played across any
	// number of rooms
	Announcements []Announcement `json:"announcements" yaml:"announcements"`
}

// AllTracks returns the list of all tracks for all rooms and announcements so
// that they may be prefetched.
func (a *Agenda) AllTracks() (out []Track) {

	// Track already-seen audio files so that we do not list them twice
	var seen []string
	var unseen = func(id string) bool {
		for _, i := range seen {
			if i == id {
				return false
			}
		}
		return true
	}

	// Load Announcements first
	for _, ann := range a.Announcements {
		if unseen(ann.ID()) {
			out = append(out, ann.Track)
			seen = append(seen, ann.ID())
		}
	}

	// Load tracks from Rooms next
	for _, r := range a.Rooms {
		for _, t := range r.AllTracks() {
			if unseen(t.ID()) {
				out = append(out, t)
				seen = append(seen, t.ID())
			}
		}
	}

	return
}

// Cue describes a specific point in time, with respect to the performance
// timeline
type Cue struct {

	// Name is the unique, human-friendly name for this cue
	Name string `json:"name" yaml:"name"`

	// QLabID is the unique identifier for this cue in QLab (assuming there are
	// such things)
	QLabID string `json:"q_lab_id" yaml:"q_lab_id"`

	// Data is the expected data to be emitted from QLab (assuming this is useful)
	Data string `json:"data" yaml:"data"`
}

// ID returns a unique hex ID for the cue
func (c *Cue) ID() string {
	// If we don't have a name, generate one
	if c.Name == "" {
		c.Name = uuid.NewV1().String()
	}

	return hashString(fmt.Sprintf("cue-%s", c.Name))
}

// Room describes a virtual room in which audio may be played
type Room struct {

	// Name is the unique, human-friendly name for this room
	Name string `json:"name" yaml:"name"`

	// LabelText indicates the textual label to be displayed in the menu for
	// users to select this room
	LabelText string `json:"label_text" yaml:"label_text"`

	// Sources describes the set of locations and audio files which will be
	// played.
	Sources []Source `json:"sources" yaml:"sources"`

	// RoomTracks is a list of audio tracks to be played in a room, sourced from
	// everywhere.  This is generally exclusive with Sources.
	RoomTracks []Track `json:"room_tracks" yaml:"room_tracks"`
}

// ID returns a unique hex ID for the room
func (r *Room) ID() string {
	// If we don't have a name, generate one
	if r.Name == "" {
		r.Name = uuid.NewV1().String()
	}

	return hashString(fmt.Sprintf("room-%s", r.Name))
}

// AllTracks returns the list of all tracks for the room so that they may be
// preloaded.
func (r *Room) AllTracks() (out []Track) {

	// Track already-seen audio files so that we do not list them twice
	var seen []string
	var unseen = func(id string) bool {
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
			if unseen(t.ID()) {
				out = append(out, t)
				seen = append(seen, t.ID())
			}
		}
	}

	// Iterate RoomTracks next
	for _, t := range r.RoomTracks {
		if unseen(t.ID()) {
			out = append(out, t)
			seen = append(seen, t.ID())
		}
	}

	return
}

// Source describes a unique audio sequence and location
type Source struct {

	// Name is the unique, human-friendly name for this source
	Name string `json:"name" yaml:"name"`

	// Location indicates a specific 3-dimensional coordinate in the room from
	// which the audio of this source emanates
	Location Point `json:"location" yaml:"location"`

	// Tracks is the list of audio tracks which should be played upon reaching a
	// particular cue
	Tracks []Track `json:"tracks" yaml:"tracks"`
}

// ID returns a unique hex ID for the source
func (s *Source) ID() string {
	// If we don't have a name, generate one
	if s.Name == "" {
		s.Name = uuid.NewV1().String()
	}

	return hashString(fmt.Sprintf("source-%s", s.Name))
}

type Track struct {

	// Cue is the unique identifier of the cue at which this track should be
	// played
	Cue string `json:"cue" yaml:"cue"`

	// AudioFile is the user-supplied location of the audio file, relative to
	// the filesystem `media/` directory
	AudioFile string `json:"audio_file" yaml:"audio_file"`

	// Repeat indicates whether the PlaySet should be repeated after it is
	// completed.  This will cause the PlaySet to be continually played.
	Repeat bool `json:"repeat" yaml:"repeat"`
}

// ID returns a unique hex ID for the track location.  Note that this is not
// required to be system-unique; only file-unique.  Thus the same track ID may
// be used multiple times (to play the same file at different times or
// locations).
func (t *Track) ID() string {
	// If we don't have a name, generate one
	if t.AudioFile == "" {
		return ""
	}

	return hashString(fmt.Sprintf("audio-%s", t.AudioFile))
}

// URI returns the URL of the audio file for use in the HTML audio tag.  It is
// generated from the AudioFile property.
func (t *Track) URI() string {
	// If we don't have a name, generate one
	if t.AudioFile == "" {
		return ""
	}

	return path.Join("/media", t.AudioFile)
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
	ExcludeRooms []string `json:"exclude_rooms" yaml:"exclude_rooms"`
}

func hashString(in string) (out string) {
	hasher := md5.New()
	hasher.Write([]byte(in))
	return hex.EncodeToString(hasher.Sum(nil))
}
