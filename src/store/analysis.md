The real time system is composed of three parts.

Redux: global app state.
IndexedDB: local db for all data that redux fetches from.
RealTimeUpdater: receive updates with realtime connection and triggers updates to both redux and IndexedDB seperatly. We can alternatively, only update
indexedDB and trigger some redux invalidation thing for the specific redux store. 


Redux and IndexedDB have indentical


//how do we init db tables. On app mount I need to check each db. if it's not intialized then we fetch all data right away for that specific table.
//if initiated all we need to run is a cache check, we can make a simple one that checks for last_updated changes