// pages/dish-edit/dish-edit.js —— 菜品编辑（含口味/做法/加料规格组）
const { api, toast, fail } = require('../../utils/api.js');
const app = getApp();

const QUICK = ['🍜', '🍲', '🥣', '🍛', '🍗', '🥟', '🥤', '🍚', '🧋', '🍢', '🍤', '🥗'];

Page({
  data: {
    isEdit: false,
    cats: [],
    catLabels: [],
    catIndex: 0,
    quick: QUICK,
    dish: { name: '', price: '', desc: '', emoji: '🍜', groups: [] },
    err: '',
    saving: false
  },

  onLoad(query) {
    const d = app.globalData.editDish;
    api('getMenu').then((m) => {
      const cats = m.cats;
      let dish;
      if (d) {
        dish = JSON.parse(JSON.stringify(d));
        dish.price = String(dish.price);
      } else {
        dish = { name: '', price: '', desc: '', emoji: '🍜', groups: [] };
      }
      let catIndex = cats.findIndex((c) => c._id === dish.cat_id);
      if (catIndex < 0) catIndex = 0;
      this.setData({
        isEdit: !!d, cats,
        catLabels: cats.map((c) => c.name),
        catIndex, dish
      });
    }).catch(fail);
  },

  onField(e) {
    const f = e.currentTarget.dataset.f;
    this.setData({ ['dish.' + f]: e.detail.value });
  },

  onCat(e) { this.setData({ catIndex: Number(e.detail.value) }); },

  pickEmoji(e) { this.setData({ 'dish.emoji': e.currentTarget.dataset.e }); },

  /* ----- 规格组 ----- */
  addGroup() {
    const groups = this.data.dish.groups.slice();
    groups.push({ id: '', name: '', mode: 'one', need: true, opts: [{ id: '', n: '', p: '' }] });
    this.setData({ 'dish.groups': groups });
  },

  delGroup(e) {
    const groups = this.data.dish.groups.slice();
    groups.splice(e.currentTarget.dataset.g, 1);
    this.setData({ 'dish.groups': groups });
  },

  onGroupField(e) {
    const { g, f } = e.currentTarget.dataset;
    this.setData({ ['dish.groups[' + g + '].' + f]: e.detail.value });
  },

  onGroupMode(e) {
    const g = e.currentTarget.dataset.g;
    this.setData({ ['dish.groups[' + g + '].mode']: e.detail.value === '多选' ? 'many' : 'one' });
  },

  onGroupNeed(e) {
    const g = e.currentTarget.dataset.g;
    this.setData({ ['dish.groups[' + g + '].need']: e.detail.value === '必选' });
  },

  addOpt(e) {
    const g = e.currentTarget.dataset.g;
    const groups = this.data.dish.groups.slice();
    groups[g].opts = groups[g].opts.concat([{ id: '', n: '', p: '' }]);
    this.setData({ 'dish.groups': groups });
  },

  delOpt(e) {
    const { g, o } = e.currentTarget.dataset;
    const groups = this.data.dish.groups.slice();
    groups[g].opts.splice(o, 1);
    this.setData({ 'dish.groups': groups });
  },

  onOptField(e) {
    const { g, o, f } = e.currentTarget.dataset;
    this.setData({ ['dish.groups[' + g + '].opts[' + o + '].' + f]: e.detail.value });
  },

  save() {
    if (this.data.saving) return;
    const d = this.data.dish;
    const cats = this.data.cats;
    const name = String(d.name || '').trim();
    const price = Number(d.price);
    if (!name) { this.setData({ err: '菜品名称不能为空' }); return; }
    if (!(price >= 0) || String(d.price).trim() === '') { this.setData({ err: '价格要填0以上数字' }); return; }
    if (!cats.length) { this.setData({ err: '请先在店主-菜单页添加分类' }); return; }
    const groups = [];
    for (const g of d.groups) {
      const gname = String(g.name || '').trim();
      if (!gname) continue;
      const opts = g.opts
        .map((o) => ({ id: o.id, n: String(o.n || '').trim(), p: Number(o.p) || 0 }))
        .filter((o) => o.n);
      if (!opts.length) { this.setData({ err: '规格组「' + gname + '」没有有效选项' }); return; }
      groups.push({ id: g.id, name: gname, mode: g.mode, need: !!g.need, opts });
    }
    this.setData({ err: '', saving: true });
    api('manageMenu', {
      op: 'saveDish',
      dish: {
        _id: d._id || null, cat_id: cats[this.data.catIndex]._id,
        name, price, desc: d.desc, emoji: d.emoji, groups,
        sold_out: !!d.sold_out, sort: Number(d.sort) || 99
      }
    }).then(() => {
      toast(this.data.isEdit ? '菜品已更新' : '菜品已上架', 'success');
      setTimeout(() => wx.navigateBack(), 700);
    }).catch((e) => { this.setData({ saving: false, err: e.message || '保存失败' }); });
  }
});
