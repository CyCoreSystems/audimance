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

      var el = document.getElementById('audio-'+s.id)

      // Always seek when play is resumed
      el.addEventListener('play', function(ev) {
         var latestCuedTrack = null

         s.tracks.forEach( function(track) {
            if(performanceTime.sinceCue(track.cue) >= 0) {
               latestCuedTrack = track
            }
         })
         
         if(latestCuedTrack !== null) {
            el.src = '/media/' + track.audio_files[1]
            el.loop = false
            el.currentTime = performanceTime.sinceCue(track.cue)
         }
      })

      var latestCuedTrack = null
      s.tracks.forEach( function(track) {

         performanceTime.on(track.cue, function() {
            el.src = '/media/'+ track.audio_files[1]
            el.loop = false
            el.currentTime = 0
            el.play()
         })

         if(performanceTime.sinceCue(track.cue) >= 0) {
            latestCuedTrack = track
         }
      })

      if(latestCuedTrack !== null) {
         el.src = track.audio_files[1]
         el.loop = false
         el.currentTime = performanceTime.sinceCue(latestCuedTrack.cue)
         el.play()
      }

         // bind toggles
 //        document.getElementById(s.id).addEventListener('change', function(ev) {
//            src.mute(!ev.currentTarget.checked)
 //        })
 //     })
   })
}

// agendaLoaded is called when the program agenda has been loaded from the server.
// It processes the agenda and sets up all of the workers.
function agendaLoaded(agenda) {
   var button = document.getElementById("play")

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
