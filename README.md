# Audimance

Audimance is a tool for the creation of an entirely new kind of non-visual
artistic experience.  Audimance enables a user-centered and choice-centered rich
auditory experience to be used in isolation or in conjunction with a live
performance.

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


