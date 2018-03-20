var agenda = {}
var roomName = ''
var room = {}
var tracks = {}

var cueChange = new Event('cueChange')
var timeSync = new Event('timeSync')

// performanceTime tracks the server-side time coordinates
// as they are eminated from the server.
var performanceTime = new WebSocket("ws://"+ location.host +'/ws/performanceTime')

// cues stores the cues which have been announced by the servers, along with
// the times of their occurrence.  This will always appear in order of receipt,
// so the last cue will always be the last cue to have been received.
//
// cues are stored in the structure:
// {
//   cue: "intro",      // name of cue
//   at: 1519211809934  // time at which the cue was received
// }
performanceTime.cues = []

// sinceCue returns the number of milliseconds since the named cue.  If the cue
// has not yet occurred, it returns a negative value.
performanceTime.sinceCue = function(cueName) {
   let now = Date.now()

   var ret = -1

   performanceTime.cues.forEach(function(c) {
      if (c.cue == cueName) {
         ret = now - c.at
      }
   })

   return ret
}

performanceTime.addEventListener('open', function(ev) {
   console.log("connected to performance time")
})

performanceTime.addEventListener('close', function(ev) {
   console.log("performance time closed")
})

performanceTime.addEventListener('error', function(err) {
   console.log("error receiving performance time: "+ err)
})

performanceTime.addEventListener('message', function(ev) {
   var newCue = ''

   console.log("received performanceTime message from server")
   
   // Milliseconds since UNIX epoch
   let now = Date.now()

   let t = JSON.parse(ev.data)

   if (t === undefined) {
      return
   }

   if (performanceTime.cue != t.cue) {
      newCue = t.cue
   }

   var cues = []
   t.time_points && t.time_points.forEach(function(tp) {

      cues.push({
         cue: tp.cue,
         at: now - (tp.offset * 1000)
      })

   })
   if (cues.length > 0) {
      performanceTime.cues = cues
   }

   if (t.cause == "cue") {
      performanceTime.dispatchEvent(cueChange)

      console.log("received cue: "+ cues[cues.length-1].cue)
   } else {
      performanceTime.dispatchEvent(timeSync)
   }
})

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
   var since = performanceTime.sinceCue(this.audimanceCue)
   if( since >= 0 ) {
      console.log("seeking and playing "+ this.audimanceID +" to "+ since/1000)
      debugToHTML("seeking and playing "+ this.audimanceID +" to "+ since/1000)
      this.seek(since/1000.0)
      this.play()
   } else {
      console.log("cue "+ this.audimanceCue +" has not yet occurred")
      debugToHTML("cue "+ this.audimanceCue +" has not yet occurred")
   }
}

// createEnvironment sets up a new audio context and
// binds a new Resonance Audio Scene and Room to it
function createEnvironment() {
   var ctx = new AudioContext()

   var scene = new ResonanceAudio(ctx)

   scene.output.connect(ctx.destination)

   scene.setRoomProperties(
      {
         // Room dimensions
         width: 100.0,
         height: 100.0,
         depth: 100.0
      },
      {
         // Wall materials
         left: 'transparent',
         right: 'transparent',
         front: 'transparent',
         back: 'transparent',
         down: 'transparent',
         up: 'transparent'
      }
   )

   return {
      context: ctx,
      scene: scene
   }
}

// createSource creates a Resonance Audio source from the
// given audio element ID at the given spatial location in the room
function createSource(env, id, loc) {
   console.log("creating source of id: "+id)

   let el = document.getElementById(id)

   let elSource = env.context.createMediaElementSource(el)

   let resonanceSource = env.scene.createSource()

   elSource.connect(resonanceSource.input)

   resonanceSource.setPosition(loc.x, loc.y, loc.z)

   return {
      el: el,
      elSource: elSource,
      resonanceSource: resonanceSource,
   }
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

         var src = new Howl({
            html5: true, // must be set for large files
            src: ["/media/" + track.audio_file],
            pos: [s.location.x, s.location.y, s.location.z],
         })

         // store the cue to the Howl
         src.audimanceCue = track.cue

         // store the audimance ID to the Howl so that we may reverse-index it
         src.audimanceID = track.id

         // forward index the audimance ID to the Howl
         tracks[track.id] = src

         src.seekAndPlay()

         // handle the _first_ time sync to make sure we know where things lie
         // if we do not have performanceTime available before we load the
         // track
         performanceTime.addEventListener('timeSync', function cb(ev) {
           src.seekAndPlay()
           ev.currentTarget.removeEventListener(ev.type, cb)
         })

         // seek and play any time we receive a cue change
         performanceTime.addEventListener('cueChange', function() {
            src.seekAndPlay()
         })
      })

   })
   

   /* Resonance Audio method 
   // Set up resonance audio
   env = createEnvironment()

   // Add sources
   roomData.sources.forEach( function(s) {

      // TODO: figure out how and if resonance audio can handle more than one
      // track per source
      if(!s.tracks || s.tracks.length != 1) {
         return
      }

      let track = s.tracks[0]

      var src = createSource(env, track.id, s.location)

      // add the track data to the source
      src["track"] = track

      sources[s.id] = src

      // seek and play to current
      seekAndPlay(src)

      // seek and play any time we receive a cue change
      performanceTime.addEventListener('cueChange', function(ev) {
         seekAndPlay(src)
      })

   } )
   */
   
}

function seekAndPlay(src) {
   var since = performanceTime.sinceCue(src.track.cue)
   if( since >= 0 ) {
      console.log("seeking and playing "+ src.el.id +" to "+ since/1000)
      src.el.currentTime = since/1000.0
      src.el.play()
   } else {
      console.log("cue "+ src.track.cue +" has not yet occurred")
   }
}

window.onload = loadAgenda

console.log("hello")
