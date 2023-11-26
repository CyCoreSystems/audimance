import {PerformanceTime} from '/app/app.js'

window.onload = function() {
   let performanceTime = new PerformanceTime()

   // Performance redirect
   var performanceURL = 'https://my.domain.com/live'

   performanceTime.addEventListener('Speech', function() {
      window.location.href = performanceURL
   })
}
