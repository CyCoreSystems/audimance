var agenda = {}
var roomName = ''
var room = {}
var tracks = {}
var performanceTime = {}
var svg = {}
var playButtons = [1]
var clickPoint = {}
var height = 0
var width = 0
var scaleX = {}
var scaleY = {}
var rScaleX = {}
var rScaleY = {}
var audioLoaded = false
var AudioMaxDistance = 50
var AudioRolloff = "linear" // linear, logarithmic, exponential
var SyncTolerance = 3.0 // sec
var WakeCheckInterval = 6000.0 // ms
var scene = {}
var listenerPosition = {
   x: 50,
   y: 50
}

class Room extends EventEmitter3 {

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
      this.roomName = roomName

      if(!cfg.agenda || typeof(cfg.agenda) != "object") {
         console.log("Room: no agenda")
         return
      }
      this.agenda = cfg.agenda

      this.el = document.getElementById("audimance-map")
      if(!this.el) {
         console.log("Room: no 'audimance-map' identified element found")
         return
      }

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

            listenerPosition.x = self.rScaleX(point[0])
            listenerPosition.y = self.rScaleY(point[1])

            // Subsequent presses change the listener position
            console.log("changing listener position to: " + listenerPosition.x + "," + listenerPosition.y)
            //Howler.pos(x,y,1)
            scene.setListenerPosition(listenerPosition.x, listenerPosition.y, 1)

            _.bind(self.redraw, self)()
         })

      self.redraw()
   }

   redraw() {
      let self = this

      width = this.el.clientWidth
      height = this.el.clientHeight

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
               loadAudio(self.agenda)

               // Draw the sound field
               _.bind(self.redraw, self)()

               // remove play button
               this.remove()
            })
         return
      }

      // Add listener position indicator
      let loc = self.svg.selectAll('circle.listener').data([listenerPosition])

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


function debugToHTML(txt) {
   let dbg = document.getElementById("debug")
   if(!dbg) {
      return
   }

   let el = document.createElement("p")
   el.appendChild(document.createTextNode(txt))
   document.body.appendChild(el)
}


// agendaLoaded is called when the program agenda has been loaded from the server.
// It processes the agenda and sets up all of the workers.
function agendaLoaded(agenda) {
   //button.innerHTML = "play"
   //button.disabled = false
}

function loadAudio(agenda) {
   loadAudioResonance(agenda)
}

function loadAudioResonance(agenda) {
   if(!document.getElementById("roomName")) {
      console.log("not in a room")
      return
   }
   roomName = document.getElementById("roomName").value
   if(roomName == "") {
      console.log("no room")
      return
   }

   agenda.rooms.forEach( function(r) {
      if(r.name == roomName) {
         roomData = r
      }
   })
   if(!roomData.name) {
      console.log("no room matched")
      return
   }

   let ctx = new AudioContext()
   scene = new ResonanceAudio(ctx)
   scene.output.connect(ctx.destination)

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

   scene.setRoomProperties(roomDimensions, roomMaterials)
   scene.setListenerPosition(listenerPosition.x, listenerPosition.y, 1)

   roomData.sources.forEach( function(s) {
      s.tracks.forEach( function(track) {

         let el = document.getElementById("audio-" + track.id)
         if(!el) {
            console.log("no media element matching " + track.id)
            return
         }
         let elSrc = ctx.createMediaElementSource(el)
         let src = scene.createSource()
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
         tracks[track.id] = src

      })
         
   })

}

performanceTime = new PerformanceTime()

window.onload = function() {
   LoadAgenda(function(agenda) {
      room = new Room({
         roomName: "happy trails",
         agenda: agenda
      })
   })
}

// FIXME:  HACK***HACK***HACK
// There is an audio context bug in (at least) Chrome which causes the audio
// context to not release audio files from RAM even after they are stopped and
// unloaded.  As a workaround, we reload the page to reset the web audio
// context.
performanceTime.on('INT-5 min warning', function() {
   window.location.reload(false)
})
