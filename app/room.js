// Upstream dependencies
import * as d3 from './d3.js';
import * as _ from './lodash.min.js';
import * as ResonanceAudio from './resonance-audio.js';
import * as EventEmitter from './eventemitter3.js';

// Local dependencies
import {LoadAgenda} from './agenda.js';
import {PerformanceTime} from './performanceTime.js';

var performanceTime = new PerformanceTime()

// Tunables
export let AudioMaxDistance = 50
export let AudioRolloff = "linear" // linear, logarithmic, exponential
export let SyncTolerance = 3.0 // sec
export let WakeCheckInterval = 6000.0 // ms

export let ListenerPosition = {
   x: 50,
   y: 50
}

// Room provides a d3-based view containing a reticle for locating the listener in a field of audio sources.
// This room will play spatialised audio synchronised to an Audimance performance server.
// There must exist in the DOM a `<div id="audimance-room"></div>` for it to insert its SVG.
// 
// It should be passed an object containing an `agenda` and a `roomName` for a room contained within that agenda.
// ex:
//      room = new Room({
//         roomName: "happy trails",
//         agenda: agenda
//      })
//
export class Room extends EventEmitter {

   constructor(cfg) {
      super()

      this.audioLoaded = false

      if(!cfg || typeof(cfg) != "object") {
         cfg = {}
         console.log("Room: requires a configuration object as an argument")
         return
      }
      if(cfg.roomName == "") {
         console.log("Room: no room")
         return
      }
      this.roomName = cfg.roomName

      if(!cfg.agenda || typeof(cfg.agenda) != "object") {
         console.log("Room: no agenda")
         return
      }
      this.agenda = cfg.agenda

      this.el = document.getElementById("audimance-room")
      if(!this.el) {
         console.log("Room: no 'audimance-room' identified element found")
         return
      }

      this.scene = {}

      this.constructRoom()

      // Redraw sound field when the screen is resized
      window.addEventListener('resize', _.bind(this.redraw, this))
   }

   constructRoom() {
      let self = this

      self.svg = d3.select(self.el).append("svg")

      // Handle listener position changes by click
      self.svg.on('click', function() {

            // Handle listener position changes by click
            let point = d3.clientPoint(this, d3.event)

            ListenerPosition.x = self.rScaleX(point[0])
            ListenerPosition.y = self.rScaleY(point[1])

            // Subsequent presses change the listener position
            console.log("changing listener position to: " + ListenerPosition.x + "," + ListenerPosition.y)
            //Howler.pos(x,y,1)
            self.scene.setListenerPosition(ListenerPosition.x, ListenerPosition.y, 1)

            _.bind(self.redraw, self)()
         })

      self.redraw()
   }

   redraw() {
      let self = this

      let width = this.el.clientWidth
      let height = this.el.clientHeight

      self.scaleX = d3.scaleLinear().domain([0,100]).range([0,width])
      self.rScaleX = d3.scaleLinear().domain([0,width]).range([0,100])
      self.scaleY = d3.scaleLinear().domain([0,100]).range([0,height])
      self.rScaleY = d3.scaleLinear().domain([0,height]).range([0,100])

      console.log("redrawing", width, height)

      // Resize SVG frame
      self.svg
         .attr("width", width)
         .attr("height", height)

      if(!self.audioLoaded) {
         // Draw play button
         self.svg.selectAll("text.button").data([0]).enter().append("text")
            .text("Click to Play")
            .attr("fill", "lightgrey")
            .attr("class", "button")
            .attr("text-anchor", "middle")
            .attr("x", self.scaleX(50))
            .attr("y", self.scaleY(50))
            .attr("width", self.scaleX(100))
            .attr("height", self.scaleY(100))
            .on("click", function(ev) {
               console.log("play clicked")
               self.audioLoaded = true
               loadAudio(self)

               // Draw the sound field
               _.bind(self.redraw, self)()

               // remove play button
               this.remove()
            })
         return
      }

      // Add listener position indicator
      let loc = self.svg.selectAll('circle.listener').data([ListenerPosition])

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
      let sources = this.svg.selectAll("circle.source").data(self.agenda.rooms[0].sources)

      sources
         .enter().append("circle")
            .attr("r", 10)
            .attr("class", "source")
            .attr("fill", function(d, i) { return d3.schemeCategory10[i] })
            .text(function(d) { return d.name })
         .merge(sources)
            .attr("cx", function(d) { return self.scaleX(d.location.x) })
            .attr("cy", function(d) { return self.scaleY(100-d.location.y) })

      // Add source labels
      let labels = self.svg.selectAll("text.sourceText")
         .data(self.agenda.rooms[0].sources)

      labels
         .enter().append("text")
            .attr("text-anchor", "middle")
            .attr("class", "sourceText")
            .attr("fill", "grey")
            .text(function(d) { return d.name })
         .merge(labels)
            .attr("x", function(d) { return self.scaleX(d.location.x) })
            .attr("y", function(d) { return self.scaleY(100-d.location.y) })
            .attr("dy", "2em")
   }
}


function loadAudio(room) {
   loadAudioResonance(room)
}

function loadAudioResonance(room) {
   let agenda = room.agenda
   let roomData = {}

   agenda.rooms.forEach( function(r) {
      if(r.name == room.roomName) {
         roomData = r
      }
   })
   if(!roomData.name) {
      console.log("no room matched")
      return
   }

   let ctx = new AudioContext()
   room.scene = new ResonanceAudio(ctx)
   room.scene.output.connect(ctx.destination)

   let roomDimensions = {
      width: 100,
      height: 100,
      depth: 10,
   }

   let roomMaterials = {
      left: 'grass',
      right: 'grass',
      front: 'grass',
      back: 'grass',
      down: 'grass',
      up: 'transparent'
   }

   room.scene.setRoomProperties(roomDimensions, roomMaterials)
   room.scene.setListenerPosition(ListenerPosition.x, ListenerPosition.y, 1)

   roomData.sources.forEach( function(s) {
      s.tracks.forEach( function(track) {

         let el = document.getElementById("audio-" + track.id)
         if(!el) {
            console.log("no media element matching " + track.id)
            return
         }
         let elSrc = ctx.createMediaElementSource(el)
         let src = room.scene.createSource()
         elSrc.connect(src.input)

         src.setPosition(s.location.x, (100-s.location.y), s.location.z)
         src.setRolloff("linear")
         src.setMaxDistance(AudioMaxDistance)

         // Toggle play once to initial mobile playback
         el.play()
         el.pause()

         let loaded = false
         function loadOnce() {
            if(!loaded && performanceTime.sinceCue(el.dataset.loadcue) > 0) {
               loaded = true
               el.load()
            }
         }

         // resync audio; if resync returns true, then the audio is synced and ready to be played
         function resync() {
            loadOnce()

            let now = performanceTime.sinceCue(el.dataset.cue)
            if(now < 0) {
               // not yet queued
               return false
            }

            let latestCuedTrack = performanceTime.latestCuedTrack(s)
            if( !latestCuedTrack || latestCuedTrack.id != track.id ) {
               el.pause()
               return false 
            }
            if(now > el.duration) {
               // track has already ended
               el.pause()
               return false
            }

            let diff = Math.abs(now - el.currentTime)

            if(diff > SyncTolerance) {

               console.log(s.name +" out of sync; reseeking.  Diff: " + diff)
               el.volume = 0
               el.currentTime = now
               return false
            }

            // already synced
            return true
         }

         let lastSync = Date.now()
         performanceTime.on('timeSync', function() {
            resync()
            return
         })
         
         el.addEventListener('seeked', function(ev) {
            console.log('seeked')

            if(resync()) {
               el.volume = 1.0
               el.play()
            }

            return
         })

         el.addEventListener('progress', function(ev) {

         })

         el.addEventListener('cueChange', function(ev) {
            el.volume = 0

            if(resync()) {
               el.volume = 1.0
               el.play()
            }
         })

         el.addEventListener('loadedmetadata', function(ev) {
            console.log("loaded metadata")
            resync()
            return
         })

         // store the cue
         src.audimanceCue = track.cue

         // store the audimance ID so that we may reverse-index it
         src.audimanceID = track.id

         // forward index the audimance ID
         s.tracks[track.id] = src

      })
         
   })

}
