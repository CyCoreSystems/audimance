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



function debugToHTML(txt) {
   var dbg = document.getElementById("debug")
   if(!dbg) {
      return
   }

   var el = document.createElement("p")
   el.appendChild(document.createTextNode(txt))
   document.body.appendChild(el)
}

// Add seekAndPlay functionality to Howls
/*
Howl.prototype.seekAndPlay = function() {
   var self = this

   // Stop and unload if we have hit the kill cue
   if( self.audimanceKillCue && performanceTime.sinceCue(self.audimanceKillCue) >= 0) {
      self.unload()
      return
   }

   if( self.audimanceLoadCue && performanceTime.sinceCue(self.audimanceLoadCue) >= 0) {
      if(self.state() == "unloaded") {
         console.log("loading "+ self.audimanceID)
         self.load()
         return // seekAndPlay will be called when load is complete
      }
   }

   // No-op if it our cue has not been called
   if( performanceTime.sinceCue(self.audimanceCue) < 0) {
      return
   }

   var ts = Date.now()

   if(self.state() == "loaded") {
      self._seekAndPlay()
      return
   }

   if(self.state() == "unloaded") {
      console.log("loading "+ self.audimanceID)
      self.load()
   }

   return
}

Howl.prototype._seekAndPlay = function() {
   var since = performanceTime.sinceCue(this.audimanceCue)
   console.log("seeking and playing "+ this.audimanceID +" to "+ since)
   debugToHTML("seeking and playing "+ this.audimanceID +" to "+ since)
   this.seek(since)
   this.play()
}
*/

// loadAgenda loads the performance Agenda and executed
// agendaLoaded() after it is retrieved
function loadAgenda() {

   var div = document.getElementById("map")

   svg = d3.select(div).append("svg")
      
   svg.style("background-color", "black")

   function redraw() {

      width = div.clientWidth
      height = div.clientHeight

      scaleX = d3.scaleLinear().domain([0,100]).range([0,width])
      rScaleX = d3.scaleLinear().domain([0,width]).range([0,100])
      scaleY = d3.scaleLinear().domain([0,100]).range([0,height])
      rScaleY = d3.scaleLinear().domain([0,height]).range([0,100])

      console.log("redrawing", width, height)

      // Resize SVG frame
      svg
         .attr("width", width)
         .attr("height", height)

      if(!audioLoaded) {
         // Draw play button
         svg.selectAll("text.button").data([0]).enter().append("text")
            .text("Click to Play")
            .attr("fill", "lightgrey")
            .attr("class", "button")
            .attr("text-anchor", "middle")
            .attr("x", scaleX(50))
            .attr("y", scaleY(50))
            .attr("width", scaleX(100))
            .attr("height", scaleY(100))
            .on("click", function(ev) {
               console.log("play clicked")
               audioLoaded = true
               loadAudio(agenda)

               // Draw the sound field
               redraw()

               // remove play button
               this.remove()
            })
         return
      }

      // Handle listener position changes by click
      svg.on('click', function() {

            // Handle listener position changes by click
            var point = d3.clientPoint(this, d3.event)

            listenerPosition.x = rScaleX(point[0])
            listenerPosition.y = rScaleY(point[1])

            // Subsequent presses change the listener position
            console.log("changing listener position to: " + listenerPosition.x + "," + listenerPosition.y)
            //Howler.pos(x,y,1)
            scene.setListenerPosition(listenerPosition.x, listenerPosition.y, 1)

            redraw()
         })

      // Add listener position indicator
      var loc = svg.selectAll('circle.listener').data([listenerPosition])

      loc
         .enter().append("circle")
            .attr("r", 10)
            .attr("class", "listener")
            .attr("stroke", "white")
            .attr("stroke", "white")
         .merge(loc)
            .attr("cx", function(d) { return scaleX(d.x) })
            .attr("cy", function(d) { return scaleY(d.y) })

      // Add source indicators
      var sources = svg.selectAll("circle.source").data(agenda.rooms[0].sources)

      sources
         .enter().append("circle")
            .attr("r", 10)
            .attr("class", "source")
            .attr("fill", function(d, i) { return d3.schemeCategory10[i] })
            .text(function(d) { return d.name })
         .merge(sources)
            .attr("cx", function(d) { return scaleX(d.location.x) })
            .attr("cy", function(d) { return scaleY(100-d.location.y) })

      // Add source labels
      var labels = svg.selectAll("text.sourceText")
         .data(agenda.rooms[0].sources)

      labels
         .enter().append("text")
            .attr("text-anchor", "middle")
            .attr("class", "sourceText")
            .attr("fill", "grey")
            .text(function(d) { return d.name })
         .merge(labels)
            .attr("x", function(d) { return scaleX(d.location.x) })
            .attr("y", function(d) { return scaleY(100-d.location.y) })
            .attr("dy", "2em")
   }
   
   fetch('/agenda.json')
   .then(function(resp) {
      return resp.json();
   })
   .then(function(j) {

      agenda = j
      agendaLoaded(j)

      redraw()

      // Redraw sound field when the screen is resized
      window.addEventListener('resize', redraw)

   })
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

         var loaded = false
         function loadOnce() {
            if(!loaded && performanceTime.sinceCue(el.dataset.loadcue) > 0) {
               loaded = true
               el.load()
            }
         }

         // resync audio; if resync returns true, then the audio is synced and ready to be played
         function resync() {
            loadOnce()

            var now = performanceTime.sinceCue(el.dataset.cue)
            if(now < 0) {
               // not yet queued
               return false
            }

            var latestCuedTrack = performanceTime.latestCuedTrack(s)
            if( !latestCuedTrack || latestCuedTrack.id != track.id ) {
               el.pause()
               return false 
            }
            if(now > el.duration) {
               // track has already ended
               el.pause()
               return false
            }

            var diff = Math.abs(now - el.currentTime)

            if(diff > SyncTolerance) {

               console.log(s.name +" out of sync; reseeking.  Diff: " + diff)
               el.volume = 0
               el.currentTime = now
               return false
            }

            // already synced
            return true
         }

         var lastSync = Date.now()
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

         /*
         if(track.kill_cue && track.kill_cue != '') {
            src.audimanceKillCue = track.kill_cue
            performanceTime.once(track.kill_cue, function() {
               el.unload()
            })
         }

         if(track.load_cue && track.load_cue != '') {
            src.audimanceLoadCue = track.load_cue
            performanceTime.once(track.load_cue, function() {
               el.load()
            })
         }
         // seek and play when we receive the play cue
         performanceTime.on(track.cue, function() {
            src.seekAndPlay()
         })
         */
      })
         
   })

}

function loadAudioHowler() {

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

   /* Howler.js method */
   roomData.sources.forEach( function(s) {

      s.tracks.forEach( function(track) {

         var urls = []
         track.audio_files.forEach(function(u) {
            urls.push("/media/"+ u)
         })

         var src = new Howl({
            html5: true, // must be set for large files
            preload: false,
            src: urls,
            pos: [s.location.x, (100-s.location.y), s.location.z],
            panningModel: 'HRTF',
            refDistance: 1,
            maxDistance: 90,
            rolloffFactor: 1,
            distanceModel: 'linear',
            onload: function() {
               this.seekAndPlay() // safety check, in case of long load delay
            },
         })


         // store the cue to the Howl
         src.audimanceCue = track.cue

         // store the audimance ID to the Howl so that we may reverse-index it
         src.audimanceID = track.id

         // forward index the audimance ID to the Howl
         tracks[track.id] = src

         // handle the _first_ time sync to make sure we know where things lie
         // if we do not have performanceTime available before we load the
         // track
         performanceTime.once('timeSync', function() {
           src.seekAndPlay()
         })

         if(track.kill_cue && track.kill_cue != '') {
            src.audimanceKillCue = track.kill_cue
            performanceTime.once(track.kill_cue, function() {
               src.unload()
            })
         }

         if(track.load_cue && track.load_cue != '') {
            src.audimanceLoadCue = track.load_cue
            performanceTime.once(track.load_cue, function() {
               src.load()
            })
         }
         // seek and play when we receive the play cue
         performanceTime.on(track.cue, function() {
            src.seekAndPlay()
         })
      })

   })
}

//Howler.mobileAudioEnabled = true

performanceTime = new PerformanceTime()

window.onload = loadAgenda

// FIXME:  HACK***HACK***HACK
// There is an audio context bug in (at least) Chrome which causes the audio
// context to not release audio files from RAM even after they are stopped and
// unloaded.  As a workaround, we reload the page to reset the web audio
// context.
performanceTime.on('INT-5 min warning', function() {
   window.location.reload(false)
})
