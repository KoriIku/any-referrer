// ==UserScript==
// @name         any-referrer - 伪装你来自哪里
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Drag links to floating icons to redirect through custom sites with favicon and management UI
// @match        *://*/*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @author       KoriIku
// @downloadURL  https://github.com/KoriIku/any-referrer/raw/refs/heads/main/any-referrer.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 默认网站列表
    const defaultSites = [
        { url: 'https://www.google.com', fuzzyMatch: false },
        { url: 'https://www.baidu.com', fuzzyMatch: false }
    ];

    // 从存储中获取网站列表和设置，如果没有则使用默认值
    let sites = GM_getValue('customSites', defaultSites);
    let showDebugOutput = GM_getValue('showDebugOutput', false);

    // 创建浮动窗口容器
    const floatingContainer = document.createElement('div');
    floatingContainer.style.cssText = `
        position: fixed;
        top: 50%;
        right: -35px;
        transform: translateY(-50%);
        width: 40px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 5px;
        background-color: rgba(255, 255, 255, 0.8);
        padding: 5px;
        border-radius: 10px 0 0 10px;
        box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        transition: right 0.3s;
    `;
    document.body.appendChild(floatingContainer);

    // 创建管理按钮
    const manageButton = document.createElement('div');
    manageButton.innerHTML = '⚙️';
    manageButton.style.cssText = `
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 20px;
        text-align: center;
        line-height: 30px;
    `;
    manageButton.title = '管理网站';
    floatingContainer.appendChild(manageButton);

    // 创建调试输出框
    const debugOutput = document.createElement('textarea');
    debugOutput.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        height: 200px;
        z-index: 10000;
        background-color: rgba(255, 255, 255, 0.9);
        border: 1px solid #ccc;
        padding: 5px;
        font-size: 12px;
        resize: both;
        display: ${showDebugOutput ? 'block' : 'none'};
    `;
    document.body.appendChild(debugOutput);

    // 日志函数
    function log(message) {
        const timestamp = new Date().toISOString();
        debugOutput.value += `[${timestamp}] ${message}\n`;
        debugOutput.scrollTop = debugOutput.scrollHeight;
        console.log(message);
    }

    // 创建图标的函数
    function createIcon(site) {
        const icon = document.createElement('div');
        icon.style.cssText = `
            width: 30px;
            height: 30px;
            background-image: url('https://www.google.com/s2/favicons?domain=${site.url}');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            cursor: pointer;
            transition: transform 0.2s;
        `;
        icon.title = new URL(site.url).hostname + (site.fuzzyMatch ? ' (模糊匹配)' : '');
        icon.addEventListener('mouseover', () => {
            icon.style.transform = 'scale(1.1)';
        });
        icon.addEventListener('mouseout', () => {
            icon.style.transform = 'scale(1)';
        });
        return icon;
    }

    // 创建图标并添加事件监听器
    function createAndAddIcon(site) {
        const icon = createIcon(site);
        icon.addEventListener('dragover', (e) => {
            e.preventDefault();
            icon.style.transform = 'scale(1.2)';
            showFloatingContainer();
        });

        icon.addEventListener('dragleave', () => {
            icon.style.transform = 'scale(1)';
        });

        icon.addEventListener('drop', (e) => {
            e.preventDefault();
            icon.style.transform = 'scale(1)';
            const draggedUrl = e.dataTransfer.getData('text/plain');
            if (draggedUrl) {
                log(`拖放URL: ${draggedUrl}`);
                redirectWithReferrer(site.url, draggedUrl);
            }
        });

        floatingContainer.appendChild(icon);
    }

    // 初始化图标
    function initIcons() {
        floatingContainer.innerHTML = ''; // 清空现有图标
        floatingContainer.appendChild(manageButton);
        sites.forEach(createAndAddIcon);
        log('图标已初始化');
    }

    initIcons();

    // 格式化 URL 的函数
    function formatUrl(url) {
        if (!/^https?:\/\//i.test(url)) {
            return 'https://' + url;
        }
        return url;
    }

    function redirectWithReferrer(refererUrl, targetUrl) {
        log(`准备重定向: 从 ${refererUrl} 到 ${targetUrl}`);
        GM_setValue('targetUrl', formatUrl(targetUrl));
        GM_openInTab(refererUrl, {active: true, insert: true, setParent: true});
    }

    // 检查是否需要重定向
    const currentHostname = window.location.hostname;
    const currentPath = window.location.pathname;
    log(`当前页面: ${currentHostname}${currentPath}`);
    
    const matchingSite = sites.find(site => {
        const siteHostname = new URL(site.url).hostname;
        if (site.fuzzyMatch) {
            return currentHostname.includes(siteHostname) || siteHostname.includes(currentHostname);
        } else {
            return siteHostname === currentHostname && currentPath === '/';
        }
    });

    if (matchingSite) {
        const targetUrl = GM_getValue('targetUrl', null);
        if (targetUrl) {
            log(`检测到重定向目标: ${targetUrl}`);
            GM_setValue('targetUrl', null);

            // 尝试添加 meta 标签来设置 Referrer Policy
            const meta = document.createElement('meta');
            meta.name = 'referrer';
            meta.content = 'unsafe-url';
            document.head.appendChild(meta);
            log('已添加 referrer meta 标签');

            // 创建一个隐藏的链接并点击它
            const link = document.createElement('a');
            link.href = targetUrl;
            link.style.display = 'none';
            document.body.appendChild(link);
            log('已创建隐藏链接');

            // 使用 setTimeout 来确保链接被添加到 DOM 中
            setTimeout(() => {
                link.click();
                log('已触发链接点击');
            }, 500);
        } else {
            log('未检测到重定向目标');
        }
    }

    // 使所有链接可拖动
    document.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'A') {
            e.target.draggable = true;
            log(`链接已设置为可拖动: ${e.target.href}`);
        }
    });

    // 自动收缩功能
    let hideTimeout;
    function showFloatingContainer() {
        clearTimeout(hideTimeout);
        floatingContainer.style.right = '0px';
    }

    function hideFloatingContainer() {
        hideTimeout = setTimeout(() => {
            floatingContainer.style.right = '-35px';
        }, 1000);
    }

    // 当鼠标进入浮动容器时，保持显示状态
    floatingContainer.addEventListener('mouseenter', showFloatingContainer);

    // 当鼠标离开浮动容器时，开始计时隐藏
    floatingContainer.addEventListener('mouseleave', hideFloatingContainer);

    // 创建管理界面
    function createManageUI() {
        const uiContainer = document.createElement('div');
        uiContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 80%;
            max-height: 80%;
            overflow-y: auto;
        `;

        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
        `;
        closeButton.onclick = () => document.body.removeChild(uiContainer);

        const addForm = document.createElement('div');
        addForm.innerHTML = `
            <input type="text" id="newSiteUrl" placeholder="网站URL" style="width: 200px;">
            <label><input type="checkbox" id="newSiteFuzzyMatch"> 模糊匹配</label>
            <button id="addSite">添加网站</button>
        `;

        const debugSetting = document.createElement('div');
        debugSetting.innerHTML = `
            <label><input type="checkbox" id="showDebugOutput" ${showDebugOutput ? 'checked' : ''}> 显示调试输出</label>
        `;

        const siteList = document.createElement('ul');
        siteList.style.cssText = `
            list-style-type: none;
            padding: 0;
            margin-top: 20px;
        `;

        function updateSiteList() {
            siteList.innerHTML = '';
            sites.forEach((site, index) => {
                const li = document.createElement('li');
                li.style.marginBottom = '10px';
                li.innerHTML = `
                    <img src="https://www.google.com/s2/favicons?domain=${site.url}" style="width: 16px; height: 16px; vertical-align: middle;">
                    ${site.url}
                    <label><input type="checkbox" class="fuzzyMatch" data-index="${index}" ${site.fuzzyMatch ? 'checked' : ''}> 模糊匹配</label>
                    <button data-index="${index}" class="removeSite">删除</button>
                `;
                siteList.appendChild(li);
            });
        }

        updateSiteList();

        uiContainer.appendChild(closeButton);
        uiContainer.appendChild(addForm);
        uiContainer.appendChild(debugSetting);
        uiContainer.appendChild(siteList);
        document.body.appendChild(uiContainer);

        // 添加网站
        document.getElementById('addSite').onclick = () => {
            let url = document.getElementById('newSiteUrl').value.trim();
            const fuzzyMatch = document.getElementById('newSiteFuzzyMatch').checked;
            if (url) {
                url = formatUrl(url);
                sites.push({ url, fuzzyMatch });
                GM_setValue('customSites', sites);
                updateSiteList();
                initIcons();
                document.getElementById('newSiteUrl').value = '';
                document.getElementById('newSiteFuzzyMatch').checked = false;
                log(`已添加新网站: ${url} (模糊匹配: ${fuzzyMatch})`);
            }
        };

        // 删除网站和更新模糊匹配设置
        siteList.onclick = (e) => {
            if (e.target.classList.contains('removeSite')) {
                const index = e.target.getAttribute('data-index');
                const removedSite = sites[index];
                sites.splice(index, 1);
                GM_setValue('customSites', sites);
                updateSiteList();
                initIcons();
                log(`已删除网站: ${removedSite.url}`);
            } else if (e.target.classList.contains('fuzzyMatch')) {
                const index = e.target.getAttribute('data-index');
                sites[index].fuzzyMatch = e.target.checked;
                GM_setValue('customSites', sites);
                initIcons();
                log(`已更新模糊匹配设置: ${sites[index].url} (模糊匹配: ${sites[index].fuzzyMatch})`);
            }
        };

        // 更新调试输出设置
        document.getElementById('showDebugOutput').onchange = (e) => {
            showDebugOutput = e.target.checked;
            GM_setValue('showDebugOutput', showDebugOutput);
            debugOutput.style.display = showDebugOutput ? 'block' : 'none';
            log(`调试输出显示已${showDebugOutput ? '开启' : '关闭'}`);
        };
    }

    // 点击管理按钮时打开管理界面
    manageButton.onclick = createManageUI;

    // 初始隐藏浮动容器
    setTimeout(() => {
        floatingContainer.style.right = '-35px';
    }, 1000);

    // 当开始拖动链接时显示浮动容器
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'A') {
            showFloatingContainer();
        }
    });
})();
