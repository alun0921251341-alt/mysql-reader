// content.js - Content Script for Shopee pages (完全修復版)
// 這個腳本會在所有 Shopee 頁面中執行

console.log('🛒 Shopee 頁面 Content Script 載入');

// 監聽來自 background script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clickChatButton') {
        console.log('📨 收到點擊聊聊按鈕的請求');
        findAndClickChatButton();
        sendResponse({success: true});
    }
});

// 尋找並點擊聊聊按鈕 - 主入口函數
function findAndClickChatButton() {
    console.log('🔍 開始尋找聊聊按鈕...');
    
    // 等待頁面穩定並多次嘗試
    setTimeout(function() {
        tryFindAndClick();
    }, 3000);
}

// 嘗試尋找並點擊 - 使用 Promise 和 .then() 替代 async/await
function tryFindAndClick() {
    let attempts = 0;
    const maxAttempts = 5;
    
    function attemptClick() {
        attempts++;
        console.log(`🔍 第 ${attempts} 次嘗試尋找聊聊按鈕...`);
        
        const chatButton = findChatButton();
        
        if (chatButton) {
            console.log('🎯 找到聊聊按鈕:', chatButton);
            
            // 使用 Promise 鏈替代 await
            clickElement(chatButton)
                .then(function(success) {
                    if (success) {
                        console.log('✅ 成功點擊聊聊按鈕！');
                        return;
                    } else if (attempts < maxAttempts) {
                        console.log('⚠️ 點擊未成功，等待後重試...');
                        setTimeout(attemptClick, 2000);
                    } else {
                        console.log('❌ 經過多次嘗試仍未成功');
                        debugButtons();
                    }
                })
                .catch(function(error) {
                    console.log('❌ 點擊過程中發生錯誤:', error);
                    if (attempts < maxAttempts) {
                        setTimeout(attemptClick, 2000);
                    }
                });
        } else {
            if (attempts < maxAttempts) {
                console.log('⏳ 等待 2 秒後重試...');
                setTimeout(attemptClick, 2000);
            } else {
                console.log('❌ 經過多次嘗試仍未找到聊聊按鈕');
                debugButtons();
            }
        }
    }
    
    attemptClick();
}

// 尋找聊聊按鈕 - 基於實際發現的結構優化
function findChatButton() {
    console.log('🔍 開始尋找聊聊按鈕 (基於實際結構)...');
    
    // 方法1: 基於實際發現的商店區域結構 - 重點檢查第14個區域
    console.log('🔍 方法1: 搜尋商店區域中的聊聊按鈕...');
    
    const sellerSelectors = [
        '[class*="seller-overview"]',
        '[class*="section-seller"]',
        '[class*="shop-overview"]',
        '[class*="store-overview"]',
        '[elementtiming*="shopee"]'
    ];
    
    const foundSections = [];
    
    // 收集所有商店區域
    sellerSelectors.forEach(function(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(function(element) {
            foundSections.push(element);
        });
    });
    
    console.log(`找到 ${foundSections.length} 個商店相關區域`);
    
    // 重點檢查第14個區域（基於用戶發現的 S14-1）
    if (foundSections.length >= 14) {
        console.log('🎯 重點檢查第14個商店區域...');
        const section14 = foundSections[13]; // 索引從0開始，所以第14個是索引13
        
        const clickablesInSection14 = section14.querySelectorAll('button, a, [role="button"], [onclick]');
        console.log(`第14個區域內有 ${clickablesInSection14.length} 個可點擊元素`);
        
        if (clickablesInSection14.length >= 1) {
            const targetElement = clickablesInSection14[0]; // 第1個元素
            const text = (targetElement.textContent || '').trim();
            
            console.log('🎯 找到目標元素 S14-1:', {
                element: targetElement,
                text: text,
                tagName: targetElement.tagName,
                className: targetElement.className,
                href: targetElement.href
            });
            
            // 驗證是否為聊聊按鈕
            if (text === '聊聊' || text.includes('聊')) {
                console.log('✅ 確認：這是聊聊按鈕');
                return targetElement;
            } else {
                console.log(`⚠️ 警告：元素文字是 "${text}"，可能不是聊聊按鈕，但仍返回此元素`);
                return targetElement;
            }
        }
    }
    
    // 方法2: 如果第14個區域方法失敗，使用廣泛搜尋
    console.log('🔍 方法2: 在所有商店區域中搜尋聊聊按鈕...');
    
    const allClickableElements = [];
    foundSections.forEach(function(section, sectionIndex) {
        const clickables = section.querySelectorAll('button, a, [role="button"], [onclick]');
        clickables.forEach(function(clickable, elementIndex) {
            const text = (clickable.textContent || '').trim();
            
            allClickableElements.push({
                element: clickable,
                sectionIndex: sectionIndex,
                elementIndex: elementIndex,
                text: text,
                score: calculateButtonScore(clickable, text, clickable.getBoundingClientRect())
            });
        });
    });
    
    // 尋找包含聊天關鍵字的元素
    const chatElements = allClickableElements.filter(function(item) {
        const text = item.text.toLowerCase();
        return text.includes('聊') || text.includes('chat') || text.includes('聯絡') || text.includes('客服');
    });
    
    if (chatElements.length > 0) {
        // 按評分排序
        chatElements.sort(function(a, b) {
            return b.score - a.score;
        });
        
        console.log(`找到 ${chatElements.length} 個聊天相關元素:`);
        chatElements.forEach(function(item, index) {
            console.log(`${index + 1}. 區域${item.sectionIndex + 1}-${item.elementIndex + 1}: "${item.text}" (評分: ${item.score})`);
        });
        
        return chatElements[0].element; // 返回評分最高的
    }
    
    // 方法3: 使用原始的 XPath 方法作為備用
    console.log('🔍 方法3: 使用原始 XPath 方法...');
    try {
        const exactPath = '/html/body/div[1]/div/div[2]/div/div/div/div/div/div[2]/div/div[1]/div/div[1]/div[3]/div[2]/a[2]/button';
        const xpathResult = document.evaluate(exactPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        
        if (xpathResult.singleNodeValue) {
            const button = xpathResult.singleNodeValue;
            const text = (button.textContent || button.innerText || '').trim();
            
            console.log('✅ 原始 XPath 找到按鈕:', button);
            console.log('- 按鈕文字:', `"${text}"`);
            
            if (text === '聊聊' || text.includes('聊')) {
                return button;
            }
        }
    } catch (e) {
        console.log('❌ 原始 XPath 方法失敗:', e);
    }
    
    // 方法4: 如果所有方法都失敗，返回所有可點擊元素中評分最高的
    if (allClickableElements.length > 0) {
        allClickableElements.sort(function(a, b) {
            return b.score - a.score;
        });
        const best = allClickableElements[0];
        
        console.log('🎯 返回評分最高的可點擊元素:', {
            element: best.element,
            text: best.text,
            sectionIndex: best.sectionIndex + 1,
            elementIndex: best.elementIndex + 1,
            score: best.score
        });
        
        return best.element;
    }
    
    console.log('❌ 所有方法都未找到合適的聊聊按鈕');
    return null;
}

// 計算按鈕評分
function calculateButtonScore(button, text, rect) {
    let score = 0;
    
    // 文字匹配評分
    if (text === '聊聊') score += 100;
    else if (text.includes('聊聊')) score += 80;
    else if (text.includes('聊')) score += 60;
    
    // Shopee class 評分
    if (button.className.includes('shopee')) score += 50;
    if (button.className.includes('button')) score += 30;
    if (button.className.includes('outline')) score += 20;
    
    // SVG 圖標評分
    if (button.querySelector('svg')) score += 25;
    if (button.querySelector('.shopee-svg-icon')) score += 35;
    
    // 位置評分 (頁面上半部優先)
    if (rect.top < window.innerHeight / 2) score += 20;
    
    // 大小評分 (合理的按鈕大小)
    if (rect.width > 40 && rect.width < 200) score += 15;
    if (rect.height > 25 && rect.height < 80) score += 15;
    
    // 可見性評分
    if (isElementVisible(button)) score += 30;
    
    return score;
}

// 檢查元素是否可見
function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

// 點擊元素 - 返回 Promise 而不是使用 async/await
function clickElement(element) {
    return new Promise(function(resolve) {
        try {
            // 詳細記錄要點擊的元素資訊
            console.log('🎯 準備點擊的元素詳細資訊:');
            console.log('- 元素:', element);
            console.log('- 標籤:', element.tagName);
            console.log('- 文字內容:', `"${(element.textContent || '').trim()}"`);
            console.log('- className:', element.className);
            console.log('- 父元素:', element.parentElement);
            console.log('- 父元素標籤:', element.parentElement?.tagName);
            console.log('- 父元素 href:', element.parentElement?.href);
            
            // 確保元素在視窗內
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
            });
            
            // 等待滾動完成
            setTimeout(function() {
                // 獲取元素位置資訊
                const rect = element.getBoundingClientRect();
                console.log(`📍 元素位置: x=${Math.round(rect.left)}, y=${Math.round(rect.top)}, 寬=${Math.round(rect.width)}, 高=${Math.round(rect.height)}`);
                
                // 記錄點擊前的狀態
                const beforeUrl = window.location.href;
                console.log('🔍 點擊前 URL:', beforeUrl);
                
                // 嘗試多種點擊方式
                const clickMethods = [
                    { 
                        name: '直接點擊按鈕', 
                        func: function() {
                            console.log('🖱️ 執行按鈕直接點擊');
                            element.click();
                        }
                    },
                    { 
                        name: '點擊父元素 (a)', 
                        func: function() {
                            console.log('🖱️ 執行父元素 (a) 點擊');
                            if (element.parentElement?.tagName === 'A') {
                                element.parentElement.click();
                            } else {
                                throw new Error('父元素不是 A 標籤');
                            }
                        }
                    },
                    { 
                        name: '滑鼠事件點擊', 
                        func: function() {
                            console.log('🖱️ 執行滑鼠事件點擊');
                            const event = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                detail: 1
                            });
                            element.dispatchEvent(event);
                        }
                    },
                    { 
                        name: '導航到 href', 
                        func: function() {
                            console.log('🖱️ 執行 href 導航');
                            const parentLink = element.parentElement;
                            if (parentLink?.tagName === 'A' && parentLink.href) {
                                console.log('🔗 導航到:', parentLink.href);
                                window.location.href = parentLink.href;
                            } else {
                                throw new Error('沒有可用的 href');
                            }
                        }
                    }
                ];
                
                let methodIndex = 0;
                
                function tryNextMethod() {
                    if (methodIndex >= clickMethods.length) {
                        console.log('❌ 所有點擊方法都已嘗試，但似乎沒有預期效果');
                        resolve(false);
                        return;
                    }
                    
                    const method = clickMethods[methodIndex];
                    
                    try {
                        console.log(`🔄 嘗試: ${method.name}`);
                        
                        method.func();
                        
                        // 等待頁面響應
                        setTimeout(function() {
                            const afterUrl = window.location.href;
                            console.log('🔍 點擊後 URL:', afterUrl);
                            
                            // 檢查是否成功（URL 改變或出現聊天相關元素）
                            const hasUrlChange = afterUrl !== beforeUrl;
                            const hasChatElements = document.querySelectorAll('[class*="chat"], [class*="message"]').length > 0;
                            
                            if (hasUrlChange || hasChatElements) {
                                console.log(`✅ ${method.name} 成功！`);
                                console.log(`- URL 變化: ${hasUrlChange}`);
                                console.log(`- 出現聊天元素: ${hasChatElements}`);
                                resolve(true);
                            } else {
                                console.log(`⚠️ ${method.name} 執行了但沒有明顯變化，嘗試下一種方法`);
                                methodIndex++;
                                setTimeout(tryNextMethod, 1000);
                            }
                        }, 2000);
                        
                    } catch (e) {
                        console.log(`❌ ${method.name} 失敗:`, e);
                        methodIndex++;
                        setTimeout(tryNextMethod, 1000);
                    }
                }
                
                tryNextMethod();
                
            }, 1000);
            
        } catch (error) {
            console.log('❌ 點擊過程發生錯誤:', error);
            resolve(false);
        }
    });
}

// 調試功能：列出所有相關按鈕
function debugButtons() {
    console.log('🔍 調試：分析頁面按鈕結構...');
    
    // 特別分析商店區域結構
    const sellerSelectors = [
        '[class*="seller-overview"]',
        '[class*="section-seller"]',
        '[class*="shop-overview"]',
        '[class*="store-overview"]',
        '[elementtiming*="shopee"]'
    ];
    
    const foundSections = [];
    sellerSelectors.forEach(function(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(function(element) {
            foundSections.push(element);
        });
    });
    
    console.log(`📊 找到 ${foundSections.length} 個商店區域`);
    
    if (foundSections.length >= 14) {
        const section14 = foundSections[13];
        const clickables = section14.querySelectorAll('button, a, [role="button"], [onclick]');
        
        console.log(`🎯 第14個區域內的可點擊元素 (${clickables.length} 個):`);
        clickables.forEach(function(el, index) {
            const text = (el.textContent || '').trim();
            console.log(`S14-${index + 1}: "${text}" [${el.tagName}] - ${el.className}`);
        });
    }
    
    // 檢查確切路徑
    console.log('\n🎯 檢查確切 XPath 路徑:');
    try {
        const exactPath = '/html/body/div[1]/div/div[2]/div/div/div/div/div/div[2]/div/div[1]/div/div[1]/div[3]/div[2]/a[2]/button';
        const xpathResult = document.evaluate(exactPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        
        if (xpathResult.singleNodeValue) {
            const button = xpathResult.singleNodeValue;
            console.log('✅ 確切路徑元素存在:', button);
            console.log('- 文字:', `"${(button.textContent || '').trim()}"`);
            console.log('- class:', button.className);
        } else {
            console.log('❌ 確切路徑元素不存在');
        }
    } catch (e) {
        console.log('❌ 確切路徑檢查失敗:', e);
    }
}