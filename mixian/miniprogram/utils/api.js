// utils/api.js —— 云函数调用与常用工具
function api(action, data) {
  const payload = Object.assign({ action: action }, data || {});
  return wx.cloud.callFunction({ name: 'api', data: payload }).then((r) => {
    const res = r && r.result;
    if (!res) throw new Error('云函数无返回，请确认已上传部署云函数 api');
    if (res.code !== 0) {
      const e = new Error(res.msg || '操作失败');
      e.code = res.code;
      throw e;
    }
    return res.data;
  });
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (x) => (x < 10 ? '0' + x : '' + x);
  return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function toast(msg, icon) {
  wx.showToast({ title: msg, icon: icon || 'none', duration: 2000 });
}

// 统一错误提示
function fail(e) {
  console.error(e);
  toast((e && e.message) || '网络异常，请重试');
}

module.exports = { api, money, fmtTime, toast, fail };
