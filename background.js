console.log('Background script loaded');

// 监听扩展图标点击
chrome.action.onClicked.addListener((tab) => {
    // 打开侧边栏
    chrome.sidePanel.open({
        windowId: tab.windowId
    }).catch(err => {
        console.error('Failed to open side panel:', err);
    });
}); 