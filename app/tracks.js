var agenda = {}
var roomName = ''
var room = {}
var tracks = {}
var performanceTime = {}
var startCue = 'Top of Act 1'
var SyncTolerance = 3.0 // sec
var WakeCheckInterval = 6000.0 // ms

function urlFor(t) {
   return '/media/'+ t.audioFiles[1]
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

      var input = document.getElementById(s.id)

      var el = document.getElementById('audio-'+s.id)

      function resync() {
         var track = performanceTime.latestCuedTrack(s)
         if(!track) {
            console.log("no latest cued track")
            return
         }

         var now = performanceTime.sinceCue(track.cue)
         if(now < 0) {
            console.log("no latest cue")
            return
         }

         var diff = Math.abs(now - el.currentTime)

         if(diff > SyncTolerance || el.currentTime == 0) {
            console.log("out of sync; reseeking.  Diff: " + diff)
            el.volume = 0
            el.currentTime = now
            return
         }

         console.log("already synced:", now, el.currentTime)
      }

      // Handle wake up resync by resetting source and position
      var lastSync = Date.now()
      performanceTime.on('timeSync', function() {
         var diff = Math.abs(Date.now() - lastSync)
         lastSync = Date.now()

         if( diff < WakeCheckInterval) {
            return
         }
         
         // wake from sleep resync
         console.log("resyncing from sleep")
         
         // check the source first
         var track = performanceTime.latestCuedTrack(s)
         if(el.src != urlFor(track)) {
            console.log("cued track has changed")
            el.volume = 0
            el.src = urlFor(track)
            el.load()
            return
         }

         // resync if necessary
         resync()

         return
      })

      el.addEventListener('play', function(ev) {
         console.log("resumed")
         resync()
         return
      })

      el.addEventListener('seeked', function(ev) {
         console.log('seeked')

         var now = performanceTime.sinceLatestTrackCue(s)

         var diff = Math.abs(now - el.currentTime)

         if(diff > SyncTolerance) {
            console.log("out of sync; ignoring.  Diff: " + diff)
            return
         }

         // Last check: make sure we are still enabled
         if(input.checked) {
            el.volume = 1.0
            el.play()
         }

         return
      })

      el.addEventListener('progress', function(ev) {

         var now = performanceTime.sinceLatestTrackCue(s)
         
         // Check to see if we have the chunk we need
         for(i=0; i<el.buffered.length; i++) {
            if(el.buffered.start(i) > now) {
               // segment starts after our interesting time
               console.log("start is too late")
               continue
            }
            if(el.buffered.end(i) < now) {
               // buffer not long enough
               console.log("end is too early")
               continue
            }

            // We are far enough; play what we have
            console.log("enough data; seeking")
            el.currentTime = now

            return
         }
         console.log("not enough data; waiting")

         return
      })

      el.addEventListener('loadedmetadata', function(ev) {
         console.log("loaded metadata")
         resync()
         return
      })

      console.log("adding event listener to change: ", s.id)
      input.addEventListener('change', function(ev) {

         console.log("input change: ", input.checked)

         el.pause()

         if(input.checked) {

            var track = performanceTime.latestCuedTrack(s)
            if(track) {
               console.log("setting source")
               el.src = urlFor(track)
            } else {
               console.log("no latest-cued track")
            }

            el.volume = 0
            el.load()

         } else {
            console.log("ignoring non-set source")
         }

         return
      })

      performanceTime.on('cueChange', function cb() {

         console.log("cue change")
         el.volume = 0

         if(input.checked) {
            var track = performanceTime.latestCuedTrack(s)
            if(track) {
               console.log("setting source")
               el.src = urlFor(track)
               el.load()
            } else {
               console.log("no latest-cued track")
            }
         } else {
            console.log("ignoring unset source")
         }

         return
      })


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


   button.innerHTML = "Waiting for Performance"

   performanceTime.once('timeSync', function() {
      loadAudio()
   })

   performanceTime.on('timeSync', function cb() {
      if(performanceTime.sinceCue(startCue) < 0) {
         return
      }
      button.innerHTML = "Live"
      performanceTime.off('timeSync', cb)
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

