// pages/courier/courier.js —— 跑腿端
const { api, money, fmtTime, toast, fail } = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    isCourier: false,
    pin: '',
    tab: 'hall',       // hall | mine
    hall: [], mine: [],
    pollTimer: null
  },

  onShow() {
    app.ensureLogin().then(() => {
      if (app.globalData.role === 'courier' || app.globalData.role === 'owner') {
        this.setData({ isCourier: true });
        this.load();
        this.startPoll();
      } else {
        this.setData({ isCourier: false });
      }
    }).catch(fail);
  },

  onHide() { this.stopPoll(); },
  onUnload() { this.stopPoll(); },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh()); },

  startPoll() {
    this.stopPoll();
    this.data.pollTimer = setInterval(() => this.load(), 5000);
  },
  stopPoll() { if (this.data.pollTimer) { clearInterval(this.data.pollTimer); this.data.pollTimer = null; } },

  onPin(e) { this.setData({ pin: e.detail.value }); },

  claim() {
    api('claimRole', { pin: this.data.pin.trim() }).then(() => {
      app.refreshLogin();
      this.setData({ isCourier: true, pin: '' });
      toast('已加入跑腿队', 'success');
      this.load();
      this.startPoll();
    }).catch(fail);
  },

  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },

  load() {
    return api('getOrders', { scope: 'courier' }).then((d) => {
      const dec = (o) => {
        const v = Object.assign({}, o);
        v.timeText = fmtTime(o.created_at);
        v.totalText = money(o.total_amount);
        v.itemLines = o.items.map((i) => i.qty + ' × ' + i.name + '（' + i.spec_text + '）');
        return v;
      };
      this.setData({ hall: d.hall.map(dec), mine: d.mine.map(dec) });
    });
  },

  grab(e) {
    const o = this.data.hall[e.currentTarget.dataset.i];
    wx.showModal({
      title: '抢下这一单？', content: o.order_no + ' · 送到 ' + o.cust.dorm + ' ' + o.cust.room,
      confirmText: '抢单',
      success: (r) => {
        if (!r.confirm) return;
        api('orderOps', { orderId: o._id, op: 'grab' })
          .then(() => { toast('抢单成功！', 'success'); this.setData({ tab: 'mine' }); this.load(); })
          .catch(fail);
      }
    });
  },

  picked(e) {
    const o = this.data.mine[e.currentTarget.dataset.i];
    api('orderOps', { orderId: o._id, op: 'picked' }).then(() => { toast('开始配送'); this.load(); }).catch(fail);
  },

  delivered(e) {
    const o = this.data.mine[e.currentTarget.dataset.i];
    wx.showModal({
      title: '确认已送达？', content: '送到 ' + o.cust.dorm + ' ' + o.cust.room,
      success: (r) => {
        if (!r.confirm) return;
        api('orderOps', { orderId: o._id, op: 'delivered' }).then(() => { toast('已完成', 'success'); this.load(); }).catch(fail);
      }
    });
  },

  call(e) {
    const phone = e.currentTarget.dataset.p;
    if (phone) wx.makePhoneCall({ phoneNumber: phone });
  }
});
