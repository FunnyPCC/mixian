// pages/pay-qr/pay-qr.js —— 收款码支付页（聚合码 + 我已付款）
const { api, money, toast, fail } = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    order: null,      // {orderId, orderNo, total, qrFileid, qrTip}
    totalText: '',
    proofFileid: '',
    proofLocal: '',
    submitting: false
  },

  onLoad() {
    const order = app.globalData.lastOrder;
    if (!order) {
      toast('订单信息丢失');
      setTimeout(() => wx.switchTab({ url: '/pages/orders/orders' }), 800);
      return;
    }
    this.setData({ order, totalText: money(order.total) });
  },

  previewQr() {
    if (!this.data.order.qrFileid) { toast('店主还没上传收款码，请联系店主'); return; }
    wx.previewImage({ urls: [this.data.order.qrFileid] });
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.order.orderNo });
  },

  chooseProof() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => {
        const local = res.tempFiles[0].tempFilePath;
        this.setData({ proofLocal: local, proofFileid: '' });
        const ext = local.indexOf('.png') >= 0 ? '.png' : '.jpg';
        wx.cloud.uploadFile({
          cloudPath: 'proof/' + Date.now() + Math.random().toString(36).slice(2, 6) + ext,
          filePath: local
        }).then((r) => {
          this.setData({ proofFileid: r.fileID });
        }).catch(() => toast('凭证上传失败，可直接点我已付款'));
      }
    });
  },

  markPaid() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    api('markPaid', { orderId: this.data.order.orderId, proofFileid: this.data.proofFileid || null })
      .then(() => {
        toast('已通知店主确认到账', 'success');
        setTimeout(() => wx.switchTab({ url: '/pages/orders/orders' }), 900);
      })
      .catch((e) => { this.setData({ submitting: false }); fail(e); });
  },

  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); }
});
