const opsButton = (label, act, id='', {glyph='',variant='',disabled=false}={}) =>
  `<button type="button" class="ops-button ${variant}" data-act="${act}" data-id="${esc(id)}" ${disabled?'disabled':''}>${glyph?icon(glyph):''}<span>${esc(label)}</span></button>`;
const opsBadge = (label,tone='') => `<span class="ops-badge ${tone}">${esc(label)}</span>`;
const opsPageTitle = (title,side='') => `<header class="ops-heading"><h1>${title}</h1>${side}</header>`;
const opsSectionTitle = (title,glyph) => `<h2 class="ops-section-title">${icon(glyph)}${title}</h2>`;
const opsEmpty = (title,glyph,copy='') => `<div class="ops-card ops-empty"><span class="ops-glyph">${icon(glyph)}</span><h2>${title}</h2>${copy?`<p>${copy}</p>`:''}</div>`;
const opsFooter = (...actions) => `<div class="ops-footer"><div>${actions.filter(Boolean).join('')}</div></div>`;
const opsBack = (label,act='back-detail') => opsButton(label,act,'',{glyph:'arrow',variant:'ops-back'});
const opsOrderRef = (order, time=order.events?.[0]?.[1]) => `<span class="ops-order-ref"><b>#${esc(order.number)}</b><time>${esc(order.date.slice(5).replace('-', '/'))}${time?` ${hhmm(time)}`:''}</time></span>`;
const opsStatus = status => `<span class="ops-badge" data-order-status="${esc(status)}">${esc(status)}</span>`;
const opsOrderWindow = order => order.slot?`预约 ${order.slot}`:windowName(order);
const opsOrderItems = order => `<div class="ops-item-list">${order.items.map(item=>`<div class="ops-item"><div><strong>${esc(item.name)}</strong><small>${esc(itemSpec(item))}</small></div><b>×${item.qty}</b></div>`).join('')}</div>`;
const opsPhone = (label,phone) => phone?`<button type="button" class="ops-button ops-phone" data-act="contact" data-id="${esc(phone)}" aria-label="${esc(label)}">${icon('phone')}</button>`:'';
const opsUserNote = note => note?.trim()?`<span class="order-note"><b>备注：</b><span>${esc(note)}</span></span>`:'';
const opsClosedFilters = [['已完结','全部'],['已完成','已完成'],['已取消','已取消']];
const opsSearchEntry = () => opsButton('搜索订单','ops-search','',{glyph:'search',variant:'ops-search-entry'});
let opsDates = {start:'',end:''}, opsQuery = '', opsSearchSource;

function opsFilterButton(label,id,active,count){
  return `<button type="button" data-act="filter" data-id="${esc(id)}" aria-pressed="${active}">${esc(label)}${count===undefined?'':`<small>${count}</small>`}</button>`;
}
function opsQueueNav(queues,selected,count){
  return `<nav class="ops-queue-nav" aria-label="订单队列">${queues.map(queue=>opsFilterButton(queue.name,queue.filters[0][0],queue===selected,count(queue))).join('')}</nav>`;
}
function opsFilterBar(queue,selected){
  if(queue.filters.length===1)return '';
  const closed=queue.name==='已完结';
  const {start,end}=opsDates;
  const shortDate=value=>value.slice(5).replace('-','/');
  const label=start&&end?(start===end?shortDate(start):`${shortDate(start)}–${shortDate(end)}`):start?`${shortDate(start)} 起`:end?`至 ${shortDate(end)}`:'日期';
  return `<div class="ops-filter-bar"><div class="ops-segments" role="group" aria-label="筛选${queue.name}订单">${queue.filters.map(([id,name])=>opsFilterButton(name,id,selected===id)).join('')}</div>
    ${closed?`<button type="button" class="ops-button ops-date-filter" data-act="ops-dates" aria-label="完结日期范围${start||end?'：'+(start||'不限')+' 至 '+(end||'不限'):''}" data-active="${!!(start||end)}">${icon('calendar')}<span>${label}</span></button>`:''}</div>`;
}
function opsClosedTime(order){
  const timestamp=orderClosedAt(order);
  if(!timestamp)return order.status;
  const date=day(timestamp);
  return `${order.status==='已完成'?'送达':'取消'} ${date!==order.date?date.slice(5).replace('-','/')+' ':''}${hhmm(timestamp)}`;
}
function opsClosedList(orders,selected){
  const {start,end}=opsDates;
  return orders.filter(order=>{
    if(!isClosedOrder(order)||selected!=='已完结'&&order.status!==selected)return false;
    const timestamp=orderClosedAt(order);
    const date=timestamp?day(timestamp):order.date;
    return (!start||date>=start)&&(!end||date<=end);
  }).sort((left,right)=>(orderClosedAt(right)||0)-(orderClosedAt(left)||0));
}
function opsStats(orders){
  const completed=orders.filter(order=>order.status==='已完成');
  const merchant=role==='merchant';
  return `<section class="ops-card ops-stats" aria-label="完结统计">
    <div class="ops-stats-head"><h2>完结统计</h2><small>仅统计已完成订单</small></div>
    <dl class="ops-stats-values"><div><dt>完成订单数</dt><dd>${completed.length}<small> 单</small></dd></div>
    ${merchant?`<div><dt>总收益</dt><dd class="ops-revenue">${yuan(completed.reduce((total,order)=>total+subtotal(order.items)+order.fee,0))}</dd></div>`:''}</dl>
    </section>`;
}
function opsDateDialog(){
  modal('完结日期范围',`<p class="ops-copy">按订单完成或取消的日期筛选。</p>
    <div class="ops-date-fields">${field('开始日期','start',opsDates.start,'type="date"')}${field('结束日期','end',opsDates.end,'type="date"')}</div>
    ${opsButton('清除日期','ops-clear-dates','',{variant:'ops-quiet ops-clear-dates'})}`,data=>{
    if(data.start&&data.end&&data.start>data.end)throw Error('结束日期不能早于开始日期。');
    opsDates={start:data.start,end:data.end};
  },'应用筛选',{sessionOnly:true});
}
function opsSearchMatches(order){
  const query=opsQuery.normalize('NFKC').replace(/[\s-]/g,'');
  if(!/^#?\d+$/.test(query))return false;
  const serial=query.replace(/^#?0+(?=\d)/,'').replace(/^#/,'');
  if(serial===String(order.number))return true;
  if(query.startsWith('#'))return false;
  return orderNumber(order)===query||((role==='merchant'||currentRider()?.id===order.rider)&&query.length>=4&&order.phone?.includes(query));
}
function opsSearchResults(){
  if(!opsQuery.trim())return opsEmpty('输入关键词查询','search','支持收货手机号后四位。');
  const {orders,card}=opsSearchSource;
  const results=orders.filter(opsSearchMatches).sort((left,right)=>right.date.localeCompare(left.date)||right.number-left.number);
  return results.length?`<p class="ops-copy ops-search-count" role="status">${results.length} 笔订单</p><div class="ops-stack">${results.map(card).join('')}</div>`:opsEmpty('未找到匹配订单','search','试试其他流水号、订单号或收货手机号。');
}
function opsSearchPage(orders,card){
  opsSearchSource={orders,card};
  return `<div class="ops-page ops-search-page">${opsBack('返回订单','ops-search-back')}
    ${opsPageTitle('搜索订单')}
    <div class="ops-search-field">${icon('search')}<input data-ops-query aria-label="搜索订单" inputmode="numeric" autocomplete="off" placeholder="流水号、订单号或收货手机号" maxlength="24" value="${esc(opsQuery)}">
    <button type="button" class="ops-search-clear" data-act="ops-clear-query" aria-label="清空搜索" ${opsQuery?'':'hidden'}>${icon('close')}</button></div>
    <div data-ops-search-results>${opsSearchResults()}</div>
    </div>`;
}

screen.addEventListener('input',event=>{
  if(!event.target.hasAttribute('data-ops-query'))return;
  opsQuery=event.target.value;
  screen.querySelector('[data-act=ops-clear-query]').hidden=!opsQuery;
  screen.querySelector('[data-ops-search-results]').innerHTML=opsSearchResults();
});
screen.addEventListener('click',event=>{
  const control=event.target.closest('[data-act]');
  if(!control||!isAuthed()||busy)return;
  const action=control.dataset.act;
  if(action==='ops-search'){
    opsQuery='';
    view='订单搜索';
    render();
    window.scrollTo(0,0);
    screen.querySelector('[data-ops-query]').focus();
  }else if(action==='ops-search-back'){
    view='订单';
    render();
    window.scrollTo(0,0);
    screen.querySelector('[data-act=ops-search]')?.focus();
  }else if(action==='ops-clear-query'){
    const input=screen.querySelector('[data-ops-query]');
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
  }else if(action==='ops-dates')opsDateDialog();
});
dialog.addEventListener('click',event=>{
  if(!event.target.closest('[data-act=ops-clear-dates]')||busy)return;
  const start=dialog.querySelector('[name=start]');
  start.value='';
  dialog.querySelector('[name=end]').value='';
  dialog.querySelector('#modal-error').hidden=true;
  start.focus();
});

function opsOrderCard(order,{status=order.status,time=opsOrderWindow(order),masked=false,destinationFirst=false,extra='',amount='',actions=''}={}){
  const products=`<span class="ops-ticket-block ops-ticket-products">${icon('bag')}<span class="ops-ticket-lines">
    ${order.items.map(item=>`<span><span class="ops-ticket-dish"><strong>${esc(item.name)}</strong><b>×${item.qty}</b></span><small class="ops-ticket-spec">${esc(itemSpec(item))}</small></span>`).join('')}</span></span>`;
  const destination=`<span class="ops-ticket-block ops-ticket-address">${icon('location')}<span>
    <strong>${esc(masked?addressHint(order.address):order.address)}</strong>
    ${masked?'':`<span class="ops-ticket-contact"><small>${esc(order.person)}</small><small>${esc(order.phone)}</small></span>`}
    ${opsUserNote(order.note)}
    </span></span>`;
  return `<article class="ops-card ops-ticket">
    <button type="button" class="ops-ticket-link" data-act="detail" data-id="${esc(order.id)}">
      <span class="ops-row ops-ticket-head">${opsOrderRef(order)}<span>${opsStatus(status)}${icon('chevron')}</span></span>
      <span class="ops-ticket-window">${icon('clock')}${esc(time)}</span>
      <span class="ops-ticket-body">${destinationFirst?destination+products:products+destination}</span>
      ${extra}
    </button>
    ${amount||actions?`<div class="ops-ticket-footer">${amount}${actions?`<div class="ops-ticket-actions">${actions}</div>`:''}</div>`:''}
    </article>`;
}

screen.addEventListener('focusin',event=>{
  const target=event.target;
  requestAnimationFrame(()=>{
    if(document.activeElement!==target)return;
    const footer=screen.querySelector('.ops-footer')||$('#tabs:not(:empty)');
    if(!footer)return;
    const overlap=target.getBoundingClientRect().bottom-footer.getBoundingClientRect().top+8;
    if(overlap>0)window.scrollBy(0,overlap);
  });
});

function opsTimeline(order){
  return `<details class="ops-card ops-log"><summary>${icon('clock')}<b>订单动态</b>${icon('chevron')}</summary><ol>
    ${[...order.events].reverse().map(([label,time])=>`<li><time>${hhmm(time)}</time><span>${esc(label)}</span></li>`).join('')}</ol></details>`;
}

login = function(){
  const rider=role==='rider';
  return `<section class="ops-login" aria-labelledby="ops-login-title">
    <div class="ops-brand"><span>${icon('bolt')}</span>${shopTitle}</div>
    <div class="ops-card">
      <h1 id="ops-login-title">${rider?'骑手登录':'商家登录'}</h1>
      <form data-form="login">
        ${rider?field('骑手账号','account','rider01','required autocomplete="username" autocapitalize="none" spellcheck="false"'):''}
        ${field('密码','password','','type="password" required autocomplete="current-password" placeholder="输入登录密码"')}
        <button type="submit" class="ops-button ops-primary">登录工作台</button>
      </form>
      <p class="ops-demo">${rider?'演示账号 rider01 / rider02 · 初始密码':'演示密码'} <code>${rider?'demo123':'shop123'}</code></p>
    </div></section>`;
};
