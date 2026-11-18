// app.js —— 全局入口
App({
  globalData: {
    role: '',
    openid: '',
    store: null,
    cart: [],          // 购物车 [{key,dish_id,name,emoji,unit,qty,spec:[{g,n,p}]}]
    lastOrder: null,   // 下单后跳支付页用
    editDish: null     // 店主编辑菜品用
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '提示', content: '当前微信版本过低，无法使用云能力，请升级微信', showCancel: false });
      return;
    }
    // 只有一个云环境时可不填 env；有多个环境时改为 wx.cloud.init({ env: '你的环境ID' })
    wx.cloud.init({ traceUser: true });
  },

  // 所有页面进入前调用，确保已登录并拿到角色
  ensureLogin() {
    const api = require('./utils/api.js').api;
    if (this._loginPromise) return this._loginPromise;
    this._loginPromise = api('login').then((d) => {
      this.globalData.role = d.role;
      this.globalData.openid = d.openid;
      return d;
    }).catch((e) => {
      this._loginPromise = null;
      throw e;
    });
    return this._loginPromise;
  },

  refreshLogin() {
    this._loginPromise = null;
    return this.ensureLogin();
  }
});
