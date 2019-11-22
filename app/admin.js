performanceTime = new PerformanceTime()

function triggerCue(id) {
   fetch('/cues/'+id, {
      method: 'PUT'
   })
}

function formatMinuteSeconds(sec) {
   let min = 0

   if (sec > 60) {
      min = Math.floor(sec/60)
   }
   sec = Math.floor(sec%60)
   return `${min}:${sec}`
}

window.onload = function() {
   setInterval(function() {
      let cue = undefined;

      cue = performanceTime.latestCue()
      if (cue !== undefined) {
         document.getElementById("lastCue").innerHTML = cue.cue

         document.getElementById("sinceLastCue").innerHTML = formatMinuteSeconds(performanceTime.sinceCue(cue.cue))
      }

   }, 1000)
}
