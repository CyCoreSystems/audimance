# Audimance

Audimance is a tool for the creation and deployment of user-directed artistic audio experiences.
Content may be designed for use in isolation, as accompaniment to other media, or in conjunction 
with live performance using QLab. 

Audimance enables a user-centered, flexibly complex, audio environment ideal for nonvisual audiences
and can be used to provide either single-track or multi-track audio description.  

## Why? 

Audimance was initially created to solve for a lack of equity and aesthetic sophistication 
in the previous standard practice of audio description for dance.  Designed by Laurel Lawson
(laurellawson.com) and initially deployed alongside Kinetic Light's DESCENT (kineticlight.org/descent),
Audimance is based on research and continual feedback from primarily nonvisual artists and arts audiences.  

Audimance provides a flexible deployment platform which:
- permits artists and content creators to easily deploy single or multi-track content
- facilitates venues in providing consistently available accessibility without large dedicated hardware systems
- creates user-directed aesthetic experiences which prioritize user agency for style and complexity

## Sample Use Cases

* Rich multi-track audio description to accompany live or recorded dance, theatre, or other performing arts 
* Spatialized sonic art or performance 
* Simple audio description to accompany performing arts
* Silent concerts or other sound experiences leveraging personal mobile devices 
* Delivery of programs, notes, or other textual assets accompanying performing or exhibited arts
* Audio description for visual arts, such as gallery or museum exhibitions 

## Usage

Audimance can be run as a binary operating on a set of custom web files and
program agenda configuration.  Generally, no modifications to the engine source
code are necessary.

Audimance expects a certain format for its execution root.  See the `/example`
directory for this structure.

The most important file is the `agenda.yaml`, which defines the program,
sections, cues, audio files, etc.  The web templates are located in the `views/`
directory.  `index.html` is always the entry point, and `room.html` represents
the template for a room (a place where a performance occurs).

There are very few constraints on styling or format overall.  Instead, the data
structures are accessible via Go `text/html` templating and from Javascript.

### Go template data structures

The data structure available to a Room is:

```go
struct {
   Announcements []*agenda.Announcement
   Room *Agenda.Room
}
```

The main index, however, has the entire Agenda available at its data root.

### Javascript helpers

The core of the javascript side of Audimance consists of the `performanceTime` package.

This package receives continuous ticker notifications and cue announcements
which enable Audimance to keep in sync with the live performance, to the
fraction of a second, continuously synchronizing.

The builtin `room.js` file provides a complete application for playback and
control of a performance.  You need only load it from your room's HTML, provide
it a `<div id="audimance-map"></div>` to fill, and it will handle everything
else.

Feel free, too, to simply use it as a model on which to build your own.

### Dependencies

Because Audimance is intended to be run at venues with unreliable internet, all
dependencies are bundled and local.  We recommend any additional dependencies be
managed in the same way to reduce external internet traffic from dozens or
hundreds of audience members.

## Technical

### Audio spatialization

Audimance leverages [Resonance Audio](https://resonance-audio.github.io/resonance-audio/) to provide
cross-platform 3-D spatialization of many source sources.

### Audio Synchronization

Audimance provides source-separated external synchronization (such as for
synchronizing certain audio sources to a live performance), and virtual rooms
which may be traversed and chosen independently and interactively by individual
audience members.

Audimance accepts cues on a UDP port (9001, by default) to be fed from external
synchronization sources, such as from Figure53's
[QLab](https://figure53.com/qlab/).  It expects the cue label to be received in
case-sensitive plain text on the UDP port to trigger the cue.


