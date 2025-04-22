console.log('Background script loaded - v7');

let isEnabled = false;

// 初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    chrome.storage.local.set({ isEnabled: false });
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', {
    tabId,
    changeInfo,
    url: tab.url,
    isEnabled
  });

  if (isEnabled && (tab.url.includes('x.com/') || tab.url.includes('twitter.com/'))) {
    console.log('Detected Twitter/X page load');
    if (changeInfo.status === 'complete') {
      console.log('Page load complete, executing script');
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: modifyUsername
      }).then(() => {
        console.log('Script execution completed');
      }).catch(err => {
        console.error('Script execution failed:', err);
      });
    }
  }
});

// 监听扩展图标点击
chrome.action.onClicked.addListener((tab) => {
  isEnabled = !isEnabled;
  console.log('Extension toggled:', {
    isEnabled,
    url: tab.url
  });

  if (isEnabled) {
    console.log('Extension enabled, executing script');
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: modifyUsername
    }).then(() => {
      console.log('Script execution completed');
    }).catch(err => {
      console.error('Script execution failed:', err);
    });
  } else {
    console.log('Extension disabled');
  }
});

function modifyUsername() {
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

    // 输出修改后的结构
    console.log('Modified element structure:', element.outerHTML);
  } else {
    console.log('Target element not found');
    
    // 输出当前页面URL和路径信息以帮助调试
    console.log('Current page info:', {
      url: window.location.href,
      pathname: window.location.pathname
    });
  }
} 