// LoadAgenda loads the agenda data from the server, executing the provided
// callback with the agenda data as its argument.
function LoadAgenda(cb) {
   if(!cb || typeof(cb) !== "function") {
      console.log("LoadAgenda called without a callback")
      return
   }

   fetch('/agenda.json')
   .then(function(resp) {
      return resp.json();
   })
   .then(function(j) {
      cb(j)
   })
}
