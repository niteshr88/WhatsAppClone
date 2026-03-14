const DATABASE_NAME = "pulsechat-offline-media";
const DATABASE_VERSION = 1;
const STORE_NAME = "pending-media";

function openPendingMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open pending media database."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openPendingMediaDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Pending media operation failed."));
    transaction.oncomplete = () => {
      database.close();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("Pending media transaction failed."));
    };
  });
}

export function savePendingMediaBlob(clientMessageId: string, blob: Blob) {
  return withStore("readwrite", (store) => store.put(blob, clientMessageId));
}

export function getPendingMediaBlob(clientMessageId: string) {
  return withStore<Blob | undefined>("readonly", (store) => store.get(clientMessageId));
}

export function deletePendingMediaBlob(clientMessageId: string) {
  return withStore("readwrite", (store) => store.delete(clientMessageId));
}
