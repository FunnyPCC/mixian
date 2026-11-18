// pages/menu/menu.js —— 顾客点餐主页
const { api, money, toast, fail } = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    store: null,
    cats: [],
    dishes: [],        // 当前分类菜品
    curCatId: '',
    cartCount: 0,
    cartTotal: '0.00',
    canGo: false,
    // 规格弹层
    spec: null,        // {dish, viewGroups:[{...g, opts:[{...o,on}]}]}
    sel: {},           // {groupId:[optId]}
    qty: 1,
    unitTotal: '0.00',
    canAdd: false
  },

  onShow() {
    app.ensureLogin().then(() => this.load()).catch(fail);
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load() {
    return api('getMenu').then((d) => {
      app.globalData.role = d.role;
      app.globalData.store = d.store;
      let curCatId = this.data.curCatId;
      if (!curCatId || !d.cats.some((c) => c._id === curCatId)) {
        curCatId = d.cats.length ? d.cats[0]._id : '';
      }
      this.setData({ store: d.store, cats: d.cats, curCatId, allDishes: d.dishes });
      this.filterDishes(d.dishes, curCatId);
      this.refreshCartBar();
    });
  },

  filterDishes(all, catId) {
    const dishes = (all || this.data.allDishes || []).filter((d) => d.cat_id === catId);
    this.setData({ dishes });
  },

  onCat(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ curCatId: id });
    this.filterDishes(this.data.allDishes, id);
  },

  /* ----- 规格弹层 ----- */
  openSpec(e) {
    const dish = this.data.dishes[e.currentTarget.dataset.i];
    if (!dish) return;
    if (dish.sold_out) { toast('这个菜售罄啦'); return; }
    if (!this.data.store || !this.data.store.open) { toast('窗口已打烊，暂时不能下单'); return; }
    if (!dish.groups || !dish.groups.length) {
      this.addCart(dish, [], 1);
      return;
    }
    const sel = {};
    dish.groups.forEach((g) => {
      sel[g.id] = (g.need && g.mode === 'one' && g.opts.length) ? [g.opts[0].id] : [];
    });
    this.setData({ qty: 1, sel });
    this.buildSpecView(dish, sel);
  },

  buildSpecView(dish, sel) {
    const viewGroups = dish.groups.map((g) => ({
      id: g.id, name: g.name, mode: g.mode, need: g.need,
      opts: g.opts.map((o) => ({ id: o.id, n: o.n, p: o.p, on: (sel[g.id] || []).indexOf(o.id) >= 0 }))
    }));
    let unit = Number(dish.price);
    dish.groups.forEach((g) => (sel[g.id] || []).forEach((oid) => {
      const o = g.opts.find((x) => x.id === oid);
      if (o) unit += Number(o.p) || 0;
    }));
    const lack = dish.groups.some((g) => g.need && !(sel[g.id] || []).length);
    this.setData({
      spec: { dish, viewGroups },
      unitTotal: money(unit * this.data.qty),
      canAdd: !lack,
      _unit: unit
    });
  },

  pickOpt(e) {
    const { g, o } = e.currentTarget.dataset;
    const sel = Object.assign({}, this.data.sel);
    const dish = this.data.spec.dish;
    const grp = dish.groups.find((x) => x.id === g);
    let arr = (sel[g] || []).slice();
    if (grp.mode === 'one') {
      arr = [o];
    } else {
      const i = arr.indexOf(o);
      if (i >= 0) arr.splice(i, 1); else arr.push(o);
    }
    sel[g] = arr;
    this.setData({ sel });
    this.buildSpecView(dish, sel);
  },

  minus() { if (this.data.qty > 1) { this.setData({ qty: this.data.qty - 1 }); this.buildSpecView(this.data.spec.dish, this.data.sel); } },
  plus() { if (this.data.qty < 20) { this.setData({ qty: this.data.qty + 1 }); this.buildSpecView(this.data.spec.dish, this.data.sel); } },
  closeSpec() { this.setData({ spec: null }); },

  onAddCart() {
    if (!this.data.canAdd) { toast('还有必选项没选'); return; }
    const dish = this.data.spec.dish;
    const specArr = [];
    dish.groups.forEach((g) => (this.data.sel[g.id] || []).forEach((oid) => {
      const o = g.opts.find((x) => x.id === oid);
      if (o) specArr.push({ g: g.name, n: o.n, p: Number(o.p) || 0, gid: g.id, oid: o.id });
    }));
    this.addCart(dish, specArr, this.data.qty);
    this.setData({ spec: null });
  },

  addCart(dish, specArr, qty) {
    const unit = Number(dish.price) + specArr.reduce((a, s) => a + s.p, 0);
    const key = dish._id + '|' + specArr.map((s) => s.n).join(',');
    const cart = app.globalData.cart;
    const hit = cart.find((c) => c.key === key);
    if (hit) hit.qty += qty;
    else cart.push({ key, dish_id: dish._id, name: dish.name, emoji: dish.emoji, unit, qty, spec: specArr });
    this.refreshCartBar();
    toast('已加入购物车：' + dish.name + ' ×' + qty);
  },

  refreshCartBar() {
    const cart = app.globalData.cart;
    let n = 0, t = 0;
    cart.forEach((c) => { n += c.qty; t += c.unit * c.qty; });
    const st = this.data.store;
    const canGo = n > 0 && st && st.open && t >= Number(st.min_order || 0);
    this.setData({ cartCount: n, cartTotal: money(t + (n && st ? Number(st.delivery_fee) || 0 : 0)), canGo, _goods: t });
  },

  goCheckout() {
    if (!app.globalData.cart.length) { toast('先挑点好吃的吧'); return; }
    const st = this.data.store;
    if (!st || !st.open) { toast('窗口已打烊'); return; }
    if (this.data._goods < Number(st.min_order || 0)) { toast('还差 ¥' + money(st.min_order - this.data._goods) + ' 到起送价'); return; }
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  }
});
