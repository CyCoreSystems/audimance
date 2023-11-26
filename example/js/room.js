import {LoadAgenda,PerformanceTime,SpatialRoom,TrackRoom} from '/app/app.js'

window.onload = function() {
   LoadAgenda(function(agenda) {
      let room = new SpatialRoom({
         roomName: document.getElementById("roomName").value,
         agenda: agenda,
      })
   })
}

