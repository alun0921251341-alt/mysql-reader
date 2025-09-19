// 調試版 popup.js - 找出問題所在
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Popup loaded - 調試版本');
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
    
    console.log('🔍 檢查按鈕元素:');
    console.log('- saveBtn:', saveBtn);
    console.log('- testBtn:', testBtn);
    console.log('- readBtn:', readBtn);
    console.log('- openShopeeBtn:', openShopeeBtn);
    console.log('- nextShopeeBtn:', nextShopeeBtn);
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveConfig);
        console.log('✅ saveBtn 事件已綁定');
    }
    if (testBtn) {
        testBtn.addEventListener('click', testConnection);
        console.log('✅ testBtn 事件已綁定');
    }
    if (readBtn) {
        readBtn.addEventListener('click', readData);
        console.log('✅ readBtn 事件已綁定');
    }
    if (statsBtn) {
        statsBtn.addEventListener('click', viewStats);
        console.log('✅ statsBtn 事件已綁定');
    }
    if (openShopeeBtn) {
        openShopeeBtn.addEventListener('click', function() {
            console.log('🛒 openShopeeBtn 被點擊了！');
            openShopeeStore();
        });
        console.log('✅ openShopeeBtn 事件已綁定');
    }
    if (nextShopeeBtn) {
        nextShopeeBtn.addEventListener('click', function() {
            console.log('⏭️ nextShopeeBtn 被點擊了！');
            openNextShopeeStore();
        });
        console.log('✅ nextShopeeBtn 事件已綁定');
    }
    
    console.log('✅ 所有事件綁定完成');
}

// 載入設定
function loadConfig() {
    chrome.storage.sync.get(['apiUrl', 'currentIndex'], function(result) {
        console.log('📂 載入的設定:', result);
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
    console.log('💾 儲存設定被調用');
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
    console.log('🔗 測試連線被調用');
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
    console.log('🛒 openShopeeStore 函數被調用');
    
    // 檢查是否有 chrome.scripting 權限
    if (!chrome.scripting) {
        console.log('❌ chrome.scripting 不可用');
        showStatus('❌ 缺少 scripting 權限', 'error');
        return;
    }
    
    console.log('✅ chrome.scripting 可用');
    
    // 重置索引為 0
    chrome.storage.sync.set({currentIndex: 0}, function() {
        console.log('📍 索引已重置為 0');
        openShopeeStoreByIndex(0);
    });
}

// 開啟下一個 Shopee 商店
function openNextShopeeStore() {
    console.log('⏭️ openNextShopeeStore 函數被調用');
    
    chrome.storage.sync.get(['currentIndex'], function(result) {
        const currentIndex = result.currentIndex || 0;
        const nextIndex = currentIndex + 1;
        console.log(`📍 當前索引: ${currentIndex}, 下一個: ${nextIndex}`);
        openShopeeStoreByIndex(nextIndex);
    });
}

// 根據索引開啟 Shopee 商店
function openShopeeStoreByIndex(index) {
    console.log(`🎯 openShopeeStoreByIndex 被調用，索引: ${index}`);
    
    chrome.storage.sync.get(['apiUrl'], function(result) {
        const apiUrl = result.apiUrl;
        console.log('📊 API URL:', apiUrl);
        
        if (!apiUrl) {
            showStatus('請先設定 API URL', 'error');
            return;
        }
        
        showStatus(`🔄 正在獲取第 ${index + 1} 筆商店資料...`, 'success');
        
        // 使用 offset 來獲取指定位置的資料
        const fetchUrl = apiUrl + `/users?limit=1&offset=${index}`;
        console.log('📡 Fetch URL:', fetchUrl);
        
        fetch(fetchUrl)
            .then(response => {
                console.log('📡 Fetch 回應狀態:', response.status);
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .then(data => {
                console.log('📊 取得的資料:', data);
                
                if (data.success && data.users && data.users.length > 0) {
                    const user = data.users[0];
                    const shopId = user.author_shopid || user.shopid;
                    console.log('🏪 商店 ID:', shopId);
                    
                    if (shopId) {
                        // 記錄讀取活動
                        logReadActivity([user], apiUrl);
                        
                        // 構建 Shopee 商店 URL
                        const shopeeUrl = `https://shopee.tw/shop/${shopId}`;
                        console.log('🔗 商店 URL:', shopeeUrl);
                        
                        // 檢查 chrome.system.display 是否可用
                        if (!chrome.system || !chrome.system.display) {
                            console.log('❌ chrome.system.display 不可用');
                            showStatus('❌ 缺少 system.display 權限', 'error');
                            return;
                        }
                        
                        console.log('✅ chrome.system.display 可用，取得螢幕資訊...');
                        
                        // 獲取螢幕尺寸並計算視窗位置
                        chrome.system.display.getInfo((displays) => {
                            console.log('🖥️ 螢幕資訊:', displays);
                            
                            const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
                            const screenWidth = primaryDisplay.bounds.width;
                            const screenHeight = primaryDisplay.bounds.height;
                            console.log(`📏 螢幕尺寸: ${screenWidth}x${screenHeight}`);
                            
                            // 計算視窗尺寸和位置
                            const windowWidth = Math.floor(screenWidth / 4);  // 寬度為螢幕的 1/4
                            const windowHeight = Math.floor(screenHeight / 2); // 高度為螢幕的 1/2
                            const windowLeft = 0;  // 靠左邊
                            const windowTop = 0;   // 靠上邊
                            
                            console.log(`🪟 視窗設定: ${windowWidth}x${windowHeight} at (${windowLeft}, ${windowTop})`);
                            
                            // 在新視窗中開啟
                            console.log('🪟 創建新視窗...');
                            chrome.windows.create({ 
                                url: shopeeUrl,
                                type: 'normal',
                                width: windowWidth,
                                height: windowHeight,
                                left: windowLeft,
                                top: windowTop,
                                focused: true
                            }, (window) => {
                                console.log('✅ 新視窗已創建:', window);
                                console.log('📑 Tab ID:', window.tabs[0].id);
                                
                                // 等待 5 秒後注入腳本（增加等待時間）
                                console.log('⏰ 等待 5 秒後注入腳本...');
                                setTimeout(() => {
                                    console.log('💉 開始注入腳本...');
                                    
                                    chrome.scripting.executeScript({
                                        target: { tabId: window.tabs[0].id },
                                        func: () => {
                                            console.log('🎯 注入的腳本開始執行');
                                            console.log('📍 當前頁面 URL:', window.location.href);
                                            console.log('📍 頁面載入狀態:', document.readyState);
                                            
                                            // 等待頁面完全載入的函數
                                            function waitForPageLoad(maxWait = 10000) {
                                                return new Promise((resolve) => {
                                                    const startTime = Date.now();
                                                    
                                                    function checkReady() {
                                                        const now = Date.now();
                                                        const timeElapsed = now - startTime;
                                                        
                                                        console.log(`⏰ 等待頁面載入... ${timeElapsed}ms`);
                                                        
                                                        if (document.readyState === 'complete' && timeElapsed > 2000) {
                                                            console.log('✅ 頁面載入完成');
                                                            resolve();
                                                        } else if (timeElapsed > maxWait) {
                                                            console.log('⏰ 等待時間達到上限，繼續執行');
                                                            resolve();
                                                        } else {
                                                            setTimeout(checkReady, 500);
                                                        }
                                                    }
                                                    
                                                    checkReady();
                                                });
                                            }
                                            
                                            // 主要執行函數
                                            async function executeMain() {
                                                // 等待頁面載入
                                                await waitForPageLoad();
                                                
                                                // 嘗試多種選擇器
                                                const selectors = [
                                                    'button.shopee-button-outline.shopee-button-outline--complement.shopee-button-outline--fill',
                                                    'button.shopee-button-outline',
                                                    'button[class*="shopee-button"]',
                                                    'button',
                                                    'a > button'
                                                ];
                                                
                                                let foundButtons = [];
                                                let usedSelector = '';
                                                
                                                console.log('🔍 嘗試不同的選擇器...');
                                                
                                                for (let selector of selectors) {
                                                    const buttons = Array.from(document.querySelectorAll(selector));
                                                    console.log(`${selector}: 找到 ${buttons.length} 個按鈕`);
                                                    
                                                    if (buttons.length > 0) {
                                                        foundButtons = buttons;
                                                        usedSelector = selector;
                                                        break;
                                                    }
                                                }
                                                
                                                if (foundButtons.length === 0) {
                                                    console.log('❌ 所有選擇器都沒找到按鈕');
                                                    
                                                    // 列出頁面上所有的按鈕
                                                    const allButtons = document.querySelectorAll('button');
                                                    console.log(`📊 頁面總共有 ${allButtons.length} 個 button 元素`);
                                                    
                                                    allButtons.forEach((btn, index) => {
                                                        if (index < 10) { // 只顯示前10個
                                                            const text = btn.textContent?.trim() || '';
                                                            console.log(`按鈕 ${index}: "${text}" - class: ${btn.className}`);
                                                        }
                                                    });
                                                    
                                                    return { ok: false, message: '找不到任何按鈕' };
                                                }
                                                
                                                console.log(`✅ 使用選擇器 "${usedSelector}" 找到 ${foundButtons.length} 個按鈕`);
                                                console.log('"聊聊" S');
                                                
                                                // 列出所有找到的按鈕
                                                foundButtons.forEach((btn, index) => {
                                                    const text = btn.textContent?.trim() || '';
                                                    console.log(`按鈕 ${index}: "${text}"`);
                                                });
                                                
                                                // 尋找包含"聊聊"的按鈕
                                                let targetButton = null;
                                                let targetIndex = -1;
                                                
                                                for (let i = 0; i < foundButtons.length; i++) {
                                                    const text = foundButtons[i].textContent?.trim() || '';
                                                    if (text === '聊聊' || text.includes('聊聊')) {
                                                        targetButton = foundButtons[i];
                                                        targetIndex = i;
                                                        console.log(`🎯 找到聊聊按鈕在索引 ${i}: "${text}"`);
                                                        break;
                                                    }
                                                }
                                                
                                                // 如果沒找到包含"聊聊"的按鈕，使用原來的邏輯（第二個按鈕）
                                                if (!targetButton && foundButtons.length >= 2) {
                                                    targetButton = foundButtons[1];
                                                    targetIndex = 1;
                                                    console.log('🔄 沒找到"聊聊"按鈕，使用第二個按鈕');
                                                }
                                                
                                                if (!targetButton) {
                                                    console.log('❌ 沒有找到目標按鈕');
                                                    return { ok: false, message: '找不到目標按鈕' };
                                                }
                                                
                                                console.log('🎯 目標按鈕:', targetButton);
                                                console.log('🎯 目標按鈕文字:', targetButton.textContent?.trim());
                                                console.log('"聊聊" E');
                                                
                                                // 高亮目標按鈕
                                                targetButton.style.border = '5px solid red';
                                                targetButton.style.backgroundColor = 'yellow';
                                                targetButton.style.zIndex = '9999';
                                                
                                                console.log('📜 滾動到按鈕位置...');
                                                try {
                                                    targetButton.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                                                } catch (_) {
                                                    targetButton.scrollIntoView({ block: 'center', inline: 'center' });
                                                }
                                                
                                                // 等待滾動完成
                                                await new Promise(resolve => setTimeout(resolve, 1000));
                                                
                                                targetButton.focus();
                                                
                                                console.log('🖱️ 執行滑鼠事件序列...');
                                                const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
                                                for (const type of events) {
                                                    const e = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                                                    targetButton.dispatchEvent(e);
                                                    console.log(`✅ 觸發 ${type}`);
                                                    await new Promise(resolve => setTimeout(resolve, 100));
                                                }
                                                
                                                console.log('🖱️ 執行 click() 方法...');
                                                if (typeof targetButton.click === 'function') {
                                                    targetButton.click();
                                                    console.log('✅ click() 已執行');
                                                }
                                                
                                                // 檢查點擊效果
                                                await new Promise(resolve => setTimeout(resolve, 2000));
                                                const newUrl = window.location.href;
                                                console.log('📍 點擊後 URL:', newUrl);
                                                
                                                // 延遲輸入邏輯
                                                console.log('⏰ 設定 5 秒後的輸入邏輯...');
                                                setTimeout(() => {
                                                    console.log('0_placeholder');
                                                    const textarea = document.querySelector('textarea[placeholder="輸入文字"]');
                                                    if (textarea) {
                                                        console.log('✅ 找到輸入框');
                                                        textarea.focus();
                                                        document.execCommand('insertText', false, 'A請問可以自取嗎?\n');
                                                        //textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                                                        console.log('1_placeholder');
                                                    } else {
                                                        console.log('❌ 未找到 placeholder 為 "輸入文字" 的 textarea 元素');
                                                    }
                                                }, 5000);
                                                
                                                return { 
                                                    ok: true, 
                                                    message: `已點擊按鈕 (索引${targetIndex})`,
                                                    buttonText: targetButton.textContent?.trim(),
                                                    selector: usedSelector
                                                };
                                            }
                                            
                                            // 執行主函數
                                            return executeMain();
                                        }
                                    }).then((results) => {
                                        console.log('💉 注入腳本執行完成');
                                        const result = results?.[0]?.result || { ok: false, message: '未知錯誤' };
                                        console.log('📋 執行結果:', result);
                                        
                                        if (result.ok) {
                                            showStatus(`✅ 成功點擊: ${result.buttonText}`, 'success');
                                        } else {
                                            showStatus(`❌ 執行失敗: ${result.message}`, 'error');
                                        }
                                    }).catch((err) => {
                                        console.log('❌ 注入腳本失敗:', err);
                                        showStatus(`❌ 注入腳本失敗: ${err.message}`, 'error');
                                    });
                                }, 5000); // 改為 5 秒
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
                        console.log('❌ 沒有找到 ShopID');
                        showStatus(`❌ 第 ${index + 1} 筆資料找不到 ShopID`, 'error');
                    }
                } else {
                    console.log('❌ API 回應無效:', data);
                    showStatus(`❌ 無法獲取資料: ${data.message || '沒有資料'}`, 'error');
                }
            })
            .catch(error => {
                console.log('❌ Fetch 失敗:', error);
                showStatus(`❌ 錯誤: ${error.message}`, 'error');
            });
    });
}

// 記錄讀取活動
function logReadActivity(users, apiUrl) {
    console.log('📝 記錄讀取活動:', users.length, '筆資料');
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
        console.error('❌ 記錄失敗:', error);
    });
}

// 顯示用戶資料
function displayUserData(users) {
    console.log('👥 顯示用戶資料:', users.length, '筆');
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

// 讀取資料
function readData() {
    console.log('📖 讀取資料被調用');
    // ... (保持原有邏輯)
}

// 查看統計
function viewStats() {
    console.log('📊 查看統計被調用');
    // ... (保持原有邏輯)
}

// 顯示統計資料
function displayStats(stats) {
    // ... (保持原有邏輯)
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