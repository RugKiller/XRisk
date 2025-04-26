console.log('Background script loaded');

// 缓存相关工具函数
async function getCachedAnalysis(username) {
    try {
        const result = await chrome.storage.local.get(username);
        if (!result[username]) {
            return null;
        }
        
        const cachedData = result[username];
        const cacheTime = cachedData.timestamp;
        const now = Date.now();
        
        // 缓存有效期为10分钟
        if (now - cacheTime >  10 * 60 * 1000) {
            // 缓存过期，删除
            await chrome.storage.local.remove(username);
            return null;
        }
        
        return cachedData.data;
    } catch (error) {
        console.error('读取缓存失败:', error);
        return null;
    }
}

async function setCachedAnalysis(username, data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        await chrome.storage.local.set({ [username]: cacheData });
        console.log('缓存写入成功');
    } catch (error) {
        console.error('缓存写入失败:', error);
    }
}

// 特殊页面黑名单
const SPECIAL_PAGES = [
    'home',
    'explore',
    'notifications',
    'messages',
    'settings',
    'search',
    'compose',
    'i',
    'login',
    'signup',
    'logout',
    'about',
    'tos',
    'privacy',
    'help',
    'status',
    'download',
    'account',
    'deactivate',
    'suspended',
    'error',
    '404',
    '500'
];

// 监听扩展图标点击
chrome.action.onClicked.addListener((tab) => {
    // 打开侧边栏
    chrome.sidePanel.open({
        windowId: tab.windowId
    }).catch(err => {
        console.error('Failed to open side panel:', err);
    });
});

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startAutoAnalyze') {
        console.log('收到开始自动分析的消息');
        // 立即执行一次分析
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.url) {
                const urlObj = new URL(activeTab.url);
                const pathParts = urlObj.pathname.split('/');
                if ((urlObj.hostname.includes('x.com') || urlObj.hostname.includes('twitter.com')) &&
                    pathParts.length === 2 && pathParts[1] && !SPECIAL_PAGES.includes(pathParts[1])) {
                    const username = pathParts[1];
                    chrome.scripting.executeScript({
                        target: { tabId: activeTab.id },
                        func: analysisXUser,
                        args: [username, activeTab.id]
                    });
                }
            }
        });
    } else if (message.action === 'stopAutoAnalyze') {
        console.log('收到停止自动分析的消息');
    } else if (message.action === 'saveCache') {
        console.log('收到保存缓存请求');
        setCachedAnalysis(message.username, message.data);
    }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // 检查是否开启了自动分析
        chrome.storage.local.get('isAutoAnalyzing', async (result) => {
            if (result.isAutoAnalyzing) {
                // 检查URL是否是用户主页
                const urlObj = new URL(tab.url);
                const pathParts = urlObj.pathname.split('/');
                // 确保是x.com或twitter.com域名，且路径格式正确（不是特殊页面）
                if ((urlObj.hostname.includes('x.com') || urlObj.hostname.includes('twitter.com')) &&
                    pathParts.length === 2 && pathParts[1] && !SPECIAL_PAGES.includes(pathParts[1])) {
                    console.log('检测到用户主页，触发分析...');
                    const username = pathParts[1];

                    // 先检查缓存
                    const cachedData = await getCachedAnalysis(username);
                    if (cachedData) {
                        console.log('找到缓存数据，直接使用');
                        // 注入分析脚本，使用缓存数据
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: analysisXUser,
                            args: [username, tabId, cachedData]
                        });
                    } else {
                        console.log('无缓存数据，执行完整分析');
                        // 注入分析脚本
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: analysisXUser,
                            args: [username, tabId]
                        });
                    }
                }
            }
        });
    }
});

// 分析函数
async function analysisXUser(username, tabId, cachedData) {
    console.log('==== 开始分析用户 ====');
    console.log('用户名:', username);

    // API配置
    const API_CONFIG = {
        PUMP_TOOLS: {
            BASE_URL: 'https://pumptools.me/api/extension',
            ENDPOINTS: {
                TWITTER_TOKENS: '/get_x_tokens_history',
                TWITTER_MODIFICATIONS: '/get_x_modification_logs',
                TWITTER_INFLUENCE: '/get_x_influence'
            }
        }
    };

    // 查找目标DOM元素
    async function findTargetElement() {
        const xpath = '//*[@id="react-root"]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/div[1]/div/div[2]/div[1]/div/div/div[2]';
        let targetElement = null;
        let retryCount = 0;
        const maxRetries = 5;
        
        while (!targetElement && retryCount < maxRetries) {
            console.log(`尝试查找DOM元素，第${retryCount + 1}次...`);
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            targetElement = result.singleNodeValue;
            if (!targetElement) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return targetElement;
    }

    // 显示加载状态
    function showLoading(targetElement) {
        // 清除之前的分析结果
        const existingResults = document.querySelectorAll('.pumptools-analysis-result');
        existingResults.forEach(element => element.remove());

        // 添加加载提示
        targetElement.insertAdjacentHTML('afterend', `
            <div class="pumptools-analysis-result" style="font-size: 12px; color: #536471; line-height: 1.3; margin-top: 4px;">
                <div style="padding: 2px 6px; background-color: #f0f0f0; border-radius: 4px;">加载中...</div>
            </div>
        `);
    }

    // API请求函数
    async function makeRequest(endpoint, payload, description) {
        try {
            const url = `${API_CONFIG.PUMP_TOOLS.BASE_URL}${endpoint}`;
            console.log(`准备发送${description}请求:`, url, payload);

            console.log('开始fetch请求...');
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log('fetch请求完成，状态:', response.status);

            if (response.status === 401 || response.status === 403) {
                console.log('需要VIP权限');
                const error = new Error('NeedVip');
                error.status = response.status;
                error.emptyData = { data: [] };
                throw error;
            }

            if (!response.ok) {
                console.log('请求失败，状态码:', response.status);
                return { data: [] };
            }

            console.log('开始解析响应数据...');
            const result = await response.json();
            console.log(`${description}响应数据:`, result);
            return result;
        } catch (error) {
            console.error(`${description}请求出错:`, error);
            if (error.message === 'NeedVip') {
                throw error;
            }
            return { data: [] };
        }
    }

    // 处理分析结果并更新UI
    function updateAnalysisResult(targetElement, tokensResult, modificationsResult, influenceResult) {
        // 移除加载提示
        const loadingIndicator = document.querySelector('.pumptools-analysis-result');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        // 获取各项数据，使用默认值防止错误
        const tokenCount = Array.isArray(tokensResult) ? tokensResult.length : (tokensResult?.data?.length || 0);
        const modifications = Array.isArray(modificationsResult) ? modificationsResult : (modificationsResult?.data || []);
        const deleteTweetCount = modifications.filter(m => m.modify_type === 'delete_tweet').length;
        const changeNameCount = modifications.filter(m => m.modify_type === 'modify_user_name').length;
        const changeAvatarCount = modifications.filter(m => m.modify_type === 'modify_profile_image').length;
        
        const kolFollow = influenceResult?.kolFollow || {};
        const kolTokenMention = influenceResult?.kolTokenMention || {};
        
        const globalKolCount = kolFollow?.globalKolFollowersCount || 0;
        const cnKolCount = kolFollow?.cnKolFollowersCount || 0;
        const topKolCount = kolFollow?.topKolFollowersCount || 0;
        
        const day7WinRate = kolTokenMention?.day7?.winRatePct ? (kolTokenMention.day7.winRatePct * 100).toFixed(2) : 'N/A';
        const day30WinRate = kolTokenMention?.day30?.winRatePct ? (kolTokenMention.day30.winRatePct * 100).toFixed(2) : 'N/A';
        const day90WinRate = kolTokenMention?.day90?.winRatePct ? (kolTokenMention.day90.winRatePct * 100).toFixed(2) : 'N/A';

        // 准备发币详情提示
        const tokens = Array.isArray(tokensResult) ? tokensResult : (tokensResult?.data || []);
        const tokenDetails = tokens.map(token => 
            `<span style="color: #ff0000;">${token.token_symbol || 'Unknown'}: ${token.token_address}, 市值: $${parseFloat(token.market_cap).toFixed(2)}</span>`
        ).join('\n') || '无发币记录';

        console.log('tokenDetails: ', tokenDetails);
        console.log('开始更新DOM...');
        targetElement.insertAdjacentHTML('afterend', `<div class="pumptools-analysis-result" style="font-size: 12px; color: #536471; line-height: 1.3; margin-top: 4px;"><div style="padding: 2px 6px; background-color: #f0f0f0; border-radius: 4px; white-space: pre-line;"><strong>发币风险分析:</strong> 发币: <span class="token-count" style="color: #ff0000; font-weight: bold; position: relative; cursor: help;">${tokenCount}<div class="tooltip" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); white-space: pre !important; overflow: visible !important; z-index: 9999; width: fit-content; min-width: 600px; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; display: none; font-size: 10px; line-height: 1.2; color: #333; border: 1px solid #e1e8ed;">${tokenDetails}</div></span>个, 删推: <span style="color: #ff0000; font-weight: bold;">${deleteTweetCount}</span>次, 改名: <span style="color: #ff0000; font-weight: bold;">${changeNameCount}</span>次, 改头像: <span style="color: #ff0000; font-weight: bold;">${changeAvatarCount}</span>次
<strong>影响力分析:</strong> 顶级KOL关注: <span style="color: #ff0000; font-weight: bold;">${topKolCount}</span>, 全球KOL关注: <span style="color: #ff0000; font-weight: bold;">${globalKolCount}</span>, 中文区KOL关注: <span style="color: #ff0000; font-weight: bold;">${cnKolCount}</span>
<strong>胜率分析:</strong> 7天胜率: <span style="color: #ff0000; font-weight: bold;">${day7WinRate}%</span>, 30天胜率: <span style="color: #ff0000; font-weight: bold;">${day30WinRate}%</span>, 90天胜率: <span style="color: #ff0000; font-weight: bold;">${day90WinRate}%</span></div></div>`);

        // 添加tooltip显示/隐藏逻辑
        const tokenCountSpan = document.querySelector('.token-count');
        if (tokenCountSpan) {
            const tooltip = tokenCountSpan.querySelector('.tooltip');
            
            // 显示tooltip
            tokenCountSpan.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
            });
            
            // 隐藏tooltip
            tokenCountSpan.addEventListener('mouseleave', () => {
                // 不立即隐藏，等待鼠标移动到tooltip上
            });
            
            // tooltip的鼠标事件
            tooltip.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
            });
            
            tooltip.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }

        console.log('新增内容已添加');
    }

    // 主流程
    const targetElement = await findTargetElement();
    if (!targetElement) {
        console.warn('未找到目标DOM元素');
        return;
    }

    showLoading(targetElement);

    let tokensResult, modificationsResult, influenceResult;

    if (cachedData) {
        console.log('使用缓存数据');
        ({tokensResult, modificationsResult, influenceResult} = cachedData);
    } else {
        console.log('执行完整分析');
        const twitterUrl = `https://x.com/${username}`;
        const payload = { twitter_url: twitterUrl };
        
        // 并行调用三个接口
        [tokensResult, modificationsResult, influenceResult] = await Promise.all([
            makeRequest(API_CONFIG.PUMP_TOOLS.ENDPOINTS.TWITTER_TOKENS, payload, '获取发币历史').catch(() => ({ data: [] })),
            makeRequest(API_CONFIG.PUMP_TOOLS.ENDPOINTS.TWITTER_MODIFICATIONS, payload, '获取异常修改历史').catch(() => ({ data: [] })),
            makeRequest(API_CONFIG.PUMP_TOOLS.ENDPOINTS.TWITTER_INFLUENCE, payload, '获取用户影响力数据').catch(() => ({ 
                kolFollow: { globalKolFollowersCount: 0, cnKolFollowersCount: 0, topKolFollowersCount: 0 },
                kolTokenMention: { 
                    day7: { winRatePct: null },
                    day30: { winRatePct: null },
                    day90: { winRatePct: null }
                }
            }))
        ]);

        // 发送消息给后台脚本保存缓存
        chrome.runtime.sendMessage({
            action: 'saveCache',
            username,
            data: {
                tokensResult,
                modificationsResult,
                influenceResult
            }
        });
    }

    updateAnalysisResult(targetElement, tokensResult, modificationsResult, influenceResult);
    console.log('==== 分析完成 ====');
} 