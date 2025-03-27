// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  sites: [
    {
      url: "gemini.google.com",
      enabled: true
    }
  ]
};

// DOM要素
const siteListElement = document.getElementById('siteList');
const newSiteInput = document.getElementById('newSiteUrl');
const addSiteButton = document.getElementById('addSite');
const saveButton = document.getElementById('saveSettings');
const statusMessage = document.getElementById('statusMessage');

// 現在の設定
let currentSettings = null;

// 設定を読み込む
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('geminiCtrlEnterSettings', (data) => {
      if (data.geminiCtrlEnterSettings) {
        resolve(data.geminiCtrlEnterSettings);
      } else {
        // 初期設定がなければデフォルト設定を保存して返す
        chrome.storage.sync.set({ geminiCtrlEnterSettings: DEFAULT_SETTINGS });
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

// 設定を保存する
function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ geminiCtrlEnterSettings: settings }, () => {
      resolve();
    });
  });
}

// サイトリストを表示する
function renderSiteList() {
  siteListElement.innerHTML = '';

  currentSettings.sites.forEach((site, index) => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';

    // URL表示
    const urlElement = document.createElement('div');
    urlElement.className = 'site-url';
    urlElement.textContent = site.url;
    siteItem.appendChild(urlElement);

    // 有効/無効チェックボックス
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.className = 'site-enabled';
    enabledCheckbox.checked = site.enabled;
    enabledCheckbox.addEventListener('change', () => {
      currentSettings.sites[index].enabled = enabledCheckbox.checked;
    });
    siteItem.appendChild(enabledCheckbox);

    // 削除ボタン
    const removeButton = document.createElement('button');
    removeButton.className = 'site-remove';
    removeButton.textContent = '削除';
    removeButton.addEventListener('click', () => {
      currentSettings.sites.splice(index, 1);
      renderSiteList();
    });
    siteItem.appendChild(removeButton);

    siteListElement.appendChild(siteItem);
  });
}

// 新しいサイトを追加する
function addNewSite() {
  const url = newSiteInput.value.trim();
  
  if (url) {
    // すでに存在するURLでないか確認
    const existingSite = currentSettings.sites.find(site => site.url === url);
    
    if (!existingSite) {
      currentSettings.sites.push({
        url: url,
        enabled: true
      });
      
      newSiteInput.value = '';
      renderSiteList();
    } else {
      alert('このURLはすでに登録されています');
    }
  }
}

// 設定を保存する
async function saveCurrentSettings() {
  await saveSettings(currentSettings);
  
  // 保存完了メッセージを表示
  statusMessage.style.display = 'block';
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 2000);
}

// イベントリスナーを設定
function setupEventListeners() {
  addSiteButton.addEventListener('click', addNewSite);
  
  newSiteInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      addNewSite();
    }
  });
  
  saveButton.addEventListener('click', saveCurrentSettings);
}

// 初期化
async function init() {
  currentSettings = await loadSettings();
  renderSiteList();
  setupEventListeners();
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', init);