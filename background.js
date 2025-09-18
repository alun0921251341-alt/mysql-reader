// background.js - Chrome 插件背景服務

// 插件安裝時初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('MySQL Reader 插件已安裝');
    
    // 設定預設 API URL
    chrome.storage.sync.set({
        apiUrl: 'http://localhost:5000/api'
    });
});