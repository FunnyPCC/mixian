const customerDraft = {};
const heading = (title,glyph) => `<h2 class="section-icon">${icon(glyph)} ${title}</h2>`;
const backLink = (label,act,id='') => `<button type="button" class="back-link" data-act="${act}" data-id="${esc(id)}">${icon('arrow')} ${label}</button>`;
const glyphButton = (label,act,id,glyph,classes='',disabled=false) => `<button type="button" aria-label="${esc(label)}" data-act="${act}" data-id="${esc(id)}" class="icon-btn ${classes}" ${disabled?'disabled':''}>${icon(glyph)}</button>`;
const menuName = line => line.image?(db.orderPhotos?.[line.image]||line.image):product(line.product)?.images[0]||'beef';
const feeText = fee => fee ? '配送费 '+yuan(fee) : '免配送费';
const orderStatus = status => `<span class="order-state" data-status="${status}"><i></i>${status}</span>`;
const canCheckout = () => isOpen() || !!(db.hold&&!db.hold.released);
function countdown(expires){
  const seconds=Math.max(0,Math.ceil((expires-now())/1000));
  return [Math.floor(seconds/60),seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
}
const countdownText = hold => `<strong class="checkout-countdown" data-expires="${hold.expires}">${countdown(hold.expires)}</strong>`;

function sellingTags(item){
  const labels=productTags(item);
  return labels.length?`<ul class="selling-tags" aria-label="菜品卖点">${labels.map(label=>`<li>${esc(label)}</li>`).join('')}</ul>`:'';
}
function emptyCustomer(glyph,title,copy,action=''){
  return `<section class="card customer-empty"><span>${icon(glyph)}</span><h2>${title}</h2><p>${copy}</p>${action}</section>`;
}
function amountBlock(label,amount){
  return `<div class="amount-block"><small>${label}</small><b>${yuan(amount)}</b></div>`;
}
function foodBill(items,fee,showTotal=false,detailView=false){
  return `<section class="card order-bill">${heading('商品明细','bag')}
    <div class="food-list">${items.map(line=>`<div class="food-row">${photo(menuName(line))}<div><b>${esc(line.name)}</b><small>${esc(itemSpec(line))}${detailView?'':` × ${line.qty}`}</small>
    ${detailView?`<small class="food-row-quantity" aria-label="数量 ${line.qty}">× ${line.qty}</small>`:''}</div><b>${yuan(line.price*line.qty)}</b></div>`).join('')}</div>
    <div class="fee-rows"><div><span>商品小计</span><b>${yuan(subtotal(items))}</b></div><div><span>配送费</span><b>${fee?yuan(fee):'免配送费'}</b></div></div>
    ${showTotal?`<div class="bill-total"><span>订单合计</span><b>${yuan(subtotal(items)+fee)}</b></div>`:''}</section>`;
}
function flowHeader(title,index){
  const labels=['确认订单','扫码转账','商家核款'];
  const activeHold=db.hold&&!db.hold.released;
  return `<header class="flow-header">${backLink('返回菜单','tab','点餐')}<h1>${title}</h1>
    <ol class="flow-steps" aria-label="下单进度">${labels.map((label,step)=>{
      const content=`<span>${step<index?icon('check'):step+1}</span><b>${label}</b>`;
      const action=step===0&&index===1?'edit-checkout':step===1&&index===0&&activeHold?'review-transfer':'';
      return `<li class="${step<index?'complete':''}" ${step===index?'aria-current="step"':''}>${action?`<button type="button" data-act="${action}">${content}</button>`:content}</li>`;
    }).join('')}</ol></header>`;
}
function resumeCheckout(){
  const hold=db.hold;
  return hold&&!hold.released?`<button type="button" class="resume-row" data-act="pay"><span class="soft-icon">${icon('wallet')}</span><span><b>有一笔结算待转账</b><small>${yuan(subtotal(hold.items)+hold.fee)} · 剩余 ${countdownText(hold)}</small></span>${icon('chevron')}</button>`:'';
}
function dishCard(item,cart){
  const available=item.skus.filter(sku=>cartStock({product:item.id,sku:sku.id})>0), sold=!available.length;
  const price=Math.min(...(sold?item.skus:available).map(sku=>sku.price));
  const selected=quantity(cart.filter(line=>line.product===item.id));
  return `<article class="menu-item ${sold?'sold':''}">
    <div class="food-frame"><button type="button" class="food-cover" data-act="sku" data-id="${esc(item.id)}" aria-label="查看${esc(item.name)}" ${sold?'disabled':''}>${photo(item.images[0])}</button>
    ${sold?'<span class="food-badge">已售罄</span>':selected?`<span class="food-badge picked">${icon('check')} 已选 ${selected}</span>`:''}</div>
    <div class="food-info"><h3>${esc(item.name)}</h3>${sellingTags(item)}
    <div class="menu-price"><span class="dish-price"><b>${yuan(price)}</b>${item.skus.length>1?' <small>起</small>':''}</span>
    ${sold?'<small class="sold-action">暂不可选</small>':glyphButton('选规格：'+item.name,'sku',item.id,'plus','add-food')}</div></div></article>`;
}
function cartDock(cart){
  const count=quantity(cart);
  if(!count)return '';
  return `<div class="cart-dock"><button type="button" data-act="cart" class="cart-summary" aria-label="查看购物袋，${count} 件商品">
    <span class="cart-icon">${icon('bag-solid')}<em>${count}</em></span>${amountBlock('商品小计',subtotal(cart))}${icon('chevron')}</button>
    ${btn(canCheckout()?'去结算':'暂不接单','checkout','','primary',!canCheckout())}</div>`;
}
function storefront(){
  const all=db.products.filter(item=>item.active), cart=cartItems(), open=isOpen();
  const categories=['全部',...new Set(all.map(item=>item.cat))];
  if(!categories.includes(category))category='全部';
  const dishes=all.filter(item=>category==='全部'||item.cat===category);
  const status=open?'营业中':db.shop.paused?'暂停接单':'休息中';
  const announcement=db.shop.announcement??defaultAnnouncement;
  return `<div class="storefront ${cart.length?'has-cart':''}">
    <section class="store-overview">
      <div class="store-photo" role="img" aria-label="招牌麻辣牛肉米线"></div>
      <div class="store-intro"><span class="store-status ${open?'is-open':''}"><i></i>${status}</span><h1>${shopTitle}</h1><p>校内宿舍配送</p></div>
    </section>
    <div class="store-content">
    <div class="store-meta">
      <div class="store-delivery">
        <div class="store-delivery-item">${icon('clock')}
          <div><div class="store-delivery-label">${open?'预计送达':'接单时间'}</div><div class="store-delivery-value">${open?`约 ${db.shop.eta} 分钟`:db.shop.paused?'暂不接新单':`${esc(db.shop.open)} 开始营业`}</div></div>
        </div>
        <div class="store-delivery-item">${icon('location')}
          <div><div class="store-delivery-label">配送费</div><div class="store-delivery-value">${db.shop.fee?yuan(db.shop.fee):'免配送费'}</div></div>
        </div>
      </div>
      ${announcement?`<aside class="store-announcement" aria-label="店铺公告"><b>店铺公告</b><p>${esc(announcement)}</p></aside>`:''}
    </div>
    ${resumeCheckout()}
    <div class="menu-heading"><h2>店铺菜单</h2><small>${dishes.length} 款菜品</small></div>
    <nav class="categories" aria-label="菜品分类">${categories.map(name=>`<button type="button" data-act="category" data-id="${esc(name)}" aria-pressed="${category===name}">${esc(name)}</button>`).join('')}</nav>
    <div class="menu-grid">${dishes.length?dishes.map(item=>dishCard(item,cart)).join(''):emptyCustomer('box','暂无在售菜品','可切换其他分类查看。')}</div>
    </div>${cartDock(cart)}
  </div>`;
}
function orderListPage(){
  const list=db.orders.filter(order=>filter==='全部'||(filter==='进行中'?!['已完成','已取消'].includes(order.status):['已完成','已取消'].includes(order.status)));
  return `<div class="checkout-column customer-orders"><header class="page-title"><h1>我的订单</h1></header>
    <div class="order-filters" aria-label="订单筛选">${pills(['全部','进行中','已完结'],filter,'filter')}</div>
    ${resumeCheckout()}
    <div class="order-list">${[...list].reverse().map(order=>{
      const first=order.items[0];
      const promise=['已完成','已取消'].includes(order.status)?'':`<small>${icon('clock')} ${esc(order.slot?'预约 '+order.slot:windowName(order))}</small>`;
      const createdAt=order.events?.[0]?.[1];
      const date=`${order.date}${createdAt?' '+hhmm(createdAt):''}`;
      return `<button type="button" class="card customer-order" data-act="detail" data-id="${esc(order.id)}">
        <span class="order-card-head"><span class="order-meta"><b aria-label="订单 ${order.number}">#${order.number}</b><time datetime="${esc(date.replace(' ','T'))}">${esc(date)}</time></span>${orderStatus(order.status)}</span>
        <span class="order-card-dish">${photo(menuName(first))}<span><b>${esc(first.name)}${order.items.length>1?` 等 ${order.items.length} 种`:''}</b><small>共 ${quantity(order.items)} 件</small>${promise}</span></span>
        <span class="order-card-foot"><b>${yuan(subtotal(order.items)+order.fee)}</b>${icon('chevron')}</span>
      </button>`;
    }).join('')||emptyCustomer('receipt','暂无订单','在这里查看已提交的订单和配送进度。',btn('去点餐','tab','点餐','primary'))}</div></div>`;
}
userPage = function(){
  if(view==='结算')return checkout();
  if(view==='收款')return payment();
  return view==='订单'?orderListPage():storefront();
};

checkout = function(){
  const hold=db.hold&&!db.hold.released?db.hold:null;
  const cart=hold?.items||cartItems(), fee=hold?.fee??db.shop.fee;
  const info={...db.receiving,...customerDraft};
  const availableSlots=checkoutSlots();
  const reserve=info.mode==='reserve'&&availableSlots.length>0;
  const selected=availableSlots.find(([start])=>String(start)===info.slot);
  return `<div class="checkout-column">${flowHeader('确认订单',0)}
    ${hold?`<p class="edit-hold-time">${icon('clock')} 结算剩余 ${countdownText(hold)}</p>`:!isOpen()?callout('店铺暂不接单，购物袋里的菜品会保留。'):''}
    <form class="checkout-form" data-form="checkout">
      ${hold?`<input type="hidden" name="editingExpires" value="${hold.expires}">`:''}
      ${['address','person','phone','note'].map(name=>`<input type="hidden" name="${name}" value="${esc(info[name]||'')}">`).join('')}
      <section class="card field-card">${heading('收货信息','location')}
        <button type="button" class="checkout-row address-preview" data-act="edit-address">
          ${info.address&&info.person&&info.phone?`<span><b>${esc(info.address)}</b><small>${esc(info.person)} · ${esc(info.phone)}</small></span>`:`<span class="soft-icon">${icon('plus')}</span><span><b>添加收货信息</b><small>填写宿舍地址、收货人和手机号</small></span>`}
          ${icon('chevron')}</button>
      </section>
      <section class="card field-card">${heading('送达时间','clock')}
        <div class="delivery-options" role="group" aria-label="配送方式">
          <label><input type="radio" name="mode" value="instant" ${reserve?'':'checked'}><span><b>尽快送达</b><small>预计 ${hhmm(hold&&!hold.slot?hold.due:now()+db.shop.eta*60000)}</small></span></label>
          <label><input type="radio" name="mode" value="reserve" ${reserve?'checked':''} ${availableSlots.length?'':'disabled'}><span><b>预约送达</b><small>${availableSlots.length?'选择 30 分钟时段':'今日暂无可约时段'}</small></span></label>
        </div>
        <div id="slot-field" ${reserve?'':'hidden'}>
          <select name="slot" hidden ${reserve?'required':''} aria-label="今日送达时段"><option value="">请选择送达时段</option>${availableSlots.map(([start,label])=>`<option value="${start}" ${start===selected?.[0]?'selected':''}>${esc(label)}</option>`).join('')}</select>
          <button type="button" class="slot-trigger" data-act="pick-slot">${icon('calendar')}<span><small>今日送达时段</small><b>${esc(selected?.[1]||'选择时段')}</b></span>${icon('chevron')}</button>
        </div>
      </section>
      ${foodBill(cart,fee,true)}
      <section class="card checkout-note"><button type="button" class="checkout-row" data-act="edit-note">${icon('clipboard')}<b>备注</b><small>${esc(info.note||'商家和骑手可见 · 选填')}</small>${icon('chevron')}</button></section>
      <div class="action-bar">${amountBlock('应付合计',subtotal(cart)+fee)}<button class="primary" ${!cart.length||!hold&&!isOpen()?'disabled':''}>查看收款码 ${icon('chevron')}</button></div>
    </form></div>`;
};
function editAddress(){
  const info={...db.receiving,...customerDraft};
  modal('收货信息',`<div class="sheet-fields">
    ${field('宿舍地址','address',info.address,'required maxlength="100" autocomplete="street-address" placeholder="例：东区 3 号宿舍楼 502"')}
    ${field('收货人','person',info.person,'required maxlength="24" autocomplete="name" placeholder="怎么称呼"')}
    ${field('手机号','phone',info.phone,'required type="tel" pattern="1[0-9]{10}" autocomplete="tel" placeholder="11 位手机号"')}</div>`,data=>{
      const address=data.address.trim(), person=data.person.trim();
      if(!address||!person)throw Error('请填写宿舍地址和收货人。');
      Object.assign(customerDraft,{address,person,phone:data.phone});
    },'保存收货信息',{sheet:true});
}
function editNote(){
  const note=customerDraft.note??db.receiving.note??'';
  modal('备注',`<label class="field sheet-fields">给商家和骑手的备注（选填）<textarea name="note" rows="4" maxlength="100" placeholder="例如：到楼下请联系">${esc(note)}</textarea></label>`,data=>{
    customerDraft.note=data.note.trim();
  },'保存备注',{sheet:true});
}
function checkoutSlots(){
  const times=slots(), hold=db.hold;
  if(hold?.slot&&!hold.released&&!times.some(([time])=>time===hold.due))times.unshift([hold.due,hold.slot]);
  return times;
}
function pickSlot(){
  const selectInput=$('#slot-field select');
  if(!selectInput)return;
  const times=checkoutSlots();
  if(!times.length){toast('今天没有可预约的时段，请选择尽快送达。');return;}
  modal('选择送达时段',`<p class="sheet-hint">今天 · 每个时段 30 分钟</p><div class="time-list" role="group" aria-label="可预约时段">${times.map(([time,label])=>`<button type="button" data-act="set-slot" data-id="${time}" aria-pressed="${selectInput.value===String(time)}"><span>${esc(label)}</span>${selectInput.value===String(time)?icon('check'):''}</button>`).join('')}</div>`,null,undefined,{sheet:true});
  dialog.querySelector('.time-list [aria-pressed=true]')?.scrollIntoView({block:'nearest'});
}

const customerQr = image => image
  ? `<span class="customer-qr-image"><img src="${esc(image)}" alt="商家收款码"></span>`
  : `<span class="qr-preview">${icon('qr')}<span>收款码预览</span></span>`;
payment = function(){
  const hold=db.hold;
  if(!hold)return `<div class="checkout-column">${backLink('返回菜单','tab','点餐')}${emptyCustomer('wallet','暂无待转账结算','请回菜单选餐后重新结算。')}</div>`;
  const expired=hold.released;
  return `<div class="checkout-column payment-page">${flowHeader('扫码转账',1)}
    <section class="card payment-panel">
      ${amountBlock(expired?'结算已过期':'本次应转金额',subtotal(hold.items)+hold.fee)}
      ${expired?callout('若已经转账，请联系商家处理，不要重复付款。'):`
      <button type="button" class="qr-trigger" data-act="preview-qr" aria-label="查看演示收款码">${customerQr(hold.qr)}</button>
      <small class="payment-warning">演示页面，请勿转账</small>
      <div class="payment-expires">${icon('clock')} <span>提交剩余时间</span>${countdownText(hold)}</div>
      <p>提交后进入待核款，商家确认到账后才会处理订单。</p>`}</section>
    ${foodBill(hold.items,hold.fee,true)}
    <div class="action-bar payment-actions">${expired?btn('重新选餐','tab','点餐','soft-button'):btn('放弃结算','abandon','','soft-button')}${expired?btn('联系商家','contact',db.shop.phone,'primary'):btn('我已转账 提交订单','submit-order','','primary')}</div></div>`;
};

detail = function(order){
  if(!order)return `<div class="checkout-column">${backLink('返回订单','back-detail')}${emptyCustomer('receipt','找不到订单','请返回订单列表。')}</div>`;
  const cancelled=order.status==='已取消', progress=states.indexOf(order.status);
  const descriptions={'待核款':'商家正在核对转账，核款前可以取消。','待配送':'已确认到账，等待骑手接单。','配送中':'骑手正在配送，请留意来电。','已完成':'餐品已送达。','已取消':'订单已取消。退款请联系商家线下处理。'};
  const steps=['商家核款','等待配送','骑手配送','订单送达'];
  const riderPhone=order.rider&&order.riderPhone;
  return `<div class="checkout-column detail-page">${backLink('返回订单','back-detail')}
    <section class="card status-panel">
      <div class="status-heading"><div><small>流水号 #${order.number} · ${esc(order.date)}</small><h1>${order.status}</h1></div><span class="status-icon">${icon(cancelled?'x-circle':progress===3?'check-circle':progress===2?'truck':'clock')}</span></div>
      <p>${descriptions[order.status]}</p>
      ${!cancelled?`${progress===3?'':`<div class="delivery-promise">${icon('calendar')}<span>${order.slot?'预约送达':'预计送达'}</span><strong>${esc(order.slot||hhmm(order.due))}</strong></div>`}
      <ol class="progress-track" aria-label="订单进度">${steps.map((label,index)=>`<li class="${index<=progress?'reached':''}" ${index===progress?'aria-current="step"':''}><span>${index<progress||progress===3?icon('check'):index+1}</span><small>${label}</small></li>`).join('')}</ol>`:
      `<div class="cancel-summary">${order.reason?`<p>取消原因：${esc(order.reason)}</p>`:''}<p>已转账请联系商家线下退款。</p></div>`}
      ${orderNumberField(order)}
    </section>
    <section class="card address-card">${heading('配送信息','location')}<div class="address-summary"><b>${esc(order.address)}</b><div class="address-contact"><span>${esc(order.person)}</span><span>${esc(order.phone)}</span></div></div>
      ${order.note?`<p class="delivery-note"><b>备注：</b><span>${esc(order.note)}</span></p>`:''}</section>
    ${foodBill(order.items,order.fee,true,true)}
    <div class="action-bar detail-actions">
      ${riderPhone?`<button type="button" class="soft-button" data-act="contact" data-id="${esc(riderPhone)}">${icon('phone')} 联系骑手</button>`:''}
      <button type="button" class="soft-button contact-shop" data-act="contact" data-id="${esc(db.shop.phone)}">${icon('store')} 联系商家</button>
      ${order.status==='待核款'?btn('取消订单','cancel',order.id,'quiet danger'):''}
    </div></div>`;
};

function attributeFields(item){
  return attributeGroups(item).map(group=>`<fieldset class="sku-set"><legend>${esc(group.name)} ${group.multiple?'<small>可多选</small>':''}</legend><div>${group.choices.map((choice,index)=>`<label>
    <input type="${group.multiple?'checkbox':'radio'}" name="attr-${esc(group.id)}" value="${esc(choice.id)}" data-price="${choice.price}" ${!group.multiple&&index===0?'checked':''}>
    <span><b>${esc(choice.name)}</b>${choice.price?`<small>+${yuan(choice.price)}</small>`:''}</span></label>`).join('')}</div></fieldset>`).join('');
}
chooseSku = function(item){
  const variants=item.skus.map(sku=>{
    const line={product:item.id,sku:sku.id};
    return {...sku,remaining:Math.max(0,cartStock(line)-skuQuantity(db.cart,line))};
  });
  const current=variants.find(sku=>sku.remaining>0);
  modal(esc(item.name),`<div class="sku-visual"><div id="sku-photo">${photo(item.images[photoIndex%item.images.length],true)}</div>
    ${item.images.length>1?`<div class="photo-controls">${glyphButton('上一张','photo',item.id,'chevron-left')}${glyphButton('下一张','photo',item.id,'chevron')}</div>`:''}</div>
    <fieldset class="sku-set"><legend>选择规格</legend><div>${variants.map(sku=>`<label><input type="radio" name="sku" value="${esc(sku.id)}" data-price="${sku.price}" data-stock="${sku.remaining}" required ${sku.remaining?'':'disabled'} ${sku===current?'checked':''}><span><b>${esc(sku.name)}</b><small>${sku.remaining?yuan(sku.price):sku.stock?'已选满':'售罄'}</small></span></label>`).join('')}</div></fieldset>
    ${current?`${attributeFields(item)}<div class="sku-quantity"><b>数量</b><div class="stepper">${glyphButton('减少数量','qty-minus','','minus')}<input name="qty" aria-label="数量" value="1" readonly>${glyphButton('增加数量','qty-plus','','plus')}</div></div>`:callout('该菜品的可售数量已全部选入购物袋。可在购物袋中调整。')}`,current?data=>{
    const sku=item.skus.find(entry=>entry.id===data.sku), count=Number(data.qty);
    const selected=Array.from(dialog.querySelectorAll('input[name^="attr-"]:checked'),input=>input.value);
    const options=chosenAttributes(item,selected).map(choice=>choice.id);
    const candidate={product:item.id,sku:data.sku,options,qty:count};
    if(!sku||!item.active||!Number.isInteger(count)||count<1||count+skuQuantity(db.cart,candidate)>cartStock(candidate))throw Error('可售库存不足，请调整数量或规格。');
    const line=db.cart.find(entry=>sameCartLine(entry,candidate));
    if(line)line.qty+=count;else db.cart.push(candidate);
    markCartChanged();
    toast(`已加入 ${count} 件`);
  }:null,'加入购物袋',{
    sheet:true,
    caption:sellingTags(item),
    footer:current?'<div class="sku-summary"><span id="sku-stock" aria-live="polite"></span><output id="sku-total"></output></div>':''
  });
  updateSku();
};
cartDialog = function(){
  const cart=cartItems();
  modal('购物袋',cart.length?`<p class="sheet-hint">${quantity(cart)} 件商品 · ${feeText(db.shop.fee)}</p>
    <div class="cart-lines">${cart.map((line,index)=>{
      const stock=cartStock(line);
      const inactive=!product(line.product)?.active;
      const selected=skuQuantity(cart,line);
      const attributesChanged=cartAttributesChanged(line);
      return `<div class="food-row cart-line">${photo(menuName(line))}<div><b>${esc(line.name)}</b><small>${esc(itemSpec(line))}</small><strong>${yuan(line.price)}</strong>
      ${inactive||attributesChanged||stock<selected?`<small class="danger">${inactive?'商品已下架':attributesChanged?'属性已调整，请移除后重选':`当前可售 ${stock} 件`}</small>`:''}</div>
      <div class="stepper">${glyphButton('减少数量','cart-minus',index,'minus')}<b>${line.qty}</b>${glyphButton('增加数量','cart-plus',index,'plus','',inactive||attributesChanged||stock<=selected)}</div></div>`;
    }).join('')}</div>`:
    emptyCustomer('bag','购物袋是空的','选一道喜欢的米线，加进购物袋再结算。',btn('继续选餐','close','','soft-button')),null,undefined,{
    sheet:true,
    footer:cart.length?`<div class="cart-sheet-footer">${amountBlock('商品小计',subtotal(cart))}${btn('去结算','checkout','','primary',!canCheckout())}</div>`:''
  });
};
function updateSku(delta=0){
  const sku=dialog.querySelector('input[name=sku]:checked');
  if(!sku)return;
  const input=dialog.querySelector('input[name=qty]'), limit=Number(sku.dataset.stock);
  const count=Math.min(limit,Math.max(1,Number(input.value)+delta));
  input.value=count;
  dialog.querySelector('[data-act=qty-minus]').disabled=count<=1;
  dialog.querySelector('[data-act=qty-plus]').disabled=count>=limit;
  const extras=Array.from(dialog.querySelectorAll('input[name^="attr-"]:checked')).reduce((total,input)=>total+Number(input.dataset.price),0);
  dialog.querySelector('#sku-total').value=yuan((Number(sku.dataset.price)+extras)*count);
  dialog.querySelector('#sku-stock').textContent=limit<=3?`商品小计 · 还可选 ${limit} 件`:'商品小计';
}
dialog.addEventListener('change',event=>{if(event.target.name==='sku'||event.target.name.startsWith('attr-'))updateSku();});
document.addEventListener('input',event=>{
  const input=event.target;
  if(input.closest('.checkout-form')&&input.name==='mode')customerDraft.mode=input.value;
});
function needsAddress(form){return ['address','person','phone'].some(name=>!form.elements.namedItem(name)?.value);}
document.addEventListener('submit',event=>{
  if(event.target.matches('.checkout-form')&&needsAddress(event.target)){
    event.preventDefault();event.stopPropagation();editAddress();
  }
},true);
document.addEventListener('invalid',event=>{
  if(event.target.matches('.checkout-form select[name=slot]')){
    event.preventDefault();
    if(needsAddress(event.target.form))editAddress();else pickSlot();
  }
},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-act]');
  if(!button||busy)return;
  const {act,id}=button.dataset;
  if(act==='qty-minus'||act==='qty-plus')updateSku(act==='qty-plus'?1:-1);
  if(act==='pick-slot')pickSlot();
  if(act==='edit-checkout'){
    const hold=db.hold;
    if(hold&&!hold.released)Object.assign(customerDraft,{address:hold.address,person:hold.person,phone:hold.phone,note:hold.note,mode:hold.slot?'reserve':'instant',slot:hold.slot?String(hold.due):''});
    change('结算');
  }
  if(act==='review-transfer')$('.checkout-form').requestSubmit($('.checkout-form button[type=submit], .checkout-form .action-bar button'));
  if(act==='edit-address')editAddress();
  if(act==='edit-note')editNote();
  if(act==='preview-qr')modal('演示收款码',`<div class="qr-enlarged">${customerQr(db.hold?.qr)}</div>${callout('仅供演示，请勿实际转账。')}`);
  if(act==='checkout'&&$('#notice').textContent.startsWith('已加入'))$('#notice').textContent='';
  if(act==='set-slot'){
    const selectInput=$('#slot-field select');
    const current=checkoutSlots().find(([start])=>String(start)===id);
    if(!current){dialog.close();toast('这个时段已不可选，请重新选择。');return;}
    if(!Array.from(selectInput.options).some(option=>option.value===id))selectInput.add(new Option(current[1],id));
    customerDraft.slot=selectInput.value=id;
    $('.slot-trigger b').textContent=current[1];
    dialog.close();
    $('.slot-trigger').focus({preventScroll:true});
  }
});
const originalPlaceHold=placeHold;
placeHold=function(data){
  originalPlaceHold(data);
  for(const name of Object.keys(customerDraft))delete customerDraft[name];
};
setInterval(()=>{
  const clocks=document.querySelectorAll('.checkout-countdown');
  for(const clock of clocks)clock.textContent=countdown(Number(clock.dataset.expires));
  if(clocks.length&&db.hold?.released&&!dialog.open&&!busy)render();
},1000);
render();
