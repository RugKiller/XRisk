console.log('Sidebar script starting...');

document.getElementById('analyzeBtn').onclick = () => {
    console.log('分析按钮被点击');
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab) {
            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                func: () => {
                    // 首先检查是否是用户主页
                    const pathParts = window.location.pathname.split('/');
                    if (pathParts.length !== 2 || pathParts[1] === '') {
                        alert('请在Twitter/X用户主页使用此功能');
                        return;
                    }

                    console.log('Starting username modification');
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
                        
                        // 添加新的标注
                        const username = element.querySelector('span:first-child')?.textContent || '';
                        console.log('Username found:', username);

                        const newSpan = document.createElement('span');
                        newSpan.className = 'css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 x-added-username';
                        newSpan.textContent = username;
                        newSpan.style.color = '#1DA1F2';
                        newSpan.style.marginLeft = '4px';
                        
                        element.appendChild(newSpan);
                        console.log('New username span added successfully');
                    } else {
                        console.log('Target element not found');
                    }
                }
            }).then(result => {
                console.log('执行结果:', result);
            }).catch(err => {
                console.error('执行失败:', err);
            });
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