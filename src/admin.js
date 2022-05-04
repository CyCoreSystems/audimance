import {PerformanceTime} from './performanceTime.js';

let performanceTime = new PerformanceTime()

export function TriggerCue(id) {
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

export function BindCueStatus(lastCueId, sinceLastCueId) {
   setInterval(function() {
      let cue = performanceTime.latestCue()
      if (cue !== undefined) {
         document.getElementById(lastCueId).innerHTML = cue.cue

         document.getElementById(sinceLastCueId).innerHTML = formatMinuteSeconds(performanceTime.sinceCue(cue.cue))
      }

   }, 1000)
}
