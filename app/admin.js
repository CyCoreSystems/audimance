function triggerCue(id) {
   fetch('/cues/'+id, {
      method: 'PUT'
   })
}

