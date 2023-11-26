import {LoadAgenda,PerformanceTime,TrackRoom} from '/app/app.js'

let performanceTime = new PerformanceTime()
let button = document.getElementById('play')
let startCue = 'Speech'

window.onload = LoadAgenda( function(agenda) {
   TrackRoom(document.getElementById("roomName").value, agenda)

   button.innerHTML = "Waiting for Performance"

   performanceTime.addEventListener('timeSync', function cb() {
      if(performanceTime.sinceCue(startCue) < 0) {
         return
      }
      button.innerHTML = "Live"
      performanceTime.removeEventListener('timeSync', cb)
   })

})

