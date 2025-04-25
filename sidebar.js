console.log('Sidebar script starting...');

// 自动检测并执行分析
function autoAnalyze() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && (activeTab.url.includes('x.com/') || tab.url.includes('twitter.com/'))) {
            const username = getAndShowUsername(activeTab.url);
            if (username) {
                // 在注入脚本时传递标签页ID
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: analysisXUser,
                    args: [username, activeTab.id]
                });
            }
        }
    });
}

// 解析URL并显示用户名，同时返回用户名
function getAndShowUsername(url) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    if (pathParts.length >= 2 && pathParts[1]) {
        const username = pathParts[1];
        // 在插件界面显示用户名
        const usernameDiv = document.getElementById('username') || document.createElement('div');
        usernameDiv.id = 'username';
        usernameDiv.textContent = `当前用户: @${username}`;
        usernameDiv.style.marginTop = '10px';
        usernameDiv.style.padding = '8px';
        usernameDiv.style.backgroundColor = '#f0f0f0';
        usernameDiv.style.borderRadius = '4px';
        
        // 确保插入到按钮之后
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn && !document.getElementById('username')) {
            analyzeBtn.parentNode.insertBefore(usernameDiv, analyzeBtn.nextSibling);
        }

        return username;  // 返回用户名
    }
    return null;
}

// 修改后的分析函数
async function analysisXUser(username, tabId) {
    console.log('==== 开始分析用户 ====');
    console.log('用户名:', username);

    // 在函数内部定义所需的配置和函数
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

    async function makeRequest(endpoint, payload, description) {
        try {
            const url = `${API_CONFIG.PUMP_TOOLS.BASE_URL}${endpoint}`;
            console.log(`准备发送${description}请求:`, url, payload);

            console.log('开始fetch请求...');
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
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
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            if (error.message === 'NeedVip') {
                throw error;
            }
            return { data: [] };
        }
    }

    // 构造Twitter URL
    const twitterUrl = `https://x.com/${username}`;
    console.log('构造的URL:', twitterUrl);
    const payload = { twitter_url: twitterUrl };
    console.log('请求参数:', payload);

    console.log('准备并行调用API...');
    
    // 先显示加载状态
    const xpath = '//*[@id="react-root"]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/div[1]/div/div[2]/div[1]/div/div/div[2]';
    
    // 添加重试机制查找DOM元素
    let targetElement = null;
    let retryCount = 0;
    const maxRetries = 5;
    
    while (!targetElement && retryCount < maxRetries) {
        console.log(`尝试查找DOM元素，第${retryCount + 1}次...`);
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        targetElement = result.singleNodeValue;
        if (!targetElement) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        }
    }
    
    console.log('找到的DOM元素:', targetElement);
    
    if (targetElement) {
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

    // 并行调用三个接口
    const [tokensResult, modificationsResult, influenceResult] = await Promise.all([
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
    
    console.log('发币历史数据:', tokensResult);
    console.log('异常修改历史数据:', modificationsResult);
    console.log('用户影响力数据:', influenceResult);

    if (targetElement) {
        // 移除加载提示
        const loadingIndicator = document.querySelector('.pumptools-analysis-result');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        // 获取各项数据，使用默认值防止错误
        const tokenCount = tokensResult?.length || 0;
        const deleteTweetCount = modificationsResult?.filter?.(m => m.modify_type === 'delete_tweet')?.length || 0;
        const changeNameCount = modificationsResult?.filter?.(m => m.modify_type === 'modify_user_name')?.length || 0;
        const changeAvatarCount = modificationsResult?.filter?.(m => m.modify_type === 'modify_profile_image')?.length || 0;
        
        const kolFollow = influenceResult?.kolFollow || {};
        const kolTokenMention = influenceResult?.kolTokenMention || {};
        
        const globalKolCount = kolFollow?.globalKolFollowersCount || 0;
        const cnKolCount = kolFollow?.cnKolFollowersCount || 0;
        const topKolCount = kolFollow?.topKolFollowersCount || 0;
        
        const day7WinRate = kolTokenMention?.day7?.winRatePct ? (kolTokenMention.day7.winRatePct * 100).toFixed(2) : 'N/A';
        const day30WinRate = kolTokenMention?.day30?.winRatePct ? (kolTokenMention.day30.winRatePct * 100).toFixed(2) : 'N/A';
        const day90WinRate = kolTokenMention?.day90?.winRatePct ? (kolTokenMention.day90.winRatePct * 100).toFixed(2) : 'N/A';

        console.log('开始更新DOM...');
        targetElement.insertAdjacentHTML('afterend', `
            <div class="pumptools-analysis-result" style="font-size: 12px; color: #536471; line-height: 1.3; margin-top: 4px;">
                <div style="padding: 2px 6px; background-color: #f0f0f0; border-radius: 4px; white-space: pre-line;">发币风险分析: 发币: ${tokenCount}个, 删推: ${deleteTweetCount}次, 改名: ${changeNameCount}次, 改头像: ${changeAvatarCount}次
影响力分析: 全球KOL关注: ${globalKolCount}, 中文区KOL关注: ${cnKolCount}, 顶级KOL关注: ${topKolCount}
7天胜率: ${day7WinRate}%, 30天胜率: ${day30WinRate}%, 90天胜率: ${day90WinRate}%</div>
            </div>
        `);
        console.log('新增内容已添加');
    } else {
        console.warn('未找到目标DOM元素');
    }

    console.log('==== 分析完成 ====');
}

// 保持原有的点击功能
document.getElementById('analyzeBtn').onclick = () => {
    console.log('分析按钮被点击');
    // 先执行一次分析
    autoAnalyze();
    // 开启自动监听
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('x.com/') || tab.url.includes('twitter.com/'))) {
            console.log('检测到页面更新，触发分析...');
            autoAnalyze();
        }
    });
};

// 确保在 DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebar);
} else {
    initializeSidebar();
}

// 添加一个全局错误处理器
window.onerror = function(msg, url, line, col, error) {
    console.error('Error: ', msg, '\nURL: ', url, '\nLine:', line, '\nColumn:', col, '\nError object:', error);
    return false;
}; 