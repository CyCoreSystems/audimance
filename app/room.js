var agenda = {}
var activeCue = ''
var cueOffset = 0.0

var cueChange = new Event('cueChange')

// performanceTime tracks the server-side time coordinates
// as they are eminated from the server.
var performanceTime = new WebSocket("ws://"+ location.host +'/ws/performanceTime')

// last holds the last performance time point received from the server
performanceTime.last = {
   cue: '',
   offset: 0.0,
   at: new Date()
}

// now returns the current performance time based on the difference from the last notification from the server
performanceTime.now = function() {
   let now = new Date()

   let diff = Match.abs(now - this.last.at)

   return {
      cue: this.last.cue,
      offset: diff,
      at: now
   }
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

   let t = JSON.parse(ev.data)

   if (performanceTime.cue != t.cue) {
      newCue = t.cue
   }

   this.last.cue = t.cue
   this.last.offset = t.offset
   this.last.at = new Date()

   if (newCue != '') {
      performanceTime.dispatchEvent(cueChange)
   }
})

// createEnvironment sets up a new audio context and
// binds a new Resonance Audio Scene and Room to it
function createEnvironment() {
   let ctx = new AudioContext()

   let scene = new ResonanceAudio(ctx)

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
function createSource(ctx, id, loc) {

   let src = ctx.createMediaElementSource(document.getElementById(id))

   src.setPosition(loc.x, loc.y, loc.z)

   return src
}

// loadAgenda loads the performance Agenda and executed
// agendaLoaded() after it is retrieved
function loadAgenda() {

   fetch('/public/agenda.json')
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

}
