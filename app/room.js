var agenda = {}
var roomName = ''
var room = {}
var tracks = {}
var performanceTime = {}

class PerformanceTime extends EventEmitter3 {

   constructor() {
      super()

      // cues stores the cues which have been announced by the servers, along with
      // the times of their occurrence.  This will always appear in order of receipt,
      // so the last cue will always be the last cue to have been received.
      //
      // cues are stored in the structure:
      // {
      //   cue: "intro",      // name of cue
      //   at: 1519211809934  // time at which the cue was received
      // }
      this.cues = []

      this.connectWS()

   }

   // sinceCue returns the number of milliseconds since the named cue.  If the cue
   // has not yet occurred, it returns a negative value.
   sinceCue(cueName) {
      let now = Date.now()

      var ret = -1

      this.cues.forEach(function(c) {
         if (c.cue == cueName) {
            ret = now - c.at
         }
      })

      return ret
   }

   connectWS() {
      var self = this

      console.log("connecting to server")
      var ws = new WebSocket("ws://"+ location.host +'/ws/performanceTime')

      ws.addEventListener('open', function(ev) {
         console.log("connected to server")
      })

      ws.addEventListener('close', function(ev) {
         console.log("server connection closed")
         setTimeout(function() {
            self.connectWS()
         }, 1000)
      })

      ws.addEventListener('error', function(err) {
         console.log("error receiving from server: "+ err)
         ws.close()
      })

      ws.addEventListener('message', function(ev) {
         console.log("received performanceTime message from server")
         
         // Milliseconds since UNIX epoch
         let now = Date.now()

         let t = JSON.parse(ev.data)

         if (t === undefined) {
            return
         }

         var cues = []
         t.time_points && t.time_points.forEach(function(tp) {

            cues.push({
               cue: tp.cue,
               at: now - (tp.offset * 1000)
            })

         })
         if (cues.length > 0) {
            self.cues = cues
         }

         if (t.cause == "cue") {
            self.emit(cues[cues.length-1].cue)
            console.log("received cue: "+ cues[cues.length-1].cue)
         } else {
            self.emit("timeSync")
         }
      })
   }
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
Howl.prototype.seekAndPlay = function() {
   var self = this

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

   // Stop and unload if we have hit the kill cue
   if( self.audimanceKillCue && performanceTime.sinceCue(self.audimanceKillCue) >= 0) {
      self.unload()
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
   console.log("seeking and playing "+ this.audimanceID +" to "+ since/1000)
   debugToHTML("seeking and playing "+ this.audimanceID +" to "+ since/1000)
   this.seek(since/1000.0)
   this.play()
}

// loadAgenda loads the performance Agenda and executed
// agendaLoaded() after it is retrieved
function loadAgenda() {

   fetch('/agenda.json')
   .then(function(resp) {
      return resp.json();
   })
   .then(function(j) {

      agenda = j
      agendaLoaded(j)

   })
}

// agendaLoaded is called when the program agenda has been loaded from the server.
// It processes the agenda and sets up all of the workers.
function agendaLoaded(agenda) {
   button.innerHTML = "play"
   button.disabled = false
}

function loadAudio() {

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
            html5: false, // must be set for large files
            preload: false,
            src: urls,
            pos: [s.location.x, s.location.y, s.location.z],
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

Howler.mobileAudioEnabled = true

var audioLoaded = false

var button = document.getElementById("playButton")
button.addEventListener("click", function cb(ev) {
      // First press enables audio
      audioLoaded = true
      loadAudio()
      button.innerHTML = "playing"

   window.addEventListener('click', function(ev) {
      // normalize the coordinates to 100x100
      var x = 100 * (ev.clientX / window.innerWidth)
      var y = 100 * (ev.clientY / window.innerHeight)

      // Subsequent presses change the listener position
      console.log("changing listener position to: " + x + "("+ ev.clientX +")," + y +"("+ev.clientY+")")
      Howler.pos(x,y,1)
   })


   ev.currentTarget.removeEventListener(ev.type, cb)
   //button.disabled = true
})

performanceTime = new PerformanceTime()

window.onload = loadAgenda

// Size the clickable area
{
   var el = document.getElementById("playButton")

   el.width = window.innerWidth
   el.height = window.innerHeight

   window.addEventListener('resize', function(ev) {
      el.width = window.innerWidth
      el.height = window.innerHeight
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
