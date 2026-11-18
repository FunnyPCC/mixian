// 可选云函数：关闭超30分钟未标记付款的订单（定时触发，每5分钟）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const now = Date.now();
  const r = await db.collection('orders')
    .where({ status: '待付款', expire_at: _.lt(now) })
    .limit(50).get();
  let n = 0;
  for (const o of r.data) {
    await db.collection('orders').where({ _id: o._id, status: '待付款', version: o.version }).update({
      data: {
        status: '已关闭', closed_at: now, version: _.inc(1),
        timeline: _.push([{ status: '已关闭', at: now, by: 'system', note: '超时未付款自动关闭' }])
      }
    });
    n++;
  }
  return { closed: n };
};
