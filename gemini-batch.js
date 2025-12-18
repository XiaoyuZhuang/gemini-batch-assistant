// ==UserScript==
// @name         Gemini 批量问答助手 (防误触版 v3.4)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  v3.3 基础上改进：将多题分割符更改为 "，，，" 或 ",,,"，避免省略号导致误判。
// @author       GeminiUser
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置区域 =================
    const CONFIG = {
        cooldownBeforeSend: 2000,
        checkInterval: 800,
        toolbarSelector: '.leading-actions-wrapper', 
        inputSelector: '.ql-editor',
        sendBtnSelector: '.send-button',
        stopIconSelector: 'mat-icon[data-mat-icon-name="stop"]', 
    };

    // ================= 状态变量 =================
    let queue = [];
    let isRunning = false;
    let isInternalCooling = false;

    // ================= 样式注入 =================
    const css = `
        .batch-inject-btn {
            display: inline-flex; align-items: center; justify-content: center;
            width: 40px; height: 40px; border-radius: 50%; border: none;
            background: transparent; color: #c4c7c5; cursor: pointer;
            transition: background 0.2s, color 0.2s; position: relative; margin-right: 4px;
        }
        .batch-inject-btn:hover { background: rgba(255, 255, 255, 0.08); color: #e3e3e3; }
        .batch-inject-btn.running { color: #8ab4f8; }
        
        .batch-badge {
            position: absolute; top: 2px; right: 2px;
            background: #d93025; color: white; border-radius: 10px;
            padding: 0 4px; font-size: 10px; min-width: 14px;
            height: 14px; line-height: 14px; text-align: center; display: none;
        }

        #batch-panel {
            position: absolute; bottom: 60px; left: 20px; width: 380px;
            background: #1e1f20; border: 1px solid #444746; border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: none; z-index: 9999;
            font-family: 'Roboto', sans-serif; color: #e3e3e3; overflow: hidden;
            flex-direction: column;
        }
        
        .bp-header {
            padding: 12px 16px; background: #2b2c2d; border-bottom: 1px solid #444746;
            display: flex; justify-content: space-between; align-items: center;
            font-size: 14px; font-weight: 500;
        }
        .bp-close { cursor: pointer; opacity: 0.6; font-size: 18px; }
        .bp-close:hover { opacity: 1; }
        
        .bp-body { padding: 12px; border-bottom: 1px solid #444746; }
        .bp-textarea {
            width: 100%; height: 60px; background: #303134; border: 1px solid #5f6368;
            border-radius: 8px; color: white; padding: 8px; resize: none;
            font-size: 13px; box-sizing: border-box; outline: none; display: block; margin-bottom: 8px;
        }
        .bp-textarea:focus { border-color: #8ab4f8; }

        .bp-controls { display: flex; gap: 8px; }
        .bp-btn {
            border: none; padding: 6px 0; border-radius: 18px; font-size: 12px;
            cursor: pointer; font-weight: 500; flex: 1; transition: opacity 0.2s;
        }
        .bp-btn:hover { opacity: 0.8; }
        .btn-add { background: #3c4043; color: #a8c7fa; border: 1px solid #5f6368; flex:0 0 70px;}
        .btn-run { background: #1b6ef3; color: white; }
        .btn-pause { background: #e2e2e2; color: #1f1f1f; }
        .btn-clear { background: transparent; color: #c4c7c5; border: 1px solid #5f6368; }

        .bp-list { max-height: 300px; overflow-y: auto; }
        .bp-item { 
            padding: 8px 12px; border-bottom: 1px solid #303134; font-size: 13px; 
            display: flex; align-items: center;
        }
        .bp-item:last-child { border-bottom: none; }
        .bp-item:hover { background: #2b2c2d; }
        .bp-item.status-done { text-decoration: line-through; opacity: 0.5; }
        .bp-item.status-processing { background: #353b48; color: #a8c7fa; }

        .bp-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; background: #444746; white-space: nowrap;}
        .tag-p { color: #c4c7c5; }
        .tag-r { background: #1b6ef3; color: white; }
        .tag-d { background: #1e8e3e; color: white; }

        .bp-actions {
            display: flex; gap: 4px; margin-left: auto; padding-left: 8px;
            opacity: 0.2; transition: opacity 0.2s;
        }
        .bp-item:hover .bp-actions { opacity: 1; }
        .bp-icon-btn {
            background: transparent; border: none; color: #9aa0a6; cursor: pointer;
            padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
        }
        .bp-icon-btn:hover { background: #444746; color: #e3e3e3; }
        .btn-del:hover { color: #ff8b8b; background: #5c2b2b; }

        .bp-insert-row {
            background: #232425; padding: 8px 12px; border-bottom: 1px solid #444746;
            animation: slideDown 0.2s ease-out;
        }
        .bp-insert-tools { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .bp-btn-sm { padding: 4px 12px; border-radius: 12px; font-size: 11px; border:none; cursor: pointer; }
        .btn-confirm { background: #1b6ef3; color: white; }
        .btn-cancel { background: #444746; color: #e3e3e3; }

        @keyframes slideDown { from { height: 0; opacity: 0; } to { height: auto; opacity: 1; } }
        
        .bp-status-bar { font-size: 11px; color: #8ab4f8; padding: 4px 16px 8px 16px; text-align: right; border-top: 1px solid #444746; background: #2b2c2d;}
    `;
    GM_addStyle(css);

    // ================= 辅助函数：安全创建 SVG =================
    function createSvgIcon(pathData, size = 18) {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("width", size.toString());
        svg.setAttribute("height", size.toString());

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathData);
        
        svg.appendChild(path);
        return svg;
    }

    const PATHS = {
        list: "M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z",
        trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
        add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
    };

    // ================= 核心逻辑 =================
    function isGeminiBusy() {
        const stopIcon = document.querySelector(CONFIG.stopIconSelector);
        if (stopIcon && stopIcon.offsetParent !== null) return true;

        const sendBtn = document.querySelector(CONFIG.sendBtnSelector);
        if (!sendBtn) return true;

        const style = window.getComputedStyle(sendBtn);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
        return false;
    }

    function simulateInput(text) {
        const editor = document.querySelector(CONFIG.inputSelector);
        if (!editor) return false;
        editor.focus();
        editor.textContent = ''; 
        const p = document.createElement('p');
        p.textContent = text;
        editor.appendChild(p);
        editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        return true;
    }

    function simulateSend() {
        const sendBtn = document.querySelector(CONFIG.sendBtnSelector);
        if (sendBtn && sendBtn.getAttribute('aria-disabled') !== 'true') {
            sendBtn.click();
            return true;
        }
        return false;
    }

    // 队列主循环
    function processingLoop() {
        const statusEl = document.getElementById('bp-status-text');
        const runBtn = document.getElementById('bp-btn-run');
        const mainBtn = document.getElementById('batch-inject-btn');

        if (mainBtn) {
            if (isRunning) mainBtn.classList.add('running');
            else mainBtn.classList.remove('running');
        }

        if (!isRunning) {
            if(statusEl) statusEl.textContent = '已暂停';
            if(runBtn) { runBtn.textContent = '开始执行'; runBtn.className = 'bp-btn btn-run'; }
            return;
        }
        
        if(runBtn) { runBtn.textContent = '暂停'; runBtn.className = 'bp-btn btn-pause'; }

        const nextItem = queue.find(item => item.status === 'pending');
        if (!nextItem) {
            isRunning = false;
            if(statusEl) statusEl.textContent = '全部完成';
            renderList();
            return;
        }

        if (isInternalCooling) {
            if(statusEl) statusEl.textContent = '冷却等待...';
            return;
        }

        if (isGeminiBusy()) {
            if(statusEl) statusEl.textContent = 'Gemini 思考中...';
            return;
        }

        nextItem.status = 'processing';
        renderList();
        if(statusEl) statusEl.textContent = '正在输入...';

        if (!simulateInput(nextItem.text)) {
            nextItem.status = 'pending';
            return;
        }

        isInternalCooling = true;

        setTimeout(() => {
            if (isGeminiBusy()) {
                nextItem.status = 'pending';
                isInternalCooling = false;
                renderList();
                return;
            }

            if (simulateSend()) {
                nextItem.status = 'done';
                if(statusEl) statusEl.textContent = '已发送';
            } else {
                nextItem.status = 'pending';
            }
            
            renderList();
            updateBadge();
            setTimeout(() => { isInternalCooling = false; }, 1000);
        }, CONFIG.cooldownBeforeSend);
    }

    // ================= UI 构建 =================

    function createPanel() {
        if (document.getElementById('batch-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'batch-panel';
        panel.style.display = 'none';
        
        // Header
        const header = document.createElement('div');
        header.className = 'bp-header';
        
        const title = document.createElement('span');
        title.textContent = '📚 批量问答队列';
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'bp-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = togglePanel;

        header.appendChild(title);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'bp-body';
        
        const textarea = document.createElement('textarea');
        textarea.id = 'bp-input';
        textarea.className = 'bp-textarea';
        // --- 文案更新：提示用户使用逗号分割 ---
        textarea.placeholder = '输入问题，Enter加入，Shift+Enter换行\n支持 "，，，" 或 ",,," 分割';
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addQueue();
            }
        });
        body.appendChild(textarea);

        // Controls
        const controls = document.createElement('div');
        controls.className = 'bp-controls';
        
        const btnAdd = document.createElement('button');
        btnAdd.className = 'bp-btn btn-add';
        btnAdd.textContent = '+ 尾部追加';
        btnAdd.onclick = addQueue;
        controls.appendChild(btnAdd);

        const btnRun = document.createElement('button');
        btnRun.id = 'bp-btn-run';
        btnRun.className = 'bp-btn btn-run';
        btnRun.textContent = '开始执行';
        btnRun.onclick = () => { isRunning = !isRunning; processingLoop(); };
        controls.appendChild(btnRun);

        const btnClear = document.createElement('button');
        btnClear.className = 'bp-btn btn-clear';
        btnClear.textContent = '清空';
        btnClear.onclick = () => { queue = []; renderList(); updateBadge(); };
        controls.appendChild(btnClear);

        body.appendChild(controls);
        panel.appendChild(body);

        // List
        const list = document.createElement('div');
        list.id = 'bp-list';
        list.className = 'bp-list';
        panel.appendChild(list);

        // Status
        const statusBar = document.createElement('div');
        statusBar.className = 'bp-status-bar';
        statusBar.id = 'bp-status-text';
        statusBar.textContent = '就绪';
        panel.appendChild(statusBar);

        document.body.appendChild(panel);
    }

    function injectButton() {
        if (document.getElementById('batch-inject-btn')) return;

        const toolbar = document.querySelector(CONFIG.toolbarSelector);
        if (!toolbar) return;

        const btn = document.createElement('button');
        btn.id = 'batch-inject-btn';
        btn.className = 'batch-inject-btn';
        btn.title = "批量提问队列";
        
        const svgIcon = createSvgIcon(PATHS.list, 24);
        btn.appendChild(svgIcon);
        
        const badge = document.createElement('div');
        badge.id = 'batch-inject-badge';
        badge.className = 'batch-badge';
        btn.appendChild(badge);

        btn.onclick = togglePanel;

        toolbar.insertBefore(btn, toolbar.firstChild);
    }

    function togglePanel() {
        const panel = document.getElementById('batch-panel');
        if (!panel) {
            createPanel();
            setTimeout(togglePanel, 0); 
            return;
        }
        
        if (panel.style.display === 'flex') {
            panel.style.display = 'none';
        } else {
            const inputArea = document.querySelector('input-area-v2') || document.querySelector('.input-area');
            if (inputArea) {
                const rect = inputArea.getBoundingClientRect();
                panel.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                panel.style.left = rect.left + 'px';
            }
            panel.style.display = 'flex';
            setTimeout(() => document.getElementById('bp-input')?.focus(), 100);
        }
    }

    // --- 核心修改：文本解析工具 ---
    function parseInput(raw) {
        if (!raw) return [];
        // 修改为仅匹配 "，，，" (全角) 或 ",,," (半角)
        return raw.split(/，，，|,,,/g).map(t => t.trim()).filter(t => t.length > 0);
    }

    function addQueue() {
        const input = document.getElementById('bp-input');
        const texts = parseInput(input.value);
        if (!texts.length) return;

        texts.forEach(t => {
            queue.push({ id: Date.now() + Math.random(), text: t, status: 'pending' });
        });
        input.value = '';
        renderList();
        updateBadge();
    }

    function insertQueue(index, rawText) {
        const texts = parseInput(rawText);
        if (!texts.length) return;
        
        const newItems = texts.map(t => ({
            id: Date.now() + Math.random(),
            text: t,
            status: 'pending'
        }));

        queue.splice(index + 1, 0, ...newItems);
        renderList();
        updateBadge();
    }

    function deleteItem(index) {
        queue.splice(index, 1);
        renderList();
        updateBadge();
    }

    function showInsertBox(index, afterElement) {
        document.querySelectorAll('.bp-insert-row').forEach(el => el.remove());

        const row = document.createElement('div');
        row.className = 'bp-insert-row';
        
        const textarea = document.createElement('textarea');
        textarea.className = 'bp-textarea';
        textarea.style.height = '50px';
        // --- 文案更新 ---
        textarea.placeholder = '插入问题 (支持 ,,, 或 ，，， 分割)';
        
        const tools = document.createElement('div');
        tools.className = 'bp-insert-tools';
        
        const btnOk = document.createElement('button');
        btnOk.className = 'bp-btn-sm btn-confirm';
        btnOk.textContent = '确认插入';
        btnOk.onclick = () => {
            insertQueue(index, textarea.value);
        };

        const btnCancel = document.createElement('button');
        btnCancel.className = 'bp-btn-sm btn-cancel';
        btnCancel.textContent = '取消';
        btnCancel.onclick = () => row.remove();

        tools.appendChild(btnCancel);
        tools.appendChild(btnOk);
        row.appendChild(textarea);
        row.appendChild(tools);

        afterElement.after(row);
        textarea.focus();
    }

    function renderList() {
        const list = document.getElementById('bp-list');
        if (!list) return;
        
        while (list.firstChild) list.removeChild(list.firstChild);
        
        queue.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = `bp-item status-${item.status}`;
            
            const text = document.createElement('span');
            text.style.flex = '1';
            text.style.whiteSpace = 'nowrap';
            text.style.overflow = 'hidden';
            text.style.textOverflow = 'ellipsis';
            text.style.marginRight = '8px';
            text.textContent = `${idx+1}. ${item.text}`;
            row.appendChild(text);
            
            if (item.status !== 'pending') {
                const tag = document.createElement('span');
                tag.className = 'bp-tag';
                if(item.status==='processing') { tag.textContent='输入中'; tag.classList.add('tag-r');}
                if(item.status==='done') { tag.textContent='完成'; tag.classList.add('tag-d');}
                row.appendChild(tag);
            }

            const actions = document.createElement('div');
            actions.className = 'bp-actions';

            const btnInsert = document.createElement('button');
            btnInsert.className = 'bp-icon-btn';
            btnInsert.title = '在该题下方插入';
            btnInsert.appendChild(createSvgIcon(PATHS.add));
            btnInsert.onclick = (e) => {
                e.stopPropagation();
                showInsertBox(idx, row);
            };
            actions.appendChild(btnInsert);

            const btnDel = document.createElement('button');
            btnDel.className = 'bp-icon-btn btn-del';
            btnDel.title = '删除该题';
            btnDel.appendChild(createSvgIcon(PATHS.trash));
            btnDel.onclick = (e) => {
                e.stopPropagation();
                deleteItem(idx);
            };
            actions.appendChild(btnDel);

            row.appendChild(actions);
            list.appendChild(row);
        });
    }

    function updateBadge() {
        const badge = document.getElementById('batch-inject-badge');
        if (!badge) return;
        const count = queue.filter(x => x.status === 'pending').length;
        if (count > 0) {
            badge.style.display = 'block';
            badge.textContent = count;
        } else {
            badge.style.display = 'none';
        }
    }

    const observer = new MutationObserver((mutations) => {
        if (!document.getElementById('batch-inject-btn')) {
            injectButton();
        }
    });

    window.addEventListener('load', () => {
        createPanel();
        injectButton();
        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(processingLoop, CONFIG.checkInterval);
    });

})();
