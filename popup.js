// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('MySQL Reader popup loaded');
    loadConfig();
    bindAllEvents();
});

// 綁定所有事件
function bindAllEvents() {
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const readBtn = document.getElementById('readBtn');
    const statsBtn = document.getElementById('statsBtn');
    const openShopeeBtn = document.getElementById('openShopeeBtn');
    const nextShopeeBtn = document.getElementById('nextShopeeBtn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveConfig);
    }
    if (testBtn) {
        testBtn.addEventListener('click', testConnection);
    }
    if (readBtn) {
        readBtn.addEventListener('click', readData);
    }
    if (statsBtn) {
        statsBtn.addEventListener('click', viewStats);
    }
    if (openShopeeBtn) {
        openShopeeBtn.addEventListener('click', openShopeeStore);
    }
    if (nextShopeeBtn) {
        nextShopeeBtn.addEventListener('click', openNextShopeeStore);
    }
    
    console.log('All events bound successfully');
}

// 載入設定
function loadConfig() {
    chrome.storage.sync.get(['apiUrl', 'currentIndex'], function(result) {
        const apiUrlInput = document.getElementById('apiUrl');
        if (apiUrlInput) {
            apiUrlInput.value = result.apiUrl || 'http://localhost:5000/api';
        }
        // 如果沒有索引，初始化為 0
        if (result.currentIndex === undefined) {
            chrome.storage.sync.set({currentIndex: 0});
        }
    });
}

// 儲存設定
function saveConfig() {
    const apiUrlInput = document.getElementById('apiUrl');
    const apiUrl = apiUrlInput ? apiUrlInput.value.trim() : '';
    
    if (!apiUrl) {
        showStatus('請輸入 API URL', 'error');
        return;
    }
    
    chrome.storage.sync.set({apiUrl: apiUrl}, function() {
        showStatus('✅ 設定已儲存', 'success');
    });
}

// 測試連線
function testConnection() {
    chrome.storage.sync.get(['apiUrl'], function(result) {
        const apiUrl = result.apiUrl;
        
        if (!apiUrl) {
            showStatus('請先設定 API URL', 'error');
            return;
        }
        
        showStatus('🔄 測試連線中...', 'success');
        
        fetch(apiUrl + '/test')
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .then(data => {
                showStatus('✅ 連線測試成功', 'success');
            })
            .catch(error => {
                showStatus(`❌ 連線失敗: ${error.message}`, 'error');
            });
    });
}

// 開啟 Shopee 商店（從第一筆開始）
function openShopeeStore() {
    // 重置索引為 0
    chrome.storage.sync.set({currentIndex: 0}, function() {
        openShopeeStoreByIndex(0);
    });
}

// 開啟下一個 Shopee 商店
function openNextShopeeStore() {
    chrome.storage.sync.get(['currentIndex'], function(result) {
        const currentIndex = result.currentIndex || 0;
        const nextIndex = currentIndex + 1;
        openShopeeStoreByIndex(nextIndex);
    });
}

// 根據索引開啟 Shopee 商店
function openShopeeStoreByIndex(index) {
    chrome.storage.sync.get(['apiUrl'], function(result) {
        const apiUrl = result.apiUrl;
        
        if (!apiUrl) {
            showStatus('請先設定 API URL', 'error');
            return;
        }
        
        showStatus(`🔄 正在獲取第 ${index + 1} 筆商店資料...`, 'success');
        
        // 使用 offset 來獲取指定位置的資料
        fetch(apiUrl + `/users?limit=1&offset=${index}`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .then(data => {
                if (data.success && data.users && data.users.length > 0) {
                    const user = data.users[0];
                    const shopId = user.author_shopid || user.shopid;
                    
                    if (shopId) {
                        // 記錄讀取活動
                        logReadActivity([user], apiUrl);
                        
                        // 構建 Shopee 商店 URL
                        const shopeeUrl = `https://shopee.tw/shop/${shopId}`;
                        
                        // 獲取螢幕尺寸並計算視窗位置
                        chrome.system.display.getInfo((displays) => {
                            const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
                            const screenWidth = primaryDisplay.bounds.width;
                            const screenHeight = primaryDisplay.bounds.height;
                            
                            // 計算視窗尺寸和位置
                            const windowWidth = Math.floor(screenWidth / 4);  // 寬度為螢幕的 1/4
                            const windowHeight = Math.floor(screenHeight / 2); // 高度為螢幕的 1/2
                            const windowLeft = 0;  // 靠左邊
                            const windowTop = 0;   // 靠上邊
                            
                            // 在新視窗中開啟
                            chrome.windows.create({ 
                                url: shopeeUrl,
                                type: 'normal',
                                width: windowWidth,
                                height: windowHeight,
                                left: windowLeft,
                                top: windowTop,
                                focused: true
                            }, (window) => {
                                // 發送消息給 background script 來處理自動點擊
                                setTimeout(() => {
                                    chrome.runtime.sendMessage({
                                        action: 'autoClickChat',
                                        tabId: window.tabs[0].id
                                    });
                                }, 3000); // 等待 3 秒讓頁面載入
                            });
                        });
                        
                        // 更新當前索引
                        chrome.storage.sync.set({currentIndex: index});
                        
                        // 顯示當前位置
                        updateCurrentIndexDisplay(index + 1);
                        
                        showStatus(`✅ 已開啟第 ${index + 1} 筆商店: ${shopId}`, 'success');
                        
                        // 顯示用戶資料
                        displayUserData([user]);
                    } else {
                        showStatus(`❌ 第 ${index + 1} 筆資料找不到 ShopID`, 'error');
                        // 如果沒有 ShopID，自動嘗試下一筆
                        if (index < 1000) { // 防止無限循環
                            setTimeout(() => openShopeeStoreByIndex(index + 1), 1000);
                        }
                    }
                } else {
                    if (index === 0) {
                        showStatus(`❌ 無法獲取資料: ${data.message || '沒有資料'}`, 'error');
                    } else {
                        showStatus(`❌ 已到達資料末尾，重新從第一筆開始`, 'error');
                        // 重置到第一筆
                        setTimeout(() => openShopeeStoreByIndex(0), 1500);
                    }
                }
            })
            .catch(error => {
                showStatus(`❌ 錯誤: ${error.message}`, 'error');
            });
    });
}

// 讀取資料
function readData() {
    chrome.storage.sync.get(['apiUrl'], function(result) {
        const apiUrl = result.apiUrl;
        
        if (!apiUrl) {
            showStatus('請先設定 API URL', 'error');
            return;
        }
        
        showStatus('🔄 正在讀取用戶資料...', 'success');
        
        fetch(apiUrl + '/users')
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .then(data => {
                if (data.success) {
                    showStatus(`✅ 成功讀取 ${data.count} 筆用戶資料`, 'success');
                    
                    // 顯示用戶資料
                    displayUserData(data.users);
                    
                    // 記錄讀取時間
                    logReadActivity(data.users, apiUrl);
                } else {
                    showStatus(`❌ 讀取失敗: ${data.message}`, 'error');
                }
            })
            .catch(error => {
                showStatus(`❌ 讀取錯誤: ${error.message}`, 'error');
            });
    });
}

// 記錄讀取活動
function logReadActivity(users, apiUrl) {
    const logs = users.map(user => ({
        userid: user.userid,
        shopid: user.shopid || user.author_shopid || null,
        timestamp: new Date().toISOString()
    }));
    
    fetch(apiUrl + '/logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: logs })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('✅ 讀取時間已記錄');
        }
    })
    .catch(error => {
        console.error('記錄失敗:', error);
    });
}

// 顯示用戶資料
function displayUserData(users) {
    const dataSection = document.getElementById('dataSection');
    const dataList = document.getElementById('dataList');
    
    if (!dataSection || !dataList) return;
    
    dataList.innerHTML = '';
    
    // 只顯示前 10 筆
    users.slice(0, 3).forEach(user => {
        const item = document.createElement('div');
        item.className = 'data-item';
        const shopId = user.author_shopid || user.shopid || 'N/A';
        item.innerHTML = `
            <div class="userid">UserID: ${user.userid || 'N/A'}</div>
            <div>ShopID: ${shopId}</div>
            <div style="font-size: 11px; color: #666;">
                ${new Date().toLocaleString()}
            </div>
        `;
        dataList.appendChild(item);
    });
    
    dataSection.style.display = 'block';
}

// 查看統計
function viewStats() {
    chrome.storage.sync.get(['apiUrl'], function(result) {
        const apiUrl = result.apiUrl;
        
        if (!apiUrl) {
            showStatus('請先設定 API URL', 'error');
            return;
        }
        
        showStatus('🔄 載入統計資料...', 'success');
        
        fetch(apiUrl + '/stats')
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .then(data => {
                displayStats(data);
                showStatus('✅ 統計資料已更新', 'success');
            })
            .catch(error => {
                showStatus(`❌ 無法取得統計: ${error.message}`, 'error');
            });
    });
}

// 顯示統計資料
function displayStats(stats) {
    const totalUsersEl = document.getElementById('totalUsers');
    const totalReadsEl = document.getElementById('totalReads');
    const todayReadsEl = document.getElementById('todayReads');
    const statsSection = document.getElementById('statsSection');
    
    if (totalUsersEl) totalUsersEl.textContent = stats.total_users || 0;
    if (totalReadsEl) totalReadsEl.textContent = stats.total_reads || 0;
    if (todayReadsEl) todayReadsEl.textContent = stats.today_reads || 0;
    
    if (statsSection) {
        statsSection.style.display = 'block';
    }
}

// 顯示狀態訊息
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // 3秒後隱藏
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// 更新當前索引顯示
function updateCurrentIndexDisplay(position) {
    const currentIndexSection = document.getElementById('currentIndexSection');
    const currentIndexDisplay = document.getElementById('currentIndexDisplay');
    
    if (currentIndexDisplay) {
        currentIndexDisplay.textContent = position;
    }
    if (currentIndexSection) {
        currentIndexSection.style.display = 'block';
    }
}