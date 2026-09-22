/* ============================================================
   学径 MindPath · 图片文字识别（OCR）
   基于 Tesseract.js v5（浏览器端运行，图片不上传任何服务器）
   首次识别需下载中文 + 英文语言包（约 20MB）
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.MindPathOCR = factory(root);
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var worker = null;
  var workerBusy = false;

  async function getWorker(onProgress) {
    if (worker) return worker;
    var T = root.Tesseract;
    if (!T) throw new Error('OCR 引擎未加载，请检查网络连接后重试');
    worker = await T.createWorker('chi_sim+eng', 1, {
      logger: function (m) {
        if (typeof onProgress === 'function') onProgress(m);
      }
    });
    return worker;
  }

  async function recognize(file, onProgress) {
    if (workerBusy) throw new Error('已有识别任务正在进行，请稍候');
    workerBusy = true;
    try {
      var w = await getWorker(onProgress);
      var result = await w.recognize(file);
      return (result && result.data && result.data.text ? result.data.text : '').trim();
    } finally {
      workerBusy = false;
    }
  }

  return { recognize: recognize };
});
