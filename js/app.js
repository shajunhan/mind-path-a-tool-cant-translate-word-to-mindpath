/* ============================================================
   学径 MindPath · 主应用逻辑
   视图切换 / 思维导图渲染（markmap）/ 学习路径 / 导出 / 设置
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var SETTINGS_KEY = 'mindpath.settings.v1';
  var DRAFT_KEY = 'mindpath.draft.v1';
  var PROGRESS_KEY = 'mindpath.progress.v1';
  var REPO_KEY = 'mindpath.repo.v1';

  var SAMPLE = [
    '我想学习编程，成为一名全栈开发者。',
    '',
    '编程的核心概念包括变量、数据类型、函数、循环、条件判断和面向对象编程，理解这些基础概念是学习编程的第一步。',
    '',
    '学习编程可以按照这样的路径：首先选择 Python 或 JavaScript 学习基础语法，然后学习数据结构和算法，接着练习前端开发（HTML、CSS、JavaScript 及框架），再学习后端开发（Node.js、数据库），最后通过项目实战把知识串联起来。',
    '',
    '常用的开发工具包括 VS Code 代码编辑器、Git 版本控制工具、Chrome 开发者工具，以及 GitHub 代码托管平台。',
    '',
    '学习过程中要注意避免只看不练的误区，一定要动手写代码；遇到报错不要慌张，学会阅读错误信息并搜索解决方案；还要注意循序渐进，不要贪多求快。',
    '',
    '实践方面，可以从做一个简单的个人网站开始，然后逐步挑战更复杂的项目，比如待办事项应用、博客系统、电商网站等。'
  ].join('\n');

  var els = {
    inputView: $('#inputView'),
    resultView: $('#resultView'),
    backBtn: $('#backBtn'),
    modeSeg: $$('#modeSeg .seg-btn'),
    textMode: $('#textMode'),
    imageMode: $('#imageMode'),
    textInput: $('#textInput'),
    charCount: $('#charCount'),
    sampleBtn: $('#sampleBtn'),
    clearBtn: $('#clearBtn'),
    dropzone: $('#dropzone'),
    fileInput: $('#fileInput'),
    previewWrap: $('#previewWrap'),
    previewImg: $('#previewImg'),
    removeImg: $('#removeImg'),
    ocrBtn: $('#ocrBtn'),
    ocrProgress: $('#ocrProgress'),
    ocrBar: $('#ocrBar'),
    ocrLabel: $('#ocrLabel'),
    ocrTextWrap: $('#ocrTextWrap'),
    ocrText: $('#ocrText'),
    generateBtn: $('#generateBtn'),
    resultTitle: $('#resultTitle'),
    resultMeta: $('#resultMeta'),
    tabSeg: $$('#tabSeg .seg-btn'),
    mindmapTab: $('#mindmapTab'),
    pathTab: $('#pathTab'),
    mindmapBox: $('#mindmapWrap'),
    btnFit: $('#btnFit'),
    btnExpand: $('#btnExpand'),
    btnCollapse: $('#btnCollapse'),
    btnPng: $('#btnPng'),
    btnMd: $('#btnMd'),
    pathSummary: $('#pathSummary'),
    pathStages: $('#pathStages'),
    btnJson: $('#btnJson'),
    loading: $('#loading'),
    loadingText: $('#loadingText'),
    sheet: $('#settingsSheet'),
    sheetBackdrop: $('#settingsSheetBackdrop'),
    sheetOpen: $('#sheetOpen'),
    sheetClose: $('#sheetClose'),
    aiToggle: $('#aiToggle'),
    endpoint: $('#endpoint'),
    apiKey: $('#apiKey'),
    model: $('#model'),
    aiHint: $('#aiHint'),
    settingsSave: $('#settingsSave'),
    settingsCancel: $('#settingsCancel'),
    toast: $('#toast'),
    /* 仓库 */
    repoOpen: $('#repoOpen'),
    repoView: $('#repoView'),
    repoList: $('#repoList'),
    repoEmpty: $('#repoEmpty'),
    repoCount: $('#repoCount'),
    saveRepoBtn: $('#saveRepoBtn'),
    /* 导出图片 */
    btnPathPng: $('#btnPathPng'),
    pathExportArea: $('#pathExportArea'),
    pathExportTitle: $('#pathExportTitle'),
    pathExportDate: $('#pathExportDate')
  };

  var state = {
    mode: 'text',
    imageFile: null,
    result: null,
    markdown: '',
    mm: null,
    mmData: null,
    mmLineMap: [],
    mmEdit: null,
    progress: {},
    repo: [],
    repoCurrentId: null,
    delArm: null,
    loadingTimer: null,
    toastTimer: null
  };

  var PALETTE = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff', '#ffd60a'];

  /* ===================== 通用工具 ===================== */
  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* 忽略 */ }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeName(t) {
    return String(t).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30) || 'mindpath';
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function hashTitle(t) {
    var h = 7;
    for (var i = 0; i < t.length; i++) h = ((h * 31 + t.charCodeAt(i)) >>> 0);
    return h.toString(36);
  }

  /* ===================== 轻提示 ===================== */
  function toast(msg, ms) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, ms || 2600);
  }

  /* ===================== 加载遮罩 ===================== */
  function showLoading(firstText) {
    els.loading.classList.remove('hidden');
    setLoadingText(firstText || '正在分析内容…');
    var msgs = ['正在理解你的内容…', '正在提取核心概念…', '正在构建知识结构…', '正在规划学习路径…', '马上就好…'];
    var i = 0;
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(function () {
      i = (i + 1) % msgs.length;
      setLoadingText(msgs[i]);
    }, 2200);
  }
  function setLoadingText(t) { els.loadingText.textContent = t; }
  function hideLoading() {
    els.loading.classList.add('hidden');
    clearInterval(state.loadingTimer);
  }

  /* ===================== 视图切换 ===================== */
  function showView(name) {
    els.inputView.classList.toggle('hidden', name !== 'input');
    els.resultView.classList.toggle('hidden', name !== 'result');
    els.repoView.classList.toggle('hidden', name !== 'repo');
    els.backBtn.classList.toggle('hidden', name === 'input');
    if (name === 'repo') renderRepo();
    if (name === 'input') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
      document.title = (state.result ? state.result.title + ' · ' : '') + '学径 MindPath';
    }
  }

  /* ===================== 仓库（本地保存的学习资料库） ===================== */
  function loadRepo() {
    try { return JSON.parse(localStorage.getItem(REPO_KEY)) || []; } catch (e) { return []; }
  }
  function persistRepo() {
    try { localStorage.setItem(REPO_KEY, JSON.stringify(state.repo)); } catch (e) { /* 忽略 */ }
  }
  function fmtDate(ts) {
    var d = new Date(ts || Date.now());
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function saveToRepo() {
    if (!state.result) { toast('请先生成思维导图'); return; }
    var item = {
      id: state.repoCurrentId || 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: state.result.title,
      markdown: state.markdown,
      learningPath: state.result.learningPath,
      meta: state.result.meta || {},
      updatedAt: Date.now()
    };
    var idx = state.repo.findIndex(function (i) { return i.id === item.id; });
    if (idx >= 0) state.repo[idx] = item; else state.repo.unshift(item);
    state.repoCurrentId = item.id;
    persistRepo();
    renderRepo();
    toast(idx >= 0 ? '已更新到仓库 ✓' : '已保存到仓库 ✓');
  }
  function renderRepo() {
    els.repoCount.textContent = state.repo.length + ' 项';
    els.repoEmpty.classList.toggle('hidden', state.repo.length > 0);
    els.repoList.innerHTML = '';
    state.repo.forEach(function (it) {
      var lp = it.learningPath || { stages: [], totalDays: 0 };
      var m = it.meta || {};
      var card = document.createElement('div');
      card.className = 'card repo-card';
      card.innerHTML =
        '<div class="repo-card-main" data-act="open" data-id="' + it.id + '">' +
          '<h3>' + escapeHtml(it.title) + '</h3>' +
          '<p>' + fmtDate(it.updatedAt) + ' · ' + lp.stages.length + ' 个阶段 · 约 ' + (m.totalDays || lp.totalDays || 0) + ' 天 · ' + (m.nodeCount || 0) + ' 个要点</p>' +
        '</div>' +
        '<div class="repo-card-btns">' +
          '<button class="repo-btn open-btn" data-act="open" data-id="' + it.id + '">打开</button>' +
          '<button class="repo-btn" data-act="rename" data-id="' + it.id + '">重命名</button>' +
          '<button class="repo-btn del-btn" data-act="del" data-id="' + it.id + '">删除</button>' +
        '</div>';
      els.repoList.appendChild(card);
    });
  }
  function openRepoItem(id) {
    var it = state.repo.find(function (i) { return i.id === id; });
    if (!it) { toast('未找到该项目'); return; }
    state.repoCurrentId = it.id;
    state.result = {
      title: it.title,
      markdown: it.markdown,
      learningPath: it.learningPath,
      meta: it.meta || {}
    };
    renderResult(state.result, !!(it.meta && it.meta.ai));
    showView('result');
    toast('已打开「' + it.title + '」，可直接编辑');
  }
  function renameRepoItem(id) {
    var it = state.repo.find(function (i) { return i.id === id; });
    if (!it) return;
    var name = window.prompt('重命名', it.title);
    if (name === null) return;
    name = String(name).trim();
    if (!name) { toast('名称不能为空'); return; }
    it.title = name.slice(0, 30);
    it.updatedAt = Date.now();
    persistRepo();
    renderRepo();
    if (state.repoCurrentId === id && state.result) {
      state.result.title = it.title;
      els.resultTitle.textContent = it.title;
    }
    toast('已重命名');
  }
  function deleteRepoItem(id) {
    if (state.delArm && state.delArm.id === id) {
      clearTimeout(state.delArm.timer);
      state.delArm = null;
      state.repo = state.repo.filter(function (i) { return i.id !== id; });
      if (state.repoCurrentId === id) state.repoCurrentId = null;
      persistRepo();
      renderRepo();
      toast('已删除');
      return;
    }
    var btn = els.repoList.querySelector('.del-btn[data-id="' + id + '"]');
    if (btn) { btn.classList.add('confirm'); btn.textContent = '确认删除'; }
    state.delArm = { id: id, timer: setTimeout(function () {
      state.delArm = null;
      var b = els.repoList.querySelector('.del-btn[data-id="' + id + '"]');
      if (b) { b.classList.remove('confirm'); b.textContent = '删除'; }
    }, 3000) };
  }

  /* ===================== 输入模式 ===================== */
  function setMode(mode) {
    state.mode = mode;
    els.modeSeg.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    els.textMode.classList.toggle('hidden', mode !== 'text');
    els.imageMode.classList.toggle('hidden', mode !== 'image');
  }

  function updateCharCount() {
    var n = els.textInput.value.length;
    els.charCount.textContent = n > 0 ? n + ' 字' : '';
  }

  /* ===================== 图片处理 ===================== */
  function handleFile(file) {
    if (!file || file.type.indexOf('image/') !== 0) { toast('请选择图片文件（JPG / PNG / WebP）'); return; }
    state.imageFile = file;
    var reader = new FileReader();
    reader.onload = function (e) {
      els.previewImg.src = e.target.result;
      els.previewWrap.classList.remove('hidden');
      els.dropzone.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  }
  function clearImage() {
    state.imageFile = null;
    els.fileInput.value = '';
    els.previewWrap.classList.add('hidden');
    els.dropzone.classList.remove('has-image');
    els.ocrTextWrap.classList.add('hidden');
    els.ocrText.value = '';
    els.ocrBar.style.width = '0';
    hideOcrProgress();
  }
  function showOcrProgress() { els.ocrProgress.classList.remove('hidden'); }
  function hideOcrProgress() { els.ocrProgress.classList.add('hidden'); }
  function setOcrProgress(pct, label) {
    els.ocrBar.style.width = (pct == null ? 30 + Math.random() * 30 : pct) + '%';
    els.ocrLabel.textContent = label || '';
  }
  async function runOcr() {
    if (!state.imageFile) { toast('请先上传图片'); return; }
    els.ocrBtn.disabled = true;
    showOcrProgress();
    setOcrProgress(null, '正在加载识别引擎（首次需下载语言包，约 20MB）…');
    try {
      var text = await MindPathOCR.recognize(state.imageFile, function (m) {
        var status = (m && m.status) || '';
        if (status === 'recognizing text') setOcrProgress(m.progress * 100, '正在识别文字…');
        else if (/loading|initializing|loaded|ready/.test(status)) setOcrProgress(null, '正在加载识别引擎…');
      });
      if (text) {
        els.ocrText.value = text;
        els.ocrTextWrap.classList.remove('hidden');
        toast('识别完成，可修改后生成导图');
      } else {
        toast('未识别到文字，请换一张更清晰的图片');
      }
    } catch (err) {
      console.error(err);
      toast('识别失败：' + (err && err.message ? err.message : err));
    } finally {
      els.ocrBtn.disabled = false;
      hideOcrProgress();
    }
  }

  /* ===================== 生成 ===================== */
  async function generate() {
    var text;
    if (state.mode === 'text') {
      text = els.textInput.value.trim();
      if (!text) { toast('请先输入学习内容，或点「✨ 使用示例」'); els.textInput.focus(); return; }
    } else {
      text = els.ocrText.value.trim();
      if (!text) { toast('图片模式下请先点击「识别图中文字」，或手动填写内容'); return; }
    }

    els.generateBtn.disabled = true;
    els.generateBtn.classList.add('busy');
    showLoading();

    var usedAI = false;
    try {
      var s = getSettings();
      if (s.aiEnabled && s.endpoint && s.apiKey) {
        setLoadingText('AI 深度解析中，请稍候…');
        state.result = await MindPathLLM.generate(text, s);
        usedAI = true;
      } else {
        state.result = MindPathParser.parse(text);
      }
    } catch (err) {
      console.error('[MindPath] AI 解析失败，回退本地解析：', err);
      state.result = MindPathParser.parse(text);
      toast('AI 解析失败（' + (err && err.message ? err.message : '未知错误') + '），已自动使用本地解析', 4200);
    } finally {
      hideLoading();
      els.generateBtn.disabled = false;
      els.generateBtn.classList.remove('busy');
    }

    state.repoCurrentId = null; /* 新生成的内容与仓库暂未关联，保存时新建条目 */
    renderResult(state.result, usedAI);
  }

  function renderResult(result, usedAI) {
    state.markdown = result.markdown;
    switchTab('mindmap');
    showView('result');
    els.resultTitle.textContent = result.title;
    els.pathExportTitle.textContent = result.title + ' · 学习路径';
    els.pathExportDate.textContent = fmtDate();
    var m = result.meta || {};
    els.resultMeta.textContent = (usedAI ? 'AI 深度解析 · ' : '本地智能解析 · ') +
      (m.stageCount || result.learningPath.stages.length) + ' 个阶段 · 约 ' +
      (m.totalDays || result.learningPath.totalDays) + ' 天 · ' +
      (m.nodeCount || 0) + ' 个要点';
    renderMindmap(result.markdown);
    renderPath(result);
  }

  /* ===================== 思维导图 ===================== */
  function renderMindmap(md) {
    try {
      /* 确保 markmap 需要的 <svg> 容器存在（渲染失败重试时可能被错误提示替换过） */
      if (!els.mindmapBox.querySelector('svg')) {
        els.mindmapBox.innerHTML = '<svg id="mindmap"></svg>';
        state.mm = null;
      }
      var wm = window.markmap;
      if (!wm || !wm.Transformer || !wm.Markmap) throw new Error('导图组件未加载，请检查网络连接');
      var transformer = new wm.Transformer();
      var data = transformer.transform(md);
      var root = data && data.root ? data.root : data;
      state.mmData = root;

      var options = {
        duration: 300,
        spacingVertical: 8,
        spacingHorizontal: 72,
        paddingX: 20,
        initialExpandLevel: 2,
        maxWidth: 260,
        fitRatio: 0.95,
        zoom: true,
        pan: true,
        color: function (node) { return PALETTE[(node.depth || 0) % PALETTE.length]; }
      };

      if (!state.mm) {
        state.mm = wm.Markmap.create('#mindmap', options, root);
      } else {
        state.mm.setData(root, options);
      }
      state.mmLineMap = buildLineMap(root, md);
      setTimeout(function () { if (state.mm) state.mm.fit(); }, 80);
    } catch (e) {
      console.error(e);
      els.mindmapBox.innerHTML = '<div class="mm-error">思维导图渲染失败：' + escapeHtml(e.message || e) + '</div>';
      toast('思维导图渲染失败：' + (e.message || e));
    }
  }

  /* ---------- 导图节点 → markdown 行号 映射（用于在线编辑） ---------- */
  function decodeHtmlEntities(s) {
    var d = document.createElement('div');
    d.innerHTML = String(s);
    return d.textContent || '';
  }
  function lineVisualText(line) {
    return String(line)
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+\.\s*/, '')
      .trim();
  }
  function buildLineMap(root, md) {
    var lines = String(md).split('\n');
    var map = [];
    var li = 0;
    (function walk(n) {
      var vn = decodeHtmlEntities(n.content).trim();
      var matched = false;
      while (!matched && li < lines.length) {
        if (lineVisualText(lines[li]) === vn) { map.push({ line: li }); li++; matched = true; }
        else li++;
      }
      if (!matched) map.push({ line: -1 });
      if (n.children) n.children.forEach(walk);
    })(root);
    return map;
  }
  /* ---------- 双击节点在线编辑（捕获阶段监听，绕开 d3-zoom 的 stopPropagation） ---------- */
  function initMindmapEdit() {
    els.mindmapBox.addEventListener('dblclick', function (e) {
      var g = e.target && e.target.closest ? e.target.closest('.markmap-node') : null;
      if (!g || !state.mmData) return;
      var fo = g.querySelector('.markmap-foreign') || g;
      var text = (fo.textContent || '').trim();
      if (!text) return;
      var depth = parseInt(g.getAttribute('data-depth') || '1', 10);
      var idx = resolveNodeIdx(text, depth);
      if (idx < 0) { toast('无法定位该节点'); return; }
      e.preventDefault();
      e.stopPropagation();
      startNodeEdit(g, idx);
    }, true);
  }
  /* 按（渲染文本 + 深度）在树中定位节点序号，与 buildLineMap 的顺序一致 */
  function resolveNodeIdx(text, renderedDepth) {
    var treeDepth = Math.max(0, renderedDepth - 1);
    var idx = 0;
    var found = -1;
    (function walk(n, d) {
      if (found >= 0) return;
      if (d === treeDepth && decodeHtmlEntities(n.content).trim() === text) { found = idx; return; }
      idx++;
      if (n.children) n.children.forEach(function (c) { walk(c, d + 1); });
    })(state.mmData, 0);
    return found;
  }
  function startNodeEdit(g, idx) {
    var fo = g.querySelector('.markmap-foreign') || g;
    var oldText = (fo.textContent || '').trim();
    if (!oldText) return;
    removeNodeEdit();
    var boxRect = els.mindmapBox.getBoundingClientRect();
    var tRect = fo.getBoundingClientRect();
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'mm-edit-input';
    input.value = oldText;
    input.style.left = Math.max(4, tRect.left - boxRect.left) + 'px';
    input.style.top = Math.max(4, tRect.top - boxRect.top - 6) + 'px';
    input.style.width = Math.max(90, tRect.width + 28) + 'px';
    els.mindmapBox.appendChild(input);
    state.mmEdit = { idx: idx, oldText: oldText, input: input };
    input.focus();
    input.select();
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') finishNodeEdit(true);
      if (ev.key === 'Escape') finishNodeEdit(false);
    });
    input.addEventListener('blur', function () { finishNodeEdit(true); });
    input.addEventListener('click', function (ev) { ev.stopPropagation(); });
  }
  function finishNodeEdit(commit) {
    var ed = state.mmEdit;
    if (!ed) return;
    state.mmEdit = null; /* 先置空，防止 remove() 触发的 blur 事件重入 */
    var v = ed.input.value.trim();
    var idx = ed.idx;
    var oldText = ed.oldText;
    ed.input.remove();
    if (commit && v && v !== oldText) commitNodeEdit(idx, oldText, v);
  }
  function removeNodeEdit() {
    if (state.mmEdit) {
      state.mmEdit.input.remove();
      state.mmEdit = null;
    }
  }
  function commitNodeEdit(idx, oldText, newText) {
    var entry = state.mmLineMap[idx];
    if (!entry || entry.line < 0) { toast('无法定位该节点，已忽略'); return; }
    var lines = state.markdown.split('\n');
    var line = lines[entry.line];
    var m = line.match(/^(#{1,6}\s+|[-*]\s+|\d+\.\s*)/);
    var prefix = m ? m[1] : '';
    lines[entry.line] = prefix + newText;
    state.markdown = lines.join('\n');
    renderMindmap(state.markdown);
    toast('已修改：' + newText);
  }

  function mmSetExpand(level) {
    if (!state.mm || !state.mmData) return;
    state.mm.setData(state.mmData, { initialExpandLevel: level });
    setTimeout(function () { if (state.mm) state.mm.fit(); }, 80);
  }

  function exportPng() {
    if (!state.mmData) { toast('暂无可导出的导图'); return; }
    try {
      var scale = 2;
      var lineH = 26, gapX = 48, pad = 36, radius = 6;
      var font = '13px ' + getComputedStyle(document.body).fontFamily;
      var measure = document.createElement('canvas').getContext('2d');
      measure.font = font;
      function textWidth(t) { return Math.ceil(measure.measureText(t).width); }
      function leafCount(n) {
        if (!n.children || !n.children.length) return 1;
        return n.children.reduce(function (a, c) { return a + leafCount(c); }, 0);
      }
      /* 布局：经典叶子计数法（父子水平展开） */
      var nodes = [];
      var offset = 0;
      var maxRight = 0;
      (function walk(n, depth, x) {
        var cnt = leafCount(n);
        var y = (offset + (cnt - 1) / 2) * lineH;
        var t = decodeHtmlEntities(n.content).trim();
        var w = Math.max(24, textWidth(t));
        var node = { text: t, x: x, y: y, w: w, depth: depth };
        n.__pos = nodes.length;
        nodes.push(node);
        if (n.children && n.children.length) {
          offset += cnt;
          n.children.forEach(function (c) { walk(c, depth + 1, x + Math.max(90, w + gapX)); });
        } else {
          offset += 1;
        }
        maxRight = Math.max(maxRight, x + w + radius + 6);
      })(state.mmData, 0, pad);

      var W = Math.ceil(maxRight + pad), H = Math.ceil(offset * lineH + pad);
      var canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      var ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.font = font;
      ctx.textBaseline = 'middle';

      /* 连线（父 → 子） */
      (function walk(n) {
        if (!n.children) return;
        var p = nodes[n.__pos];
        n.children.forEach(function (c, i) {
          if (c.__pos == null) return;
          var ch = nodes[c.__pos];
          ctx.strokeStyle = PALETTE[ch.depth % PALETTE.length];
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x + p.w + radius, p.y);
          ctx.bezierCurveTo(p.x + p.w + gapX * 0.6, p.y, ch.x - radius - gapX * 0.6, ch.y, ch.x - radius, ch.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      })(state.mmData);

      /* 节点圆 + 文字 */
      nodes.forEach(function (n) {
        var color = PALETTE[n.depth % PALETTE.length];
        var r = n.depth === 0 ? 9 : radius;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x + n.w + r, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1d1d1f';
        ctx.fillText(n.text, n.x, n.y);
      });

      canvas.toBlob(function (blob) {
        if (blob) downloadBlob(blob, '思维导图_' + safeName(state.result ? state.result.title : '') + '.png');
        else toast('导出失败');
      }, 'image/png');
    } catch (e) {
      console.error(e);
      toast('导出失败：' + (e.message || e));
    }
  }

  function copyMarkdown() {
    var text = state.markdown;
    function done() { toast('Markdown 已复制到剪贴板'); }
    function fail() { toast('复制失败，请手动复制'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { fail(); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /* ===================== 学习路径 ===================== */
  function progressKey() { return PROGRESS_KEY + '.' + hashTitle(state.result.title); }
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(progressKey())) || {}; } catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(progressKey(), JSON.stringify(state.progress)); } catch (e) { /* 忽略 */ }
  }

  function renderPath(result) {
    var stages = result.learningPath.stages;
    state.progress = loadProgress();

    els.pathSummary.innerHTML =
      '<div class="summary-stats">' +
        '<div class="stat"><b>' + stages.length + '</b><span>学习阶段</span></div>' +
        '<div class="stat"><b>' + result.learningPath.totalDays + '</b><span>预计天数</span></div>' +
        '<div class="stat"><b>' + (result.meta ? result.meta.nodeCount : 0) + '</b><span>知识要点</span></div>' +
      '</div>' +
      '<div class="summary-progress">' +
        '<div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>' +
        '<span class="progress-text" id="progressText">0%</span>' +
      '</div>';

    els.pathStages.innerHTML = '';
    stages.forEach(function (st, si) {
      var checked = state.progress[si] || [];
      var items = st.items.map(function (it, ii) {
        return '<li><label class="check">' +
          '<input type="checkbox" data-si="' + si + '" data-ii="' + ii + '"' + (checked.indexOf(ii) !== -1 ? ' checked' : '') + '>' +
          '<span class="box"></span>' +
          '<span class="txt editable path-item" contenteditable="true" spellcheck="false" data-si="' + si + '" data-ii="' + ii + '">' + escapeHtml(it) + '</span>' +
        '</label></li>';
      }).join('');

      var card = document.createElement('div');
      card.className = 'stage';
      card.innerHTML =
        '<div class="rail"><div class="dot">' + (st.icon || (si + 1)) + '</div><div class="line"></div></div>' +
        '<div class="stage-card">' +
          '<div class="stage-head">' +
            '<h3 class="editable path-title" contenteditable="true" spellcheck="false" data-si="' + si + '">' + (si + 1) + '. ' + escapeHtml(st.title) + '</h3>' +
            '<span class="chip editable path-chip" contenteditable="true" spellcheck="false" data-si="' + si + '">约 ' + escapeHtml(st.duration || '1 天') + '</span>' +
          '</div>' +
          '<ul class="stage-items">' + items + '</ul>' +
          (st.tip ? '<p class="stage-tip editable path-tip" contenteditable="true" spellcheck="false" data-si="' + si + '">💡 ' + escapeHtml(st.tip) + '</p>' : '') +
        '</div>';
      els.pathStages.appendChild(card);
    });

    updateProgress();
  }

  /* ---------- 学习路径在线编辑 ---------- */
  function syncPathEdit(el) {
    if (!state.result || !state.result.learningPath) return;
    var stages = state.result.learningPath.stages;
    var si = parseInt(el.getAttribute('data-si'), 10);
    if (isNaN(si) || !stages[si]) return;
    var text = (el.textContent || '').trim();
    if (el.classList.contains('path-title')) {
      var title = text.replace(/^\d+\.\s*/, '');
      stages[si].title = title;
      el.textContent = (si + 1) + '. ' + title;
    } else if (el.classList.contains('path-chip')) {
      var days = text.replace(/[^\d]/g, '') || '1';
      stages[si].duration = days + ' 天';
      el.textContent = '约 ' + days + ' 天';
    } else if (el.classList.contains('path-item')) {
      var ii = parseInt(el.getAttribute('data-ii'), 10);
      if (!isNaN(ii) && stages[si].items) {
        stages[si].items[ii] = text;
        el.textContent = text;
      }
    } else if (el.classList.contains('path-tip')) {
      stages[si].tip = text.replace(/^💡\s*/, '');
      el.textContent = '💡 ' + stages[si].tip;
    }
    /* 同步总天数与摘要统计 */
    var total = 0;
    stages.forEach(function (s) { total += (parseInt(String(s.duration || '1'), 10) || 1); });
    state.result.learningPath.totalDays = total;
    if (state.result.meta) state.result.meta.totalDays = total;
    var statDays = els.pathSummary ? els.pathSummary.querySelectorAll('.stat b')[1] : null;
    if (statDays) statDays.textContent = total;
  }

  function updateProgress() {
    var boxes = els.pathStages.querySelectorAll('input[type="checkbox"]');
    var checked = els.pathStages.querySelectorAll('input[type="checkbox"]:checked').length;
    var pct = boxes.length ? Math.round((checked / boxes.length) * 100) : 0;
    var fill = $('#progressFill');
    var text = $('#progressText');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = pct + '%';
  }

  function onPathCheckChange(e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'checkbox') return;
    var si = parseInt(t.getAttribute('data-si'), 10);
    var ii = parseInt(t.getAttribute('data-ii'), 10);
    if (isNaN(si) || isNaN(ii)) return;
    var arr = state.progress[si] || (state.progress[si] = []);
    var idx = arr.indexOf(ii);
    if (t.checked && idx === -1) arr.push(ii);
    if (!t.checked && idx !== -1) arr.splice(idx, 1);
    saveProgress();
    updateProgress();
  }

  function exportJson() {
    if (!state.result) { toast('暂无可导出的计划'); return; }
    var payload = {
      title: state.result.title,
      createdAt: new Date().toISOString(),
      mindmap: state.result.markdown,
      learningPath: state.result.learningPath.stages,
      totalDays: state.result.learningPath.totalDays
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
      '学习计划_' + safeName(state.result.title) + '.json'
    );
  }

  /* ---------- 学习路径导出为图片 ---------- */
  async function exportPathPng() {
    if (!state.result) { toast('暂无可导出的内容'); return; }
    if (!window.html2canvas) { toast('图片组件未加载，请检查网络连接'); return; }
    toast('正在生成图片…', 2000);
    try {
      var canvas = await window.html2canvas(els.pathExportArea, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      });
      canvas.toBlob(function (blob) {
        if (blob) downloadBlob(blob, '学习路径_' + safeName(state.result.title) + '.png');
        else toast('导出失败');
      }, 'image/png');
    } catch (e) {
      console.error(e);
      toast('导出失败：' + (e.message || e));
    }
  }

  /* ===================== 标签切换 ===================== */
  function switchTab(tab) {
    els.tabSeg.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    els.mindmapTab.classList.toggle('hidden', tab !== 'mindmap');
    els.pathTab.classList.toggle('hidden', tab !== 'path');
    if (tab === 'mindmap' && state.mm) {
      setTimeout(function () { if (state.mm) state.mm.fit(); }, 60);
    }
  }

  /* ===================== 设置面板 ===================== */
  function openSheet() {
    els.sheet.classList.add('open');
    els.sheetBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    els.sheet.classList.remove('open');
    els.sheetBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
  /* 兜底：文档级事件委托，确保任何情况下都能关闭设置面板 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#sheetClose') || t.closest('#settingsCancel')) { closeSheet(); return; }
    if (t.id === 'settingsSheetBackdrop') { closeSheet(); }
  });
  function syncAiFields() {
    var on = els.aiToggle.checked;
    ['endpoint', 'apiKey', 'model'].forEach(function (id) {
      var field = $('#' + id);
      if (field) field.closest('.field').style.display = on ? '' : 'none';
    });
    els.aiHint.classList.toggle('hidden', !on);
  }
  function saveSettingsFromUI() {
    saveSettings({
      aiEnabled: els.aiToggle.checked,
      endpoint: els.endpoint.value.trim(),
      apiKey: els.apiKey.value.trim(),
      model: els.model.value.trim()
    });
    toast('设置已保存');
    closeSheet();
  }

  /* ===================== 初始化 ===================== */
  function init() {
    /* 设置回显（预填常用默认值，便于快速粘贴 Key） */
    var s = getSettings();
    els.aiToggle.checked = !!s.aiEnabled;
    els.endpoint.value = s.endpoint || 'https://api.deepseek.com/v1';
    els.apiKey.value = s.apiKey || '';
    els.model.value = s.model || 'deepseek-chat';
    syncAiFields();

    /* 模式切换 */
    els.modeSeg.forEach(function (btn) {
      btn.addEventListener('click', function () { setMode(btn.getAttribute('data-mode')); });
    });
    els.tabSeg.forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
    });

    /* 文字输入 */
    try { els.textInput.value = localStorage.getItem(DRAFT_KEY) || ''; } catch (e) { /* 忽略 */ }
    updateCharCount();
    els.textInput.addEventListener('input', function () {
      updateCharCount();
      try { localStorage.setItem(DRAFT_KEY, els.textInput.value); } catch (e) { /* 忽略 */ }
    });
    els.sampleBtn.addEventListener('click', function () {
      els.textInput.value = SAMPLE;
      updateCharCount();
      try { localStorage.setItem(DRAFT_KEY, SAMPLE); } catch (e) { /* 忽略 */ }
      toast('已填入示例内容，点击「✨ 开始生成」试试');
    });
    els.clearBtn.addEventListener('click', function () {
      els.textInput.value = '';
      updateCharCount();
      try { localStorage.setItem(DRAFT_KEY, ''); } catch (e) { /* 忽略 */ }
      toast('已清空');
    });
    els.textInput.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
    });

    /* 图片输入 */
    els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
    els.fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    ['dragover', 'dragenter'].forEach(function (ev) {
      els.dropzone.addEventListener(ev, function (e) { e.preventDefault(); els.dropzone.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      els.dropzone.addEventListener(ev, function (e) { e.preventDefault(); els.dropzone.classList.remove('drag'); });
    });
    els.dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    els.removeImg.addEventListener('click', function (e) { e.stopPropagation(); clearImage(); });
    els.ocrBtn.addEventListener('click', runOcr);

    /* 生成 */
    els.generateBtn.addEventListener('click', generate);
    els.backBtn.addEventListener('click', function () { showView('input'); });

    /* 导图工具栏 */
    els.btnFit.addEventListener('click', function () { if (state.mm) state.mm.fit(); });
    els.btnExpand.addEventListener('click', function () { mmSetExpand(Infinity); });
    els.btnCollapse.addEventListener('click', function () { mmSetExpand(1); });
    els.btnPng.addEventListener('click', exportPng);
    els.btnMd.addEventListener('click', copyMarkdown);
    els.btnJson.addEventListener('click', exportJson);

    /* 设置 */
    els.sheetOpen.addEventListener('click', openSheet);
    els.sheetClose.addEventListener('click', closeSheet);
    els.sheetBackdrop.addEventListener('click', closeSheet);
    els.settingsCancel.addEventListener('click', closeSheet);
    els.aiToggle.addEventListener('change', syncAiFields);
    els.settingsSave.addEventListener('click', saveSettingsFromUI);

    /* 仓库 */
    state.repo = loadRepo();
    els.repoOpen.addEventListener('click', function () { showView('repo'); });
    els.saveRepoBtn.addEventListener('click', saveToRepo);
    els.repoList.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');
      if (act === 'open') openRepoItem(id);
      else if (act === 'rename') renameRepoItem(id);
      else if (act === 'del') deleteRepoItem(id);
    });

    /* 导出图片 */
    els.btnPathPng.addEventListener('click', exportPathPng);

    /* 在线编辑 */
    initMindmapEdit();
    els.pathStages.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('editable')) e.preventDefault();
    });
    ['input', 'blur'].forEach(function (ev) {
      els.pathStages.addEventListener(ev, function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('editable')) syncPathEdit(t);
      });
    });

    /* 学习路径进度 */
    els.pathStages.addEventListener('change', onPathCheckChange);

    /* 窗口变化时重适应导图 */
    window.addEventListener('resize', function () {
      if (state.mm && !els.resultView.classList.contains('hidden') && !els.mindmapTab.classList.contains('hidden')) {
        setTimeout(function () { if (state.mm) state.mm.fit(); }, 100);
      }
    });

    /* Esc 关闭设置 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });
  }

  init();
})();
