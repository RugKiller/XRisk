console.log('Sidebar script starting...');

// 全局变量，用于存储监听器状态
let isAutoAnalyzing = false;

// 初始化状态
async function initializeState() {
    const result = await chrome.storage.local.get('isAutoAnalyzing');
    isAutoAnalyzing = result.isAutoAnalyzing || false;
    updateButtonState();
}

// 开启自动分析
function startAutoAnalyze() {
    if (!isAutoAnalyzing) {
        isAutoAnalyzing = true;
        chrome.storage.local.set({ isAutoAnalyzing: true });
        updateButtonState();
        chrome.runtime.sendMessage({ action: 'startAutoAnalyze' });
    }
}

// 关闭自动分析
function stopAutoAnalyze() {
    if (isAutoAnalyzing) {
        isAutoAnalyzing = false;
        chrome.storage.local.set({ isAutoAnalyzing: false });
        updateButtonState();
        chrome.runtime.sendMessage({ action: 'stopAutoAnalyze' });
    }
}

// 更新按钮状态
function updateButtonState() {
    const button = document.getElementById('startAutoAnalyze');
    if (button) {
        if (isAutoAnalyzing) {
            button.textContent = '关闭自动分析';
            button.classList.add('active');
        } else {
            button.textContent = '开启自动分析';
            button.classList.remove('active');
        }
        // 重新添加状态指示点
        const statusDot = document.createElement('span');
        statusDot.className = 'status-dot';
        button.appendChild(statusDot);
    }
}

// 初始化侧边栏
function initializeSidebar() {
    // 设置按钮点击事件
    const analyzeBtn = document.getElementById('startAutoAnalyze');
    if (analyzeBtn) {
        analyzeBtn.onclick = () => {
            if (isAutoAnalyzing) {
                stopAutoAnalyze();
            } else {
                startAutoAnalyze();
            }
        };
    }
}

// 确保在 DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeState();
        initializeSidebar();
    });
} else {
    initializeState();
    initializeSidebar();
}

// 添加一个全局错误处理器
window.onerror = function(msg, url, line, col, error) {
    console.error('Error: ', msg, '\nURL: ', url, '\nLine:', line, '\nColumn:', col, '\nError object:', error);
    return false;
};

// 添加清空缓存按钮事件监听
document.getElementById('clearCache').addEventListener('click', async () => {
    try {
        await chrome.storage.local.clear();
        console.log('缓存已清空');
        // 可以添加一个简单的提示
        const resultDiv = document.getElementById('analysisResult');
        resultDiv.innerHTML = '<div class="alert alert-success">缓存已清空</div>';
        setTimeout(() => {
            resultDiv.innerHTML = '';
        }, 2000);
    } catch (error) {
        console.error('清空缓存失败:', error);
    }
}); 