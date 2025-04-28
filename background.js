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
        
        // 缓存有效期为30分钟
        if (now - cacheTime >  30 * 60 * 1000) {
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
                await new Promise(resolve => setTimeout(resolve, 2000));
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

        // 数据处理工具
        const dataProcessor = {
            getTokenData(tokensResult) {
                const tokens = Array.isArray(tokensResult) ? tokensResult : (tokensResult?.data || []);
                return {
                    count: tokens.length,
                    details: `<div style="color: #666; font-size: 11px; margin-bottom: 4px;">发币记录（最多显示10条）</div>` + (tokens.length > 0 ? 
                        tokens.map(token => 
                            `<div style="color: #ff0000; padding: 2px 0;">${token.token_symbol || 'Unknown'}: ${token.token_address} (市值: $${parseFloat(token.market_cap).toFixed(2)})</div>`
                        ).slice(0, 10).join('') : '无发币记录')
                };
            },

            getModificationData(modificationsResult) {
                const modifications = Array.isArray(modificationsResult) ? modificationsResult : (modificationsResult?.data || []);
                const getDetails = (type) => {
                    return modifications
                        .filter(m => m.modify_type === type)
                        .slice(0, 10)
                        .map(m => {
                            const date = new Date(m.gmt_modify).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            
                            let detail = '';
                            if (type === 'modify_user_name' || type === 'modify_show_name') {
                                const matches = m.modification_log.match(/Raw Value:<\/br>(.*?)<\/br>.*?New Value:<\/br>(.*?)(?:<\/br>|$)/s);
                                if (matches) {
                                    detail = `${matches[1]} → ${matches[2]}`;
                                }
                            } else if (type === 'delete_tweet') {
                                detail = m.modification_log.replace(/^Delete Tweet:<\/br>/, '').trim();
                            }
                            
                            return `<div style="color: #ff0000; padding: 2px 0;">${date}: ${detail}</div>`;
                        })
                        .join('') || '无记录';
                };
                
                return {
                    deleteTweet: {
                        count: modifications.filter(m => m.modify_type === 'delete_tweet').length,
                        details: `<div style="color: #666; font-size: 11px; margin-bottom: 4px;">删推记录（最多显示10条）</div>` + getDetails('delete_tweet')
                    },
                    changeName: {
                        count: modifications.filter(m => m.modify_type === 'modify_user_name').length,
                        details: `<div style="color: #666; font-size: 11px; margin-bottom: 4px;">改名记录（最多显示10条）</div>` + getDetails('modify_user_name')
                    }
                };
            },

            getInfluenceData(influenceResult) {
                const kolFollow = influenceResult?.kolFollow || {};
                // 处理KOL列表详情
                function getKolDetail(list, title) {
                    if (!Array.isArray(list) || !list.length) return `<span style=\"color: #999;\">无${title}</span>`;
                    return `<div style=\"color: #666; font-size: 11px; margin-bottom: 4px;\">${title}</div>` +
                        list.slice(0, 10).map(kol =>
                            `<div style=\"display: flex; align-items: center; gap: 6px; margin-bottom: 2px;\">
                                <img src=\"${kol.avatar}\" alt=\"avatar\" style=\"width: 22px; height: 22px; border-radius: 50%; object-fit: cover;\">
                                <a href=\"https://x.com/${kol.username}\" target=\"_blank\" style=\"color: #4a90e2; text-decoration: none; font-size: 13px;\">${kol.name || kol.username}</a>
                            </div>`
                        ).join('');
                }
                return {
                    kol: {
                        global: {
                            count: kolFollow?.globalKolFollowersCount || 0,
                            details: getKolDetail(kolFollow?.globalKolFollowers, '全球KOL列表')
                        },
                        cn: {
                            count: kolFollow?.cnKolFollowersCount || 0,
                            details: getKolDetail(kolFollow?.cnKolFollowers, '中文区KOL列表')
                        },
                        top: {
                            count: kolFollow?.topKolFollowersCount || 0,
                            details: getKolDetail(kolFollow?.topKolFollowers, '顶级KOL列表')
                        }
                    }
                };
            }
        };

        // 样式配置
        const styles = {
            container: 'font-size: 12px; color: #536471; line-height: 1.3; margin-top: 4px;',
            content: 'padding: 2px 6px; background-color: #f0f0f0; border-radius: 4px; white-space: pre-line;',
            tooltip: `
                position: absolute;
                background: #fff !important;
                backdrop-filter: none;
                padding: 8px 12px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                white-space: pre !important;
                overflow: visible !important;
                z-index: 9999;
                width: fit-content;
                min-width: 300px;
                max-width: 90vw;
                word-break: break-all;
                user-select: text;
                -webkit-user-select: text;
                -moz-user-select: text;
                -ms-user-select: text;
                display: none;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                border: 1px solid #e1e8ed;
                left: calc(100% + 10px);
                top: 50%;
                transform: translateY(-50%);
            `,
            highlight: 'color: #ff0000; font-weight: bold;'
        };

        // 处理数据
        const tokenData = dataProcessor.getTokenData(tokensResult);
        const modificationData = dataProcessor.getModificationData(modificationsResult);
        const influenceData = dataProcessor.getInfluenceData(influenceResult);

        // 构建HTML
        const analysisHTML = `
            <div class="pumptools-analysis-result" style="${styles.container}">
                <div style="${styles.content}"><strong>发币风险分析:</strong>发币: <span class="token-count" style="${styles.highlight}; position: relative; cursor: help;">${tokenData.count}<div class="tooltip" style="${styles.tooltip}">${tokenData.details}</div></span>个, 删推: <span class="delete-tweet-count" style="${styles.highlight}; position: relative; cursor: help;">${modificationData.deleteTweet.count}<div class="tooltip" style="${styles.tooltip}">${modificationData.deleteTweet.details}</div></span>次, 改名: <span class="change-name-count" style="${styles.highlight}; position: relative; cursor: help;">${modificationData.changeName.count}<div class="tooltip" style="${styles.tooltip}">${modificationData.changeName.details}</div></span>次
                    <strong>影响力分析:</strong>顶级KOL关注: <span class="top-kol-count" style="${styles.highlight}; position: relative; cursor: help;">${influenceData.kol.top.count}<div class="tooltip" style="${styles.tooltip}">${influenceData.kol.top.details}</div></span>, 全球KOL关注: <span class="global-kol-count" style="${styles.highlight}; position: relative; cursor: help;">${influenceData.kol.global.count}<div class="tooltip" style="${styles.tooltip}">${influenceData.kol.global.details}</div></span>, 中文区KOL关注: <span class="cn-kol-count" style="${styles.highlight}; position: relative; cursor: help;">${influenceData.kol.cn.count}<div class="tooltip" style="${styles.tooltip}">${influenceData.kol.cn.details}</div></span>
                    <strong>广告位：有需要的老板联系<a href="https://x.com/pumptools_me" target="_blank" style="color: #1d9bf0; text-decoration: none;">@pumptools_me</a>，免费版时有不稳定，如需VIP版请联系我</strong>
                </div>
            </div>
        `;

        // 插入HTML
        targetElement.insertAdjacentHTML('afterend', analysisHTML);

        // --------- 全局tooltip实现 ---------
        // 创建全局唯一tooltip节点
        let globalTooltip = document.getElementById('pumptools-global-tooltip');
        if (!globalTooltip) {
            globalTooltip = document.createElement('div');
            globalTooltip.id = 'pumptools-global-tooltip';
            globalTooltip.style.position = 'fixed';
            globalTooltip.style.zIndex = '99999';
            globalTooltip.style.background = '#fff';
            globalTooltip.style.backdropFilter = 'none';
            globalTooltip.style.padding = '8px 12px';
            globalTooltip.style.borderRadius = '4px';
            globalTooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            globalTooltip.style.whiteSpace = 'pre';
            globalTooltip.style.overflow = 'visible';
            globalTooltip.style.minWidth = '300px';
            globalTooltip.style.userSelect = 'text';
            globalTooltip.style.fontSize = '12px';
            globalTooltip.style.lineHeight = '1.4';
            globalTooltip.style.color = '#333';
            globalTooltip.style.border = '1px solid #e1e8ed';
            globalTooltip.style.display = 'none';
            globalTooltip.style.pointerEvents = 'auto';
            document.body.appendChild(globalTooltip);
        }

        // 设置tooltip事件
        const setupTooltip = (className) => {
            const element = document.querySelector(`.${className}`);
            if (element) {
                let hideTimeout;
                // 获取原本的tooltip内容
                const tooltipContent = element.querySelector('.tooltip')?.innerHTML || '';

                function showTooltip() {
                    if (hideTimeout) clearTimeout(hideTimeout);
                    // 设置内容
                    globalTooltip.innerHTML = tooltipContent;
                    globalTooltip.style.display = 'block';
                    // 定位到目标元素右侧或下方
                    const rect = element.getBoundingClientRect();
                    const tooltipRect = globalTooltip.getBoundingClientRect();
                    let left = rect.right + 10;
                    let top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                    // 如果右侧空间不够，显示在左侧
                    if (left + tooltipRect.width > window.innerWidth) {
                        left = rect.left - tooltipRect.width - 10;
                    }
                    // 如果左侧也溢出，贴屏幕左边
                    if (left < 10) left = 10;
                    // 如果上方溢出，贴顶部
                    if (top < 0) top = 10;
                    // 如果下方溢出，贴底部
                    if (top + tooltipRect.height > window.innerHeight) {
                        top = window.innerHeight - tooltipRect.height - 10;
                    }
                    globalTooltip.style.left = left + 'px';
                    globalTooltip.style.top = top + 'px';
                }

                function hideTooltip() {
                    hideTimeout = setTimeout(() => {
                        globalTooltip.style.display = 'none';
                    }, 300);
                }

                element.addEventListener('mouseenter', showTooltip);
                element.addEventListener('mouseleave', hideTooltip);
                globalTooltip.addEventListener('mouseenter', () => {
                    if (hideTimeout) clearTimeout(hideTimeout);
                    globalTooltip.style.display = 'block';
                });
                globalTooltip.addEventListener('mouseleave', hideTooltip);
            }
        };

        // 为所有需要tooltip的元素设置事件
        ['token-count', 'delete-tweet-count', 'change-name-count', 'top-kol-count', 'global-kol-count', 'cn-kol-count'].forEach(setupTooltip);
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