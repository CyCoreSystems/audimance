var agenda = {}
var roomName = ''
var room = {}
var tracks = {}
var performanceTime = {}
var startCue = 'Top of Act 1'
var audioActivated = false
var audioSuspended = false

// Add the activation sound
var activationSound = new Howl({
   html5: false,
   preload: true,
   src: ['/media/activate.mp3'],
})


function mostRecentCue()

/*
class Track extends Howl {
   constructor(trackOpts, perfTime) {

      var urls = []
      trackOpts.audio_files.forEach(function(u) {
         urls.push("/media/"+u)
      })

      // Create the underlying Howl
      super({
         html5: false,
         preload: false,
         src: urls,
         pos: []
      })

      this.performanceTime = perfTime


   }
}
*/

// Add seekAndPlay functionality to Howls
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

   self._seekAndPlay()
}

Howl.prototype._seekAndPlay = function() {
   if(!audioActivated) {
      return
   }
   var since = performanceTime.sinceCue(this.audimanceCue)
   console.log("seeking and playing "+ this.audimanceID +" to "+ since/1000)
   this.seek(since/1000.0)
   //if(!this.playing()) {
      this.play()
   //}
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
            html5: true, // must be set for large files
            preload: false,
            src: urls,
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

         // start playing when audio activation occurs
         performanceTime.once('audioActive', function() {
            src.seekAndPlay()
         })

         if(track.kill_cue && track.kill_cue != '') {
            src.audimanceKillCue = track.kill_cue
            performanceTime.once(track.kill_cue, function() {
               src.seekAndPlay()
            })
         }

         if(track.load_cue && track.load_cue != '') {
            src.audimanceLoadCue = track.load_cue
            performanceTime.once(track.load_cue, function() {
               src.seekAndPlay()
            })
         }

         // seek and play when we receive the play cue
         performanceTime.on(track.cue, function() {
            src.seekAndPlay()
         })

         // bind toggles
         document.getElementById(s.id).addEventListener('change', function(ev) {
            src.mute(!ev.currentTarget.checked)
         })
      })
   })
}

// agendaLoaded is called when the program agenda has been loaded from the server.
// It processes the agenda and sets up all of the workers.
function agendaLoaded(agenda) {
   var button = document.getElementById("play")

   button.innerHTML = "Loading Audio"

   loadAudio()

   button.innerHTML = "Press to Play"
   button.disabled = false

   button.addEventListener("click", function cb(ev) {
      //ev.currentTarget.removeEventListener(ev.type, cb)

      if(!audioSuspended) {
         audioSuspended = true
         Howler.ctx.suspend()
         button.innerHTML = "Press to Play"
         return
      } else {
         audioSuspended = false
         Howler.ctx.resume()
      }

      if(!audioActivated) {
         activationSound.play()
         audioActivated = true
         performanceTime.emit('audioActive')
      }

      // Check to see if performance has started
      if(performanceTime.sinceCue(startCue) >= 0) {
         button.innerHTML = "playing..."
         return
      }

      button.innerHTML = "Waiting for Performance"

      performanceTime.on('timeSync', function cb() {
         if(performanceTime.sinceCue(startCue) < 0) {
            return
         }
         button.innerHTML = "playing..."
         performanceTime.off('timeSync', cb)
      })

   })
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
