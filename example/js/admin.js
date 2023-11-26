import {TriggerCue,BindCueStatus} from '/app/admin.js'

window.triggerCue = TriggerCue

window.onload = function() {
   BindCueStatus("lastCue", "sinceLastCue")
}
