# Getting started

1. Build and install a binary on your application server of choice.
2. Set up a network (for production use, we suggest a dedicated network that no one is using for random internet access).
3. Load your audio files into /media (add /static/ to hold out-of-runtime content like your audio program and use /performance to hold cue media).
4. Edit agenda.yaml
5. Edit index.html to add your out-of-runtime content. Optional: edit title in live. You should not need to edit admin, rooms, or tracks.
6. /admin.html will allow you to manually fire cues.  Use this to test & develop, and for monitoring during production. 
