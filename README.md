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


