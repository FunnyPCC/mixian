// pages/owner/owner.js —— 店主工作台
const { api, money, fmtTime, toast, fail } = require('../../utils/api.js');
const app = getApp();

const ST_CLASS = {
  '待付款': 'UNPAID', '待确认收款': 'PEND', '已支付(待接单)': 'PAID', '制作中': 'COOK',
  '待配送': 'WAIT', '待取餐': 'PICK', '配送中': 'DELI', '已完成': 'DONE',
  '已取消(待退款)': 'C_REFUND', '已取消(已退款)': 'C_DONE', '已关闭': 'CLOSED'
};

Page({
  data: {
    isOwner: false,
    pin: '',
    tab: 'orders',        // orders | menu | set
    // 订单
    pendList: [], todoList: [], doingList: [], doneList: [],
    pendCount: 0,
    // 菜单
    cats: [], dishes: [],
    catName: '',
    // 设置
    store: null,
    form: {},
    slotStart: '11:00', slotEnd: '13:30',
    modeLabels: ['抢单制（跑腿自己抢）', '指派制（店主指派）'],
    modeIndex: 0,
    couriers: [],
    pollTimer: null
  },

  onShow() {
    app.ensureLogin().then(() => {
      if (app.globalData.role === 'owner') {
        this.setData({ isOwner: true });
        this.loadAll();
        this.startPoll();
      } else {
        this.setData({ isOwner: false });
      }
    }).catch(fail);
  },

  onHide() { this.stopPoll(); },
  onUnload() { this.stopPoll(); },

  startPoll() {
    this.stopPoll();
    this.data.pollTimer = setInterval(() => {
      if (this.data.tab === 'orders') this.loadOrders();
    }, 8000);
  },
  stopPoll() { if (this.data.pollTimer) { clearInterval(this.data.pollTimer); this.data.pollTimer = null; } },

  onPin(e) { this.setData({ pin: e.detail.value }); },

  claim() {
    api('claimRole', { pin: this.data.pin.trim() }).then((d) => {
      app.refreshLogin();
      this.setData({ isOwner: true, pin: '' });
      toast('已进入店主模式', 'success');
      this.loadAll();
      this.startPoll();
    }).catch(fail);
  },

  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },

  loadAll() {
    api('getMenu').then((d) => {
      const form = {
        name: d.store.name, notice: d.store.notice, phone: d.store.phone || '',
        delivery_fee: String(d.store.delivery_fee), min_order: String(d.store.min_order),
        qr_tip: d.store.qr_tip || ''
      };
      this.setData({
        store: d.store, cats: d.cats,
        dishes: d.dishes.map((x) => Object.assign({}, x, {
          groupNames: (x.groups || []).map((g) => g.name).join('/')
        })),
        form,
        modeIndex: d.store.courier_mode === 'assign' ? 1 : 0
      });
    }).catch(fail);
    this.loadOrders();
    api('listCouriers').then((cs) => this.setData({ couriers: cs })).catch(() => {});
  },

  loadOrders() {
    api('getOrders', { scope: 'owner' }).then((d) => {
      const map = (o) => {
        const v = Object.assign({}, o);
        v.stClass = ST_CLASS[o.status] || 'UNPAID';
        v.timeText = fmtTime(o.created_at);
        v.totalText = money(o.total_amount);
        v.itemLines = o.items.map((i) => i.qty + ' × ' + i.name + '（' + i.spec_text + '）');
        v.markTime = fmtTime(o.mark_paid_at);
        v.custText = o.cust.dorm + ' ' + o.cust.room + ' · ' + o.cust.name + ' ' + o.cust.phone + (o.cust.note ? ' · 备注:' + o.cust.note : '');
        v.acts = this.actsFor(o);
        return v;
      };
      const all = d.list;
      this.setData({
        pendList: all.filter((o) => o.status === '待确认收款').map(map),
        todoList: all.filter((o) => o.status === '已支付(待接单)').map(map),
        doingList: all.filter((o) => ['制作中', '待配送', '待取餐', '配送中'].indexOf(o.status) >= 0).map(map),
        doneList: all.filter((o) => ['已完成', '已取消(待退款)', '已取消(已退款)', '已关闭', '待付款'].indexOf(o.status) >= 0).map(map).slice(0, 20),
        pendCount: all.filter((o) => o.status === '待确认收款').length
      });
    }).catch(fail);
  },

  actsFor(o) {
    const s = o.status;
    if (s === '待确认收款') return [{ op: 'confirm', label: '✔ 确认到账', pri: true }, { op: 'notfound', label: '未查到款项', dgr: true }];
    if (s === '已支付(待接单)') return [{ op: 'accept', label: '接单制作', pri: true }, { op: 'reject', label: '拒单退款', dgr: true }];
    if (s === '制作中') return [{ op: 'ready', label: '出餐完毕', pri: true }];
    if (s === '待配送') return [{ op: 'assign', label: '指派跑腿', pri: true }];
    if (s === '已取消(待退款)') return [{ op: 'refundDone', label: '登记已退款', pri: true }];
    return [];
  },

  onAct(e) {
    const { op, i, g } = e.currentTarget.dataset;
    const list = g === 'pend' ? this.data.pendList : g === 'todo' ? this.data.todoList : g === 'doing' ? this.data.doingList : this.data.doneList;
    const o = list[i];
    if (!o) return;
    if (op === 'confirm') {
      wx.showModal({
        title: '确认到账 ¥' + money(o.total_amount) + '？',
        content: '订单 ' + o.order_no + '。请先核对收款小精灵流水（金额+备注订单号）。确认后订单生效，不可自动撤销。',
        confirmText: '确认到账',
        success: (r) => { if (r.confirm) this.doConfirm(o, 'CONFIRMED', ''); }
      });
      return;
    }
    if (op === 'notfound' || op === 'reject' || op === 'refundDone') {
      const titles = { notfound: '未查到款项，填写原因退回顾客', reject: '拒单原因（将通知顾客线下退款）', refundDone: '退款方式备注（如：收款小精灵已退）' };
      wx.showModal({
        title: titles[op], editable: true, placeholderText: '请填写',
        success: (r) => {
          if (!r.confirm) return;
          const note = (r.content || '').trim();
          if ((op !== 'refundDone') && !note) { toast('请填写原因'); return; }
          if (op === 'notfound') this.doConfirm(o, 'NOT_FOUND', note);
          else api('orderOps', { orderId: o._id, op, reason: note }).then(() => { toast('已处理'); this.loadOrders(); }).catch(fail);
        }
      });
      return;
    }
    if (op === 'assign') {
      const cs = this.data.couriers;
      if (!cs.length) { toast('还没有跑腿账号，让跑腿在「跑腿」页输入口令注册'); return; }
      wx.showActionSheet({
        itemList: cs.map((c) => c.nickname + (c.phone ? ' ' + c.phone : '')),
        success: (r) => {
          api('orderOps', { orderId: o._id, op: 'assign', courierOpenid: cs[r.tapIndex].openid })
            .then(() => { toast('已指派给 ' + cs[r.tapIndex].nickname); this.loadOrders(); }).catch(fail);
        }
      });
      return;
    }
    if (op === 'accept' || op === 'ready') {
      api('orderOps', { orderId: o._id, op }).then(() => { toast('已更新'); this.loadOrders(); }).catch(fail);
    }
  },

  doConfirm(o, result, note) {
    api('confirmPayment', { orderId: o._id, result, note }).then(() => {
      toast(result === 'CONFIRMED' ? '已确认到账，订单生效' : '已退回待付款');
      this.loadOrders();
    }).catch(fail);
  },

  previewProof(e) {
    const fid = e.currentTarget.dataset.f;
    if (fid) wx.previewImage({ urls: [fid] });
  },

  /* ---------- 菜单管理 ---------- */
  onCatName(e) { this.setData({ catName: e.detail.value }); },
  addCat() {
    const name = this.data.catName.trim();
    if (!name) { toast('先输入分类名'); return; }
    api('manageMenu', { op: 'addCat', name }).then(() => { this.setData({ catName: '' }); this.loadAll(); }).catch(fail);
  },
  delCat(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除分类？', content: '分类下不能有菜品才能删除',
      success: (r) => { if (r.confirm) api('manageMenu', { op: 'delCat', id }).then(() => this.loadAll()).catch(fail); }
    });
  },
  toggleSold(e) {
    api('manageMenu', { op: 'toggleSold', id: e.currentTarget.dataset.id }).then(() => this.loadAll()).catch(fail);
  },
  delDish(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除菜品？', content: '删除后不可恢复',
      success: (r) => { if (r.confirm) api('manageMenu', { op: 'delDish', id }).then(() => this.loadAll()).catch(fail); }
    });
  },
  editDish(e) {
    const id = e.currentTarget.dataset.id;
    const dish = this.data.dishes.find((d) => d._id === id) || null;
    app.globalData.editDish = dish;
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' });
  },
  newDish() {
    app.globalData.editDish = null;
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' });
  },

  /* ---------- 设置 ---------- */
  onForm(e) {
    const f = e.currentTarget.dataset.f;
    const form = Object.assign({}, this.data.form);
    form[f] = e.detail.value;
    this.setData({ form });
  },
  onOpen(e) {
    api('manageStore', { patch: { open: e.detail.value } }).then(() => {
      this.setData({ 'store.open': e.detail.value });
      toast(e.detail.value ? '已开店' : '已打烊');
    }).catch(fail);
  },
  onMode(e) {
    const i = Number(e.detail.value);
    api('manageStore', { patch: { courier_mode: i === 1 ? 'assign' : 'grab' } }).then(() => {
      this.setData({ modeIndex: i, 'store.courier_mode': i === 1 ? 'assign' : 'grab' });
    }).catch(fail);
  },
  saveSet() {
    const f = this.data.form;
    const fee = Number(f.delivery_fee), min = Number(f.min_order);
    if (!f.name.trim()) { toast('窗口名称不能为空'); return; }
    if (!(fee >= 0) || !(min >= 0)) { toast('配送费/起送价要填数字'); return; }
    api('manageStore', {
      patch: { name: f.name.trim(), notice: f.notice, phone: f.phone, delivery_fee: fee, min_order: min, qr_tip: f.qr_tip }
    }).then(() => { toast('已保存'); this.loadAll(); }).catch(fail);
  },
  onSlotStart(e) { this.setData({ slotStart: e.detail.value }); },
  onSlotEnd(e) { this.setData({ slotEnd: e.detail.value }); },
  addSlot() {
    const slots = (this.data.store.slots || []).slice();
    const { slotStart, slotEnd } = this.data;
    if (slotStart >= slotEnd) { toast('结束时间要晚于开始时间'); return; }
    slots.push({ id: 's' + Date.now().toString(36), start: slotStart, end: slotEnd, on: true });
    api('manageStore', { patch: { slots } }).then(() => this.loadAll()).catch(fail);
  },
  toggleSlot(e) {
    const i = e.currentTarget.dataset.i;
    const slots = (this.data.store.slots || []).slice();
    slots[i] = Object.assign({}, slots[i], { on: e.detail.value });
    api('manageStore', { patch: { slots } }).then(() => this.loadAll()).catch(fail);
  },
  delSlot(e) {
    const i = e.currentTarget.dataset.i;
    const slots = (this.data.store.slots || []).slice();
    slots.splice(i, 1);
    api('manageStore', { patch: { slots } }).then(() => this.loadAll()).catch(fail);
  },
  uploadQr() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => {
        wx.showLoading({ title: '上传中' });
        const local = res.tempFiles[0].tempFilePath;
        const ext = local.indexOf('.png') >= 0 ? '.png' : '.jpg';
        wx.cloud.uploadFile({ cloudPath: 'payqr/qr-' + Date.now() + ext, filePath: local })
          .then((r) => api('manageStore', { patch: { qr_fileid: r.fileID } }))
          .then(() => { wx.hideLoading(); toast('收款码已更新'); this.loadAll(); })
          .catch((e) => { wx.hideLoading(); fail(e); });
      }
    });
  },
  previewQr() {
    if (this.data.store && this.data.store.qr_fileid) wx.previewImage({ urls: [this.data.store.qr_fileid] });
  }
});
