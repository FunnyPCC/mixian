// 云函数 api —— 校园窗口送餐小程序唯一后端入口（action 路由）
const OWNER_PIN = process.env.OWNER_PIN;
const COURIER_PIN = process.env.COURIER_PIN;

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const C = {
  users: 'users', store: 'store_settings', cats: 'categories',
  dishes: 'dishes', orders: 'orders', payconf: 'payment_confirmations'
};
const ST = {
  UNPAID: '待付款', PEND: '待确认收款', PAID: '已支付(待接单)', COOK: '制作中',
  WAIT: '待配送', PICK: '待取餐', DELI: '配送中', DONE: '已完成',
  C_REFUND: '已取消(待退款)', C_DONE: '已取消(已退款)', CLOSED: '已关闭'
};

const ok = (data) => ({ code: 0, data: data === undefined ? null : data });
const err = (code, msg) => ({ code, msg });

function tl(status, by, note) {
  return { status, at: Date.now(), by: by || '', note: note || '' };
}

async function getUser(openid) {
  const r = await db.collection(C.users).where({ _openid: openid }).limit(1).get();
  return r.data[0] || null;
}
async function requireRole(openid, role) {
  const u = await getUser(openid);
  if (!u || u.role !== role) throw { code: 40001, msg: '无权限' };
  return u;
}
async function getStore() {
  try {
    const r = await db.collection(C.store).doc('main').get();
    return r.data;
  } catch (e) { return null; }
}

/* ---------- 种子数据 ---------- */
function seedData() {
  const g = (id, name, mode, need, opts) => ({
    id, name, mode, need,
    opts: opts.map((o, i) => ({ id: id + '_o' + i, n: o[0], p: o[1] || 0 }))
  });
  const cats = [
    { _id: 'cat_1', name: '粉面', sort: 1 },
    { _id: 'cat_2', name: '盖饭', sort: 2 },
    { _id: 'cat_3', name: '小吃', sort: 3 },
    { _id: 'cat_4', name: '饮品', sort: 4 }
  ];
  const dishes = [
    { _id: 'd_1', cat_id: 'cat_1', name: '招牌牛肉拌面', desc: '手工碱面，慢卤4小时牛腩', price: 12, emoji: '🍜', sold_out: false, sort: 1, groups: [
      g('d_1g1', '口味', 'one', true, [['不辣'], ['微辣'], ['中辣'], ['特辣']]),
      g('d_1g2', '做法', 'one', true, [['干拌'], ['汤面'], ['拌川(加汁)', 1]]),
      g('d_1g3', '加料', 'many', false, [['加卤蛋', 2], ['加牛腩', 6], ['加青菜', 1], ['加豆干', 2]])
    ]},
    { _id: 'd_2', cat_id: 'cat_1', name: '重庆小面', desc: '麻辣鲜香，二荆条辣子', price: 9, emoji: '🍜', sold_out: false, sort: 2, groups: [
      g('d_2g1', '口味', 'one', true, [['微麻微辣'], ['标准麻辣'], ['重麻重辣']]),
      g('d_2g2', '做法', 'one', true, [['带汤'], ['干溜']])
    ]},
    { _id: 'd_3', cat_id: 'cat_1', name: '酸辣粉', desc: '红薯宽粉，酸汤开胃', price: 8, emoji: '🥣', sold_out: false, sort: 3, groups: [
      g('d_3g1', '口味', 'one', true, [['酸一点'], ['正常'], ['辣一点']]),
      g('d_3g2', '加料', 'many', false, [['加炸黄豆', 1], ['加肥肠', 6]])
    ]},
    { _id: 'd_4', cat_id: 'cat_2', name: '番茄鸡蛋盖饭', desc: '现炒浇头，米饭管饱', price: 11, emoji: '🍛', sold_out: false, sort: 4, groups: [
      g('d_4g1', '口味', 'one', true, [['不要葱'], ['正常']]),
      g('d_4g2', '加料', 'many', false, [['加鸡腿', 5], ['加例汤', 2]])
    ]},
    { _id: 'd_5', cat_id: 'cat_2', name: '咖喱鸡肉饭', desc: '日式咖喱，大块鸡腿肉', price: 13, emoji: '🍛', sold_out: false, sort: 5, groups: [
      g('d_5g1', '口味', 'one', true, [['不辣'], ['微辣'], ['中辣']])
    ]},
    { _id: 'd_6', cat_id: 'cat_3', name: '香酥鸡柳', desc: '现炸出锅，配秘制蘸料', price: 6, emoji: '🍗', sold_out: false, sort: 6, groups: [
      g('d_6g1', '口味', 'one', true, [['番茄酱'], ['辣椒面'], ['蜜汁', 0.5]])
    ]},
    { _id: 'd_7', cat_id: 'cat_3', name: '卤味拼盘', desc: '卤蛋豆干藕片一小盒', price: 7, emoji: '🥟', sold_out: false, sort: 7, groups: [] },
    { _id: 'd_8', cat_id: 'cat_4', name: '冰镇酸梅汤', desc: '解辣神器', price: 4, emoji: '🥤', sold_out: false, sort: 8, groups: [
      g('d_8g1', '口味', 'one', true, [['正常糖'], ['少糖'], ['去冰']])
    ]}
  ];
  const store = {
    _id: 'main', store_id: 'S001',
    name: '麻辣电线·校园窗口', notice: '覆盖全部宿舍楼，下单后约30分钟送达',
    open: true, delivery_fee: 2, min_order: 10,
    slots: [
      { id: 's1', start: '11:00', end: '13:30', on: true },
      { id: 's2', start: '17:00', end: '19:30', on: true }
    ],
    courier_mode: 'grab', pay_mode: 'qr_manual',
    qr_fileid: '', qr_tip: '扫码付款后请点「我已付款」，付款备注里填订单号',
    phone: '', updated_at: Date.now()
  };
  return { cats, dishes, store };
}

async function initData() {
  for (const k of Object.keys(C)) {
    try { await db.createCollection(C[k]); } catch (e) { /* 已存在 */ }
  }
  const st = await getStore();
  if (!st) {
    const s = seedData();
    await db.collection(C.store).add({ data: s.store });
    for (const c of s.cats) await db.collection(C.cats).add({ data: c });
    for (const d of s.dishes) await db.collection(C.dishes).add({ data: d });
    return { seeded: true };
  }
  return { seeded: false };
}

/* ---------- 账号 ---------- */
async function login(openid) {
  let u = await getUser(openid);
  if (!u) {
    await db.collection(C.users).add({
      data: { _openid: openid, role: 'customer', nickname: '', phone: '', created_at: Date.now() }
    });
    u = { role: 'customer' };
  }
  return ok({ role: u.role, openid });
}

async function claimRole(openid, ev) {
  const pin = String(ev.pin || '');
  if (OWNER_PIN && pin === OWNER_PIN) {
    const cnt = await db.collection(C.users).where({ role: 'owner' }).count();
    const me = await getUser(openid);
    if (cnt.total > 0 && !(me && me.role === 'owner')) {
      return err(40001, '本店已有店主账号，请联系店主');
    }
    if (me) await db.collection(C.users).doc(me._id).update({ data: { role: 'owner' } });
    else await db.collection(C.users).add({ data: { _openid: openid, role: 'owner', nickname: '', phone: '', created_at: Date.now() } });
    await initData();
    return ok({ role: 'owner' });
  }
  if (COURIER_PIN && COURIER_PIN !== OWNER_PIN && pin === COURIER_PIN) {
    const me = await getUser(openid);
    if (me && me.role === 'owner') return err(40001, '店主账号无需切换跑腿');
    if (me) await db.collection(C.users).doc(me._id).update({ data: { role: 'courier', courier_active: true } });
    else await db.collection(C.users).add({ data: { _openid: openid, role: 'courier', nickname: '', phone: '', courier_active: true, created_at: Date.now() } });
    return ok({ role: 'courier' });
  }
  return err(40001, '口令不对或尚未配置，请联系店主');
}

/* ---------- 菜单 ---------- */
async function getMenu(openid) {
  const store = await getStore();
  const cats = (await db.collection(C.cats).orderBy('sort', 'asc').limit(50).get()).data;
  const dishes = (await db.collection(C.dishes).orderBy('sort', 'asc').limit(200).get()).data;
  const u = await getUser(openid);
  return ok({ store, cats, dishes, role: u ? u.role : 'customer' });
}

async function manageMenu(openid, ev) {
  await requireRole(openid, 'owner');
  const op = ev.op;
  if (op === 'addCat') {
    const name = String(ev.name || '').trim();
    if (!name) return err(40002, '分类名不能为空');
    const id = 'cat_' + Date.now().toString(36);
    const cnt = await db.collection(C.cats).count();
    await db.collection(C.cats).add({ data: { _id: id, name, sort: cnt.total + 1 } });
    return ok({ id });
  }
  if (op === 'delCat') {
    const used = await db.collection(C.dishes).where({ cat_id: ev.id }).count();
    if (used.total > 0) return err(40002, '该分类下还有菜品，先移走或删除');
    await db.collection(C.cats).doc(ev.id).remove();
    return ok();
  }
  if (op === 'saveDish') {
    const d = ev.dish || {};
    const name = String(d.name || '').trim();
    const price = Number(d.price);
    if (!name) return err(40002, '菜品名不能为空');
    if (!(price >= 0)) return err(40002, '价格要填0以上数字');
    if (!d.cat_id) return err(40002, '请选择分类');
    const groups = [];
    for (const rawG of (d.groups || [])) {
      const gname = String(rawG.name || '').trim();
      if (!gname) continue;
      const opts = (rawG.opts || [])
        .map((o) => ({ id: o.id || 'o' + Math.random().toString(36).slice(2, 8), n: String(o.n || '').trim(), p: Number(o.p) || 0 }))
        .filter((o) => o.n);
      if (!opts.length) return err(40002, '规格组「' + gname + '」没有有效选项');
      groups.push({ id: rawG.id || 'g' + Math.random().toString(36).slice(2, 8), name: gname, mode: rawG.mode === 'many' ? 'many' : 'one', need: !!rawG.need, opts });
    }
    const data = {
      cat_id: d.cat_id, name, price, desc: String(d.desc || '').trim(),
      emoji: String(d.emoji || '🍽️').trim() || '🍽️', groups,
      sold_out: !!d.sold_out, sort: Number(d.sort) || 99
    };
    if (d._id) {
      await db.collection(C.dishes).doc(d._id).update({ data });
      return ok({ _id: d._id });
    }
    const r = await db.collection(C.dishes).add({ data });
    return ok({ _id: r._id });
  }
  if (op === 'delDish') {
    await db.collection(C.dishes).doc(ev.id).remove();
    return ok();
  }
  if (op === 'toggleSold') {
    const dish = (await db.collection(C.dishes).doc(ev.id).get()).data;
    await db.collection(C.dishes).doc(ev.id).update({ data: { sold_out: !dish.sold_out } });
    return ok({ sold_out: !dish.sold_out });
  }
  return err(40400, '未知操作');
}

async function manageStore(openid, ev) {
  await requireRole(openid, 'owner');
  const allow = ['name', 'notice', 'open', 'delivery_fee', 'min_order', 'slots', 'courier_mode', 'qr_fileid', 'qr_tip', 'phone'];
  const patch = {};
  for (const k of allow) if (ev.patch && ev.patch[k] !== undefined) patch[k] = ev.patch[k];
  if (patch.delivery_fee !== undefined && !(Number(patch.delivery_fee) >= 0)) return err(40002, '配送费不合法');
  if (patch.min_order !== undefined && !(Number(patch.min_order) >= 0)) return err(40002, '起送价不合法');
  if (patch.slots) {
    for (const s of patch.slots) {
      if (!s.id || !s.start || !s.end) return err(40002, '时段不完整');
    }
  }
  patch.updated_at = Date.now();
  await db.collection(C.store).doc('main').update({ data: patch });
  return ok();
}

/* ---------- 下单 ---------- */
async function createOrder(openid, ev) {
  const store = await getStore();
  if (!store) return err(50001, '店铺未初始化，请先让店主用口令登录');
  if (!store.open) return err(40006, '窗口已打烊');
  const slot = (store.slots || []).find((s) => s.id === ev.slot_id && s.on);
  if (!slot) return err(40006, '请选择有效的配送时段');
  const cust = ev.cust || {};
  if (!cust.dorm || !cust.room || !cust.name) return err(40002, '请填全宿舍信息');
  if (!/^1\d{10}$/.test(String(cust.phone || ''))) return err(40002, '手机号格式不对');

  const items = ev.items || [];
  if (!items.length) return err(40002, '购物车是空的');
  const ids = items.map((i) => i.dish_id);
  const dishRes = await db.collection(C.dishes).where({ _id: _.in(ids) }).limit(100).get();
  const dishMap = {};
  dishRes.data.forEach((d) => { dishMap[d._id] = d; });

  let goods = 0;
  const orderItems = [];
  for (const it of items) {
    const dish = dishMap[it.dish_id];
    if (!dish) return err(40003, '有菜品不存在，请刷新菜单');
    if (dish.sold_out) return err(40003, dish.name + ' 已售罄');
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    const specSel = it.spec || {};
    let unit = Number(dish.price);
    const specArr = [];
    for (const grp of (dish.groups || [])) {
      const picked = specSel[grp.id] || [];
      if (grp.need && !picked.length) return err(40003, dish.name + ' 的「' + grp.name + '」还没选');
      if (grp.mode === 'one' && picked.length > 1) return err(40003, '「' + grp.name + '」只能单选');
      for (const oid of picked) {
        const o = (grp.opts || []).find((x) => x.id === oid);
        if (!o) return err(40003, '规格选项已变化，请重新选择');
        unit += Number(o.p) || 0;
        specArr.push({ g: grp.name, n: o.n, p: Number(o.p) || 0 });
      }
    }
    goods += unit * qty;
    orderItems.push({
      dish_id: dish._id, name: dish.name, emoji: dish.emoji || '🍽️',
      unit_price: Number(dish.price), unit, qty,
      spec_text: specArr.map((s) => s.g + ':' + s.n).join('，') || '默认',
      spec_snapshot: specArr
    });
  }
  goods = Math.round(goods * 100) / 100;
  const fee = Number(store.delivery_fee) || 0;
  if (goods < Number(store.min_order || 0)) return err(40005, '未达起送金额 ¥' + Number(store.min_order).toFixed(2));

  if (ev.idem_key) {
    const dup = await db.collection(C.orders).where({ _openid: openid, idem_key: ev.idem_key }).limit(1).get();
    if (dup.data[0]) return ok(publicOrder(dup.data[0]));
  }
  const now = Date.now();
  const order = {
    order_no: 'A' + String(now).slice(-8) + Math.floor(Math.random() * 90 + 10),
    _openid: openid, status: ST.UNPAID, pay_mode: store.pay_mode || 'qr_manual',
    idem_key: ev.idem_key || '',
    items: orderItems, goods_amount: goods, delivery_fee: fee,
    total_amount: Math.round((goods + fee) * 100) / 100,
    slot: { id: slot.id, start: slot.start, end: slot.end },
    cust: { name: cust.name, phone: cust.phone, dorm: cust.dorm, room: cust.room, note: String(cust.note || '') },
    qr_fileid: store.qr_fileid || '', qr_tip: store.qr_tip || '',
    mark_paid_at: null, proof_fileid: null, pay_confirmed_by: null, pay_confirmed_at: null,
    courier_openid: null, courier_name: null, refund_offline: null,
    timeline: [tl(ST.UNPAID, 'customer', '下单成功')],
    version: 1, created_at: now, expire_at: now + 30 * 60 * 1000,
    paid_at: null, accepted_at: null, ready_at: null, grabbed_at: null, delivered_at: null, closed_at: null
  };
  const r = await db.collection(C.orders).add({ data: order });
  order._id = r._id;
  return ok(publicOrder(order));
}

function publicOrder(o) {
  return {
    _id: o._id, order_no: o.order_no, status: o.status, total_amount: o.total_amount,
    goods_amount: o.goods_amount, delivery_fee: o.delivery_fee, items: o.items,
    slot: o.slot, cust: o.cust, qr_fileid: o.qr_fileid, qr_tip: o.qr_tip,
    mark_paid_at: o.mark_paid_at, proof_fileid: o.proof_fileid,
    courier_name: o.courier_name, timeline: o.timeline || [],
    created_at: o.created_at, expire_at: o.expire_at, delivered_at: o.delivered_at
  };
}

async function markPaid(openid, ev) {
  const r = await db.collection(C.orders).doc(ev.orderId).get().catch(() => null);
  const o = r && r.data;
  if (!o) return err(40007, '订单不存在');
  if (o._openid !== openid) return err(40007, '只能操作自己的订单');
  if (o.status === ST.PEND) return ok();
  if (o.status !== ST.UNPAID) return err(40002, '当前状态不能标记付款');
  await db.collection(C.orders).where({ _id: o._id, status: ST.UNPAID, version: o.version }).update({
    data: {
      status: ST.PEND, mark_paid_at: Date.now(),
      proof_fileid: ev.proofFileid || null,
      timeline: _.push([tl(ST.PEND, 'customer', '顾客标记已付款')]),
      version: _.inc(1)
    }
  });
  return ok();
}

async function confirmPayment(openid, ev) {
  await requireRole(openid, 'owner');
  const r = await db.collection(C.orders).doc(ev.orderId).get().catch(() => null);
  const o = r && r.data;
  if (!o) return err(40007, '订单不存在');
  if (o.status !== ST.PEND) return err(40002, '该订单不在待确认状态');
  const note = String(ev.note || '');
  if (ev.result === 'CONFIRMED') {
    const res = await db.collection(C.orders).where({ _id: o._id, status: ST.PEND, version: o.version }).update({
      data: {
        status: ST.PAID, paid_at: Date.now(),
        pay_confirmed_by: openid, pay_confirmed_at: Date.now(),
        timeline: _.push([tl(ST.PAID, 'owner', '店主确认到账' + (note ? '：' + note : ''))]),
        version: _.inc(1)
      }
    });
    if (!res.stats.updated) return err(40002, '订单状态已变化，请刷新');
    await db.collection(C.payconf).add({
      data: { order_id: o._id, order_no: o.order_no, amount_expected: o.total_amount, result: 'CONFIRMED', by_openid: openid, note, proof_fileid: o.proof_fileid || null, created_at: Date.now() }
    });
    return ok();
  }
  if (ev.result === 'NOT_FOUND') {
    if (!note) return err(40002, '请填写未查到款项的原因');
    const res = await db.collection(C.orders).where({ _id: o._id, status: ST.PEND, version: o.version }).update({
      data: {
        status: ST.UNPAID, mark_paid_at: null, proof_fileid: null,
        expire_at: Date.now() + 30 * 60 * 1000,
        timeline: _.push([tl(ST.UNPAID, 'owner', '未查到款项：' + note)]),
        version: _.inc(1)
      }
    });
    if (!res.stats.updated) return err(40002, '订单状态已变化，请刷新');
    await db.collection(C.payconf).add({
      data: { order_id: o._id, order_no: o.order_no, amount_expected: o.total_amount, result: 'NOT_FOUND', by_openid: openid, note, created_at: Date.now() }
    });
    return ok();
  }
  return err(40400, '未知操作');
}

/* ---------- 订单流转 ---------- */
const OPS = {
  accept:      { role: 'owner',    from: [ST.PAID],   to: ST.COOK,     at: 'accepted_at' },
  reject:      { role: 'owner',    from: [ST.PAID],   to: ST.C_REFUND, needReason: true },
  ready:       { role: 'owner',    from: [ST.COOK],   to: ST.WAIT,     at: 'ready_at' },
  assign:      { role: 'owner',    from: [ST.WAIT],   to: ST.PICK,     at: 'grabbed_at', needCourier: true },
  grab:        { role: 'courier',  from: [ST.WAIT],   to: ST.PICK,     at: 'grabbed_at', selfCourier: true },
  picked:      { role: 'courier',  from: [ST.PICK],   to: ST.DELI },
  delivered:   { role: 'courier',  from: [ST.DELI],   to: ST.DONE,     at: 'delivered_at' },
  cancel:      { role: 'customer', from: [ST.UNPAID, ST.PEND], to: ST.CLOSED, at: 'closed_at' },
  cancelPaid:  { role: 'owner',    from: [ST.PAID],   to: ST.C_REFUND, needReason: true },
  refundDone:  { role: 'owner',    from: [ST.C_REFUND], to: ST.C_DONE }
};

async function orderOps(openid, ev) {
  const def = OPS[ev.op];
  if (!def) return err(40400, '未知操作');
  const u = await requireRole(openid, def.role);
  const r = await db.collection(C.orders).doc(ev.orderId).get().catch(() => null);
  const o = r && r.data;
  if (!o) return err(40007, '订单不存在');
  if (def.role === 'customer' && o._openid !== openid) return err(40007, '只能操作自己的订单');
  if (def.role === 'courier' && ['picked', 'delivered'].includes(ev.op) && o.courier_openid !== openid) return err(40007, '只能操作自己的任务');
  if (!def.from.includes(o.status)) return err(40002, '当前状态(' + o.status + ')不允许该操作');
  if (def.needReason && !String(ev.reason || '').trim()) return err(40002, '请填写原因');

  const data = {
    status: def.to,
    timeline: _.push([tl(def.to, def.role, String(ev.reason || '').trim())]),
    version: _.inc(1)
  };
  if (def.at) data[def.at] = Date.now();
  if (def.to === ST.CLOSED) data.closed_at = Date.now();

  if (def.selfCourier) {
    const store = await getStore();
    if (store && store.courier_mode !== 'grab') return err(40002, '当前是指派模式，请等店主指派');
    data.courier_openid = openid;
    data.courier_name = u.nickname || '跑腿员';
    const res = await db.collection(C.orders)
      .where({ _id: o._id, status: ST.WAIT, courier_openid: null, version: o.version }).update({ data });
    if (!res.stats.updated) return err(40002, '手慢了，这单已被抢');
    return ok();
  }
  if (def.needCourier) {
    const c = await db.collection(C.users).where({ _openid: ev.courierOpenid, role: 'courier' }).limit(1).get();
    if (!c.data[0]) return err(40002, '该跑腿账号无效');
    data.courier_openid = ev.courierOpenid;
    data.courier_name = c.data[0].nickname || '跑腿员';
  }
  const res = await db.collection(C.orders).where({ _id: o._id, status: o.status, version: o.version }).update({ data });
  if (!res.stats.updated) return err(40002, '订单状态已变化，请刷新');
  return ok();
}

async function getOrders(openid, ev) {
  const scope = ev.scope;
  if (scope === 'mine') {
    const r = await db.collection(C.orders).where({ _openid: openid }).orderBy('created_at', 'desc').limit(50).get();
    return ok({ list: r.data.map(publicOrder), serverTime: Date.now() });
  }
  if (scope === 'owner') {
    await requireRole(openid, 'owner');
    const r = await db.collection(C.orders).orderBy('created_at', 'desc').limit(100).get();
    return ok({ list: r.data, serverTime: Date.now() });
  }
  if (scope === 'courier') {
    await requireRole(openid, 'courier');
    const hallR = await db.collection(C.orders).where({ status: ST.WAIT }).orderBy('created_at', 'desc').limit(30).get();
    const hall = hallR.data.map((o) => ({
      _id: o._id, order_no: o.order_no, status: o.status, total_amount: o.total_amount,
      items: o.items, slot: o.slot, created_at: o.created_at,
      cust: { name: o.cust.name, dorm: o.cust.dorm, room: o.cust.room } // 大厅隐藏手机号
    }));
    const mineR = await db.collection(C.orders)
      .where({ courier_openid: openid, status: _.in([ST.PICK, ST.DELI, ST.DONE]) })
      .orderBy('created_at', 'desc').limit(30).get();
    return ok({ hall, mine: mineR.data, serverTime: Date.now() });
  }
  return err(40400, '未知scope');
}

async function listCouriers(openid) {
  await requireRole(openid, 'owner');
  const r = await db.collection(C.users).where({ role: 'courier' }).limit(50).get();
  return ok(r.data.map((u) => ({ openid: u._openid, nickname: u.nickname || ('跑腿' + String(u._id).slice(-4)), phone: u.phone || '' })));
}

/* ---------- 路由 ---------- */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  try {
    switch (event.action) {
      case 'login': return await login(OPENID);
      case 'claimRole': return await claimRole(OPENID, event);
      case 'initData': return ok(await initData());
      case 'getMenu': return await getMenu(OPENID);
      case 'manageMenu': return await manageMenu(OPENID, event);
      case 'manageStore': return await manageStore(OPENID, event);
      case 'createOrder': return await createOrder(OPENID, event);
      case 'markPaid': return await markPaid(OPENID, event);
      case 'confirmPayment': return await confirmPayment(OPENID, event);
      case 'orderOps': return await orderOps(OPENID, event);
      case 'getOrders': return await getOrders(OPENID, event);
      case 'listCouriers': return await listCouriers(OPENID);
      default: return err(40400, '未知action: ' + event.action);
    }
  } catch (e) {
    if (e && e.code) return err(e.code, e.msg);
    console.error(e);
    return err(50000, (e && e.message) || '服务器内部错误');
  }
};
