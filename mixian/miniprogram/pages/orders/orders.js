// pages/orders/orders.js —— 顾客订单列表
const { api, money, fmtTime, toast, fail } = require('../../utils/api.js');
const app = getApp();

const ST_CLASS = {
  '待付款': 'UNPAID', '待确认收款': 'PEND', '已支付(待接单)': 'PAID', '制作中': 'COOK',
  '待配送': 'WAIT', '待取餐': 'PICK', '配送中': 'DELI', '已完成': 'DONE',
  '已取消(待退款)': 'C_REFUND', '已取消(已退款)': 'C_DONE', '已关闭': 'CLOSED'
};

Page({
  data: { list: [], loaded: false },

  onShow() {
    app.ensureLogin().then(() => this.load()).catch(fail);
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load() {
    return api('getOrders', { scope: 'mine' }).then((d) => {
      const list = d.list.map((o) => {
        const v = Object.assign({}, o);
        v.stClass = ST_CLASS[o.status] || 'UNPAID';
        v.timeText = fmtTime(o.created_at);
        v.totalText = money(o.total_amount);
        v.itemText = o.items.map((i) => i.name + '×' + i.qty).join('、');
        v.canPay = o.status === '待付款';
        v.canMark = o.status === '待付款';
        v.canCancel = o.status === '待付款' || o.status === '待确认收款';
        v.lastNote = (o.timeline && o.timeline.length) ? o.timeline[o.timeline.length - 1].note : '';
        return v;
      });
      this.setData({ list, loaded: true });
    });
  },

  goPay(e) {
    const o = this.data.list[e.currentTarget.dataset.i];
    app.globalData.lastOrder = {
      orderId: o._id, orderNo: o.order_no, total: o.total_amount,
      qrFileid: o.qr_fileid, qrTip: o.qr_tip
    };
    wx.navigateTo({ url: '/pages/pay-qr/pay-qr' });
  },

  markPaid(e) {
    const o = this.data.list[e.currentTarget.dataset.i];
    wx.showModal({
      title: '确认已付款？',
      content: '请先通过收款码完成付款（¥' + money(o.total_amount) + '），店主确认到账后订单才会生效。',
      confirmText: '我已付款',
      success: (r) => {
        if (!r.confirm) return;
        api('markPaid', { orderId: o._id }).then(() => { toast('已通知店主确认'); this.load(); }).catch(fail);
      }
    });
  },

  cancel(e) {
    const o = this.data.list[e.currentTarget.dataset.i];
    wx.showModal({
      title: '取消订单？', content: '订单 ' + o.order_no + ' 将被取消', confirmText: '取消订单',
      success: (r) => {
        if (!r.confirm) return;
        api('orderOps', { orderId: o._id, op: 'cancel' }).then(() => { toast('订单已取消'); this.load(); }).catch(fail);
      }
    });
  }
});
