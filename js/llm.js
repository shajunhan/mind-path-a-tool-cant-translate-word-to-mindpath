/* ============================================================
   学径 MindPath · 可选 AI 深度解析
   对接 OpenAI 兼容接口（DeepSeek / OpenAI / 本地 Ollama 等）
   用户在设置中自行配置 endpoint + apiKey + model
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MindPathLLM = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYSTEM_PROMPT = [
    '你是一位资深学习规划导师。用户会提供一段学习主题或素材（文字，或从图片识别出的文字）。',
    '请完成两件事，并且只输出一个 JSON 对象（不要输出任何其他文字、注释或 Markdown 代码块标记）：',
    '{',
    '  "title": "简洁的学习主题（15 字以内）",',
    '  "mindmap": "思维导图 Markdown：第一行为 # 主题；二级标题 ## 为分支（例如 核心概念、知识模块、工具资源、实践步骤、注意事项）；三级标题 ### 为子模块；列表项 - 为具体要点。层次清晰、不超过 4 层，共 15~40 个要点",',
    '  "learningPath": [',
    '    { "icon": "emoji", "title": "阶段名", "duration": "X 天", "items": ["要点1","要点2"], "tip": "一条简短学习建议" }',
    '  ]',
    '}',
    '学习路径包含 4~6 个阶段，按照 目标 → 基础 → 深化 → 实践 → 拓展 的思路设计，每个阶段 2~4 个要点。'
  ].join('\n');

  function extractJSON(text) {
    var cleaned = String(text)
      .replace(/```[a-zA-Z]*\s*/g, '')
      .replace(/```/g, '')
      .trim();
    var start = cleaned.indexOf('{');
    var end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('AI 返回内容格式异常');
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  function contentOfMessage(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map(function (part) { return part && (part.text || ''); })
        .join('');
    }
    return '';
  }

  async function generate(text, settings) {
    var base = String(settings.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 150000);
    try {
      var res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (settings.apiKey || '')
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: String(text).slice(0, 12000) }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        var detail = '';
        try {
          var errData = await res.json();
          detail = (errData && errData.error && errData.error.message) || '';
        } catch (e) { /* 忽略解析失败 */ }
        throw new Error('API 请求失败（' + res.status + '）' + (detail ? '：' + detail : ''));
      }

      var data = await res.json();
      var content = '';
      if (data && data.choices && data.choices.length && data.choices[0].message) {
        content = contentOfMessage(data.choices[0].message.content);
      }
      if (!content) throw new Error('AI 未返回内容');

      var parsed = extractJSON(content);
      var mindmap = String(parsed.mindmap || '').trim();
      if (!mindmap) throw new Error('AI 返回缺少思维导图');
      if (mindmap.charAt(0) !== '#') {
        mindmap = '# ' + (parsed.title || '学习主题') + '\n' + mindmap;
      }
      if (!Array.isArray(parsed.learningPath) || !parsed.learningPath.length) {
        throw new Error('AI 返回缺少学习路径');
      }

      var totalDays = parsed.learningPath.reduce(function (a, s) {
        return a + (parseInt(String(s.duration || '1'), 10) || 1);
      }, 0);

      return {
        title: String(parsed.title || '学习主题').slice(0, 30),
        markdown: mindmap,
        learningPath: { stages: parsed.learningPath, totalDays: totalDays },
        meta: {
          ai: true,
          nodeCount: (mindmap.match(/^- /gm) || []).length,
          stageCount: parsed.learningPath.length,
          totalDays: totalDays
        }
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { generate: generate };
});
