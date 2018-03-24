var performanceURL = 'https://live.kineticlight.org/live'

performanceTime = new PerformanceTime()

performanceTime.on('30-sec', function() {
   window.location.href = performanceURL
})
performanceTime.on('Top of Act 1', function() {
   window.location.href = performanceURL
})
performanceTime.on('INT-30 sec', function() {
   window.location.href = performanceURL
})
performanceTime.on('Top of Act 2', function() {
   window.location.href = performanceURL
})

/*
performanceTime.once('', function() {
   if( performanceTime.sinceCue('30-sec) >= 0) {
      // If performance has begun but it is before the end of the first act
      window.location.href = performanceURL
   }
})
*/
