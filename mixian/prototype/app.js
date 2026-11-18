const $ = selector => document.querySelector(selector);
const screen = $('#screen'), dialog = $('#dialog');
const key = 'ruzhidianxian-demo-v2';
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const yuan = cents => `¥${(cents / 100).toFixed(2)}`;
const now = () => Date.now() + offset;
const local = (time, options) => new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', ...options}).format(time);
const hhmm = time => local(time, {hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const day = time => local(time,{year:'numeric',month:'2-digit',day:'2-digit'}).replaceAll('/','-');
const states = ['待核款','待配送','配送中','已完成','已取消'];
const roleNames = {user:'用户端',merchant:'商家端',rider:'骑手端'};
const prototypeRoutes = {user:['点餐','订单'],merchant:['订单','商品','骑手','设置'],rider:['订单','我的']};
const orderFilter = () => role==='merchant'?'待核款':role==='rider'?'待接单':'全部';
const formatOrderNumber = (date,number) => date.replaceAll('-','')+String(number).padStart(4,'0');
const orderNumber = order => order.orderNo || formatOrderNumber(order.date,order.number);
const orderNumberField = order => {
  const number=esc(orderNumber(order));
  return `<dl class="order-number-field"><dt>订单号</dt><dd><span>${number}</span><button type="button" data-act="copy-order-number" data-id="${number}" aria-label="复制订单号">${icon('copy')}</button></dd></dl>`;
};
const isClosedOrder = order => ['已完成','已取消'].includes(order.status);
function orderClosedAt(order){
  if(!isClosedOrder(order))return null;
  return order.closedAt??order.events?.findLast(([label])=>label===order.status||label.endsWith(' · '+order.status)||label.includes(' · '+order.status+'：'))?.[1]??null;
}
const options = entries => entries.map(entry => `<option value="${esc(entry[0])}">${esc(entry[1])}</option>`).join('');
const btn = (label, act, id='', cls='outline', disabled=false) => `<button type="button" class="${cls}" data-act="${act}" data-id="${esc(id)}" ${disabled?'disabled':''}>${esc(label)}</button>`;
const tag = (label, color='') => `<span class="tag ${color}">${esc(label)}</span>`;
const empty = (title, copy) => `<div class="card empty"><h3>${title}</h3><p>${copy}</p></div>`;
const callout = copy => `<div class="callout">${copy}</div>`;
const field = (title, name, value='', attrs='') => `<label class="field">${title}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const select = (title,name,entries) => `<label class="field">${title}<select name="${name}">${options(entries)}</select></label>`;
const photo = (image, large=false) => /^data:image\/(?:jpeg|png|webp);base64,/.test(image)
  ? `<img class="photo uploaded-photo ${large?'feature':''}" src="${esc(image)}" alt="菜品照片">`
  : `<span class="photo ${['beef','tomato','mushroom','cucumber'].includes(image)?image:'beef'} ${large?'feature':''}" role="img" aria-label="菜品照片"></span>`;
const shopTitle = '汝职麻辣电线';
const defaultAnnouncement = '下单请填写宿舍楼栋和房间号，方便骑手送达。';
const checkoutDuration = 20 * 60_000;
const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const imageUploadTypes = ['image/png','image/jpeg','image/webp'];
const packaging = {id:'pack',name:'包装',choices:[{id:'bag',name:'塑料袋',price:0},{id:'box',name:'打包盒',price:100}]};
const noodleAttributes = [
  {id:'taste',name:'口味',choices:[{id:'plain',name:'不辣',price:0},{id:'mild',name:'微辣',price:0},{id:'medium',name:'中辣',price:0}]},
  packaging,
  {id:'extras',name:'加配菜',multiple:true,choices:[{id:'potato',name:'土豆',price:100},{id:'lettuce',name:'生菜',price:100},{id:'tofu',name:'鱼豆腐',price:100}]},
];
const demoOffset = () => new Date(`${day(Date.now())}T11:00:00+08:00`).getTime() - Date.now();
const role = document.body.dataset.role || 'user';
let offset = demoOffset(), view = prototypeRoutes[role][0], filter = orderFilter(), category = '全部', detailId = '', busy = false;
let session = {}, toastTimer, dialogHandler, dialogSessionOnly, photoIndex = 0, storedVersion = null, visiblePickupCount = 0;
function seed() {
  const products = [
    ['beef','招牌麻辣牛肉米线','红油麻辣 · 软嫩炖牛肉','米线',1680,18],
    ['tomato','番茄鲜肉米线','番茄熬汤 · 酸甜不辣','米线',1480,12],
    ['mushroom','山野菌香米线','菌菇清汤 · 清鲜温润','米线',1380,0],
    ['cucumber','红油拍黄瓜','清脆爽口 · 一份解腻','小食',580,16],
  ].map(([id,name,desc,cat,price,stock])=>({id,name,desc,cat,images:[id],active:true,skus:[{id:'regular',name:cat==='米线'?'标准份':'一份',price,stock},...(cat==='米线'?[{id:'large',name:'加量份',price:price+300,stock:stock?8:0}]:[])]}));
  const base = {date:day(now()), person:'林同学',phone:'13800000001',address:'东区 3 号宿舍楼 502',note:'到楼下请联系',fee:0,items:[{product:'beef',sku:'regular',name:products[0].name,spec:'标准份',image:'beef',price:1680,qty:1}],due:now()+40*60000,slot:'',eligible:now(),qrVersion:1};
  const orders = states.map((status,index)=>({...structuredClone(base),id:`sample-${index}`,number:index+1,status,rider:index===2||index===3?'rider1':null,riderName:index===2||index===3?'小陈':'',riderPhone:'13800000002',reason:index===4?'用户取消演示单':'',events:[['用户声明已转账 · 待核款',now()-3600000],...(index>0?[[status,now()-1800000]]:[])]}));
  orders.push({...structuredClone(base),id:'sample-rider-cancelled',number:6,status:'已取消',rider:'rider1',riderName:'小陈',riderPhone:'13800000002',reason:'商家取消演示配送单',
    events:[['用户声明已转账 · 待核款',now()-7200000],['配送中',now()-4200000],['商家端 · 已取消：商家取消演示配送单',now()-3300000]]});
  return {products,orders,cart:[],hold:null,receiving:{},shop:{open:'07:00',close:'23:45',eta:40,fee:0,phone:'13800000003',paused:false,qr:'',qrVersion:1},riders:[{id:'rider1',account:'rider01',name:'小陈',phone:'13800000002',password:'demo123',active:true},{id:'rider2',account:'rider02',name:'小林',phone:'13800000004',password:'demo123',active:true}]};
}
function snapshotImage(state,line){
  const image=state.products.find(item=>item.id===line.product)?.images[0]||'beef';
  if(!image.startsWith('data:'))return image;
  const archive=state.orderPhotos??={};
  const ref=Object.keys(archive).find(key=>archive[key]===image)||newId();
  archive[ref]=image;
  return ref;
}
function load(){
  try{
    storedVersion=localStorage.getItem(key);
    const stored=JSON.parse(storedVersion);
    if(!stored)return seed();
    offset=stored.offset??offset;
    const state=stored.data;
    for(const order of [...state.orders,state.hold].filter(Boolean)){
      for(const line of order.items)if(!line.image)line.image=snapshotImage(state,line);
    }
    return state;
  }catch{return seed();}
}
let db = load();
function save(strict=false){
  try{
    const snapshot=JSON.stringify({data:db,offset});
    if(snapshot!==storedVersion)localStorage.setItem(key,snapshot);
    storedVersion=snapshot;
  }catch{
    if(strict)throw Error('本地空间不足或不可用，请减少商品图片后重试。');
    toast('浏览器未保存数据，当前会话仍可继续。');
  }
}
function syncOrders(force=false){
  try{if(localStorage.getItem(key)===storedVersion)return false;}catch{return false;}
  if(!force&&(dialog.open||busy||screen.querySelector('form:focus-within')))return false;
  db=load();
  return true;
}
window.addEventListener('storage',event=>{if(event.key===key&&syncOrders())render();});
function onDialogBackdrop(event){
  if(event.target!==dialog)return false;
  const bounds=dialog.getBoundingClientRect();
  return event.clientX<bounds.left||event.clientX>=bounds.right||event.clientY<bounds.top||event.clientY>=bounds.bottom;
}
let backdropPressed=false;
let opsDialogOpener=null;
dialog.addEventListener('pointerdown',event=>{backdropPressed=event.button===0&&onDialogBackdrop(event);});
dialog.addEventListener('pointercancel',()=>{backdropPressed=false;});
dialog.addEventListener('close',()=>{backdropPressed=false;});
dialog.addEventListener('click',event=>{
  const dismiss=backdropPressed&&onDialogBackdrop(event);
  backdropPressed=false;
  if(dismiss&&!busy)dialog.close();
});
function toast(text){$('#notice').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#notice').textContent='',1000)}
async function copyOrderNumber(number){
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(number);
    }else{
      const active=document.activeElement;
      const source=document.createElement('textarea');
      source.value=number;
      source.readOnly=true;
      Object.assign(source.style,{position:'fixed',inset:'0 auto auto 0',opacity:'0'});
      document.body.append(source);
      try{
        source.select();
        if(!document.execCommand('copy'))throw Error();
      }finally{
        source.remove();
        active?.focus({preventScroll:true});
      }
    }
    toast('订单号已复制');
  }catch{
    toast('复制失败，请长按订单号复制');
  }
}
function change(page){view=page;detailId='';filter=page==='订单'?orderFilter():'全部';render();window.scrollTo(0,0)}
function focusOpsHeading(){
  const heading=screen.querySelector('h1');
  if(!heading)return;
  heading.tabIndex=-1;
  heading.focus({preventScroll:true});
}
function byOrder(id){return db.orders.find(order=>order.id===id)}
function product(id){return db.products.find(item=>item.id===id)}
function skuFor(line){return product(line.product)?.skus.find(sku=>sku.id===line.sku)}
function productTags(item){return item?.tags??[...new Set((item?.desc||'').split(/[·、，,；;｜|\n]+/u).map(label=>label.trim()).filter(Boolean))];}
function attributeGroups(item){return item?.attributes??(item?.cat==='米线'?noodleAttributes:item?[packaging]:[]);}
function chosenAttributes(item, selections){
  return attributeGroups(item).flatMap(group=>group.choices.filter(choice=>selections?.includes(choice.id)).map(choice=>({...choice,group:group.name})));
}
function sameSku(left,right){return left.product===right.product&&left.sku===right.sku;}
function sameCartLine(left,right){return sameSku(left,right)&&(left.options||[]).join(',')===(right.options||[]).join(',');}
function skuQuantity(items,line){return quantity(items.filter(item=>sameSku(item,line)));}
function itemSpec(item){return [item.spec,...(item.attributes||[]).map(choice=>choice.name)].join(' · ');}
function cartStock(line){
  const sku=skuFor(line);
  const reserved=role==='user'&&db.hold&&!db.hold.released?skuQuantity(db.hold.items,line):0;
  return sku?sku.stock+reserved:0;
}
function markCartChanged(){if(role==='user'&&db.hold&&!db.hold.released)db.hold.cartChanged=true;}
const subtotal = items => items.reduce((sum,item)=>sum+item.price*item.qty,0);
const quantity = items => items.reduce((sum,item)=>sum+item.qty,0);
const windowName = order => order.slot || `预计 ${hhmm(order.due)} 送达`;
const event = (order,label) => order.events.push([label,now()]);
function restock(items){for(const item of items){const sku=skuFor(item);if(sku)sku.stock+=item.qty}}
function release(){if(db.hold&&!db.hold.released){restock(db.hold.items);db.hold.released=true;save()}}
function expire(){if(db.hold && now()>=db.hold.expires)release()}
function cartItems(){
  return db.cart.map(line=>{
    const item=product(line.product), sku=skuFor(line);
    const attributes=chosenAttributes(item,line.options);
    const price=(sku?.price||0)+attributes.reduce((sum,choice)=>sum+choice.price,0);
    return {...line,name:item?.name||'已移除商品',spec:sku?.name||'原规格',price,attributes};
  });
}
function cartAttributesChanged(line){
  if(!line.options)return false;
  const groups=attributeGroups(product(line.product));
  const chosen=groups.flatMap(group=>group.choices.filter(choice=>line.options.includes(choice.id)));
  return chosen.length!==line.options.length||
    groups.some(group=>!group.multiple&&group.choices.filter(choice=>line.options.includes(choice.id)).length!==1);
}
function clockMinutes(time){const [hour,minute]=hhmm(time).split(':').map(Number);return hour*60+minute}
function minuteOf(text){const [hour,minute]=text.split(':').map(Number);return hour*60+minute}
function slots(){const start=new Date(`${day(now())}T00:00:00+08:00`).getTime();const earliest=Math.max(minuteOf(db.shop.open),Math.ceil((clockMinutes(now())+db.shop.eta+1)/30)*30);const close=minuteOf(db.shop.close);const result=[];for(let cursor=Math.ceil(earliest/30)*30;cursor+30<=close;cursor+=30){const due=start+cursor*60000;result.push([due,`${hhmm(due)}–${hhmm(due+30*60000)}`])}return result}
function isOpen(){const minute=clockMinutes(now());return !db.shop.paused&&minute>=minuteOf(db.shop.open)&&minute<minuteOf(db.shop.close)}
function currentRider(){return db.riders.find(item=>item.id===session.rider&&item.active)}
function placeHold(data){
  expire();
  const existing=db.hold&&!db.hold.released?db.hold:null;
  if(data.editingExpires&&String(existing?.expires)!==data.editingExpires)throw Error('原结算已过期，请重新确认订单。');
  if(!existing&&!isOpen())throw Error('店铺当前不接新订单。');
  const items=existing?.items||cartItems();
  if(!existing&&(!items.length||items.some(line=>!product(line.product)?.active||!skuFor(line)||skuFor(line).stock<skuQuantity(items,line))))throw Error('购物袋里有商品已下架或库存不足，请返回调整。');
  if(!existing&&items.some(cartAttributesChanged))throw Error('有商品的可选属性已更新，请从购物袋移除后重新选择。');
  const receiving={person:data.person.trim(),phone:data.phone,address:data.address.trim(),note:data.note.trim()};
  if(!receiving.person||!receiving.address)throw Error('请填写收货人和完整地址。');
  const sameSlot=existing?.slot&&String(existing.due)===data.slot;
  const slot=data.mode==='reserve'?(sameSlot?[existing.due,existing.slot]:slots().find(([start])=>String(start)===data.slot)):null;
  if(data.mode==='reserve'&&!slot)throw Error('请选择仍可预约的时段。');
  const sameInstant=existing&&!existing.slot&&!slot;
  if(!slot&&!sameInstant&&clockMinutes(now())+db.shop.eta>minuteOf(db.shop.close))throw Error('距打烊不足以完成配送，请在下一营业时段下单。');
  const due=slot?slot[0]:sameInstant?existing.due:now()+db.shop.eta*60000;
  const eligible=slot?(sameSlot?existing.eligible:due-db.shop.eta*60000):now();
  db.receiving=receiving;
  const delivery={...receiving,due,slot:slot?.[1]||'',eligible};
  if(existing)Object.assign(existing,delivery);
  else{
    for(const line of items)skuFor(line).stock-=line.qty;
    db.hold={...delivery,items:items.map(line=>({...line,image:snapshotImage(db,line)})),expires:now()+checkoutDuration,fee:db.shop.fee,qr:db.shop.qr,qrVersion:db.shop.qrVersion,released:false};
  }
  change('收款');
}
function submitOrder(){
  expire();
  if(!db.hold||db.hold.released)throw Error('结算已失效。若已转账，请联系商家。');
  const {qr,expires,released,cartChanged,...hold}=db.hold;
  const date=day(now()),number=1+Math.max(0,...db.orders.filter(order=>order.date===date).map(order=>order.number));
  const order={...hold,id:newId(),date,number,orderNo:formatOrderNumber(date,number),status:'待核款',rider:null,events:[]};
  event(order,'用户声明已转账 · 待核款');
  db.orders.push(order);
  for(const item of hold.items){const line=db.cart.find(entry=>sameCartLine(entry,item));if(line)line.qty-=item.qty;}
  db.cart=db.cart.filter(item=>item.qty>0);
  db.hold=null;view='订单';detailId=order.id;filter='全部';screen.scrollTop=0;
  toast('已提交，等待商家核款');
}
function assignRider(order,rider){
  Object.assign(order,{rider:rider.id,riderName:rider.name,riderPhone:rider.phone});
}
function orderAction(action,order){
  const configs={
    verify:['确认商家已到账','请先在收款记录中人工核对应转金额。确认后订单进入待配送。','待核款','待配送'],
    take:['接下这单？','接单后，本人可查看完整配送信息。','待配送','配送中'],
    deliver:['确认已送达？','确认后订单完成，请先核实已交付给收货人。','配送中','已完成'],
    cancel:['取消订单？','取消不可恢复，已转账不会自动退款。配送中订单请先和骑手协调。',null,'已取消'],
  };
  const [title,copy,expected,result]=configs[action];
  const reason=action==='cancel';
  const summary=`<div class="row spread card"><b>订单 #${order.number}</b><b>${yuan(subtotal(order.items)+order.fee)}</b></div>`;
  modal(title,summary+callout(copy)+(reason?field('取消原因','reason',role==='user'?'用户主动取消':'','required maxlength="120"'):''),data=>{
    if(expected&&order.status!==expected||action==='cancel'&&(role==='user'?order.status!=='待核款':['已完成','已取消'].includes(order.status))||action==='take'&&!canTake(order)||action==='deliver'&&order.rider!==session.rider)throw Error('订单状态已变更，请返回刷新。');
    if(reason&&!data.reason.trim())throw Error('请填写说明。');
    if(action==='take'){const rider=currentRider();if(!rider)throw Error('会话已失效，请重新登录。');assignRider(order,rider);}
    if(action==='cancel'){order.reason=data.reason.trim();if(!order.stockReturned){if(!order.id.startsWith('sample-'))restock(order.items);order.stockReturned=true;}}
    if(result){
      order.status=result;
      if(isClosedOrder(order))order.closedAt=now();
    }
    event(order,roleNames[role]+' · '+(result||title)+(reason?'：'+data.reason.trim():''));
    toast(result||'已记录');
  },role==='user'?'确认':({verify:'确认到账',take:'确认接单',deliver:'确认送达',cancel:'取消订单'})[action]);
}
async function readPaymentImage(file){
  if(!imageUploadTypes.includes(file.type)||file.size>1_000_000)throw Error('请选择 1 MB 以内的 JPG、PNG 或 WebP 图片。');
  try{
    const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const preview=new Image();
    preview.src=source;
    await preview.decode();
    return source;
  }catch{throw Error('图片无法读取，请重新选择。');}
}
async function saveShop(data){
  if(data.open>=data.close)throw Error('结束时间必须晚于开始时间，演示暂不支持跨日。');
  let qrImage=db.shop.qr;
  if(data.remove)qrImage='';
  if(data.qr?.size)qrImage=await readPaymentImage(data.qr);
  const qrVersion=db.shop.qrVersion+Number(qrImage!==db.shop.qr);
  db.shop={open:data.open,close:data.close,eta:Number(data.eta),fee:Math.round(Number(data.fee)*100),phone:data.phone,paused:!!data.paused,qr:qrImage,qrVersion,announcement:(data.announcement??db.shop.announcement??defaultAnnouncement).trim()};
  toast('店铺设置已保存');
}
async function commit(button,work,onError=toast,{sessionOnly=false}={}){
  if(busy)return;
  busy=true;
  const formName=button?.form?.dataset.form;
  const opener=dialog.open?opsDialogOpener:button;
  const focusAction=opener?.dataset.act;
  const focusId=opener?.dataset.id||'';
  const restoreFocus=()=>{
    if(role==='user')return;
    const target=focusAction?screen.querySelector(`[data-act="${CSS.escape(focusAction)}"][data-id="${CSS.escape(focusId)}"]`):formName==='shop'?screen.querySelector('form[data-form=shop] [type=submit]'):null;
    if(target&&!target.disabled)target.focus();else focusOpsHeading();
  };
  if(button){button.disabled=true;button.textContent='处理中…';}
  try{
    await new Promise(resolve=>setTimeout(resolve,220));
    if(syncOrders(true)&&!sessionOnly){
      if(dialog.open)dialog.close();
      render();
      toast('数据已更新，请核对后重试。');
      restoreFocus();
      return;
    }
    await work();
    if(!sessionOnly)save();
    render();
    restoreFocus();
  }catch(error){onError(error.message||'操作失败，请重试。');if(button?.isConnected){button.disabled=false;button.textContent=button.dataset.label||'重试';}}
  finally{busy=false;}
}
document.addEventListener('change',event=>{
  if(event.target.name==='mode'){const slotField=$('#slot-field');slotField.hidden=event.target.value!=='reserve';slotField.querySelector('select').required=!slotField.hidden;}
});
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!form.matches('[data-form],#modal-form'))return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form)),button=event.submitter;
  if(button)button.dataset.label=button.textContent;
  if(form.id==='modal-form'){
    if(!dialogHandler)return;
    const handler=dialogHandler;
    commit(button,async()=>{await handler(data);dialog.close();},message=>{const error=$('#modal-error');if(error){error.hidden=false;error.textContent=message;}else toast(message);},{sessionOnly:dialogSessionOnly});
    return;
  }
  form.querySelector('.form-error')?.remove();
  commit(button,async()=>{
    if(form.dataset.form==='checkout')placeHold(data);
    if(form.dataset.form==='shop')await saveShop(data);
    if(form.dataset.form==='login'){
      if(role==='merchant'){if(data.password!=='shop123')throw Error('密码有误，请检查后重试。');session.merchant=true;}
      if(role==='rider'){const rider=db.riders.find(item=>item.account===data.account&&item.password===data.password&&item.active);if(!rider)throw Error('账号或密码不正确，或骑手已停用。');session.rider=rider.id;}
    }
  },message=>{
    const error=document.createElement('p');
    error.className='form-error danger';error.setAttribute('role','alert');error.tabIndex=-1;error.textContent=message;
    button.before(error);error.focus({preventScroll:true});error.scrollIntoView({block:'nearest'});
  },{sessionOnly:form.dataset.form==='login'});
});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-act]');
  if(!button||busy)return;
  const {act,id}=button.dataset;
  if(act==='close'){dialog.close();return;}
  if(act==='tab'){
    const bottomTab=role!=='user'&&button.closest('#tabs');
    change(id);
    if(bottomTab)$('#tabs [aria-current=page]')?.focus({preventScroll:true});
    return;
  }
  if(act==='filter'){
    const group=button.closest('.ops-queue-nav,.ops-segments')?.className;
    filter=id;
    render();
    if(group)$(`.${group} [aria-pressed="true"]`)?.focus({preventScroll:true});
    return;
  }
  if(act==='category'){category=id;render();return;}
  if(act==='expire-session'){delete session[role];change(prototypeRoutes[role][0]);toast('请重新登录演示账号');return;}
  if(!isAuthed())return;
  if(act==='copy-order-number'){copyOrderNumber(id);return;}
  if(act==='detail'){
    detailId=id;render();window.scrollTo(0,0);
    if(role!=='user')focusOpsHeading();
    return;
  }
  if(act==='back-detail'){
    const previousId=detailId;
    detailId='';render();window.scrollTo(0,0);
    if(role!=='user'){
      const card=screen.querySelector(`[data-act="detail"][data-id="${CSS.escape(previousId)}"]`);
      if(card)card.focus();else focusOpsHeading();
    }
    return;
  }
  if(act==='contact'){modal('联系信息',`<div class="card"><b>${esc(id||'暂无号码')}</b><p class="muted">演示号码，不会发起拨号。</p></div>`);return;}
  if(act==='sku'){photoIndex=0;chooseSku(product(id));return;}
  if(act==='photo'){const item=product(id);photoIndex+=button.getAttribute('aria-label')==='上一张'?item.images.length-1:1;$('#sku-photo').innerHTML=photo(item.images[photoIndex%item.images.length],true);return;}
  if(act==='cart'){cartDialog();return;}
  if(act.startsWith('cart-')){
    const line=db.cart[Number(id)];if(!line)return;
    if(act==='cart-plus'){if(!product(line.product)?.active||cartStock(line)<=skuQuantity(db.cart,line)){toast('可售库存不足');return;}line.qty++;}
    if(act==='cart-minus')line.qty--;
    if(act==='cart-remove'||line.qty===0)db.cart.splice(Number(id),1);
    markCartChanged();save();render();cartDialog();
    (dialog.querySelector(`[data-act="${act}"][data-id="${id}"]`)||dialog.querySelector('[data-act="close"]'))?.focus({preventScroll:true});
    return;
  }
  if(act==='checkout'||act==='pay'){
    if(dialog.open)dialog.close();
    syncOrders(true);
    const hold=db.hold&&!db.hold.released?db.hold:null;
    if(act==='checkout'&&role==='user'&&hold?.cartChanged&&db.cart.length&&isOpen()){
      release();db.hold=null;save();change('结算');return;
    }
    change(act==='pay'||hold?'收款':'结算');return;
  }
  if(act==='qr'){modal('收款码',qr(db.hold?.qr)+callout('预览专用，不可实际转账。'));return;}
  if(act==='abandon'){modal('放弃这次结算？',callout('仅在尚未转账时放弃。若已转账，请联系商家。'),()=>{release();db.hold=null;change('点餐');});return;}
  if(act==='submit-order'){button.dataset.label=button.textContent;commit(button,submitOrder);return;}
  if(act==='edit-product'){editProduct(product(id));return;}
  if(act==='toggle-product'){const item=product(id);modal(item.active?'下架商品？':'上架商品？',callout('仅影响新结算，已有订单与有效结算凭据不变。'),()=>{item.active=!item.active;});return;}
  if(['edit-rider','reset-rider','toggle-rider'].includes(act)&&role!=='merchant')return;
  if(act==='edit-rider'){editRider(db.riders.find(item=>item.id===id));return;}
  if(act==='reset-rider'){
    const rider=db.riders.find(item=>item.id===id);
    modal('重置骑手密码',field('新密码','password','','type="password" minlength="6" required autocomplete="new-password"'),data=>{rider.password=data.password;toast('密码已更新');},'保存新密码');return;
  }
  if(act==='toggle-rider'){const item=db.riders.find(rider=>rider.id===id);modal(item.active?'停用骑手？':'启用骑手？',callout('骑手停用后不能登录或接单，在途任务需先处理。'),()=>{if(item.active&&db.orders.some(order=>order.rider===id&&order.status==='配送中'))throw Error('该骑手还有配送中的订单。');item.active=!item.active;if(!item.active&&session.rider===id)delete session.rider;});return;}
  if(['verify','take','deliver','cancel'].includes(act)){const order=byOrder(id);if(order)orderAction(act,order);}
});
render();
setInterval(()=>{
  if(syncOrders()){render();return;}
  const wasActive=db.hold&&!db.hold.released;
  if(!dialog.open&&!busy){try{if(localStorage.getItem(key)===storedVersion)expire();}catch{}}
  if(wasActive&&db.hold.released&&view==='收款'&&!busy&&!dialog.open)render();
  if(role==='rider'&&isAuthed()&&view!=='我的'&&!detailId&&!dialog.open&&!busy&&visiblePickupCount!==db.orders.filter(canTake).length)render();
},1000);
function isAuthed(){return role==='user'||(role==='merchant'&&session.merchant)||(role==='rider'&&currentRider())}
function canTake(order){return order.status==='待配送'&&order.eligible<=now()}
function lines(items){return items.map(item=>`<div class="row spread moneyline"><span class="break">${esc(item.name)} <small>${esc(itemSpec(item))} × ${item.qty}</small></span><b>${yuan(item.price*item.qty)}</b></div>`).join('')}
function bill(items,fee){return `<div class="card stack">${lines(items)}<div class="row spread"><span>配送费</span><span>${yuan(fee)}</span></div><div class="row spread"><b>应付合计</b><b class="price">${yuan(subtotal(items)+fee)}</b></div></div>`}
function pills(values, selected, act){return `<div class="chips">${values.map(value=>`<button type="button" data-act="${act}" data-id="${esc(value)}" aria-pressed="${value===selected}" class="${value===selected?'active':''}">${esc(value)}</button>`).join('')}</div>`}
function render(){
  expire();
  if(role==='rider')visiblePickupCount=db.orders.filter(canTake).length;
  const navigation={'点餐':'store','订单':'clipboard','商品':'package','骑手':'rider','设置':'settings','我的':'rider'};
  const isSubpage=detailId||['结算','收款','订单搜索'].includes(view);
  const searchInput=screen.querySelector('input[data-ops-query]:focus');
  const selection=searchInput&&[searchInput.selectionStart,searchInput.selectionEnd];
  document.body.classList.toggle('subpage',!!isSubpage);
  const titlebar=$('#titlebar');
  if(titlebar)titlebar.innerHTML=`<div class="brand"><span class="mark">${icon('bolt')}</span><span>${shopTitle}${role==='user'?'':`<small>${roleNames[role]}</small>`}</span></div>${role==='merchant'&&isAuthed()?btn('退出登录','expire-session','','quiet'):''}`;
  $('#tabs').innerHTML=isAuthed()&&!isSubpage?prototypeRoutes[role].map(name=>{
    const selected=view===name;
    const glyph=navigation[name]+(selected&&role!=='user'?'-solid':'');
    return `<button data-act="tab" data-id="${name}" class="${selected?'selected':''}" ${selected?'aria-current="page"':''}>${icon(glyph)}<span>${name}</span></button>`;
  }).join(''):'';
  screen.innerHTML=!isAuthed()?login():detailId?detail(byOrder(detailId)):role==='user'?userPage():role==='merchant'?merchantPage():riderPage();
  if(selection){
    const input=screen.querySelector('[data-ops-query]');
    input?.focus({preventScroll:true});
    input?.setSelectionRange(...selection);
  }
}
function login(){return `<div class="stack"><div class="card stack"><span class="eyebrow">专用入口 · ${roleNames[role]}</span><h2 class="section-title">${role==='merchant'?'商家工作台':'骑手工作台'}</h2><p class="muted">请使用演示账号。入口不出现在普通用户底栏。</p></div><form data-form="login" class="card stack">${role==='rider'?field('骑手账号','account','rider01','required autocomplete="username"'):''}${field('密码','password','','type="password" required autocomplete="current-password"')}<p><small>演示密码：${role==='merchant'?'shop123':'demo123（骑手 rider01 / rider02）'}</small></p><button class="primary wide">登录</button></form></div>`}
function userPage(){
  if(view==='订单'){const list=db.orders.filter(order=>filter==='全部'||(filter==='进行中'?!['已完成','已取消'].includes(order.status):['已完成','已取消'].includes(order.status)));return `<div class="stack"><h2 class="section-title">我的订单</h2>${pills(['全部','进行中','已完结'],filter,'filter')}${db.hold&&!db.hold.released?btn('继续未提交结算','pay','', 'primary wide'):''}${orderList(list)}</div>`}
  if(view==='结算')return checkout();
  if(view==='收款')return payment();
  const list=db.products.filter(item=>item.active&&(category==='全部'||item.cat===category));
  const cart=cartItems();
  return `<div class="stack"><div class="hero"><small>RUZHI · 校内米线铺</small><h1>麻辣<br>正上头。</h1><p>现煮米线，热乎到楼下。</p></div><div class="row spread card">${tag(isOpen()?'营业中':db.shop.paused?'暂停接单':'非营业时段',isOpen()?'green':'')}<small>校内配送 · 约 ${db.shop.eta} 分钟 · 配送 ${yuan(db.shop.fee)}</small></div><div class="row spread"><h2 class="section-title">今日菜单</h2><small>演示菜品</small></div>${pills(['全部',...new Set(db.products.filter(item=>item.active).map(item=>item.cat))],category,'category')}${list.length?list.map(item=>`<article class="product">${photo(item.images[0])}<div><h3 class="break">${esc(item.name)}</h3><small class="break">${esc(item.desc)}</small><div class="row spread"><span class="price">${yuan(Math.min(...item.skus.map(sku=>sku.price)))} <small>起</small></span>${btn(item.skus.some(sku=>sku.stock)?'选规格':'已售罄','sku',item.id,'primary',!item.skus.some(sku=>sku.stock))}</div></div></article>`).join(''):empty('暂无菜品','试试其他分类。')}${db.hold&&!db.hold.released?btn('返回转账页','pay','','outline wide'):''}<div class="basket row spread">${btn(cart.length?`购物车 · ${quantity(cart)} 件`:'购物车为空','cart','','plain')}<b>${yuan(subtotal(cart))}</b>${btn('去结算','checkout','','primary',!cart.length)}</div></div>`;
}
function checkout(){const cart=cartItems();const info=db.receiving;return `<div class="stack">${btn('‹ 返回点餐','tab','点餐','quiet')}<h2 class="section-title">确认订单</h2>${!isOpen()?callout('当前不接新订单，请稍后再试。'):''}<form class="stack" data-form="checkout"><div class="card stack"><h3>送到哪里</h3>${field('收货人','person',info.person,'required maxlength="24" autocomplete="name"')}${field('手机号','phone',info.phone,'required inputmode="numeric" pattern="1[0-9]{10}" autocomplete="tel"')}${field('完整地址 · 自由填写','address',info.address,'required maxlength="100" placeholder="例：东区 3 号楼 502"')}${field('备注（选填）','note',info.note,'maxlength="100" placeholder="例如到楼下联系"')}</div><div class="card stack"><h3>什么时候送达</h3>${select('配送方式','mode',[['instant',`立即配送 · 预计 ${hhmm(now()+db.shop.eta*60000)}`],['reserve','预约送达 · 30 分钟时段']])}<div id="slot-field" hidden>${select('今日送达时段','slot',[['',slots().length?'请选择':'今天暂无可约时段'],...slots()])}</div><small>预约时段是送达窗口，不是下单或接单时间。</small></div>${bill(cart,db.shop.fee)}<button class="primary wide" ${!cart.length||!isOpen()?'disabled':''}>确认金额，查看收款码</button></form></div>`}
function payment(){const hold=db.hold;if(!hold)return empty('暂无结算凭据','请回点餐页重新结算。');return `<div class="stack"><h2 class="section-title">扫码转账</h2>${hold.released?callout('结算已过期，库存已释放。若已经转账，请联系商家处理，不要重复付款。'):callout('此页仅用于演示。请勿扫码或转账；「我已支付」仅模拟用户声明。')}<div class="card stack empty"><span>应转金额</span><div class="price">${yuan(subtotal(hold.items)+hold.fee)}</div>${btn('查看演示收款码','qr','','outline')}${qr(hold.qr)}<small>凭据有效至 ${hhmm(hold.expires)} · 不代表已创建订单</small></div>${bill(hold.items,hold.fee)}${hold.released?`${btn('返回点餐','tab','点餐','primary wide')}${btn('联系商家','contact',db.shop.phone,'outline wide')}`:`${btn('我已支付 · 提交订单','submit-order','','primary wide')}${btn('返回点餐，保留凭据','tab','点餐','outline wide')}${btn('未转账，放弃结算','abandon','','quiet wide')}`}</div>`}
function qr(image){return `<div class="qr">${image?`<img src="${esc(image)}" alt="自定义演示收款图">`:'演示二维码<br>不可付款'}</div>`}
function orderList(list,masked=false){return list.length?[...list].reverse().map(order=>`<article class="card stack"><div class="row spread"><b>#${order.number} <small>${esc(order.date)}</small></b>${tag(order.status,order.status==='已完成'?'green':'')}</div><div><b>${esc(windowName(order))}</b><br><small>${esc(order.items.map(item=>`${item.name} ×${item.qty}`).join('、'))}</small></div>${masked?`<small>${esc(addressHint(order.address))}</small>`:''}<div class="row spread"><b>${yuan(subtotal(order.items)+order.fee)}</b>${btn('查看详情','detail',order.id)}</div></article>`).join(''):empty('暂无订单','新订单或分配的任务会出现在这里。')}
function addressHint(address){
  const building=address.trim().match(/^(?:(?:[东南西北]{1,2}|中心)(?:校区|区)\s*)?\d{1,2}\s*(?:号\s*(?:宿舍楼|公寓楼|楼)|栋)(?=$|[\s，,。；;（(\d])/u);
  return building?.[0]||'校内配送 · 接单后查看地址';
}
function merchantPage(){
  if(view==='商品')return `<div class="stack"><div class="row spread"><h2 class="section-title">商品管理</h2>${btn('新增商品','edit-product','','primary')}</div>${db.products.map(item=>`<div class="product">${photo(item.images[0])}<div><h3>${esc(item.name)} ${tag(item.active?'上架':'下架')}</h3><small>${item.skus.map(sku=>esc(sku.name)+' 可售 '+sku.stock).join(' · ')}</small><div class="actions">${btn('编辑','edit-product',item.id)}${btn(item.active?'下架':'上架','toggle-product',item.id)}</div></div></div>`).join('')}</div>`;
  if(view==='骑手')return `<div class="stack"><div class="row spread"><h2 class="section-title">骑手管理</h2>${btn('新增骑手','edit-rider','','primary')}</div>${db.riders.map(item=>`<div class="card stack"><div class="row spread"><b>${esc(item.name)}</b>${tag(item.active?'启用':'停用',item.active?'green':'')}</div><small>${esc(item.account)} · ${esc(item.phone)}</small><div class="actions">${btn('编辑 / 重置密码','edit-rider',item.id)}${btn(item.active?'停用':'启用','toggle-rider',item.id)}</div></div>`).join('')}</div>`;
  if(view==='设置'){const shop=db.shop;return `<form data-form="shop" class="stack"><h2 class="section-title">店铺设置</h2><div class="card stack">${field('暂停接单','paused','yes','type="checkbox" '+(shop.paused?'checked':''))}${field('营业开始','open',shop.open,'type="time" required')}${field('营业结束','close',shop.close,'type="time" required')}${field('履约时间（分钟）','eta',shop.eta,'type="number" min="1" max="180" required')}${field('配送费（元）','fee',(shop.fee/100).toFixed(2),'type="number" min="0" step=".01" required')}${field('商家联系方式','phone',shop.phone,'required pattern="1[0-9]{10}"')}</div><div class="card stack"><h3>演示收款图 · v${shop.qrVersion}</h3>${qr(shop.qr)}<label class="field">替换图片（仅使用非真实收款图）<input name="qr" type="file" accept="image/png,image/jpeg,image/webp"></label>${field('移除图片','remove','yes','type="checkbox"')}</div><button class="primary wide">保存设置</button></form>`;}
  return `<div class="stack"><span class="eyebrow">商家工作台 / 今日履约</span><h2 class="section-title">订单工作台</h2><div class="kpis">${states.slice(0,3).map(status=>`<button data-act="filter" data-id="${status}"><b>${db.orders.filter(order=>order.status===status).length}</b>${status}</button>`).join('')}</div>${pills(['全部',...states],filter,'filter')}${orderList(db.orders.filter(order=>filter==='全部'||order.status===filter))}</div>`;
}
function riderPage(){const rider=currentRider();const list=db.orders.filter(order=>view==='待接单'?canTake(order):order.rider===rider.id&&order.status===(view==='我的配送'?'配送中':'已完成'));return `<div class="stack"><div class="row spread"><span class="eyebrow">配送工作台 / ${esc(rider.name)}</span>${btn('切换账号','expire-session','','quiet')}</div><h2 class="section-title">${view}</h2>${view==='待接单'?callout('仅显示已核款且进入接单窗口的订单。接单前隐藏完整地址与联系方式。'):''}${orderList(list,view==='待接单')}</div>`}
function modal(title,body,handler,label='确认',{sessionOnly=false,sheet=false,caption='',footer=''}={}){
  dialogHandler=handler;
  dialogSessionOnly=sessionOnly;
  dialog.setAttribute('aria-labelledby','modal-title');
  dialog.classList.toggle('customer-sheet',role==='user'&&sheet);
  const wasOpen=dialog.open;
  if(!wasOpen&&role!=='user')opsDialogOpener=document.activeElement;
  const header=`<header class="dialog-header"><div class="row spread"><h2 id="modal-title" class="section-title" tabindex="-1" autofocus>${title}</h2><button type="button" class="icon-btn quiet" data-act="close" aria-label="关闭">${icon('close')}</button></div>${caption}</header>`;
  const actions=`${footer}<p id="modal-error" class="danger" role="alert" hidden></p>${handler?`<button type="submit" class="primary wide">${label}</button>`:''}`;
  dialog.innerHTML=`<form id="modal-form" class="dialog-form">${header}<div class="dialog-body">${body}</div><div class="dialog-footer">${actions}</div></form>`;
  if(!wasOpen)dialog.showModal();
  dialog.querySelector('#modal-title').focus({preventScroll:true});
}
function chooseSku(item){
  modal(esc(item.name),`<div class="row">${btn('‹','photo',item.id)}<div id="sku-photo" style="flex:1">${photo(item.images[photoIndex%item.images.length],true)}</div>${btn('›','photo',item.id)}</div><p>${esc(item.desc)}</p>${select('规格','sku',item.skus.map(sku=>[sku.id,`${sku.name} · ${yuan(sku.price)} · ${sku.stock?'可售 '+sku.stock:'售罄'}`]))}${field('数量','qty',1,'type="number" min="1" required')}`,data=>{
    const sku=item.skus.find(entry=>entry.id===data.sku), qty=Number(data.qty);
    const line=db.cart.find(entry=>entry.product===item.id&&entry.sku===sku.id);
    if(!sku||!item.active||!Number.isInteger(qty)||qty<1||qty+(line?.qty||0)>sku.stock)throw Error('可售库存不足，请调整数量或规格。');
    if(line)line.qty+=qty;else db.cart.push({product:item.id,sku:sku.id,qty});
    toast('已加入购物车');
  },'加入购物车');
}
function cartDialog(){
  modal('购物车',`<div class="stack">${cartItems().map((line,index)=>`<div class="card stack"><b>${esc(line.name)}</b><small>${esc(line.spec)} · ${yuan(line.price)}</small><div class="row">${btn('−','cart-minus',index)}<b>${line.qty}</b>${btn('+','cart-plus',index)}${btn('删除','cart-remove',index,'quiet')}</div></div>`).join('')||empty('购物车为空','先去挑一碗米线。')}<div class="row spread"><b>商品小计</b><b class="price">${yuan(subtotal(cartItems()))}</b></div>${btn('去结算','checkout','','primary wide',!db.cart.length)}</div>`);
}
function editProduct(item){
  const skuRows=(item?.skus||[{id:newId(),name:'标准份',price:0,stock:0}]).map(sku=>[sku.id,sku.name,(sku.price/100).toFixed(2),sku.stock].join('|')).join('\n');
  modal(item?'编辑商品':'新增商品',`${field('名称','name',item?.name,'required maxlength="30"')}${field('卖点标签','desc',item?.desc,'maxlength="48"')}${field('分类','cat',item?.cat||'米线','required maxlength="12"')}${field('演示配图（逗号分隔）','images',item?.images.join(',')||'beef','required')}<small>可选 beef、tomato、mushroom、cucumber，第一张为主图。</small><label class="field">SKU · 每行：编号|规格|价格（元）|可售库存<textarea name="skus" rows="4" required>${esc(skuRows)}</textarea></label>`,data=>{
    const images=data.images.split(',').map(value=>value.trim());
    if(!images.length||images.some(value=>!['beef','tomato','mushroom','cucumber'].includes(value)))throw Error('请选择有效的演示配图。');
    const skus=data.skus.trim().split(/\r?\n/).map(row=>{
      const [id,name,price,stock,...extra]=row.split('|').map(value=>value.trim());
      if(!id||!name||!/^\d+(\.\d{1,2})?$/.test(price)||!/^\d+$/.test(stock)||Number(price)>9999||Number(stock)>99999||extra.length)throw Error('SKU 格式有误，请检查编号、价格和库存。');
      return {id,name,price:Math.round(Number(price)*100),stock:Number(stock)};
    });
    if(new Set(skus.map(sku=>sku.id)).size!==skus.length)throw Error('SKU 编号不能重复。');
    if(!data.name.trim()||!data.cat.trim())throw Error('名称和分类不能为空。');
    const updated={name:data.name.trim(),desc:data.desc.trim(),cat:data.cat.trim(),images,skus};
    if(item)Object.assign(item,updated);else db.products.push({id:newId(),...updated,active:true});
    toast('商品已保存');
  },'保存商品');
}
function editRider(item){
  modal(item?'编辑骑手':'新增骑手',`${field('账号','account',item?.account,'required pattern="[A-Za-z0-9_]{3,20}"')}${field('姓名','name',item?.name,'required maxlength="24"')}${field('手机号','phone',item?.phone,'required pattern="1[0-9]{10}"')}${item?'':field('初始密码','password','','type="password" minlength="6" required autocomplete="new-password"')}`,data=>{
    if(db.riders.some(rider=>rider!==item&&rider.account===data.account))throw Error('该账号已存在。');
    if(!data.name.trim())throw Error('请输入骑手姓名。');
    const updated={account:data.account,name:data.name.trim(),phone:data.phone,password:data.password||item?.password};
    if(item){Object.assign(item,updated);if(data.password&&session.rider===item.id)delete session.rider;}else db.riders.push({id:newId(),...updated,active:true});
    toast('骑手资料已保存');
  },'保存骑手');
}
function detail(order){
  if(!order||role==='rider'&&order.rider!==session.rider&&!canTake(order))return `${btn('‹ 返回','back-detail','','quiet')}${empty('订单状态已变更','请返回列表查看最新任务。')}`;
  const masked=role==='rider'&&order.rider!==session.rider;
  const [pending,ready,delivering,done,cancelled]=states;
  const actions=[];
  if(role==='user'){actions.push(btn('联系商家','contact',db.shop.phone));if(order.status===pending)actions.push(btn('取消订单','cancel',order.id,'danger outline'));if(order.status===delivering)actions.push(btn('联系骑手','contact',order.riderPhone));}
  if(role==='merchant'){actions.push(btn('联系用户','contact',order.phone));if(order.rider)actions.push(btn('联系骑手','contact',order.riderPhone));if(order.status===pending)actions.unshift(btn('确认到账','verify',order.id,'primary'));if(![done,cancelled].includes(order.status))actions.push(btn('取消订单','cancel',order.id,'danger outline'));}
  if(role==='rider'){if(masked&&order.status===ready)actions.push(btn('接下这单','take',order.id,'primary'));if(!masked&&order.status===delivering)actions.push(btn('联系用户','contact',order.phone),btn('确认送达','deliver',order.id,'primary'));}
  return `<div class="stack">${btn('‹ 返回列表','back-detail','','quiet')}<div class="card stack"><div class="row spread"><h2 class="section-title">${order.status}</h2>${tag(`#${order.number} · ${order.date}`)}</div><p>${esc(windowName(order))}</p>${order.status===pending?callout('用户已声明转账，仍需商家人工核对。'):''}${order.status===ready&&order.slot&&role==='merchant'?callout(`预约单 · ${hhmm(order.eligible)} 后进入接单池`):''}${order.reason?`<p class="break">取消原因：${esc(order.reason)}</p>`:''}${order.status===cancelled&&role==='user'?callout('取消不等于退款。若已转账，请联系商家线下处理。'):''}</div><div class="card stack"><h3>配送信息</h3><p class="break">${esc(masked?addressHint(order.address):order.address)}</p>${masked?'<small>接单后显示联系人与备注。</small>':`<p class="break">${esc(order.person)} · ${esc(order.phone)}</p>${order.note?`<p class="break">备注：${esc(order.note)}</p>`:''}`}${order.riderName?`<small>骑手：${esc(order.riderName)}</small>`:''}</div>${bill(order.items,order.fee)}<div class="card"><h3>订单动态</h3><div class="timeline">${order.events.map(([label,time])=>`<p class="break"><small>${hhmm(time)}</small>　${esc(label)}</p>`).join('')}</div></div><div class="actions">${actions.join('')}</div></div>`;
}
