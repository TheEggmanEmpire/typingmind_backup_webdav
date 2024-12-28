// 1. Remove or comment out the import statement:
// import { createClient, WebDAVClient, FileStat } from 'webdav';

// 2. Add a function to dynamically load webdav, similar to loadJSZip:
async function loadWebDAVLibrary() {
    if (typeof createClient === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/webdav/dist/web/webdav.min.js';
      await new Promise((resolve) => {
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }
    return window.WebDAV;
  }
  
  // 3. Wherever you originally created the client, do this:
  await loadWebDAVLibrary(); 
  const client = window.webdav.createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });
  
  // The rest of the code that uses 'client' remains the same.
  

let backupIntervalRunning = false;
let wasImportSuccessful = false;
let isExportInProgress = false;
let isImportInProgress = false;
let isSnapshotInProgress = false;
const TIME_BACKUP_INTERVAL = 15; //minutes
const TIME_BACKUP_FILE_PREFIX = `T-${TIME_BACKUP_INTERVAL}`;

(async function checkDOMOrRunBackup() {
  if (document.readyState === 'complete') {
    await handleDOMReady();
  } else {
    window.addEventListener('load', handleDOMReady);
  }
})();

async function handleDOMReady() {
  window.removeEventListener('load', handleDOMReady);
  var importSuccessful = await checkAndImportBackup();
  const storedSuffix = localStorage.getItem('last-daily-backup');
  const today = new Date();
  const currentDateSuffix = `<span class="math-inline">\{today\.getFullYear\(\)\}</span>{String(
    today.getMonth() + 1
  ).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const currentTime = new Date().toLocaleString();
  const lastSync = localStorage.getItem('last-cloud-sync');
  var element = document.getElementById('last-sync-msg');

  if (lastSync && importSuccessful) {
    if (element !== null) {
      element.innerText = `Last sync done at ${currentTime}`;
      element = null;
    }
    if (!storedSuffix || currentDateSuffix > storedSuffix) {
      await handleBackupFiles();
    }
    startBackupInterval();
    setupStorageMonitoring();
  } else if (!backupIntervalRunning) {
    startBackupInterval();
    setupStorageMonitoring();
  }
}

// Create a new button
const cloudSyncBtn = document.createElement('button');
cloudSyncBtn.setAttribute('data-element-id', 'cloud-sync-button');
cloudSyncBtn.className =
  'cursor-default group flex items-center justify-center p-1 text-sm font-medium flex-col group focus:outline-0 focus:text-white text-white/70';

const cloudIconSVG = `
<svg class="w-6 h-6 flex-shrink-0" width="24px" height="24px" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M19 9.76c-.12-3.13-2.68-5.64-5.83-5.64-2.59 0-4.77 1.68-5.53 4.01-.19-.03-.39-.04-.57-.04-2.45 0-4.44 1.99-4.44 4.44 0 2.45 1.99 4.44 4.44 4.44h11.93c2.03 0 3.67-1.64 3.67-3.67 0-1.95-1.52-3.55-3.44-3.65zm-5.83-3.64c2.15 0 3.93 1.6 4.21 3.68l.12.88.88.08c1.12.11 1.99 1.05 1.99 2.19 0 1.21-.99 2.2-2.2 2.2H7.07c-1.64 0-2.97-1.33-2.97-2.97 0-1.64 1.33-2.97 2.97-2.97.36 0 .72.07 1.05.2l.8.32.33-.8c.59-1.39 1.95-2.28 3.45-2.28z" fill="currentColor"></path>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 15.33v-5.33M9.67 12.33L12 14.67l2.33-2.34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
`;

const textSpan = document.createElement('span');
textSpan.className = 'font-normal self-stretch text-center text-xs leading-4 md:leading-none';
textSpan.innerText = 'Backup';

const iconSpan = document.createElement('span');
iconSpan.className =
  'block group-hover:bg-white/30 w-[35px] h-[35px] transition-all rounded-lg flex items-center justify-center group-hover:text-white/90';
iconSpan.innerHTML = cloudIconSVG;

cloudSyncBtn.appendChild(iconSpan);
cloudSyncBtn.appendChild(textSpan);

function insertCloudSyncButton() {
  const teamsButton = document.querySelector(
    '[data-element-id="workspace-tab-teams"]'
  );

  if (teamsButton && teamsButton.parentNode) {
    teamsButton.parentNode.insertBefore(cloudSyncBtn, teamsButton.nextSibling);
    return true;
  }
  return false;
}

const observer = new MutationObserver((mutations) => {
  if (insertCloudSyncButton()) {
    observer.disconnect();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

const maxAttempts = 10;
let attempts = 0;
const interval = setInterval(() => {
  if (insertCloudSyncButton() || attempts >= maxAttempts) {
    clearInterval(interval);
  }
  attempts++;
}, 1000);

// Attach modal to new button
cloudSyncBtn.addEventListener('click', function () {
  openSyncModal();
});

// New Popup
let lastBackupTime = 0;
let backupInterval;

function openSyncModal() {
  var existingModal = document.querySelector(
    'div[data-element-id="sync-modal-dbbackup"]'
  );
  if (existingModal) {
    return;
  }
  var modalPopup = document.createElement('div');
  modalPopup.style.paddingLeft = '10px';
  modalPopup.style.paddingRight = '10px';
  modalPopup.setAttribute('data-element-id', 'sync-modal-dbbackup');
  modalPopup.className =
    'bg-opacity-75 fixed inset-0 bg-gray-800 transition-all flex items-center justify-center z-[60]';
  modalPopup.innerHTML = `
        <div class="inline-block w-full align-bottom bg-white dark:bg-zinc-950 rounded-lg px-4 pb-4 text-left shadow-xl transform transition-all sm:my-8 sm:p-6 sm:align-middle pt-4 overflow-hidden sm:max-w-lg">
            <div class="text-gray-800 dark:text-white text-left text-sm">
                <div class="flex justify-center items-center mb-4">
                    <h3 class="text-center text-xl font-bold">Backup & Sync</h3>
                    <div class="relative group ml-2">
                        <span class="cursor-pointer" id="info-icon" style="color: white">ℹ</span>
                        <div id="tooltip" style="display:none; width: 250px; margin-top: 0.5em;" class="z-1 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded-md px-2 py-1 opacity-90 transition-opacity duration-300 opacity-0 transition-opacity">
                            Fill form & Save. If you are using WebDAV - fill in WebDAV URL, Username, Password.<br/><br/> Initial backup: You will need to click on "Export to WebDAV" to create your first backup. Thereafter, automatic backups are done every 1 minute if the browser tab is active.<br/><br/> Restore backup: If WebDAV server already has an existing backup, this extension will automatically pick it and restore the data in this typingmind instance. <br/><br/> Adhoc Backup & Restore: Use the "Export to WebDAV" and "Import from WebDAV" to perform on-demand backup or restore. Note that this overwrites the main backup. <br/><br/> Snapshot: Creates an instant 'no-touch' backup that will not be overwritten. <br/><br/> Download: You can select the backup data to be download and click on Download button to download it for local storage. <br/><br/> Restore: Select the backup you want to restore and Click on Restore. The typingmind data will be restored to the selected backup data/date.
                        </div>
                    </div>
                </div>
                <div class="space-y-4">
                    <div>
        <div class="mt-6 bg-gray-100 px-3 py-3 rounded-lg border border-gray-200 dark:bg-zinc-800 dark:border-gray-600">
    <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-400">Available Backups</label>
        <button id="refresh-backups-btn" class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
        </button>
    </div>
    <div class="space-y-2">
        <div class="w-full">
            <select id="backup-files" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700">
                <option value="">Please configure WebDAV credentials first</option>
            </select>
        </div>
        <div class="flex justify-end space-x-2">
            <button id="download-backup-btn" class="z-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>
                Download
            </button>
            <button id="restore-backup-btn" class="z-1 px-3 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>
                Restore
            </button>
            <button id="delete-backup-btn" class="z-1 px-3 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>
                Delete
            </button>
        </div>
    </div>
</div>
                        <div class="my-4 bg-gray-100 px-3 py-3 rounded-lg border border-gray-200 dark:bg-zinc-800 dark:border-gray-600">
                            <div class="space-y-4">
                                <div>
                                    <label for="webdav-url" class="block text-sm font-medium text-gray-700 dark:text-gray-400">WebDAV URL</label>
                                    <input id="webdav-url" name="webdav-url" type="text" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div>
                                    <label for="webdav-username" class="block text-sm font-medium text-gray-700 dark:text-gray-400">Username</label>
                                    <input id="webdav-username" name="webdav-username" type="text" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div>
                                    <label for="webdav-password" class="block text-sm font-medium text-gray-700 dark:text-gray-400">Password</label>
                                    <input id="webdav-password" name="webdav-password" type="password" class="z-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-zinc-700" autocomplete="off" required>
                                </div>
                                <div class="flex justify-between space-x-2">
                                    <button id="save-webdav-details-btn" type="button" class="z-1 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-between space-x-2 mt-4">
                        <button
  id="export-to-webdav-btn"
  type="button"
  class="z-1 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors"
  disabled
>
  <svg
    stroke="currentColor"
    fill="currentColor"
    stroke-width="0"
    viewBox="0 0 1024 1024"
    fill-rule="evenodd"
    class="w-4 h-4 mr-2"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Corrected path data -->
    <path
      d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7
        14.3 32 32 32h360c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H184V184
        h656v320c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V144
        c0-17.7-14.3-32-32-32zm-109.13 712.869-52.2 52.2
        c-4.7 4.7-1.9 12.8 4.7 13.6l179.4 21c5.1.6 9.5-3.7 8.9-8.9l-21-179.4
        c-.8-6.6-8.9-9.4-13.6-4.7l-52.4 52.4-256.2-256.2
        c-3.1-3.1-8.2-3.1-11.3 0l-42.4 42.4
        c-3.1 3.1-3.1 8.2 0 11.3l256.1 256.3Z"
    ></path>
  </svg>
  <span>Export to WebDAV</span>
</button>

                        <button id="import-from-webdav-btn" type="button" class="z-1 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
                            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 1024 1024" fill-rule="evenodd" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                <path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h360c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H184V184h656v320c0 4.4-3.6 8 8 8h56c4.4 0 8-3.6 8-8V144c0-17.7-14.3-32-32-32ZM653.3 599.4l52.2-52.2c4.7-4.7 1.9-12.8-4.7-13.6l-179.4-21c-5.1-.6-9.5 3.7-8.9 8.9l21 179.4c.8 6.6 8.9 9.4 13.6 4.7l52.4-52.4 256.2 256.2c3.1 3.1 8.2 3.1 11.3 0l42.4-42.4c3.1-3.1 3.1-8.2 0-11.3L653.3 599.4Z" transform="matrix(1 0 0 -1 0 1024)"></path>
                            </svg><span>Import from WebDAV</span>
                        </button>
                            <button id="snapshot-btn" type="button" class="z-1 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-default transition-colors" disabled>
        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z"/>
            <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"/>
        </svg><span>Snapshot</span>
    </button></div>

                                        <div class="text-center mt-4">
                        <span id="last-sync-msg"></span>
                    </div>
                    <div id="action-msg" class="text-center"></div>
                </div>
            </div>
        </div>`;
  document.body.appendChild(modalPopup);
  loadBackupFiles();

  const webdavUrlInput = document.getElementById('webdav-url');
  const webdavUsernameInput = document.getElementById('webdav-username');
  const webdavPasswordInput = document.getElementById('webdav-password');
  const savedUrl = localStorage.getItem('webdav-url');
  const savedUsername = localStorage.getItem('webdav-username');
  const savedPassword = localStorage.getItem('webdav-password');
  const lastSync = localStorage.getItem('last-cloud-sync');

  if (savedUrl) webdavUrlInput.value = savedUrl;
  if (savedUsername) webdavUsernameInput.value = savedUsername;
  if (savedPassword) webdavPasswordInput.value = savedPassword;
  
  const currentTime = new Date().toLocaleString();
  var element = document.getElementById('last-sync-msg');
  if (lastSync) {
    if (element !== null) {
      element.innerText = `Last sync done at ${currentTime}`;
      element = null;
    }
  }

  function updateButtonState() {
    const isDisabled =
      !webdavUrlInput.value.trim() ||
      !webdavUsernameInput.value.trim() ||
      !webdavPasswordInput.value.trim();
    document.getElementById('export-to-webdav-btn').disabled = isDisabled;
    document.getElementById('import-from-webdav-btn').disabled = isDisabled;
    document.getElementById('save-webdav-details-btn').disabled = isDisabled;
    document.getElementById('snapshot-btn').disabled = isDisabled;
  }

  modalPopup.addEventListener('click', function (event) {
    if (event.target === modalPopup) {
      modalPopup.remove();
    }
  });

  webdavUrlInput.addEventListener('input', updateButtonState);
  webdavUsernameInput.addEventListener('input', updateButtonState);
  webdavPasswordInput.addEventListener('input', updateButtonState);

  updateButtonState();

  const infoIcon = document.getElementById('info-icon');
  const tooltip = document.getElementById('tooltip');

  function showTooltip() {
    tooltip.style.removeProperty('display');
    tooltip.classList.add('opacity-100');
    tooltip.classList.remove('z-1');
    tooltip.classList.add('z-10');
    tooltip.classList.remove('opacity-0');
  }

  function hideTooltip() {
    tooltip.style.display = 'none'
    tooltip.classList.add('opacity-0');
    tooltip.classList.remove('z-10');
    tooltip.classList.add('z-1');
    tooltip.classList.remove('opacity-100');
  }

  infoIcon.addEventListener('click', () => {
    const isVisible = tooltip.classList.contains('opacity-100');
    if (isVisible) {
      hideTooltip();
    } else {
      showTooltip();
    }
  });

  document
    .getElementById('backup-files')
    .addEventListener('change', updateBackupButtons);
  document
    .getElementById('download-backup-btn')
    .addEventListener('click', downloadBackupFile);
  document
    .getElementById('restore-backup-btn')
    .addEventListener('click', restoreBackupFile);
  document
    .getElementById('refresh-backups-btn')
    .addEventListener('click', loadBackupFiles);
  document
    .getElementById('delete-backup-btn')
    .addEventListener('click', deleteBackupFile);

  // Save button click handler
  document
    .getElementById('save-webdav-details-btn')
    .addEventListener('click', async function () {
      const url = webdavUrlInput.value.trim();
      const username = webdavUsernameInput.value.trim();
      const password = webdavPasswordInput.value.trim();

      try {
        let extensionURLs = JSON.parse(
            localStorage.getItem('TM_useExtensionURLs') || '[]'
          );
          if (!extensionURLs.some((url) => url.endsWith('webdav.js'))) {
            extensionURLs.push(
              'https://github.com/TheEggmanEmpire/typingmind_backup_webdav/raw/main/Typingmind%20Webdav%20Backup%20Extension.js'  // Replace with your actual hosted script URL
            );
            localStorage.setItem(
              'TM_useExtensionURLs',
              JSON.stringify(extensionURLs)
            );
          }
        await validateWebDAVCredentials(url, username, password);
        localStorage.setItem('webdav-url', url);
        localStorage.setItem('webdav-username', username);
        localStorage.setItem('webdav-password', password);
        const actionMsgElement = document.getElementById('action-msg');
        actionMsgElement.textContent = 'WebDAV details saved!';
        actionMsgElement.style.color = 'white';
        setTimeout(() => {
          actionMsgElement.textContent = '';
        }, 3000);
        updateButtonState();
        updateBackupButtons();
        await loadBackupFiles();
        var importSuccessful = await checkAndImportBackup();
        const currentTime = new Date().toLocaleString();
        const lastSync = localStorage.getItem('last-cloud-sync');
        var element = document.getElementById('last-sync-msg');
        if (lastSync && importSuccessful) {
          if (element !== null) {
            element.innerText = `Last sync done at ${currentTime}`;
            element = null;
          }
        }
        startBackupInterval();
      } catch (err) {
        const actionMsgElement = document.getElementById('action-msg');
        actionMsgElement.textContent = `Invalid WebDAV details: ${err.message}`;
        actionMsgElement.style.color = 'red';
        localStorage.setItem('webdav-url', '');
        localStorage.setItem('webdav-username', '');
        localStorage.setItem('webdav-password', '');
        clearInterval(backupInterval);
      }
    });

  // Export button click handler
  document
    .getElementById('export-to-webdav-btn')
    .addEventListener('click', async function () {
      if (isExportInProgress) return;
      const exportBtn = document.getElementById('export-to-webdav-btn');
      exportBtn.disabled = true;
      exportBtn.style.cursor = 'not-allowed';
      exportBtn.textContent = 'Export in progress';
      isExportInProgress = true;

      try {
        await backupToWebDAV();
      } finally {
        isExportInProgress = false;
        exportBtn.disabled = false;
        exportBtn.style.cursor = 'pointer';
        exportBtn.innerHTML = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 1024 1024" fill-rule="evenodd" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h360c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H184V184h656v320c0 4.4-3.6 8 8 8h56c4.4 0 8-3.6 8-8V144c0-17.7-14.3-32-32-32ZM770.87 824.869l-52.2 52.2c-4.7 4.7 13.6l179.4 21c5.1.6 9.5-3.7 8.9-8.9l-21-179.4c-.8-6.6-8.9-9.4-13.6-4.7l-52.4 52.4-256.2-256.2c-3.1-3.1-8.2-3.1-11.3 0l-42.4 42.4c-3.1 3.1-3.1 8.2 0 11.3l256.1 256.3Z"></path></svg><span>Export to WebDAV</span>';
      }
    });

  // Import button click handler
  document
    .getElementById('import-from-webdav-btn')
    .addEventListener('click', async function () {
      if (isImportInProgress) return;
      const importBtn = document.getElementById('import-from-webdav-btn');
      importBtn.disabled = true;
      importBtn.style.cursor = 'not-allowed';
      importBtn.textContent = 'Importing...';
      isImportInProgress = true;

      try {
        await importFromWebDAV();
      } finally {
        isImportInProgress = false;
        importBtn.disabled = false;
        importBtn.style.cursor = 'pointer';
        importBtn.innerHTML = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 1024 1024" fill-rule="evenodd" class="w-4 h-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h360c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H184V184h656v320c0 4.4-3.6 8 8 8h56c4.4 0 8-3.6 8-8V144c0-17.7-14.3-32-32-32ZM653.3 599.4l52.2-52.2c4.7-4.7 1.9-12.8-4.7-13.6l-179.4-21c-5.1-.6-9.5 3.7-8.9 8.9l21 179.4c.8 6.6 8.9 9.4 13.6 4.7l52.4-52.4 256.2 256.2c3.1 3.1 8.2 3.1 11.3 0l42.4-42.4c3.1-3.1 3.1-8.2 0-11.3L653.3 599.4Z"></path></svg><span>Import from WebDAV</span>';
      }
    });

  // Snapshot button click handler
  document
    .getElementById('snapshot-btn')
    .addEventListener('click', async function () {
      const snapshotBtn = document.getElementById('snapshot-btn');

      // If button is disabled, return early
      if (snapshotBtn.disabled) return;

      // Disable button and update UI
      snapshotBtn.disabled = true;
      snapshotBtn.style.cursor = 'not-allowed';
      const originalButtonContent = snapshotBtn.innerHTML;
      snapshotBtn.innerHTML = '<span>Snapshot in progress</span>';

      const webdavUrl = localStorage.getItem('webdav-url');
      const webdavUsername = localStorage.getItem('webdav-username');
      const webdavPassword = localStorage.getItem('webdav-password');
      
      const client = createClient(webdavUrl, {
        username: webdavUsername,
        password: webdavPassword,
      });

      try {
        const now = new Date();
        const timestamp =
          now.getFullYear() +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') +
          'T' +
          String(now.getHours()).padStart(2, '0') +
          String(now.getMinutes()).padStart(2, '0') +
          String(now.getSeconds()).padStart(2, '0');

        const data = await exportBackupData();
        const dataStr = JSON.stringify(data);

        // Load JSZip
        const jszip = await loadJSZip();
        const zip = new jszip();

        // Add the JSON data to the zip file
        zip.file(`Snapshot_${timestamp}.json`, dataStr, {
          compression: 'DEFLATE',
          compressionOptions: {
            level: 9,
          },
        });

        // Generate the zip content
        const compressedContent = await zip.generateAsync({ type: 'blob' });

        await client.putFileContents(`/Snapshot_${timestamp}.zip`, compressedContent, {
          overwrite: false 
        });


        // Update last sync message with snapshot status
        const lastSyncElement = document.getElementById('last-sync-msg');
        const currentTime = new Date().toLocaleString();
        lastSyncElement.textContent = `Snapshot successfully saved to the cloud at ${currentTime}`;

        // Revert back to regular sync status after 3 seconds
        setTimeout(() => {
          const lastSync = localStorage.getItem('last-cloud-sync');
          if (lastSync) {
            lastSyncElement.textContent = `Last sync done at ${lastSync}`;
          }
        }, 3000);

        // Refresh the backup files list after successful snapshot
        await loadBackupFiles();

      } catch (error) {
        const lastSyncElement = document.getElementById('last-sync-msg');
        lastSyncElement.textContent = `Error creating snapshot: ${error.message}`;

        // Revert back to regular sync status after 3 seconds
        setTimeout(() => {
          const lastSync = localStorage.getItem('last-cloud-sync');
          if (lastSync) {
            lastSyncElement.textContent = `Last sync done at ${lastSync}`;
          }
        }, 3000);
      } finally {
        // Re-enable button and restore original content
        snapshotBtn.disabled = false;
        snapshotBtn.style.cursor = 'pointer';
        snapshotBtn.innerHTML = originalButtonContent;
      }
    });
}

// Visibility change event listener
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    var importSuccessful = await checkAndImportBackup();
    const storedSuffix = localStorage.getItem('last-daily-backup');
    const today = new Date();
    const currentDateSuffix = `<span class="math-inline">\{today\.getFullYear\(\)\}</span>{String(
      today.getMonth() + 1
    ).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const currentTime = new Date().toLocaleString();
    const lastSync = localStorage.getItem('last-cloud-sync');
    var element = document.getElementById('last-sync-msg');

    if (lastSync && importSuccessful) {
      if (element !== null) {
        element.innerText = `Last sync done at ${currentTime}`;
        element = null;
      }
      if (!storedSuffix || currentDateSuffix > storedSuffix) {
        await handleBackupFiles();
      }
      if (
        !backupIntervalRunning &&
        localStorage.getItem('activeTabBackupRunning') !== 'true'
      ) {
        startBackupInterval();
      }
    }
  } else {
    localStorage.setItem('activeTabBackupRunning', 'false');
    clearInterval(backupInterval);
    backupIntervalRunning = false;
  }
});

// Time based backup creates a rolling backup every X minutes. Default is 15 minutes
// Update parameter 'TIME_BACKUP_INTERVAL' in the beginning of the code to customize this
// This is to provide a secondary backup option in case of unintended corruption of the backup file
async function handleTimeBasedBackup() {
  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');
  let lastTimeBackup = localStorage.getItem('last-time-based-no-touch-backup');
  const currentTime = new Date().getTime();

  if (!lastTimeBackup) {
    localStorage.setItem(
      'last-time-based-no-touch-backup',
      new Date().toLocaleString()
    );
    lastTimeBackup = '0';
  }

  if (
    lastTimeBackup === '0' ||
    currentTime - new Date(lastTimeBackup).getTime() >=
    TIME_BACKUP_INTERVAL * 60 * 1000
  ) {
      
    const client = createClient(webdavUrl, {
        username: webdavUsername,
        password: webdavPassword,
      });

    try {
      const data = await exportBackupData();
      const dataStr = JSON.stringify(data);
      const jszip = await loadJSZip();
      const zip = new jszip();
      zip.file(`${TIME_BACKUP_FILE_PREFIX}.json`, dataStr, {
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9,
        },
      });

      const compressedContent = await zip.generateAsync({ type: 'blob' });
      
      await client.putFileContents(`/${TIME_BACKUP_FILE_PREFIX}.zip`, compressedContent, {
          overwrite: true 
        });      

      localStorage.setItem(
        'last-time-based-no-touch-backup',
        new Date(currentTime).toLocaleString()
      );
    } catch (error) {
      console.error('Error creating time-based backup:', error);
    }
  }
}

// Function to check for backup file and import it
async function checkAndImportBackup() {
  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');

  if (webdavUrl && webdavUsername && webdavPassword) {
      
    const client = createClient(webdavUrl, {
        username: webdavUsername,
        password: webdavPassword,
      });

    try {
      const fileExists = await client.exists('/typingmind-backup.json');
      if (fileExists) {
        await importFromWebDAV();
        wasImportSuccessful = true;
        return true;
      } else {
        alert("Backup file not found on WebDAV server! Run an adhoc 'Export to WebDAV' first.");
        return false;
      }
    } catch (err) {
      localStorage.setItem('webdav-url', '');
      localStorage.setItem('webdav-username', '');
      localStorage.setItem('webdav-password', '');
      alert('Failed to connect to WebDAV. Please check your credentials.');
      return false;
    }
  }
  return false;
}

async function loadBackupFiles() {
  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');

  const select = document.getElementById('backup-files');

  if (!webdavUrl || !webdavUsername || !webdavPassword) {
    select.innerHTML =
      '<option value="">Please configure WebDAV credentials first</option>';
    updateBackupButtons();
    return;
  }

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });

  try {
    const files = await client.getDirectoryContents("/", {
        deep: false,
        glob: "*.zip" // Assuming zip files are backups, adjust if necessary
    });

    select.innerHTML = '';

    if (files.length === 0) {
      select.innerHTML = '<option value="">No backup files found</option>';
    } else {
      const sortedFiles = files.sort(
        (a, b) => b.lastmod - a.lastmod
      );

      sortedFiles.forEach((file) => {
        const option = document.createElement('option');
        option.value = file.filename;
        option.textContent = `<span class="math-inline">\{file\.basename\} \(</span>{new Date(file.lastmod).toLocaleString()})`;
        select.appendChild(option);
      });
    }

    updateBackupButtons();
  } catch (error) {
    console.error('Error loading backup files:', error);
    select.innerHTML = '<option value="">Error loading backups</option>';
    updateBackupButtons();
  }
}

function updateBackupButtons() {
  const select = document.getElementById('backup-files');
  const downloadBtn = document.getElementById('download-backup-btn');
  const restoreBtn = document.getElementById('restore-backup-btn');
  const deleteBtn = document.getElementById('delete-backup-btn');
  const refreshBtn = document.getElementById('refresh-backups-btn');

  const webdavConfigured =
    localStorage.getItem('webdav-url') &&
    localStorage.getItem('webdav-username') &&
    localStorage.getItem('webdav-password');

  // Enable/disable refresh button based on credentials
  if (refreshBtn) {
    refreshBtn.disabled = !webdavConfigured;
    refreshBtn.classList.toggle('opacity-50', !webdavConfigured);
  }

  const selectedFile = select.value;
  const isSnapshotFile = selectedFile.startsWith('/Snapshot_');

  // Enable download button if credentials exist and file is selected
  if (downloadBtn) {
    downloadBtn.disabled = !webdavConfigured || !selectedFile;
    downloadBtn.classList.toggle(
      'opacity-50',
      !webdavConfigured || !selectedFile
    );
  }

  // Enable restore button if credentials exist and valid file is selected
  if (restoreBtn) {
    restoreBtn.disabled =
      !webdavConfigured ||
      !selectedFile ||
      selectedFile === '/typingmind-backup.json';
    restoreBtn.classList.toggle(
      'opacity-50',
      !webdavConfigured || !selectedFile || selectedFile === '/typingmind-backup.json'
    );
  }

  // Enable delete button only for snapshot files
  if (deleteBtn) {
    deleteBtn.disabled = !webdavConfigured || !selectedFile || !isSnapshotFile;
    deleteBtn.classList.toggle(
      'opacity-50',
      !webdavConfigured || !selectedFile || !isSnapshotFile
    );
  }
}

async function downloadBackupFile() {
    const webdavUrl = localStorage.getItem('webdav-url');
    const webdavUsername = localStorage.getItem('webdav-username');
    const webdavPassword = localStorage.getItem('webdav-password');
    const selectedFile = document.getElementById('backup-files').value;
  
    const client = createClient(webdavUrl, {
      username: webdavUsername,
      password: webdavPassword,
    });
  
    try {
        const fileExists = await client.exists(selectedFile);
        if (!fileExists) {
          alert("Selected file not found on WebDAV server!");
          return;
        }
    
        const fileContent = await client.getFileContents(selectedFile);
    
        const blob = new Blob([fileContent]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.split('/').pop();
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading file:', error);
      }
  }

async function restoreBackupFile() {
  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');
  const selectedFile = document.getElementById('backup-files').value;

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });

  try {
    const jszip = await loadJSZip();
    const fileContent = await client.getFileContents(selectedFile);
    const zip = await jszip.loadAsync(fileContent);
    const jsonFile = Object.keys(zip.files)[0];
    const content = await zip.file(jsonFile).async('string');
    const importedData = JSON.parse(content);

    importDataToStorage(importedData);

    const currentTime = new Date().toLocaleString();
    localStorage.setItem('last-cloud-sync', currentTime);

    const element = document.getElementById('last-sync-msg');
    if (element) {
      element.innerText = `Last sync done at ${currentTime}`;
    }

    alert('Backup restored successfully!');
  } catch (error) {
    console.error('Error restoring backup:', error);
    alert('Error restoring backup: ' + error.message);
  }
}

// Function to start the backup interval
function startBackupInterval() {
  if (backupIntervalRunning) return;
  // Check if another tab is already running the backup
  if (localStorage.getItem('activeTabBackupRunning') === 'true') {
    return;
  }
  backupIntervalRunning = true;
  localStorage.setItem('activeTabBackupRunning', 'true');
  backupInterval = setInterval(async () => {
    if (wasImportSuccessful && !isExportInProgress) {
      isExportInProgress = true;
      await backupToWebDAV();
      isExportInProgress = false;
    }
  }, 60000);
}

// Function to dynamically load the JSZip library
async function loadJSZip() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.5.0/jszip.min.js';
    script.onload = () => {
      resolve(window.JSZip); // Pass JSZip to resolve
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load Dexie library
async function loadDexie() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/dexie@latest/dist/dexie.js';
    script.onload = () => resolve(window.Dexie);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Debounce function to prevent frequent backups
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Setup storage monitoring using Dexie
async function setupStorageMonitoring() {
  try {
    const Dexie = await loadDexie();

    // Create Dexie instance for existing database
    const db = new Dexie('keyval-store');
    db.version(1).stores({
      keyval: '' // Define store without schema to work with existing data
    });

    // Excluded keys that shouldn't trigger backup
    const excludedKeys = [
      'last-cloud-sync',
      'last-daily-backup',
      'last-time-based-no-touch-backup',
      'activeTabBackupRunning'
    ];

    // Debounced backup function
    const debouncedBackup = debounce(async () => {
      if (!isExportInProgress && wasImportSuccessful) {
        try {
          isExportInProgress = true;
          await backupToWebDAV();
           
          const currentTime = new Date().toLocaleString();
          const element = document.getElementById('last-sync-msg');
          if (element) {
            element.innerText = `Last sync done at ${currentTime}`;
          }
        } catch (error) {
          console.error('Backup failed:', error);
          const element = document.getElementById('last-sync-msg');
          if (element) {
            element.innerText = `Backup failed: ${error.message}`;
          }
        } finally {
          isExportInProgress = false;
        }
      }
    }, 2000); // 2 second debounce

    // Monitor IndexedDB changes using Dexie hooks
    db.keyval.hook('creating', debouncedBackup);
    db.keyval.hook('updating', debouncedBackup);
    db.keyval.hook('deleting', debouncedBackup);

    // Monitor LocalStorage using Dexie.Observable
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      if (!excludedKeys.includes(key)) {
        debouncedBackup();
      }
      originalSetItem.apply(this, arguments);
    };

    // Monitor localStorage removal
    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(key) {
      if (!excludedKeys.includes(key)) {
        debouncedBackup();
      }
      originalRemoveItem.apply(this, arguments);
    };

    // Monitor localStorage clear
    const originalClear = localStorage.clear;
    localStorage.clear = function() {
      debouncedBackup();
      originalClear.apply(this);
    };

    // Return cleanup function
    return () => {
      // Restore original localStorage methods
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
      localStorage.clear = originalClear;
       
      // Close Dexie connection
      db.close();
    };

  } catch (error) {
    console.error('Error setting up storage monitoring:', error);
    return () => {}; // Return empty cleanup function
  }
}

// Function to import data from WebDav to localStorage and IndexedDB
function importDataToStorage(data) {
  Object.keys(data.localStorage).forEach((key) => {
    localStorage.setItem(key, data.localStorage[key]);
  });

  const request = indexedDB.open('keyval-store');
  request.onsuccess = function (event) {
    const db = event.target.result;
    const transaction = db.transaction(['keyval'], 'readwrite');
    const objectStore = transaction.objectStore('keyval');
    const deleteRequest = objectStore.clear();
    deleteRequest.onsuccess = function () {
      data = data.indexedDB;
      Object.keys(data).forEach((key) => {
        objectStore.put(data[key], key);
        // Add after the objectStore.put operations
let extensionURLs = JSON.parse(
    localStorage.getItem('TM_useExtensionURLs') || '[]'
  );
  if (!extensionURLs.some((url) => url.endsWith('webdav.js'))) {
    extensionURLs.push(
      'https://github.com/TheEggmanEmpire/typingmind_backup_webdav/raw/main/Typingmind%20Webdav%20Backup%20Extension.js'  // Replace with your actual hosted script URL
    );
    localStorage.setItem(
      'TM_useExtensionURLs',
      JSON.stringify(extensionURLs)
    );
  }
      });
    };
  };
}

// Function to export data from localStorage and IndexedDB
function exportBackupData() {
  return new Promise((resolve, reject) => {
    var exportData = {
      localStorage: { ...localStorage },
      indexedDB: {},
    };
    var request = indexedDB.open('keyval-store', 1);
    request.onsuccess = function (event) {
      var db = event.target.result;
      var transaction = db.transaction(['keyval'], 'readonly');
      var store = transaction.objectStore('keyval');
      store.getAllKeys().onsuccess = function (keyEvent) {
        var keys = keyEvent.target.result;
        store.getAll().onsuccess = function (valueEvent) {
          var values = valueEvent.target.result;
          keys.forEach((key, i) => {
            exportData.indexedDB[key] = values[i];
          });
          resolve(exportData);
        };
      };
    };
    request.onerror = function (error) {
      reject(error);
    };
  });
}

// Function to handle backup to WebDAV
async function backupToWebDAV() {
  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });

  try {
    const data = await exportBackupData();
    const dataStr = JSON.stringify(data);

    await client.putFileContents('/typingmind-backup.json', dataStr, {
      overwrite: true,
    });

    await handleTimeBasedBackup();
    const currentTime = new Date().toLocaleString();
    localStorage.setItem('last-cloud-sync', currentTime);
    var element = document.getElementById('last-sync-msg');
    if (element !== null) {
      element.innerText = `Last sync done at ${currentTime}`;
    }
    startBackupInterval();

  } catch (error) {
    console.error('Backup failed:', error);
    var element = document.getElementById('last-sync-msg');
    if (element !== null) {
      element.innerText = `Backup failed: ${error.message}`;
    }
    throw error;
  }
}

// Function to handle import from WebDAV
async function importFromWebDAV() {
  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });

  try {
    const fileExists = await client.exists('/typingmind-backup.json');
    if (!fileExists) {
      alert("Backup file not found on WebDAV server!");
      return;
    }
    const data = await client.getFileContents('/typingmind-backup.json', { format: 'text' });
    const importedData = JSON.parse(data);
    importDataToStorage(importedData);
    const currentTime = new Date().toLocaleString();
    localStorage.setItem('last-cloud-sync', currentTime);
    var element = document.getElementById('last-sync-msg');
    if (element !== null) {
      element.innerText = `Last sync done at ${currentTime}`;
    }
    wasImportSuccessful = true;
  } catch (error) {
    console.error('Import failed:', error);
    alert('Import failed:'+ error.message);
  }
}

//Delete file from WebDAV
async function deleteBackupFile() {
  const selectedFile = document.getElementById('backup-files').value;

  // Check if it's a snapshot file
  if (!selectedFile.startsWith('/Snapshot_')) {
    return;
  }

  // Ask for confirmation
  const isConfirmed = confirm(`Are you sure you want to delete ${selectedFile}? This action cannot be undone.`);

  if (!isConfirmed) {
    return;
  }

  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });

  try {
    await client.deleteFile(selectedFile);

    // Refresh the backup files list
    await loadBackupFiles();

    // Show success message
    const actionMsgElement = document.getElementById('action-msg');
    if (actionMsgElement) {
      actionMsgElement.textContent = 'Backup file deleted successfully';
      actionMsgElement.style.color = 'white';
      setTimeout(() => {
        actionMsgElement.textContent = '';
      }, 3000);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    const actionMsgElement = document.getElementById('action-msg');
    if (actionMsgElement) {
      actionMsgElement.textContent = `Error deleting file: ${error.message}`;
      actionMsgElement.style.color = 'red';
    }
  }
}

// Validate the WebDAV connection
async function validateWebDAVCredentials(url, username, password) {
    const client = createClient(url, {
        username: username,
        password: password
    });

    try {
        // Try to get directory contents
        await client.getDirectoryContents('/');
        return true; 
    } catch (error) {
        console.error('WebDAV validation failed:', error);
        throw new Error('Invalid credentials or URL'); 
    }
}

// Function to create a dated backup copy, zip it, and purge old backups
async function handleBackupFiles() {

  const webdavUrl = localStorage.getItem('webdav-url');
  const webdavUsername = localStorage.getItem('webdav-username');
  const webdavPassword = localStorage.getItem('webdav-password');

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword,
  });

  const today = new Date();
  const currentDateSuffix = `<span class="math-inline">\{today\.getFullYear\(\)\}</span>{String(
    today.getMonth() + 1
  ).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  try {
      const data = await client.getDirectoryContents("/", {
        deep: false,
        glob: "*.zip" 
    });

    if (data.length > 0) {
      const lastModified = new Date(data[0].lastmod);

      if (lastModified.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0)) {
        const backupFile = await client.getFileContents('/typingmind-backup.json');
        
        const jszip = await loadJSZip();
        const zip = new jszip();
        zip.file(`typingmind-backup-${currentDateSuffix}.json`, backupFile, {
          compression: 'DEFLATE',
          compressionOptions: {
            level: 9,
          },
        });

        const compressedContent = await zip.generateAsync({ type: 'blob' });

        const zipKey = `/typingmind-backup-${currentDateSuffix}.zip`;

        await client.putFileContents(zipKey, compressedContent, {
          overwrite: false 
        });
        
        localStorage.setItem('last-daily-backup', currentDateSuffix);
      }

      // Purge backups older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      for (const file of data) {
          const fileDate = new Date(file.lastmod);
          if (fileDate < thirtyDaysAgo) {
            await client.deleteFile(file.filename);
          }
      }
    }
  } catch (error) {
    console.error('Errorhandling backup files:', error);
  }
}