console.log('Content script loaded - v7');

let isExtensionEnabled = false;

// 添加一个明显的视觉标记来确认脚本在运行
function addDebugMarker() {
    const marker = document.createElement('div');
    marker.style.position = 'fixed';
    marker.style.top = '10px';
    marker.style.right = '10px';
    marker.style.padding = '5px';
    marker.style.background = 'red';
    marker.style.color = 'white';
    marker.style.zIndex = '9999';
    marker.textContent = 'Debug Marker';
    document.body.appendChild(marker);
}

// 使用多种方法查找目标元素
function findTargetElement() {
    console.log('Finding target element...');
    
    // 1. 尝试 XPath
    const xpath = '//*[@id="react-root"]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/div[1]/div/div[2]/div[1]/div/div/div[1]/div/div/span';
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const xpathElement = result.singleNodeValue;
    console.log('XPath element found:', xpathElement);

    // 2. 尝试选择器
    const selectorElement = document.querySelector('[data-testid="UserName"]');
    console.log('Selector element found:', selectorElement);

    return xpathElement || selectorElement;
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.isEnabled !== undefined) {
        isExtensionEnabled = message.isEnabled;
        if (isExtensionEnabled) {
            startObserving();
        } else {
            stopObserving();
        }
        sendResponse({ status: 'ok', success: true });
    }
});

// 检查是否在用户主页
function isUserProfile() {
    // Twitter用户主页URL格式：twitter.com/:username
    const pathParts = window.location.pathname.split('/');
    return pathParts.length === 2 && pathParts[1] !== '';
}

function modifyUsername() {
    if (!isExtensionEnabled || !isUserProfile()) return;

    console.log('Modifying username...');
    addDebugMarker(); // 添加调试标记

    const targetElement = findTargetElement();
    console.log('Target element:', targetElement);

    if (targetElement) {
        // 记录原始HTML
        console.log('Original HTML:', targetElement.outerHTML);

        // 找到用户名文本
        const usernameText = targetElement.textContent;
        console.log('Username text:', usernameText);

        try {
            // 创建新的span
            const newSpan = document.createElement('span');
            newSpan.className = 'css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 x-added-username';
            newSpan.textContent = usernameText;
            newSpan.style.color = '#1DA1F2';
            newSpan.style.marginLeft = '4px';

            // 添加到目标元素
            targetElement.appendChild(newSpan);
            console.log('Modification applied');
            console.log('New HTML:', targetElement.outerHTML);
        } catch (error) {
            console.error('Error during modification:', error);
        }
    } else {
        console.log('Target element not found');
        // 输出页面结构以帮助调试
        console.log('Page structure:', document.body.innerHTML);
    }
}

function removeModification() {
    console.log('Removing modification...');
    
    // 移除所有带有标记的元素
    document.querySelectorAll('.x-added-username').forEach(el => {
        console.log('Removing element:', el);
        el.remove();
    });
    
    // 移除调试标记
    const marker = document.querySelector('div[style*="position: fixed"]');
    if (marker) marker.remove();
}

// 观察URL变化
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isExtensionEnabled) {
            setTimeout(modifyUsername, 1000); // 给页面加载一些时间
        }
    }
}).observe(document, {subtree: true, childList: true});

// 观察DOM变化
let observer = null;

function startObserving() {
    if (!observer) {
        observer = new MutationObserver((mutations) => {
            if (isUserProfile()) {
                modifyUsername();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 初始检查
        modifyUsername();
    }
}

function stopObserving() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    removeModification();
}

// 初始化
if (isUserProfile()) {
    modifyUsername();
}

// 添加测试函数
window.testModification = function() {
    console.log('Manual test triggered');
    modifyUsername();
};

// 初始化时输出页面信息
console.log('Page URL:', window.location.href);
console.log('Document ready state:', document.readyState); 