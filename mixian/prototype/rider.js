(() => {
  const queues = [
    {name:'待接单', filters:[['待接单','全部']],empty:['暂无可接订单','inbox']},
    {name:'配送中', filters:[['配送中','全部']],empty:['暂无在途订单','truck']},
    {name:'已完结', filters:opsClosedFilters,empty:['暂无符合条件的订单','check-circle']},
  ];
  const riderDestination = (order, masked) => masked ? addressHint(order.address) : order.address;

  function riderCard(order){
    const available=order.status==='待配送';
    const active=order.status==='配送中';
    const time=isClosedOrder(order)?opsClosedTime(order):opsOrderWindow(order);
    const actions=available?opsButton('确认接单','take',order.id,{variant:'ops-primary'}):active?
      opsButton('联系收货人','contact',order.phone,{glyph:'phone'})+opsButton('确认送达','deliver',order.id,{variant:'ops-primary'}):'';
    return opsOrderCard(order,{status:available?'待接单':order.status,time,masked:available,destinationFirst:true,actions});
  }

  riderPage = function(){
    const rider=currentRider();
    if(view==='我的')return profile(rider);
    const owned=db.orders.filter(order=>order.rider===rider.id);
    const pickup=db.orders.filter(canTake);
    if(view==='订单搜索')return opsSearchPage([...new Set([...pickup,...owned])],riderCard);
    const active=owned.filter(order=>order.status==='配送中');
    const queue=queues.find(group=>group.filters.some(([id])=>id===filter))||queues[0];
    const available=queue.name==='待接单', closed=queue.name==='已完结';
    const list=closed?opsClosedList(owned,filter):(available?pickup:active).sort((left,right)=>left.due-right.due);
    const later=available?db.orders.filter(order=>order.status==='待配送'&&order.slot&&order.eligible>now()).length:0;
    return `<div class="ops-page rx-page">
      ${opsPageTitle('订单',opsSearchEntry())}
      ${opsQueueNav(queues,queue,group=>group.name==='待接单'?pickup.length:group.name==='配送中'?active.length:undefined)}
      ${opsFilterBar(queue,filter)}
      ${closed?opsStats(list):''}
      ${later?`<p class="ops-copy ops-icon-text rx-later">${icon('clock')}${later} 笔预约单尚未到接单时间</p>`:''}
      <div class="ops-stack">${list.length?list.map(riderCard).join(''):opsEmpty(...queue.empty)}</div>
    </div>`;
  };

  function profile(rider){
    return `<div class="ops-page rx-profile">
      ${opsPageTitle('我的')}
      <section class="ops-card">
        <div class="rx-profile-head"><span class="ops-glyph">${icon('rider')}</span><div><h2>${esc(rider.name)}</h2><p class="ops-copy">骑手账号 · ${esc(rider.account)}</p></div></div>
        <div class="rx-profile-phone"><span>联系电话</span><b>${esc(rider.phone)}</b></div>
        ${opsButton('编辑资料','rider-profile-edit','',{glyph:'edit'})}
      </section>
      <section class="ops-card rx-profile-actions">
        ${opsButton('重置密码','rider-profile-password','',{glyph:'lock',variant:'ops-quiet'})}
        ${opsButton('退出登录','expire-session','',{glyph:'logout',variant:'ops-quiet'})}
      </section>
    </div>`;
  }

  const baseDetail=detail;
  detail=function(order){
    if(role!=='rider')return baseDetail(order);
    const owns=order&&currentRider()?.id===order.rider;
    const back=opsBack(view==='订单搜索'?'返回搜索':'返回订单');
    if(!order||!owns&&!canTake(order))return `<div class="ops-page">${back}${opsEmpty('订单状态已变更','inbox','返回列表查看可接订单。')}</div>`;
    const active=owns&&order.status==='配送中';
    const time=isClosedOrder(order)?opsClosedTime(order):opsOrderWindow(order);
    const action=owns?(active?opsButton('确认送达','deliver',order.id,{glyph:'check',variant:'ops-primary'}):''):opsButton('确认接单','take',order.id,{variant:'ops-primary'});
    return `<div class="ops-page rx-detail">${back}
      ${opsPageTitle(owns?esc(order.status):'待接单',opsOrderRef(order))}
      <section class="ops-card rx-address">
        <span class="rx-window">${icon('clock')}${esc(time)}</span>
        <div class="ops-contact-row"><div class="rx-destination"><span class="ops-glyph">${icon('location')}</span><div><small>送达地点</small><strong>${esc(riderDestination(order,!owns))}</strong>
          ${owns?`<div class="rx-recipient"><b>${esc(order.person)}</b><span>${esc(order.phone)}</span></div>`:''}</div></div>${owns?opsPhone('联系收货人',order.phone):''}</div>
        ${opsUserNote(order.note,true)}
        ${!owns?'<p class="ops-copy">接单后显示完整地址和联系人</p>':''}
        ${order.status==='已取消'&&order.reason?`<p class="ops-copy">取消原因：${esc(order.reason)}</p>`:''}
        ${orderNumberField(order)}
      </section>
      <section class="ops-card">${opsSectionTitle('商品明细','bag')}${opsOrderItems(order)}</section>
      ${owns?opsTimeline(order):''}
      ${action?opsFooter(action):''}
    </div>`;
  };
  screen.addEventListener('click',event=>{
    const control=event.target.closest('[data-act=rider-profile-edit],[data-act=rider-profile-password]');
    const rider=currentRider();
    if(!control||busy||!rider)return;
    if(control.dataset.act==='rider-profile-edit'){
      modal('编辑资料',`${field('名称','name',rider.name,'required maxlength="24" autocomplete="name"')}
        ${field('联系电话','phone',rider.phone,'type="tel" required pattern="1[0-9]{10}" autocomplete="tel"')}`,data=>{
        const account=currentRider(), name=data.name.trim();
        if(!account||account.id!==rider.id)throw Error('请重新登录后修改资料。');
        if(!name)throw Error('请输入名称。');
        Object.assign(account,{name,phone:data.phone});
        for(const order of db.orders)if(order.rider===account.id&&order.status==='配送中')assignRider(order,account);
        toast('资料已更新');
      },'保存资料');
    }else{
      modal('重置密码',`${field('当前密码','current','','type="password" required autocomplete="current-password"')}
        ${field('新密码','password','','type="password" required minlength="6" autocomplete="new-password" placeholder="至少 6 位"')}
        ${field('确认新密码','confirm','','type="password" required minlength="6" autocomplete="new-password"')}`,data=>{
        const account=currentRider();
        if(!account||account.id!==rider.id)throw Error('请重新登录后重置密码。');
        if(data.current!==account.password)throw Error('当前密码不正确。');
        if(data.password.trim().length<6)throw Error('新密码至少 6 位。');
        if(data.password!==data.confirm)throw Error('两次输入的新密码不一致。');
        account.password=data.password;
        toast('密码已更新');
      },'保存新密码');
    }
  });
  render();
})();
