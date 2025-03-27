// Gemini用のEnterとCtrl+Enterのキー操作を制御するスクリプト

// デバッグ用ログ関数
function logDebug(message) {
  console.log(`[Gemini Ctrl+Enter] ${message}`);
}

logDebug('拡張機能が読み込まれました');

// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  sites: [
    {
      url: "gemini.google.com",
      enabled: true
    }
  ]
};

// 設定を読み込む
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('geminiCtrlEnterSettings', (data) => {
      if (data.geminiCtrlEnterSettings) {
        logDebug('設定を読み込みました');
        resolve(data.geminiCtrlEnterSettings);
      } else {
        logDebug('デフォルト設定を使用します');
        chrome.storage.sync.set({ geminiCtrlEnterSettings: DEFAULT_SETTINGS });
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

// 現在のURLがリストに含まれているか確認
function isSiteEnabled(settings, currentUrl) {
  for (const site of settings.sites) {
    if (currentUrl.includes(site.url) && site.enabled) {
      logDebug(`サイト ${site.url} は有効です`);
      return true;
    }
  }
  logDebug('このサイトでは無効です');
  return false;
}

// Geminiのテキストエリアを取得する関数
function findTextArea() {
  // Geminiで使用される可能性のあるテキストエリアのセレクタ
  const selectors = [
    'textarea',
    'div[contenteditable="true"]',
    'div[role="textbox"]',
    '.ql-editor'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      // 表示されているものだけを対象にする
      if (element.offsetParent !== null) {
        logDebug(`テキストエリアを発見: ${selector}`);
        return element;
      }
    }
  }
  
  return null;
}

// 送信ボタンを見つける関数
function findSendButton() {
  // 様々な可能性のあるボタンセレクタ
  const buttonSelectors = [
    'button[aria-label="送信する"]', 
    'button[aria-label="Send"]',
    'button.send-button',
    'button[data-test-id="send-button"]',
    'button[type="submit"]'
  ];

  for (const selector of buttonSelectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) {
      logDebug(`送信ボタンを発見: ${selector}`);
      return button;
    }
  }

  // アイコンで識別できるボタンを探す
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    if (button.offsetParent === null) continue; // 非表示ボタンはスキップ
    
    // 内部にSVGやアイコン要素があるか確認
    const hasIcon = button.querySelector('svg') || button.querySelector('i');
    if (hasIcon) {
      // 送信ボタンらしき位置や属性を持つか確認
      const rect = button.getBoundingClientRect();
      // 画面の右下にボタンがあることが多い
      if (rect.bottom > window.innerHeight * 0.7 && rect.right > window.innerWidth * 0.7) {
        logDebug('送信ボタンと思われるものを発見');
        return button;
      }
    }
  }
  
  return null;
}

// キーボード操作のリスナーを設定
function setupKeyListeners() {
  logDebug('キーボードリスナーを設定');
  
  // すでに設定されているリスナーを防ぐためのフラグ
  if (window.geminiCtrlEnterListenerActive) {
    logDebug('リスナーはすでに設定済み');
    return;
  }
  
  window.geminiCtrlEnterListenerActive = true;
  
  document.addEventListener('keydown', handleKeyDown, true);
}

// キーダウンイベントハンドラ
function handleKeyDown(event) {
  // テキストエリアまたは編集可能な要素かチェック
  const isEditableTarget = event.target.tagName === 'TEXTAREA' || 
                          event.target.tagName === 'INPUT' || 
                          event.target.isContentEditable || 
                          event.target.getAttribute('role') === 'textbox';
  
  if (!isEditableTarget) return;
  
  // Enterキーが押された場合（Ctrl, Shift, Altキーなしで）
  if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
    logDebug('Enterキーが押されました');
    event.preventDefault();
    event.stopPropagation();
    
    // カーソル位置に改行を挿入
    if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') {
      const cursorPos = event.target.selectionStart;
      const text = event.target.value;
      event.target.value = text.slice(0, cursorPos) + '\n' + text.slice(cursorPos);
      event.target.selectionStart = event.target.selectionEnd = cursorPos + 1;
    } else if (event.target.isContentEditable) {
      // contentEditableの場合はdocument.execCommandを使用
      document.execCommand('insertLineBreak', false, null);
    }
    
    return false;
  }
  
  // Ctrl+Enterが押された場合、送信
  if (event.key === 'Enter' && event.ctrlKey) {
    logDebug('Ctrl+Enterが押されました');
    event.preventDefault();
    event.stopPropagation();
    
    // 送信ボタンを特定して自動クリック
    const sendButton = findSendButton();
    
    if (sendButton && !sendButton.disabled) {
      logDebug('送信ボタンをクリックします');
      sendButton.click();
    } else {
      logDebug('送信ボタンが見つからないか、無効化されています');
    }
    
    return false;
  }
}

// メインの処理
async function init() {
  logDebug('初期化を開始');
  const settings = await loadSettings();
  const currentUrl = window.location.href;
  
  if (isSiteEnabled(settings, currentUrl)) {
    setupKeyListeners();
    startObserver();
  }
}

// DOMの変更を監視（SPAに対応するため）
function startObserver() {
  logDebug('MutationObserverを開始');
  
  // 既存のオブザーバーがあれば切断
  if (window.geminiCtrlEnterObserver) {
    window.geminiCtrlEnterObserver.disconnect();
  }
  
  // 新しいオブザーバーの作成
  window.geminiCtrlEnterObserver = new MutationObserver((mutations) => {
    // テキストエリアが存在するか確認
    const textArea = findTextArea();
    if (textArea) {
      logDebug('テキストエリアを検出');
      setupKeyListeners();
    }
  });
  
  // 全体のDOM変更を監視
  window.geminiCtrlEnterObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
}

// ページ読み込み完了時またはDOMContentLoadedで初期化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  logDebug('ページはすでに読み込み完了しています');
  init();
} else {
  logDebug('DOMContentLoadedを待機します');
  document.addEventListener('DOMContentLoaded', init);
}

// 追加の保険として、loadイベントでも初期化
window.addEventListener('load', () => {
  logDebug('loadイベントが発生しました');
  init();
});

// SPAのURLの変更を検出するための処理
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    logDebug('URLが変更されました: ' + url);
    init();
  }
}).observe(document, { subtree: true, childList: true });