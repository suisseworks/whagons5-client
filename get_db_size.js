async function getIndexedDBSize(dbName) {
    return new Promise((resolve, reject) => {
      let request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let db = request.result;
        let totalSize = 0;
        let tx = db.transaction(db.objectStoreNames, "readonly");
  
        let pendingStores = db.objectStoreNames.length;
        for (let storeName of db.objectStoreNames) {
          let store = tx.objectStore(storeName);
          let cursorReq = store.openCursor();
          cursorReq.onsuccess = e => {
            let cursor = e.target.result;
            if (cursor) {
              // rough size estimate (string length)
              totalSize += JSON.stringify(cursor.value).length;
              cursor.continue();
            } else {
              if (--pendingStores === 0) {
                resolve(totalSize);
              }
            }
          };
        }
      };
    });
  }
  
  getIndexedDBSize("FzqzyrGA8RgC3TLvP9XjmEnbPCo2").then(size => {
    console.log("Estimated size:", (size / 1024).toFixed(2), "KB");
  });
  
  