var agenda = {}
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
      var ws = {}
      if(window.location.protocol =="https:") {
         ws = new WebSocket("wss://"+ location.host +'/ws/performanceTime')
      } else{
         ws = new WebSocket("ws://"+ location.host +'/ws/performanceTime')
      }

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

performanceTime.on('30-sec', function() {
   window.location.href = 'https://live.kineticlight.org/room/8084a0953a687e398b34db0d4f711204'
})
performanceTime.on('Top of Act 1', function() {
   window.location.href = 'https://live.kineticlight.org/room/8084a0953a687e398b34db0d4f711204'
})
