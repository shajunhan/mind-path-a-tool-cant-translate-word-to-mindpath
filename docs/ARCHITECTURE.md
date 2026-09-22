# 学径 MindPath · 架构与实现详解

本文档对「学径 MindPath」的整体架构、模块划分、数据流与核心算法进行系统性梳理。

---

## 1. 项目定位

一个**纯前端、零构建**的智能学习导图工具：输入一段文字或一张图片，自动转化为条理清晰的**思维导图**与可执行的**学习路径**。核心特色是**本地优先**——即使不配置 AI，也能通过内置的本地解析引擎生成结果。

## 2. 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│                        index.html                             │
│    入口页面（Apple 风格 UI，浅/深色自适应，移动端适配）         │
└──────────────┬───────────────────────────────────────────────┘
               │  加载
┌──────────────▼───────────────────────────────────────────────┐
│                         js/ 四个模块                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │ app.js    │  │ parser.js │  │ llm.js    │  │ ocr.js    │  │
│  │ 主控逻辑   │→ │ 本地解析   │  │ AI 深度    │  │ 图片OCR   │  │
│  │           │  │ 引擎(离线) │  │ 解析(可选) │  │ (Tesseract)│ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
└───────┬──────────────────────┬──────────────────┬────────────┘
        │ 按需 CDN              │                  │ 按需 CDN
┌───────▼───────┐      ┌───────▼───────┐  ┌───────▼───────┐
│  markmap      │      │  localStorage │  │ Tesseract.js  │
│ 思维导图渲染   │      │ 设置/仓库/进度 │  │ 中文+英文识别  │
└───────────────┘      └───────────────┘  └───────────────┘
```

**设计原则**：`app.js` 承担主控与 UI 绑定，`parser.js` / `llm.js` / `ocr.js` 三个纯逻辑模块互相独立、可替换，形成「本地解析 → AI 增强 → 失败回退」的多级能力。

## 3. 模块划分

| 模块 | 职责 | 关键函数 |
| --- | --- | --- |
| `app.js`（主控） | 设置管理、学习仓库、输入处理、生成调度、导图渲染/编辑、导出 | `getSettings`、`saveSettings`、`loadRepo`、`persistRepo`、`generate`、`renderMindmap`、`initMindmapEdit`、`exportPng`、`copyMarkdown` |
| `parser.js`（本地解析） | 无 AI 时把文字拆分为思维导图与学习路径 | `cleanText`、`splitSentences`、`clusterSentences`、`classify`、`buildMarkdown`、`buildLearningPath` |
| `llm.js`（AI 增强） | 调用 OpenAI 兼容接口生成结构化结果 | `generate`、`extractJSON`、`contentOfMessage` |
| `ocr.js`（图片识别） | 浏览器端 OCR 提取图片文字 | `getWorker`、`recognize` |
| `css/style.css` | Apple 风格样式 | — |

## 4. 数据流

```
 文字粘贴 / 图片(OCR)  →  generate()
        │
        ├─[AI 已配置] → llm.generate(text, settings)
        │                POST /chat/completions（OpenAI 兼容）
        │                解析返回 JSON { title, mindmap, learningPath }
        │                成功 → 用 AI 结果
        │                失败 → 自动回退到 parser.js
        │
        └─[本地解析]  → parser.parse(text)
                        句子清洗 → 分句 → 聚类 → 分类 → 构建 Markdown 导图 + 学习路径
        │
        ▼
    renderResult() → renderMindmap(markmap) + 学习路径卡片
        │
        ▼
   用户可勾选学习路径进度（persistRepo → localStorage）
```

## 5. 核心：本地解析引擎（parser.js）

即使离线、不配置 AI 也能出结果，是全项目**最重要的算法模块**：

```
parse(text)
  1. cleanText()        去噪、规整标点与空白
  2. splitSentences()   按标点切分为句子（isStepSentence 判断动作句）
  3. clusterSentences() 基于 bigramsOf()（二字共现）对句子做聚类分组
  4. classify()         给每个分组打分类标签（如核心概念 / 知识模块 / 工具资源 / 实践步骤 / 注意事项）
  5. buildMarkdown()    按 主题 → 二级分支 → 三级子模块 → 列表要点 组装为 Markdown 导图
  6. buildLearningPath() 按「目标 → 基础 → 深化 → 实践 → 拓展」生成 4~6 个阶段
                       （每阶段含 icon/标题/预计天数/要点/建议，days() 汇总总时长）
```

关键词：`isStopChar`（停用字符）、`extractTitle`（从文本提炼主题）、`clusterSentences`（无监督聚类，不依赖 AI）。

## 6. 核心：AI 深度解析（llm.js）

- 兼容任意 OpenAI Chat Completions 接口（DeepSeek / OpenAI / 本地 Ollama 等），用户在设置中自填 `endpoint + apiKey + model`，**Key 仅存本机 localStorage**；
- `generate()` 用 `fetch` POST `/chat/completions`，带 150s 超时（AbortController）；
- 系统提示词要求模型**只输出一个 JSON** `{ title, mindmap, learningPath }`；
- `extractJSON()` 剥离 Markdown 代码块后解析，并对返回结构做健壮性校验（导图首行须为 `#`、学习路径须为非空数组）；
- **失败自动回退**：任何异常（网络、超时、格式错误）都会被 `app.js` 捕获并降级到 `parser.js`，保证用户始终能得到结果。

## 7. 交互与渲染

- **思维导图**：`markmap`（CDN，v0.18）渲染 Markdown 为可交互导图——拖拽平移、滚轮缩放、节点折叠；`initMindmapEdit` 支持**节点内联编辑**、增删节点；
- **OCR**：`ocr.js` 复用 Tesseract Worker，识别 `chi_sim+eng`，首次约下载 20MB 语言包；
- **学习仓库**：解析结果可存入 `localStorage` 的多仓库结构，进度（勾选的学习路径阶段）持久化；
- **导出**：思维导图导出 PNG（Canvas 快照）、复制 Markdown；学习路径导出 JSON 计划。

## 8. 技术栈

| 层面 | 技术 |
| --- | --- |
| 架构 | 单页应用（SPA），无框架、无构建、无后端 |
| 语言 | 原生 HTML5 / CSS3 / JavaScript（ES6+） |
| 导图渲染 | markmap（CDN，按需加载） |
| 图片 OCR | Tesseract.js v5（CDN，按需加载） |
| 存储 | localStorage（设置 / 学习仓库 / 路径进度） |
| 深色模式 | `prefers-color-scheme` 跟随系统 |

## 9. 设计决策与扩展点

| 决策 | 权衡 |
| --- | --- |
| 本地解析 + AI 双引擎 | 保证离线可用；AI 是可选增强而非硬依赖，失败静默回退 |
| 无构建工具 | 双击 index.html 即用；代价是代码未做模块打包、需浏览器支持 ES 模块能力 |
| CDN 按需加载 markmap/Tesseract | 首屏轻量；但首次使用导图/OCR 需联网 |

**扩展建议**：打包 PWA（可安装到手机）、改造为小程序 / 跨端应用（Tauri、uni-app）、增加学习笔记存储与打卡提醒、AI 答疑等。

---

*本文档由源码逐模块梳理生成。*
