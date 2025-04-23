console.log('Sidebar script starting...');

// 自动检测并执行分析
function autoAnalyze() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && (activeTab.url.includes('x.com/') || activeTab.url.includes('twitter.com/'))) {
            // 获取用户名并传递给分析函数
            const username = getAndShowUsername(activeTab.url);
            if (username) {
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: analysisXUser,
                    args: [username]  // 传递username参数
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

// 重命名并修改为接收username参数
function analysisXUser(username) {
    // 首先检查是否是用户主页
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length !== 2 || pathParts[1] === '') {
        return;
    }

    console.log('Starting analysis for user:', username);
    const xpath = '//*[@id="react-root"]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/div[1]/div/div[2]/div[1]/div/div/div[1]/div/div/span';
    console.log('Looking for element with XPath:', xpath);

    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const element = result.singleNodeValue;
    
    if (element) {
        console.log('Target element found');
        
        // 如果已经添加过，先移除
        const existing = element.querySelector('.x-added-username');
        if (existing) {
            console.log('Removing existing modification');
            existing.remove();
        }
        
        // 添加新的标注，使用传入的username
        const newSpan = document.createElement('span');
        newSpan.className = 'css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 x-added-username';
        newSpan.textContent = username;  // 使用传入的username
        newSpan.style.color = '#1DA1F2';
        newSpan.style.marginLeft = '4px';
        
        element.appendChild(newSpan);
        console.log('Analysis completed for user:', username);
    } else {
        console.log('Target element not found');
    }
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