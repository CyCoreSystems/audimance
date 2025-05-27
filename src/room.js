// Upstream dependencies
import * as d3 from 'd3';
import _ from 'lodash';
import {ResonanceAudio} from '@3den.club/resonance-audio';
import NoSleep from 'nosleep.js';

// Local upstream dependencies
//import defaultExport from './resonance-audio/main.js';

// Local dependencies
import {LoadAgenda} from './agenda.js';
import {PerformanceTime} from './performanceTime.js';

var performanceTime = new PerformanceTime()
var noSleep = new NoSleep()

// Tunables
export let AudioMaxDistance = 50
export let AudioRolloff = "linear" // linear, logarithmic, exponential
export let SyncTolerance = 3.0 // sec
export let WakeCheckInterval = 6000.0 // ms

class Position {
   constructor(x,y,z, width, height, depth) {
      this.x = x
      this.y = y
      this.z = z
      this.width = width
      this.height = height
      this.depth = depth
   }

   fromClick(clickX, clickY) {
      this.x = clickX - (this.width/2)
      this.z = (this.depth/2) - clickY
   }

   toSVG() {
      return {
         x: this.x + (this.width/2),
         y: (this.depth/2) - this.z
      }
   }

   // we store in native audio format
   toAudio() {
      return {
         x: this.x,
         y: this.y,
         z: this.z
      }
   }
}

// SpatialRoom provides a d3-based view containing a reticle for locating the listener in a field of audio sources.
// This room will play spatialised audio synchronised to an Audimance performance server.
// There must exist in the DOM a `<div id="audimance-room"></div>` for it to insert its SVG.
//
// It should be passed an object containing an `agenda` and a `roomName` for a room contained within that agenda.
// ex:
//      room = new SpatialRoom({
//         roomName: "happy trails",
//         agenda: agenda
//      })
//
export class SpatialRoom extends EventTarget {

   constructor(cfg) {
      super()

      let self = this

      this.audioLoaded = false

      if(!cfg || typeof(cfg) != "object") {
         cfg = {}
         console.log("SpatialRoom: requires a configuration object as an argument")
         return
      }
      if(cfg.roomName == "") {
         console.log("SpatialRoom: no room")
         return
      }
      this.roomName = cfg.roomName

      if(!cfg.agenda || typeof(cfg.agenda) != "object") {
         console.log("SpatialRoom: no agenda")
         return
      }
      this.agenda = cfg.agenda

      this.el = document.getElementById("audimance-room")
      if(!this.el) {
         console.log("SpatialRoom: no 'audimance-room' identified element found")
         return
      }

      this.svg = d3.select(this.el).append("svg")

      this.scene = {}

      this.data = {}

      cfg.agenda.rooms.forEach( function(r) {
         if(r.name == cfg.roomName) {
            self.data = r
         }
      })
      if(!this.data.name) {
         console.log("no room matched")
         return
      }

      // DEBUG
      window.room = this

      this.listenerPosition = new Position(0, 0, 0, this.data.dimensions.width, this.data.dimensions.height, this.data.dimensions.depth)

      this.redraw()

      // Redraw sound field when the screen is resized
      window.addEventListener('resize', _.bind(this.redraw, this))
   }

   enableAudio() {
      self = this
      self.audioLoaded = true

      loadAudio(self)

      // Disable display sleep
      noSleep.enable()
   }

   drawPlayButton() {
      self = this

      // Draw play button
      self.svg.selectAll("text.button").data([0]).enter().append("text")
         .text("Click to Play")
         .attr("fill", "lightgrey")
         .attr("class", "button")
         .attr("text-anchor", "middle")
         .attr("x", self.scaleX(self.data.dimensions.width/2))
         .attr("y", self.scaleY(self.data.dimensions.depth/2))
         .attr("width", self.scaleX(self.data.dimensions.width))
         .attr("height", self.scaleY(self.data.dimensions.depth))
         .on("click", function(ev) {
            console.log("play clicked")

            self.enableAudio()

            // Draw the sound field
            _.bind(self.redraw, self)()

            // remove play button
            this.remove()
         })
   }

   redraw() {
      let self = this

      let width = this.el.clientWidth
      let height = this.el.clientHeight

      // Resize SVG frame to match containing div
      self.svg
         .attr("width", width)
         .attr("height", height)

      // Determine scale based on room dimensions
      self.scaleX = d3.scaleLinear().domain([0,self.data.dimensions.width]).range([0,width])
      self.rScaleX = d3.scaleLinear().domain([0,width]).range([0,self.data.dimensions.width])
      self.scaleY = d3.scaleLinear().domain([0,self.data.dimensions.height]).range([0,height])
      self.rScaleY = d3.scaleLinear().domain([0,height]).range([0,self.data.dimensions.height])

      console.log("redrawing", width, height)

      if(!self.audioLoaded) {
         if (typeof(window.AUDIMANCE_WRAPPER_PLATFORM) !== "undefined") {
            // User is in the Audimance app.
            if (window.AUDIMANCE_WRAPPER_PLATFORM === "iOS") {
               self.enableAudio()
            }
         } else {
            // Draw the play button
            // and defer drawing the sound field until the user clicks it
            self.drawPlayButton()
            return
         }
      }

      // Add listener position indicator
      let loc = self.svg.selectAll('circle.listener').data([{
         x: self.listenerPosition.toSVG().x,
         y: self.listenerPosition.toSVG().y, // note we are presenting depth (z) as y-axis for this display
      }])

      loc
         .enter().append("circle")
            .attr("r", 10)
            .attr("class", "listener")
            .attr("stroke", "white")
            .attr("stroke", "white")
         .merge(loc)
            .attr("cx", function(d) { return self.scaleX(d.x) })
            .attr("cy", function(d) { return self.scaleY(d.y) })

      // Add source indicators
      let sources = this.svg.selectAll("circle.source").data(self.data.sources)

      sources
         .enter().append("circle")
            .attr("r", 10)
            .attr("class", "source")
            .attr("fill", function(d, i) { return d3.schemeCategory10[i] })
            .text(function(d) { return d.name })
         .merge(sources)
            .attr("cx", function(d) { return self.scaleX(d.location.x + self.data.dimensions.width/2) })
            .attr("cy", function(d) { return self.scaleY(self.data.dimensions.depth/2-d.location.z) })

      // Add source labels
      let labels = self.svg.selectAll("text.sourceText")
         .data(self.data.sources)

      labels
         .enter().append("text")
            .attr("text-anchor", "middle")
            .attr("class", "sourceText")
            .attr("fill", "grey")
            .text(function(d) { return d.name })
         .merge(labels)
            .attr("x", function(d) { return self.scaleX(d.location.x + self.data.dimensions.width/2) })
            .attr("y", function(d) { return self.scaleY(self.data.dimensions.depth/2-d.location.z) })
            .attr("dy", "2em")
   }
}


function loadAudio(room) {
   loadAudioResonance(room)
}

function loadAudioResonance(room) {
   let agenda = room.agenda
   let ctx = new AudioContext()

   room.scene = new window.ResonanceAudio(ctx)
   room.scene.output.connect(ctx.destination)

   room.scene.setRoomProperties(room.data.dimensions, room.materials)
   room.scene.setListenerPosition(0,0,0)

   // Update listener position changes by click
   room.svg.on('click', function(event) {

      // Handle listener position changes by click
      let point = d3.pointer(event, room.svg)

      console.log("got click at: "+ point[0] +","+ point[1])

      // scale and translate point coordinates to room coordinates (relative to center-of-room)
      room.listenerPosition.fromClick(room.rScaleX(point[0]), room.rScaleY(point[1]))

      // Subsequent presses change the listener position
      console.log("changing listener position to: " + room.listenerPosition.toSVG().x + "," + room.listenerPosition.toSVG().y)

      // **NOTE**:  listener position is as offset from the CENTER of the room, not the origin
      // Unlike room dimensions, these are x, y, z.
      room.scene.setListenerPosition(
         room.listenerPosition.toAudio().x,
         room.listenerPosition.toAudio().y,
         room.listenerPosition.toAudio().z,
      )

      _.bind(room.redraw, room)()
   })

   room.sources = []

   room.data.sources.forEach( function(s) {
         room.sources[s.id] = new Source(ctx, room, s)
   })
}

class Track {
   constructor(ctx, room, index, s, data) {
      let self = this

      let el = document.getElementById("audio-" + s.id + "-" + index)
      if(!el) {
         console.error("no media element matching audio-" + s.id + "-" + index)
         return
      }
      console.log("configuring track audio-"+s.id+"-"+index)

      self.el = el
      self.src = s
      self.myCue = data.cue
      self.loaded = false

      /*
      self.baseURI = "/media/"
	   if(room.agenda.mediaBaseURL != "") {
         self.baseURI = room.agenda.mediaBaseURL
      }
      */

      // Set the initial source for this track
      // this didn't work earlier; need to check to allow simpler HTML
      /*
      for ( let i = 0; i < data.audioFiles.length; i++ ) {
         el.getElementsByTagName("source")[i].src = baseURI + data.audioFiles[i]
      }
      */

      // Configure the audio mixing characteristics
      let elSrc = ctx.createMediaElementSource(el)
      let src = room.scene.createSource()
      elSrc.connect(src.input)

      // NOTE: position is offset from _CENTER_ of room, not origin
      //src.setPosition(s.location.x-(room.dimensions.width/2),s.location.y-(room.dimensions.height/2),s.location.z-(room.dimensions.depth/2))
      src.setPosition(s.location.x,s.location.y,s.location.z)

      src.setRolloff("linear")
      src.setMaxDistance(AudioMaxDistance)

      // Toggle play once to initialise mobile playback
      let playPromise = el.play()
      if (playPromise !== undefined) {
         playPromise.then(_ => {
            el.pause()
         })
         .catch(error => {
            console.error("pause for source "+s.id+" track "+ index + " failed", error, error.stack)
         })
      }

      let lastSync = Date.now()
      performanceTime.addEventListener('timeSync', function() {
         self.resync()
         return
      })

      el.addEventListener('seeked', function(ev) {
         console.log('seeked')

         if(self.resync()) {
            el.volume = 1.0
            el.play()
         }

         return
      })

      el.addEventListener('progress', function(ev) {

      })

      el.addEventListener('loadedmetadata', function(ev) {
         console.log("loaded metadata")
         self.resync()
         return
      })

   }

   cueChanged() {
         this.el.volume = 0

         if(this.resync()) {
            this.el.volume = 1.0
            this.el.play()
         }
   }

   loadOnce() {
      if(!this.loaded && performanceTime.sinceCue(this.el.dataset.loadcue) > 0) {
         this.loaded = true
         this.el.load()
      }
   }

   setTrackIndex(n) {
      console.log("setting track index "+n)

      let self = this

      self.loaded = false

      let srcTrack = self.src.tracks[n]
      if (srcTrack == undefined ) {
         console.error("track does not exist")
         return
      }

      self.myCue = srcTrack.cue

      for ( let i = 0; i < srcTrack.audioFiles.length; i++ ) {
         console.log("updating source for "+ self.src.id +" to "+ srcTrack.audioFiles[i])
         self.el.getElementsByTagName("source")[i].src = srcTrack.audioFiles[i]
      }

      self.loaded = true

      self.el.load()
   }

   // resync audio; if resync returns true, then the audio is synced and ready to be played
   resync() {
      let self = this

      self.loadOnce()

      let now = performanceTime.sinceCue(self.myCue)
      if(now < 0) {
         // not yet queued
         return false
      }

      let latestCuedTrack = performanceTime.latestCuedTrack(self.src)
      if( !latestCuedTrack || latestCuedTrack.cue != self.myCue ) {
         // not our cue
         self.el.pause()
         return false
      }

      if(now > self.el.duration) {
         // track has already ended
         self.el.pause()
         return false
      }

      let diff = Math.abs(now - self.el.currentTime)

      if(diff > SyncTolerance) {

         console.log(self.src.name +" out of sync; reseeking.  Diff: " + diff)
         self.el.volume = 0
         self.el.currentTime = now

         return false
      }

      // already synced
      return true
   }
}

class Source {

   constructor(ctx, room, src) {
      let self = this

      this.data = src
      this.currentCue = ""
      this.currentTrack = 0
      this.tracks = []

      this.tracks[0] = new Track(ctx, room, 0, src, src.tracks[0]) // initialise with the first track of this source
      this.tracks[1] = new Track(ctx, room, 1, src, src.tracks[1]) // initialise with the second track of this source

      performanceTime.addEventListener('cueChange', function() {
         self.cueChanged()
      })

      // Make sure we process a timeSync event to set the initial cue on load
      performanceTime.addEventListener('timeSync', function() {
         self.cueChanged()
      },{ once: true})
   }

   cueChanged() {
      if (!this) {
         return
      }

      var self = this

      var latestCuedTrack = performanceTime.latestCuedTrack(self.data)

      if ( !latestCuedTrack) {
         return
      }

      let currentCue = latestCuedTrack.cue

      let currentCueIndex = 0
      for ( let i = 0; i < self.data.tracks.length; i++ ) {
         if (self.data.tracks[i].cue == currentCue) {
            currentCueIndex = i
            break
         }
      }

      console.log("cueChange: new cue is "+ currentCue +", index "+ currentCueIndex )

      if (self.tracks[0].myCue == currentCue) {
         self.tracks[1].setTrackIndex(currentCueIndex+1)

         self.tracks[0].cueChanged()
         self.tracks[1].cueChanged()
         return
      }

      if (self.tracks[1].myCue == currentCue) {
         self.tracks[0].setTrackIndex(currentCueIndex+1)

         self.tracks[0].cueChanged()
         self.tracks[1].cueChanged()
         return
      }

      // Oops; no one has this cue; give it to the first track
      self.tracks[0].setTrackIndex(currentCueIndex)
      self.tracks[1].setTrackIndex(currentCueIndex+1)

      self.tracks[0].cueChanged()
      self.tracks[1].cueChanged()
   }

}
