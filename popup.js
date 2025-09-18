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
    
    console.log('All events bound successfully');
}

// 載入設定
function loadConfig() {
    chrome.storage.sync.get(['apiUrl'], function(result) {
        const apiUrlInput = document.getElementById('apiUrl');
        if (apiUrlInput) {
            apiUrlInput.value = result.apiUrl || 'http://localhost:5000/api';
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
        shopid: user.shopid || null,
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
        item.innerHTML = `
            <div class="userid">UserID: ${user.userid || 'N/A'}</div>
            <div>ShopID: ${user.author_shopid || 'N/A'}</div>
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