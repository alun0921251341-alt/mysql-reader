// background.js - Chrome 插件背景服務

// 插件安裝時初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('MySQL Reader 插件已安裝');
    
    // 設定預設 API URL
    chrome.storage.sync.set({
        apiUrl: 'http://localhost:5000/api'
    });
});

// 監聽來自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autoClickChat') {
        // 處理自動點擊聊聊按鈕的請求
        autoClickChatButton(request.tabId);
        sendResponse({success: true});
    }
});

// 自動點擊聊聊按鈕
async function autoClickChatButton(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: clickChatButtonOnPage
        });
        console.log('✅ 已執行自動點擊腳本');
    } catch (error) {
        console.log('❌ 自動點擊聊聊按鈕失敗:', error);
    }
}

// 在頁面中執行的點擊函數
function clickChatButtonOnPage() {
    console.log('🔍 開始尋找聊聊按鈕...');
    
    // 等待頁面完全載入
    const waitForPageLoad = async (maxWait = 15000) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            // 檢查頁面是否載入完成
            if (document.readyState === 'complete') {
                // 再等待一點時間讓動態內容載入
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return false;
    };
    
    // 尋找聊聊按鈕的函數 - 更精確的版本
    const findChatButton = () => {
        console.log('🔍 正在搜尋聊聊按鈕...');
        
        // 首先嘗試找到商店資訊區域的聊聊按鈕
        // 根據截圖，聊聊按鈕通常在商店頭像和名稱附近
        
        // 方法1: 尋找確切包含"聊聊"文字的按鈕
        const allButtons = document.querySelectorAll('button, a, [role="button"], div[class*="button"]');
        
        for (let button of allButtons) {
            const buttonText = button.textContent?.trim() || '';
            const innerText = button.innerText?.trim() || '';
            
            // 確切匹配"聊聊"文字
            if (buttonText === '聊聊' || innerText === '聊聊') {
                const rect = button.getBoundingClientRect();
                if (rect.width > 20 && rect.height > 20) { // 確保按鈕有合理大小
                    console.log('🎯 找到聊聊按鈕 (精確匹配):', button);
                    return button;
                }
            }
        }
        
        // 方法2: 在商店資訊區域內尋找
        // 通常商店資訊會有特定的 class 或結構
        const shopInfoSelectors = [
            '[class*="shop"]',
            '[class*="seller"]', 
            '[class*="store"]',
            '[data-testid*="shop"]'
        ];
        
        for (let selector of shopInfoSelectors) {
            const shopArea = document.querySelector(selector);
            if (shopArea) {
                const chatButton = shopArea.querySelector('button, a, [role="button"]');
                if (chatButton) {
                    const text = chatButton.textContent?.trim() || '';
                    if (text.includes('聊聊') || text.includes('Chat')) {
                        console.log('🎯 在商店區域找到聊聊按鈕:', chatButton);
                        return chatButton;
                    }
                }
            }
        }
        
        // 方法3: 使用 XPath 精確搜尋包含"聊聊"的元素
        try {
            const xpath = "//button[text()='聊聊'] | //a[text()='聊聊'] | //*[@role='button'][text()='聊聊']";
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                console.log('🎯 XPath 找到聊聊按鈕:', result.singleNodeValue);
                return result.singleNodeValue;
            }
        } catch (e) {
            console.log('XPath 搜尋失敗:', e);
        }
        
        // 方法4: 尋找包含聊聊圖標的按鈕 (有些網站使用圖標)
        const iconButtons = document.querySelectorAll('[class*="chat"], [class*="message"], [aria-label*="聊"], [title*="聊"]');
        for (let button of iconButtons) {
            const rect = button.getBoundingClientRect();
            if (rect.width > 20 && rect.height > 20) {
                console.log('🎯 找到聊天圖標按鈕:', button);
                return button;
            }
        }
        
        console.log('❌ 未找到聊聊按鈕');
        return null;
    };
    
    // 點擊按鈕的函數 - 改進版
    const clickButton = async (button) => {
        try {
            console.log('🎯 準備點擊按鈕:', button);
            
            // 確保按鈕可見
            button.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
            });
            
            // 等待滾動完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 獲取按鈕的中心位置
            const rect = button.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            console.log(`按鈕位置: ${centerX}, ${centerY}, 大小: ${rect.width}x${rect.height}`);
            
            // 移除任何可能的遮罩或覆蓋層
            const overlays = document.querySelectorAll('[class*="overlay"], [class*="mask"], [class*="modal"]');
            overlays.forEach(overlay => {
                const overlayRect = overlay.getBoundingClientRect();
                if (overlayRect.width > 0 && overlayRect.height > 0) {
                    overlay.style.display = 'none';
                }
            });
            
            // 嘗試多種點擊方式
            let success = false;
            
            // 方式1: 標準點擊
            try {
                button.focus(); // 先聚焦
                await new Promise(resolve => setTimeout(resolve, 100));
                button.click();
                console.log('✅ 標準點擊成功');
                success = true;
            } catch (e) {
                console.log('標準點擊失敗:', e);
            }
            
            // 方式2: 滑鼠事件序列
            if (!success) {
                try {
                    const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
                    for (let eventType of events) {
                        const event = new MouseEvent(eventType, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            detail: 1,
                            screenX: centerX,
                            screenY: centerY,
                            clientX: centerX,
                            clientY: centerY,
                            button: 0,
                            buttons: 1
                        });
                        button.dispatchEvent(event);
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    console.log('✅ 滑鼠事件序列完成');
                    success = true;
                } catch (e) {
                    console.log('滑鼠事件序列失敗:', e);
                }
            }
            
            // 方式3: 觸發 URL 導航 (如果是連結)
            if (!success && button.tagName === 'A' && button.href) {
                try {
                    window.location.href = button.href;
                    console.log('✅ 連結導航成功');
                    success = true;
                } catch (e) {
                    console.log('連結導航失敗:', e);
                }
            }
            
            return success;
            
        } catch (error) {
            console.log('❌ 點擊過程中發生錯誤:', error);
            return false;
        }
    };
    
    // 主要執行邏輯
    const executeAutoClick = async () => {
        try {
            console.log('⏳ 等待頁面載入完成...');
            await waitForPageLoad();
            
            console.log('🔍 頁面載入完成，開始尋找聊聊按鈕...');
            
            // 嘗試多次尋找，因為有些元素可能是動態載入的
            let chatButton = null;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!chatButton && attempts < maxAttempts) {
                chatButton = findChatButton();
                if (!chatButton) {
                    console.log(`第 ${attempts + 1} 次嘗試未找到按鈕，等待後重試...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                attempts++;
            }
            
            if (chatButton) {
                console.log('🎯 找到聊聊按鈕，準備點擊...');
                const success = await clickButton(chatButton);
                
                if (success) {
                    console.log('✅ 成功點擊聊聊按鈕！');
                } else {
                    console.log('❌ 點擊失敗');
                }
            } else {
                console.log('❌ 經過多次嘗試仍未找到聊聊按鈕');
                
                // 輸出調試資訊
                console.log('🔍 調試資訊：頁面上所有可能的按鈕');
                const allButtons = document.querySelectorAll('button, a, [role="button"]');
                allButtons.forEach((btn, index) => {
                    const text = (btn.textContent || '').trim();
                    const rect = btn.getBoundingClientRect();
                    if (text && rect.width > 0 && rect.height > 0) {
                        console.log(`按鈕 ${index}: "${text}" - ${btn.tagName} - ${btn.className}`);
                    }
                });
            }
            
        } catch (error) {
            console.log('❌ 自動點擊過程中發生錯誤:', error);
        }
    };
    
    // 立即執行或等待 DOM 載入
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', executeAutoClick);
    } else {
        executeAutoClick();
    }
}