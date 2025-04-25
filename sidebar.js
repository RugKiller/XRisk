console.log('Sidebar script starting...');

// 自动检测并执行分析
function autoAnalyze() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && (activeTab.url.includes('x.com/') || activeTab.url.includes('twitter.com/'))) {
            const username = getAndShowUsername(activeTab.url);
            if (username) {
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: analysisXUser,
                    args: [username]
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

// API 配置和通用方法
const API_CONFIG = {
    PUMP_TOOLS: {
        BASE_URL: 'https://pumptools.me/api/extension',
        ENDPOINTS: {
            TWITTER_TOKENS: '/get_x_tokens_history',
            TWITTER_MODIFICATIONS: '/get_x_modification_logs'
        }
    }
};

async function makeRequest(endpoint, payload, description) {
    try {
        const url = `${API_CONFIG.PUMP_TOOLS.BASE_URL}${endpoint}`;
        console.log(`准备发送${description}请求:`, url, payload);

        payload.user_id = '2cziYKVaXnYx8GQZptAGFokgocu2ck33jvtxDV38kien';
        console.log('添加user_id后的payload:', payload);

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

// 修改后的分析函数
async function analysisXUser(username) {
    console.log('==== 开始分析用户 ====');
    console.log('用户名:', username);

    // 在函数内部定义所需的配置和函数
    const API_CONFIG = {
        PUMP_TOOLS: {
            BASE_URL: 'https://pumptools.me/api/extension',
            ENDPOINTS: {
                TWITTER_TOKENS: '/get_x_tokens_history',
                TWITTER_MODIFICATIONS: '/get_x_modification_logs'
            }
        }
    };

    async function makeRequest(endpoint, payload, description) {
        try {
            const url = `${API_CONFIG.PUMP_TOOLS.BASE_URL}${endpoint}`;
            console.log(`准备发送${description}请求:`, url, payload);

            payload.user_id = '2cziYKVaXnYx8GQZptAGFokgocu2ck33jvtxDV38kien';
            console.log('添加user_id后的payload:', payload);

            console.log('开始fetch请求...');
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyY3ppWUtWYVhuWXg4R1FacHRBR0Zva2dvY3UyY2szM2p2dHhEVjM4a2llbiIsImV4cCI6MTc0NTQyMDIyN30.LAJai7lkQXZjaGhOaZBu8tiNVLKxfScgP1CbKs4N03E'
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

    console.log('准备调用API...');
    // 调用两个接口
    const tokensResult = await makeRequest(API_CONFIG.PUMP_TOOLS.ENDPOINTS.TWITTER_TOKENS, payload, '获取发币历史');
    console.log('发币历史数据:', tokensResult);

    const modificationsResult = await makeRequest(API_CONFIG.PUMP_TOOLS.ENDPOINTS.TWITTER_MODIFICATIONS, payload, '获取异常修改历史');
    console.log('异常修改历史数据:', modificationsResult);

    console.log('准备修改DOM...');
    const xpath = '//*[@id="react-root"]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/div[1]/div/div[2]/div[1]/div/div/div[1]/div/div/span';
    console.log('使用XPath:', xpath);
    
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const element = result.singleNodeValue;
    console.log('找到的DOM元素:', element);
    
    if (element) {
        console.log('开始更新DOM...');
        // 如果已经添加过，先移除
        const existing = element.querySelector('.x-added-username');
        console.log('existing is:', existing);
        if (existing) {
            console.log('移除已存在的标注');
            existing.remove();
        }
        
        console.log('准备创建新span...');
        const newSpan = document.createElement('span');
        console.log('span已创建');
        
        console.log('设置className...');
        newSpan.className = 'css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 x-added-username';
        
        try {
            console.log('设置文本内容...');
            const tokenCount = tokensResult.length || 0;
            
            // 统计各种修改类型的次数
            const deleteTweetCount = modificationsResult.filter(m => m.modify_type === 'delete_tweet').length;
            const changeNameCount = modificationsResult.filter(m => m.modify_type === 'modify_user_name').length;
            const changeAvatarCount = modificationsResult.filter(m => m.modify_type === 'modify_profile_image').length;
            
            newSpan.textContent = `发币: ${tokenCount}个, 删推: ${deleteTweetCount}次, 改名: ${changeNameCount}次, 改头像: ${changeAvatarCount}次`;
            
            console.log('设置样式...');
            newSpan.style.color = '#1DA1F2';
            newSpan.style.marginLeft = '4px';
            
            console.log('准备添加到DOM...');
            element.appendChild(newSpan);
            console.log('添加的内容:', newSpan.textContent);
        } catch (error) {
            console.error('DOM更新出错:', error);
        }
    } else {
        console.warn('未找到目标DOM元素');
    }

    console.log('==== 分析完成 ====');
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        autoAnalyze();
    }
});

// 保持原有的点击功能
document.getElementById('analyzeBtn').onclick = () => {
    console.log('分析按钮被点击');
    autoAnalyze();
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