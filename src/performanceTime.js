//var EventEmitter = import("./eventemitter3.js");
//import * as EventEmitter from './eventemitter3.js'
//const EventEmitter = await import('./eventemitter3.js');

export {PerformanceTime as PerformanceTime};

class PerformanceTime extends EventTarget {

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

   // latestCuedTrack returns the latest track which has been queued for the
   // given source.  Tracks from cues which have not yet been triggered will be
   // discarded.
   // NOTE: administrators should be able to go back in time, so while the a later track
   // may have been cued _earlier_, we should return the wall-clock-time-latest-cued track.
   latestCuedTrack(src) {
      if(!src || !src.tracks || src.tracks.length < 1) {
         return undefined
      }

      var that = this

      var latestCuedTrack = null
      src.tracks.forEach(function(track) {
         if(that.sinceCue(track.cue) >= 0) {
            // if this track is _also_ more recently-cued that our existing latestCuedTrack,
            // update our latestCuedTrack to this one.
            // This is necessary so that administrators can go back in time in the case of error.
            if (latestCuedTrack == null ||
                that.sinceCue(latestCuedTrack.cue) > that.sinceCue(track.cue) ) {
               latestCuedTrack = track
            }
         }
      })
      return latestCuedTrack
   }

   // sinceLatestTrackCue returns the time since the latest playing track's cue
   sinceLatestTrackCue(src) {
      var t = this.latestCuedTrack(src)
      if(!t || !t.cue) {
         return 0
      }

      return this.sinceCue(t.cue)
   }

   // latestCue returns the most recently-received cue.  If no cue has been received, it will return undefined.
   latestCue() {
      let latest = undefined;

      this.cues.forEach(function(c) {
         if (latest == undefined || c.at > latest.at) {
            latest = c
         }
      })

      return latest;
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

      return ret / 1000.0
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
            self.dispatchEvent(new Event(cues[cues.length-1].cue))
            self.dispatchEvent(new Event('cueChange'))

            //self.ee.emit(cues[cues.length-1].cue)
            //self.ee.emit('cueChange')
            console.log("received cue: "+ cues[cues.length-1].cue)
         } else {
            //self.ee.emit("timeSync")
            self.dispatchEvent(new Event('timeSync'))
         }
      })
   }
}


