// TypingMind WebDAV Backup Extension

// Import or dynamically load WebDAV library
async function loadWebDAVLibrary() {
    if (typeof createClient === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/webdav/dist/web/webdav.min.js';
        await new Promise((resolve) => {
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    return window.webdav;
}

// Load JSZip dynamically
async function loadJSZip() {
    if (typeof JSZip === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        await new Promise((resolve) => {
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    return window.JSZip;
}

// Backup data to WebDAV
async function backupToWebDAV() {
    const webdavUrl = localStorage.getItem('webdav-url');
    const webdavUsername = localStorage.getItem('webdav-username');
    const webdavPassword = localStorage.getItem('webdav-password');

    if (!webdavUrl || !webdavUsername || !webdavPassword) {
        console.error('WebDAV credentials are missing.');
        return;
    }

    const client = createClient(webdavUrl, {
        username: webdavUsername,
        password: webdavPassword
    });

    try {
        const data = JSON.stringify(await exportBackupData());
        await client.putFileContents('/typingmind-backup.json', data, { overwrite: true });
        console.log('Backup successful.');
    } catch (error) {
        console.error('Backup failed:', error);
    }
}

// Import data from WebDAV
async function importFromWebDAV() {
    const webdavUrl = localStorage.getItem('webdav-url');
    const webdavUsername = localStorage.getItem('webdav-username');
    const webdavPassword = localStorage.getItem('webdav-password');

    if (!webdavUrl || !webdavUsername || !webdavPassword) {
        console.error('WebDAV credentials are missing.');
        return;
    }

    const client = createClient(webdavUrl, {
        username: webdavUsername,
        password: webdavPassword
    });

    try {
        const fileExists = await client.exists('/typingmind-backup.json');
        if (!fileExists) {
            console.error('Backup file not found on WebDAV server.');
            return;
        }

        const data = await client.getFileContents('/typingmind-backup.json', { format: 'text' });
        await importDataToStorage(JSON.parse(data));
        console.log('Import successful.');
    } catch (error) {
        console.error('Import failed:', error);
    }
}

// Export data from localStorage and IndexedDB
async function exportBackupData() {
    const data = {
        localStorage: { ...localStorage },
        indexedDB: {}
    };

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(['keyval'], 'readonly');
            const store = transaction.objectStore('keyval');

            store.getAllKeys().onsuccess = function (keyEvent) {
                const keys = keyEvent.target.result;
                store.getAll().onsuccess = function (valueEvent) {
                    const values = valueEvent.target.result;
                    keys.forEach((key, index) => {
                        data.indexedDB[key] = values[index];
                    });
                    resolve(data);
                };
            };
        };

        request.onerror = function (error) {
            reject(error);
        };
    });
}

// Import data into localStorage and IndexedDB
async function importDataToStorage(data) {
    Object.keys(data.localStorage).forEach((key) => {
        localStorage.setItem(key, data.localStorage[key]);
    });

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(['keyval'], 'readwrite');
            const store = transaction.objectStore('keyval');

            store.clear().onsuccess = function () {
                Object.keys(data.indexedDB).forEach((key) => {
                    store.put(data.indexedDB[key], key);
                });
                resolve();
            };

            transaction.onerror = function (error) {
                reject(error);
            };
        };

        request.onerror = function (error) {
            reject(error);
        };
    });
}

// Setup periodic backups
function setupPeriodicBackup() {
    setInterval(async () => {
        try {
            await backupToWebDAV();
        } catch (error) {
            console.error('Periodic backup failed:', error);
        }
    }, 15 * 60 * 1000); // 15 minutes
}

// Setup UI and actions
function setupBackupUI() {
    const backupButton = document.createElement('button');
    backupButton.textContent = 'Backup Now';
    backupButton.onclick = backupToWebDAV;
    document.body.appendChild(backupButton);

    const importButton = document.createElement('button');
    importButton.textContent = 'Import Now';
    importButton.onclick = importFromWebDAV;
    document.body.appendChild(importButton);

    const snapshotButton = document.createElement('button');
    snapshotButton.textContent = 'Create Snapshot';
    snapshotButton.onclick = async () => {
        try {
            const data = JSON.stringify(await exportBackupData());
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
            const client = createClient(localStorage.getItem('webdav-url'), {
                username: localStorage.getItem('webdav-username'),
                password: localStorage.getItem('webdav-password')
            });

            await client.putFileContents(`/snapshot_${timestamp}.json`, data, { overwrite: false });
            console.log('Snapshot created successfully.');
        } catch (error) {
            console.error('Snapshot creation failed:', error);
        }
    };
    document.body.appendChild(snapshotButton);
}

// Initialize script
(async function init() {
    await loadWebDAVLibrary();
    await loadJSZip();
    setupBackupUI();
    setupPeriodicBackup();
})();
