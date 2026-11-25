// File-system handles use IndexedDB's structured cloning so folder approval can be reused.
export function folderStore(handle) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mystical-skill-editor', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('settings', handle ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('settings');
      const operation = handle ? store.put(handle, 'characters-folder') : store.get('characters-folder');
      transaction.oncomplete = () => { db.close(); resolve(operation.result || null); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

export async function ensureFolderPermission(directory) {
  const options = {mode: 'readwrite'};
  if (await directory.queryPermission(options) === 'granted') return;
  if (await directory.requestPermission(options) !== 'granted') throw Error('Allow access to the remembered Characters folder to save JSON.');
}

export async function writeCharacterFile(directory, id, text) {
  const folder = await directory.getDirectoryHandle(id.toUpperCase(), {create: true});
  const handle = await folder.getFileHandle(id + '.json', {create: true});
  const writer = await handle.createWritable();
  try {
    await writer.write(text);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
}
