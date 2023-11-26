import {PerformanceTime} from '/app/app.js'

window.onload = function() {
   let performanceTime = new PerformanceTime()

   // Performance redirect
   // This URL should be the canoncal URL to which the user should be directed when the
   // performance is about to begin.
   var performanceURL = 'https://my.domain.com/live'

   // ToPerformance here is the name of the cue on receipt of which, the browser should redirect
   // the user to the live performance page.
   performanceTime.addEventListener('ToPerformance', function() {
      window.location.href = performanceURL
   })
}
