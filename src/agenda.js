// LoadAgenda loads the agenda data from the server, executing the provided
// callback with the agenda data as its argument.
export function LoadAgenda(cb) {
   if(!cb || typeof(cb) !== "function") {
      console.log("LoadAgenda called without a callback")
      return
   }

   // Fetches the agenda in the page's language.
   let lang = document.documentElement.lang
   fetch(lang ? '/agenda.json?lang=' + encodeURIComponent(lang) : '/agenda.json')
   .then(function(resp) {
      return resp.json();
   })
   .then(function(j) {
      cb(j)
   })
}
