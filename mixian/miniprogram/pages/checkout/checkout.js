// pages/checkout/checkout.js —— 确认订单
const { api, money, toast, fail } = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    store: null,
    cart: [],
    slotLabels: [],
    slots: [],
    slotIndex: 0,
    goods: '0.00',
    fee: '0.00',
    total: '0.00',
    form: { dorm: '', room: '', name: '', phone: '', note: '' },
    err: '',
    submitting: false
  },

  onLoad() {
    const store = app.globalData.store;
    const cart = app.globalData.cart.map((c) => Object.assign({}, c, {
      specText: c.spec.map((s) => s.g + ':' + s.n).join('，'),
      unitText: money(c.unit * c.qty)
    }));
    const slots = ((store && store.slots) || []).filter((s) => s.on);
    let goods = 0;
    cart.forEach((c) => { goods += c.unit * c.qty; });
    goods = Math.round(goods * 100) / 100;
    const fee = Number((store && store.delivery_fee) || 0);
    this.setData({
      store, cart, slots,
      slotLabels: slots.map((s) => s.start + ' - ' + s.end),
      goods: money(goods),
      fee: money(fee),
      total: money(goods + fee)
    });
    if (!slots.length) this.setData({ err: '店主暂未开放配送时段，无法下单' });
  },

  onInput(e) {
    const f = e.currentTarget.dataset.f;
    const form = Object.assign({}, this.data.form);
    form[f] = e.detail.value;
    this.setData({ form });
  },

  onSlot(e) { this.setData({ slotIndex: Number(e.detail.value) }); },

  submit() {
    if (this.data.submitting) return;
    const { form, slots, slotIndex } = this.data;
    if (!slots.length) { this.setData({ err: '店主暂未开放配送时段' }); return; }
    if (!form.dorm.trim() || !form.room.trim()) { this.setData({ err: '请填写宿舍楼栋和房间号' }); return; }
    if (!form.name.trim()) { this.setData({ err: '请填写称呼' }); return; }
    if (!/^1\d{10}$/.test(form.phone.trim())) { this.setData({ err: '请填写11位手机号' }); return; }
    this.setData({ err: '', submitting: true });
    const idemKey = 'ik' + Date.now() + Math.random().toString(36).slice(2, 6);
    api('createOrder', {
      slot_id: slots[slotIndex].id,
      idem_key: idemKey,
      cust: { name: form.name.trim(), phone: form.phone.trim(), dorm: form.dorm.trim(), room: form.room.trim(), note: form.note.trim() },
      items: app.globalData.cart.map((c) => {
        const spec = {};
        c.spec.forEach((s) => {
          if (!s.gid || !s.oid) return;
          if (!spec[s.gid]) spec[s.gid] = [];
          spec[s.gid].push(s.oid);
        });
        return { dish_id: c.dish_id, qty: c.qty, spec };
      })
    }).then((order) => {
      app.globalData.cart = [];
      app.globalData.lastOrder = {
        orderId: order._id, orderNo: order.order_no,
        total: order.total_amount, qrFileid: order.qr_fileid, qrTip: order.qr_tip
      };
      wx.redirectTo({ url: '/pages/pay-qr/pay-qr' });
    }).catch((e) => {
      this.setData({ submitting: false, err: e.message || '下单失败' });
    });
  }
});
