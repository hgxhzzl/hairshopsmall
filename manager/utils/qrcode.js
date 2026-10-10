/**
 * QR 码生成器 — 基于 qrcode-generator 官方库 (Kazuhiko Arase)
 * https://github.com/kazuhikoarase/qrcode-generator
 */
var qrg = require('./qrcode-lib');

/**
 * 在 Canvas 2D 上绘制 QR 码
 * @param {Canvas} canvas  微信小程序 Canvas 2D 节点
 * @param {String} text    编码内容
 * @param {Object} options { width: 画布尺寸(px) }
 * @returns {Boolean} 是否成功
 */
function drawQRCodeToCanvas(canvas, text, options) {
  var width = (options && options.width) || 280;

  // typeNumber=0 自动选择版本, EC Level='M'
  var qr = qrg(0, 'M');
  qr.addData(text);
  qr.make();

  var moduleCount = qr.getModuleCount();
  var quiet = 2;                          // 2 模块静区
  var totalMods = moduleCount + quiet * 2;
  var modSize = Math.floor(width / totalMods);
  var offset = quiet * modSize + Math.floor((width - totalMods * modSize) / 2);

  var ctx = canvas.getContext('2d');
  var dpr = (wx.getSystemInfoSync().pixelRatio) || 2;
  canvas.width = width * dpr;
  canvas.height = width * dpr;
  ctx.scale(dpr, dpr);

  // 白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, width);

  // 绘制黑色模块
  ctx.fillStyle = '#000000';
  for (var r = 0; r < moduleCount; r++) {
    for (var c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(offset + c * modSize, offset + r * modSize, modSize, modSize);
      }
    }
  }

  return true;
}

module.exports = {
  drawQRCodeToCanvas: drawQRCodeToCanvas
};
