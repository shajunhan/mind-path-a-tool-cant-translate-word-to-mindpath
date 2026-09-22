/* ============================================================
   学径 MindPath · 本地智能解析引擎
   输入文本 → 结构化思维导图 Markdown + 学习路径
   纯前端算法，不依赖任何网络服务
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MindPathParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 常用停用字（用于过滤无效二元组） ---------- */
  var STOP_TEXT = '的了是在我你他她它我们有和与就不也都会要以及等之中上下这那个一二三四五六七八九十百千万学习可以用到对从于而或但并更最很没被把让向为着过既';
  var STOP_SET = {};
  for (var i = 0; i < STOP_TEXT.length; i++) STOP_SET[STOP_TEXT[i]] = true;

  function isStopChar(ch) {
    if (/[0-9A-Za-z]/.test(ch)) return false;
    return !!STOP_SET[ch];
  }

  /* ---------- 步骤类句子的识别规则 ---------- */
  var STEP_RE = [
    /^第[一二三四五六七八九十百千万\d]+[步阶段章节]/,
    /^[一二三四五六七八九十]+[、.．]/,
    /^\d{1,2}[、.．)]/,
    /^(首先|然后|接着|其次|最后|最终|第一步|第二步|第三步)/,
    /^(步骤|阶段)\s*[一二三四五六七八九十\d]/
  ];

  /* 句中含顺序副词也算步骤（但"实践/练习"开头的句子优先归实践类） */
  function isStepSentence(s) {
    if (STEP_RE.some(function (r) { return r.test(s); })) return true;
    if (/(首先|然后|接着|其次|最后|最终)/.test(s)) {
      if (/^(实践|练习|实操|动手|案例|通过)/.test(s)) return false;
      return true;
    }
    return false;
  }

  /* ---------- 文本清洗 ---------- */
  function cleanText(raw) {
    return String(raw || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* ---------- 按标点切句 ---------- */
  function splitSentences(text) {
    return text
      .split(/(?<=[。！？!?；;\n])/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 1; });
  }

  /* ---------- 提取主题标题 ---------- */
  function extractTitle(text, lines) {
    var firstLine = '';
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 0) { firstLine = lines[i].trim(); break; }
    }
    if (firstLine && firstLine.length <= 30 && !/[。！？!?；;]/.test(firstLine)) return firstLine;

    var patterns = [
      /^(?:我想|想要|希望)学习(.{2,24})/,
      /^(?:如何|怎样|怎么)学习(.{2,24})/,
      /^什么是(.{2,24})/,
      /^学习(.{2,24})/,
      /^(?:掌握|了解|熟悉)(.{2,24})/
    ];
    for (var p = 0; p < patterns.length; p++) {
      var m = text.match(patterns[p]);
      if (m) {
        var t = m[1].replace(/[，。！？!?；;\s].*$/, '').slice(0, 18);
        if (t.length >= 2) return t;
      }
    }
    var first = splitSentences(text)[0] || '';
    return (first.length > 18 ? first.slice(0, 18) + '…' : first) || '学习主题';
  }

  /* ---------- 句子的二元组（相邻字对）集合 ---------- */
  function bigramsOf(sentence) {
    var chars = sentence.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
    var grams = {};
    for (var i = 0; i < chars.length - 1; i++) {
      var a = chars[i], b = chars[i + 1];
      if (isStopChar(a) || isStopChar(b)) continue;
      grams[a + b] = true;
    }
    return Object.keys(grams);
  }

  /* ---------- 按高频词聚类剩余句子，形成知识分支 ---------- */
  function clusterSentences(sentences) {
    var gramCount = {};
    var sentGrams = sentences.map(bigramsOf);
    sentences.forEach(function (s, i) {
      sentGrams[i].forEach(function (g) { gramCount[g] = (gramCount[g] || 0) + 1; });
    });
    var top = Object.keys(gramCount)
      .filter(function (g) { return gramCount[g] >= 2; })
      .sort(function (a, b) { return gramCount[b] - gramCount[a]; })
      .slice(0, 6);

    var clusters = {};
    top.forEach(function (g) { clusters[g] = []; });
    var rest = [];

    for (var i = 0; i < sentences.length; i++) {
      var best = null, bestScore = 0;
      for (var j = 0; j < top.length; j++) {
        var g = top[j];
        if (sentGrams[i].indexOf(g) !== -1 && sentGrams[i].length > bestScore) {
          bestScore = sentGrams[i].length;
          best = g;
        }
      }
      if (best && clusters[best].length < 6) clusters[best].push(sentences[i]);
      else rest.push(sentences[i]);
    }

    var out = [];
    top.forEach(function (g) { if (clusters[g].length) out.push({ topic: g, items: clusters[g] }); });
    if (rest.length) out.push({ topic: '_其他', items: rest });
    return out;
  }

  /* ---------- 句子分类 ---------- */
  function classify(sentences) {
    var b = { goal: [], core: [], tools: [], practice: [], steps: [], notes: [], other: [] };
    sentences.forEach(function (s) {
      if (/^(我想|我想要|我的目标|目标是|最终目标|学习目标|我打算)/.test(s)) b.goal.push(s);
      else if (isStepSentence(s)) b.steps.push(s);
      else if (/(概念|定义|什么是|本质|原理|要素|核心)/.test(s)) b.core.push(s);
      else if (/(注意|误区|易错|坑|建议|技巧|提醒|不要|避免|错误|重点|切记)/.test(s)) b.notes.push(s);
      else if (/(练习|实践|项目|实验|实操|动手|案例|训练|作业|实战)/.test(s)) b.practice.push(s);
      else if (/(工具|软件|平台|网站|库|框架|编辑器|环境|插件|App|安装|下载|命令)/.test(s)) b.tools.push(s);
      else b.other.push(s);
    });
    return b;
  }

  /* ---------- 清洗步骤句：去掉前导序词与铺垫 ---------- */
  function cleanStep(s) {
    return s
      .replace(/^.*?(?=(?:首先|然后|接着|最后|最终|第[一二三四五六七八九十\d]+[步阶段]))/, '')
      .replace(/^(?:首先|然后|接着|最后|最终|第[一二三四五六七八九十\d]+[步阶段])/, '')
      .trim();
  }

  /* ---------- 生成思维导图 Markdown ---------- */
  function buildMarkdown(title, b, knowledge) {
    var md = '# ' + title + '\n';
    function add(heading, items) {
      if (!items.length) return;
      md += '\n## ' + heading + '\n';
      items.forEach(function (it) { md += '- ' + it + '\n'; });
    }
    add('🎯 学习目标', b.goal);
    add('🎯 核心概念', b.core);

    if (knowledge.length) {
      md += '\n## 📚 知识点\n';
      knowledge.forEach(function (k) {
        if (k.topic === '_其他') {
          k.items.forEach(function (it) { md += '- ' + it + '\n'; });
        } else {
          md += '### ' + k.topic + '\n';
          k.items.forEach(function (it) { md += '- ' + it + '\n'; });
        }
      });
    }

    add('🛠 工具与资源', b.tools);
    add('✍️ 实践应用', b.practice);
    add('💡 注意事项', b.notes);

    if (b.steps.length) {
      md += '\n## 🚀 学习步骤\n';
      b.steps.forEach(function (it, idx) {
        md += (idx + 1) + '. ' + cleanStep(it) + '\n';
      });
    }
    return md;
  }

  /* ---------- 生成学习路径 ---------- */
  function buildLearningPath(title, b, knowledge) {
    function days(n) { return Math.max(1, Math.round(n / 2)); }
    var stages = [];

    var goalItems = b.goal.length
      ? b.goal.slice(0, 3)
      : ['明确主题：「' + title + '」', '写下想达到的水平与期限', '收集 2~3 份权威参考资料'];
    stages.push({
      icon: '🎯',
      title: '明确学习目标',
      duration: '1 天',
      items: goalItems,
      tip: '目标越具体，路径越清晰。用一句话描述学习终点。'
    });

    stages.push({
      icon: '📖',
      title: '基础入门 · 核心概念',
      duration: days(b.core.length || 3) + ' 天',
      items: b.core.length ? b.core.slice(0, 5) : ['了解领域的基本术语与定义', '建立整体知识框架', '阅读入门教材或课程第一章'],
      tip: '先搭骨架，不求细节；理解关键术语之间的关联。'
    });

    var kItems = [];
    knowledge.forEach(function (k) {
      if (k.topic === '_其他') kItems = kItems.concat(k.items.slice(0, 2));
      else kItems.push(k.topic + '：' + (k.items[0] || '').slice(0, 24));
    });

    stages.push({
      icon: '🧩',
      title: '知识深化 · 分块攻克',
      duration: days(Math.max(kItems.length, 3)) + ' 天',
      items: kItems.length ? kItems.slice(0, 6) : ['把内容拆成小模块逐个学习', '边学边做笔记与小结', '每周回顾一次已学内容'],
      tip: '大目标拆小模块，逐个击破，先广后深。'
    });

    stages.push({
      icon: '🛠',
      title: '动手实践 · 应用练习',
      duration: days(b.practice.length || 3) + ' 天',
      items: b.practice.length ? b.practice.slice(0, 5) : ['完成 3~5 个小型练习', '把概念套用到真实场景', '记录遇到的问题与解法'],
      tip: '实践是检验理解的唯一标准，动手优先。'
    });

    var stepItems = b.steps.length
      ? b.steps.map(cleanStep).filter(function (s) { return s.length > 0; })
      : [];

    stages.push({
      icon: '🗺',
      title: '综合进阶 · 项目实战',
      duration: days(stepItems.length || 4) + ' 天',
      items: stepItems.length ? stepItems.slice(0, 5) : ['完成一个综合性小项目', '输出学习笔记或作品', '向他人讲解所学内容'],
      tip: '把所学整合成完整作品，是最好的复习方式。'
    });

    var extra = b.notes.concat(b.tools).slice(0, 4);
    if (extra.length) {
      stages.push({
        icon: '🧠',
        title: '巩固与拓展',
        duration: days(2) + ' 天',
        items: extra,
        tip: '复盘易错点与常用工具，查漏补缺，构建自己的知识体系。'
      });
    }

    var totalDays = stages.reduce(function (a, s) { return a + (parseInt(s.duration, 10) || 1); }, 0);
    return { stages: stages, totalDays: totalDays };
  }

  /* ---------- 统计要点数量 ---------- */
  function countLeaves(md) {
    var n = (md.match(/^- /gm) || []).length;
    n += (md.match(/^\d+\. /gm) || []).length;
    return n;
  }

  /* ---------- 主入口 ---------- */
  function parse(raw) {
    var text = cleanText(raw);
    var lines = text.split('\n');
    var title = extractTitle(text, lines);
    var sentences = splitSentences(text).filter(function (s) { return s !== title; });
    var b = classify(sentences);
    var knowledge = clusterSentences(b.other);
    var markdown = buildMarkdown(title, b, knowledge);
    var learningPath = buildLearningPath(title, b, knowledge);
    return {
      title: title,
      markdown: markdown,
      learningPath: learningPath,
      meta: {
        ai: false,
        sentenceCount: sentences.length,
        nodeCount: countLeaves(markdown),
        stageCount: learningPath.stages.length,
        totalDays: learningPath.totalDays
      }
    };
  }

  return { parse: parse };
});
