(() => {
  const symbol = name => `<span class="mx-icon">${icon(name)}</span>`;
  const queues = [
    {name:'待核款', filters:[['待核款','全部']]},
    {name:'进行中', filters:[['进行中','全部'],['待配送','待配送'],['配送中','配送中']]},
    {name:'已完结', filters:opsClosedFilters},
  ];

  function matches(order,key){
    if(key==='进行中')return ['待配送','配送中'].includes(order.status);
    return order.status===key;
  }
  const dispatchButton=order=>order.status==='待配送'?opsButton('派单','mx-dispatch',order.id,{variant:'ops-primary'}):
    order.status==='配送中'?opsButton('转单','mx-dispatch',order.id,{variant:'ops-primary'}):'';

  function dispatch(order){
    if(!order||!['待配送','配送中'].includes(order.status))return;
    const changeRider=order.status==='配送中';
    const label=changeRider?'转单':'派单';
    if(!changeRider&&!canTake(order)){
      modal('派单',callout(`预约单 ${hhmm(order.eligible)} 后可派单。`));
      return;
    }
    const candidates=db.riders.filter(rider=>rider.active&&rider.id!==order.rider);
    const ref=`<div class="ops-row">${opsOrderRef(order)}${changeRider?`<span class="ops-copy">当前骑手：${esc(order.riderName||'未设置')}</span>`:''}</div>`;
    if(!candidates.length){
      modal(label,ref+opsEmpty(changeRider?'暂无其他可用骑手':'暂无可用骑手','users'));
      return;
    }
    const originalRider=order.rider;
    modal(label,ref+`<fieldset class="mx-dispatch-options"><legend>选择骑手</legend>${candidates.map(rider=>{
      const workload=db.orders.filter(item=>item.status==='配送中'&&item.rider===rider.id).length;
      return `<label class="mx-dispatch-option">
        <span class="ops-glyph">${icon('rider')}</span><span><b>${esc(rider.name)}</b><small>${workload?workload+' 单配送中':'暂无在途订单'}</small></span>
        <input type="radio" name="rider" value="${esc(rider.id)}" required>
      </label>`;
    }).join('')}</fieldset>`,data=>{
      if(!isAuthed()||order.status!==(changeRider?'配送中':'待配送')||order.rider!==originalRider||!changeRider&&!canTake(order))throw Error('订单状态已变更，请刷新后重试。');
      const rider=db.riders.find(item=>item.id===data.rider&&item.active&&item.id!==originalRider);
      if(!rider)throw Error('请选择可用骑手。');
      const previous=order.riderName;
      assignRider(order,rider);
      order.status='配送中';
      event(order,changeRider?`商家端 · 转单：${previous||'原骑手'} → ${rider.name}`:`商家端 · 派单：${rider.name}`);
      toast(changeRider?'已转单':'已派单');
    },'确认'+label);
  }
  screen.addEventListener('click',event=>{
    const control=event.target.closest('[data-act="mx-dispatch"]');
    if(control&&!busy&&isAuthed())dispatch(byOrder(control.dataset.id));
  });

  function orderCard(order){
    const pending=order.status==='待核款', waiting=order.status==='待配送';
    const actions=pending?opsButton('确认到账','verify',order.id,{variant:'ops-primary'}):dispatchButton(order);
    const amount=`<span class="ops-ticket-amount ${pending?'is-due':''}"><small>${pending?'应核金额':'订单金额'}</small><b>${yuan(subtotal(order.items)+order.fee)}</b></span>`;
    const extra=waiting&&order.eligible>now()?`<span class="ops-copy">${hhmm(order.eligible)} 后可接单</span>`:'';
    return opsOrderCard(order,{time:isClosedOrder(order)?opsClosedTime(order):opsOrderWindow(order),extra,amount,actions});
  }
  function orders(){
    const queue=queues.find(group=>group.filters.some(([id])=>id===filter))||queues[0];
    const key=queue.filters.some(([id])=>id===filter)?filter:queue.filters[0][0];
    const closed=queue.name==='已完结';
    const list=closed?opsClosedList(db.orders,key):db.orders.filter(order=>matches(order,key)).reverse();
    const shopStatus=db.shop.paused?'暂停接单':isOpen()?'营业中':'休息中';
    return `${opsPageTitle('订单',`<div class="ops-heading-actions">${opsSearchEntry()}${opsButton(shopStatus,'tab','设置',{glyph:'store',variant:'mx-shop-status'})}</div>`)}
      ${opsQueueNav(queues,queue,group=>group.name==='已完结'?undefined:db.orders.filter(order=>matches(order,group.filters[0][0])).length)}
      ${opsFilterBar(queue,key)}
      ${closed?opsStats(list):''}
      <div class="ops-stack">${list.length?list.map(orderCard).join(''):opsEmpty('暂无相关订单','inbox')}</div>`;
  }

  function products(){
    return `${opsPageTitle('商品管理',opsButton('新增商品','edit-product','',{glyph:'plus',variant:'ops-primary'}))}
      <div class="ops-stack">${db.products.map(item=>{
        const stock=item.skus.reduce((total,sku)=>total+sku.stock,0);
        return `<article class="ops-card mx-list-card">
          <button type="button" class="mx-product-row" data-act="edit-product" data-id="${esc(item.id)}" aria-label="编辑${esc(item.name)}">
            ${photo(item.images[0])}<span><strong>${esc(item.name)}</strong><small>${esc(item.cat)}</small></span>${icon('chevron')}
          </button>
          <ul class="mx-inventory" aria-label="规格售价和库存">${item.skus.map(sku=>`<li><span>${esc(sku.name)}</span><b>${yuan(sku.price)}</b><small>可售 ${sku.stock} 件</small></li>`).join('')}</ul>
          <div class="ops-row mx-card-actions">${opsBadge(item.active?(stock?'在售':'售罄'):'已下架',item.active&&stock?'is-good':'')}${opsButton(item.active?'下架':'上架','toggle-product',item.id,{variant:'ops-quiet'})}</div>
        </article>`;
      }).join('')||opsEmpty('暂无商品','package','新增商品后可设置售价和库存。')}</div>`;
  }

  function riders(){
    return `${opsPageTitle('骑手管理',opsButton('新增骑手','edit-rider','',{glyph:'plus',variant:'ops-primary'}))}
      <div class="ops-stack">${db.riders.map(item=>{
        const deliveries=db.orders.filter(order=>order.rider===item.id&&order.status==='配送中').length;
        return `<article class="ops-card mx-list-card">
          <div class="ops-row mx-rider-row"><span class="ops-glyph">${icon('rider')}</span><div><strong>${esc(item.name)}</strong><p class="ops-copy">${esc(item.account)} · ${esc(item.phone)}</p>
          ${deliveries?`<small>${deliveries} 单配送中</small>`:''}</div>${opsBadge(item.active?'启用中':'已停用',item.active?'is-good':'')}</div>
          <div class="mx-rider-actions">
            ${opsButton('编辑资料','edit-rider',item.id)}
            ${opsButton('重置密码','reset-rider',item.id)}
            ${opsButton(item.active?'停用账号':'启用账号','toggle-rider',item.id,{disabled:!!deliveries})}
          </div>
        </article>`;
      }).join('')||opsEmpty('暂无骑手','users')}</div>`;
  }

  function settings(){
    const shop=db.shop;
    return `${opsPageTitle('店铺设置')}
      <form data-form="shop" class="ops-stack">
        <section class="ops-card">
          ${opsSectionTitle('营业与配送','clock')}
          <label class="mx-check mx-switch"><span><b>暂停接新单</b><small>已有订单照常履约</small></span><input name="paused" role="switch" type="checkbox" value="yes" ${shop.paused?'checked':''}></label>
          <div class="mx-fields">${field('营业开始','open',shop.open,'type="time" required')}${field('营业结束','close',shop.close,'type="time" required')}${field('履约时间（分钟）','eta',shop.eta,'type="number" min="1" max="180" required')}${field('配送费（元）','fee',(shop.fee/100).toFixed(2),'type="number" min="0" step=".01" required')}</div>
          ${field('商家联系电话','phone',shop.phone,'type="tel" required pattern="1[0-9]{10}"')}
        </section>
        <section class="ops-card">
          ${opsSectionTitle('店铺公告','clipboard')}
          <label class="field"><span class="mx-sr">公告内容</span><textarea name="announcement" rows="3" maxlength="100" placeholder="填写要展示给顾客的公告">${esc(shop.announcement??defaultAnnouncement)}</textarea></label>
          <p class="mx-meta">显示在点餐首页，留空不展示。</p>
        </section>
        <section class="ops-card" data-mx-qr>${opsSectionTitle('收款图','wallet')}
          <input type="file" name="qr" accept="${imageUploadTypes.join(',')}" aria-label="选择演示收款图" hidden>
          <input type="hidden" name="remove" value="">
          <div class="mx-media-grid" data-mx-qr-preview>${paymentPhoto(shop.qr)}</div>
          <p class="mx-meta" data-mx-qr-status role="status" hidden></p>
        </section>
        <button class="ops-button ops-primary" type="submit">保存设置</button>
      </form>
      ${opsButton('退出登录','expire-session','',{glyph:'logout',variant:'ops-quiet'})}`;
  }

  merchantPage = function(){
    if(view==='订单搜索')return opsSearchPage(db.orders,orderCard);
    const page={商品:products,骑手:riders,设置:settings}[view]||orders;
    return `<div class="ops-page mx-page">${page()}</div>`;
  };

  const previousDetail=detail;
  detail=function(order){
    if(role!=='merchant'||!order)return previousDetail(order);
    const amount=yuan(subtotal(order.items)+order.fee);
    const pending=order.status==='待核款';
    const closed=isClosedOrder(order);
    const main=pending?opsButton('确认到账','verify',order.id,{variant:'ops-primary'}):dispatchButton(order);
    const rider=order.rider&&(order.riderName||order.riderPhone);
    return `<div class="ops-page mx-page mx-detail">${opsBack(view==='订单搜索'?'返回搜索':'返回订单')}
      ${opsPageTitle(esc(order.status),opsOrderRef(order))}
      <section class="ops-card mx-summary">
        <div class="ops-row"><span>${pending?'应核金额':'订单金额'}</span><strong>${amount}</strong></div>
        <span class="ops-copy ops-icon-text">${icon('clock')} ${esc(closed?opsClosedTime(order):opsOrderWindow(order))}</span>
        ${order.slot&&order.status==='待配送'?`<small>${hhmm(order.eligible)} 后可接单</small>`:''}
        ${order.reason?`<p class="ops-copy">取消原因 · ${esc(order.reason)}</p>`:''}
        ${orderNumberField(order)}
      </section>
      <section class="ops-card">${opsSectionTitle('商品明细','bag')}${opsOrderItems(order)}
        <div class="mx-fees"><span>配送费</span><b>${order.fee?yuan(order.fee):'免配送费'}</b></div>
      </section>
      <section class="ops-card mx-receiving">${opsSectionTitle('收货信息','location')}
        <div class="ops-contact-row"><div><strong>${esc(order.address)}</strong><p class="ops-copy">${esc(order.person)} · ${esc(order.phone)}</p></div>${opsPhone('联系收货人',order.phone)}</div>
        ${opsUserNote(order.note,true)}
      </section>
      ${rider?`<section class="ops-card mx-receiving">${opsSectionTitle('骑手信息','rider')}
        <div class="ops-contact-row"><div><strong>${esc(order.riderName||'配送骑手')}</strong>${order.riderPhone?`<p class="ops-copy">${esc(order.riderPhone)}</p>`:''}</div>${opsPhone('联系骑手',order.riderPhone)}</div>
      </section>`:''}
      ${opsTimeline(order)}
      ${!closed?opsFooter(opsButton('取消订单','cancel',order.id,{variant:'ops-destructive'}),main):''}
    </div>`;
  };

  const maxImages = 4;
  const maxTags = 6;
  const photoTypes = imageUploadTypes.join(',');
  const newSku = () => ({id: newId(), name: '', price: 0, stock: 0});
  const newChoice = () => ({id: newId(), name: '', price: 0});
  const iconControl = (label, glyph, attrs) => `<button type="button" class="mx-icon-control" aria-label="${esc(label)}" ${attrs}>${icon(glyph)}</button>`;
  const addImageTile = (label,attrs) => `<button type="button" class="mx-media-add" ${attrs}>${icon('plus')}${label}</button>`;
  const paymentPhoto = source => source?`<div class="mx-media-thumb mx-qr-thumb">
    <button type="button" class="mx-qr-preview" data-mx-qr-pick aria-label="更换收款图"><img src="${esc(source)}" alt="演示收款图"></button>
    ${iconControl('移除收款图','close','data-mx-qr-remove')}</div>`:addImageTile('添加图片','data-mx-qr-pick aria-label="添加演示收款图"');

  screen.addEventListener('click',event=>{
    const control=event.target.closest('[data-mx-qr-pick],[data-mx-qr-remove]');
    if(!control||busy)return;
    const section=control.closest('[data-mx-qr]');
    if(section.getAttribute('aria-busy')==='true')return;
    const input=section.querySelector('[name=qr]');
    if(control.hasAttribute('data-mx-qr-pick'))input.click();
    else{
      input.value='';
      section.querySelector('[name=remove]').value='yes';
      section.querySelector('[data-mx-qr-preview]').innerHTML=paymentPhoto('');
      section.querySelector('[data-mx-qr-status]').hidden=true;
      section.querySelector('[data-mx-qr-pick]').focus();
    }
  });
  screen.addEventListener('change',async event=>{
    const input=event.target;
    const section=input.closest('[data-mx-qr]');
    if(!section||input.name!=='qr'||!input.files.length)return;
    const saveButton=input.form.querySelector('[type=submit]');
    const info=section.querySelector('[data-mx-qr-status]');
    const preview=section.querySelector('[data-mx-qr-preview]');
    const remove=section.querySelector('[name=remove]');
    section.setAttribute('aria-busy','true');
    saveButton.disabled=true;
    try{
      const source=await readPaymentImage(input.files[0]);
      preview.innerHTML=paymentPhoto(source);
      remove.value='';
      info.hidden=true;
    }catch(error){
      input.value='';
      preview.innerHTML=paymentPhoto(remove.value?'':db.shop.qr);
      info.textContent=error.message;
      info.hidden=false;
    }finally{
      section.removeAttribute('aria-busy');
      saveButton.disabled=false;
      if(section.isConnected)preview.querySelector('[data-mx-qr-pick]').focus({preventScroll:true});
    }
  });
  const choiceRow = choice => `<div class="mx-choice" data-choice="${esc(choice.id)}">
    ${field('<span class="mx-sr">选项名称</span>','choice-name',choice.name,'maxlength="12" placeholder="例：微辣"')}
    ${field('<span class="mx-sr">加价（元）</span>','choice-price',choice.price?(choice.price/100).toFixed(2):'','inputmode="decimal" maxlength="7" placeholder="0"')}
    ${iconControl('移除选项','close','data-mx-remove-choice')}</div>`;
  const groupRow = group => `<fieldset class="mx-editor-card" aria-label="商品属性组" data-group="${esc(group.id)}">
    <div class="mx-editor-row mx-group-head">${field('属性名称','group-name',group.name,'maxlength="12" placeholder="例：口味"')}
      <label class="field">选择方式<select name="group-mode"><option value="single">单选</option><option value="multiple" ${group.multiple?'selected':''}>多选</option></select></label>
      ${iconControl('移除属性组','close','data-mx-remove-group')}</div>
    <div class="mx-choice mx-choice-labels" aria-hidden="true"><span>选项名称</span><span>加价（元）</span></div>
    <div class="mx-choices">${group.choices.map(choiceRow).join('')}</div>
    <button type="button" class="ops-button ops-quiet mx-inline" data-mx-add-choice>${symbol('plus')}添加选项</button>
    </fieldset>`;

  async function readProductPhoto(file){
    if(!photoTypes.split(',').includes(file.type)||file.size>15_000_000)throw Error('请选择 15 MB 以内的 JPG、PNG 或 WebP 图片。');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      image.src=url;
      await image.decode();
      const canvas=document.createElement('canvas'), context=canvas.getContext('2d');
      for(const edge of [960,720,480]){
        const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        context.fillStyle='#fff';
        context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        const result=canvas.toDataURL('image/jpeg',.84);
        if(result.length<260_000)return result;
      }
      throw Error('无法压缩图片。');
    }catch{
      throw Error('有图片无法读取，请重新选择。');
    }finally{URL.revokeObjectURL(url);}
  }

  function readGroups(container){
    const check=(valid,input,message)=>{
      if(valid)return;
      input.focus();
      throw Error(message);
    };
    const names=new Set();
    return Array.from(container.children,row=>{
      const input=row.querySelector('[name="group-name"]'), name=input.value.trim();
      check(name&&!names.has(name),input,'请填写属性名称，同一商品内不能重复。');
      names.add(name);
      const choiceNames=new Set();
      const choices=Array.from(row.querySelectorAll('[data-choice]'),choice=>{
        const input=choice.querySelector('[name="choice-name"]'), name=input.value.trim();
        const amount=choice.querySelector('[name="choice-price"]'), price=amount.value.trim()||'0';
        check(name&&!choiceNames.has(name),input,'请填写选项名称，同组内不能重复。');
        check(/^\d{1,4}(\.\d{1,2})?$/.test(price),amount,'加价请输入 0–9999.99 元，最多两位小数。');
        choiceNames.add(name);
        return {id:choice.dataset.choice,name,price:Math.round(Number(price)*100)};
      });
      return {id:row.dataset.group,name,multiple:row.querySelector('select').value==='multiple',choices};
    });
  }

  editProduct = function (item) {
    const skuRow = sku => `<fieldset class="mx-editor-card" aria-label="商品规格" data-sku="${esc(sku.id)}">
      <div class="mx-editor-row">${field('规格名称','sku-name',sku.name,'required maxlength="12"')}${iconControl('移除规格','close','data-mx-remove title="至少保留一个规格"')}</div>
      <div class="mx-fields">${field('售价（元）', 'sku-price', (sku.price / 100).toFixed(2), 'required type="number" min="0" max="9999" step=".01"')}${field('可售库存', 'sku-stock', sku.stock, 'required type="number" min="0" max="99999" step="1"')}</div></fieldset>`;
    const images = [...(item?.images || [])];
    const tags = [...productTags(item)];
    modal(item ? '编辑商品' : '新增商品', `<div class="mx-editor">
      <section><h3>商品信息</h3>${field('商品名称', 'name', item?.name, 'required maxlength="30"')}
        ${field('分类', 'cat', item?.cat || '米线', 'required maxlength="12"')}
        <div class="mx-tags">
          <div class="mx-tag-input">${field('卖点标签','tag-entry','','maxlength="12" placeholder="例：红油麻辣"')}${iconControl('添加标签','plus','data-mx-add-tag disabled')}</div>
          <div class="mx-tag-list" data-mx-tags role="group" aria-label="已添加标签"></div>
          <p class="mx-meta" data-mx-tag-status role="status" hidden></p>
        </div>
      </section>
      <section aria-labelledby="mx-photo-title"><div class="mx-editor-heading"><h3 id="mx-photo-title">商品图片</h3><small data-mx-image-count></small></div>
        <input type="file" accept="${photoTypes}" multiple data-mx-files aria-label="选择商品图片" hidden>
        <div class="mx-media-grid" data-mx-images></div>
        <p class="mx-meta" data-mx-image-status role="status" hidden></p>
        <p class="mx-sr" data-mx-sort-status role="status"></p>
      </section>
      <section><h3>规格与库存</h3>
        <div class="ops-stack" data-mx-skus>${(item?.skus || [{...newSku(), name: '标准份'}]).map(skuRow).join('')}</div>
        <button type="button" class="ops-button" data-mx-add>${symbol('plus')}添加规格</button>
      </section>
      <section><div class="mx-editor-heading"><h3>商品属性</h3><small data-mx-group-count></small></div>
        <p class="mx-meta">单选默认第一项，多选可不选。加价按份计算。</p>
        <div class="ops-stack" data-mx-groups>${attributeGroups(item).map(groupRow).join('')}</div>
        <button type="button" class="ops-button" data-mx-add-group>${symbol('plus')}添加属性组</button>
      </section></div>`, data => {
      if (uploading) throw Error('图片还在处理中，请稍候。');
      if (!images.length) {
        imageList.querySelector('[data-mx-pick]').focus();
        throw Error('请至少添加一张商品图片。');
      }
      if (tagInput.value.trim() && !addTag()) {
        tagInput.focus();
        throw Error(tagStatus.textContent);
      }
      const formData = new FormData(editor.closest('form'));
      const prices = formData.getAll('sku-price');
      const stocks = formData.getAll('sku-stock');
      const skus = Array.from(rows.children, (row, index) => {
        const name = row.querySelector('[name="sku-name"]').value.trim();
        if (!name || !/^\d+(\.\d{1,2})?$/.test(prices[index]) || Number(prices[index]) > 9999 || !/^\d+$/.test(stocks[index]) || Number(stocks[index]) > 99999) throw Error('请检查规格名称、售价和可售库存。');
        return {id: row.dataset.sku, name, price: Math.round(Number(prices[index]) * 100), stock: Number(stocks[index])};
      });
      if (!skus.length) throw Error('至少保留一个规格。');
      if (!data.name.trim() || !data.cat.trim()) throw Error('名称和分类不能为空。');
      const updated = {name: data.name.trim(), desc: tags.join(' · '), tags, cat: data.cat.trim(), images, skus, attributes:readGroups(groups)};
      const previous = db.products;
      db.products=item?previous.map(entry=>entry.id===item.id?{...entry,...updated}:entry):[...previous,{id:newId(),...updated,active:true}];
      try{save(true);}catch(error){db.products=previous;throw error;}
      toast('商品已保存');
    }, '保存商品');

    const editor = dialog.querySelector('.mx-editor');
    const rows = editor.querySelector('[data-mx-skus]');
    const groups = editor.querySelector('[data-mx-groups]');
    const tagInput = editor.querySelector('[name="tag-entry"]');
    const tagList = editor.querySelector('[data-mx-tags]');
    const tagStatus = editor.querySelector('[data-mx-tag-status]');
    const addTagButton = editor.querySelector('[data-mx-add-tag]');
    const imageList = editor.querySelector('[data-mx-images]');
    const imageInput = editor.querySelector('[data-mx-files]');
    const imageStatus = editor.querySelector('[data-mx-image-status]');
    const sortStatus = editor.querySelector('[data-mx-sort-status]');
    const saveButton = dialog.querySelector('button.primary');
    let uploading = false;
    function message(node,text=''){node.textContent=text;node.hidden=!text;}
    function renderTags(){
      tagList.innerHTML=tags.map((tag,index)=>`<span class="mx-tag"><span>${esc(tag)}</span>${iconControl('移除标签 '+tag,'close',`data-mx-drop-tag="${index}"`)}</span>`).join('');
      addTagButton.disabled=!tagInput.value.trim();
    }
    function addTag(){
      const tag=tagInput.value.trim();
      if(!tag)return false;
      if(tags.includes(tag)||tags.length>=maxTags){
        message(tagStatus,tags.includes(tag)?'这个标签已添加。':`最多添加 ${maxTags} 个标签。`);
        return false;
      }
      tags.push(tag);
      tagInput.value='';
      message(tagStatus);
      renderTags();
      return true;
    }
    function renderImages(){
      editor.querySelector('[data-mx-image-count]').textContent=`${images.length} / ${maxImages}`;
      imageList.innerHTML=images.map((image,index)=>`<div class="mx-media-tile mx-media-thumb" data-mx-tile="${index}">${photo(image)}
        ${iconControl('移除第 '+(index+1)+' 张图片','close',`data-mx-drop-image="${index}"`)}
        ${images.length>1?`<button type="button" class="mx-media-grip" data-mx-sort="${index}" aria-label="排序第 ${index+1} 张图片${index?'':'（主图）'}" aria-keyshortcuts="ArrowLeft ArrowRight Home End"><span aria-hidden="true"></span></button>`:''}
      </div>`).join('')+(images.length<maxImages?addImageTile('添加图片',`data-mx-pick ${uploading?'disabled':''}`):'');
    }
    function renderGroups(){
      editor.querySelector('[data-mx-group-count]').textContent=groups.children.length?`${groups.children.length} 组`:'未设置';
      groups.querySelectorAll('.mx-choices').forEach(list=>{
        for(const row of list.children)row.querySelector('[data-mx-remove-choice]').disabled=list.children.length===1;
      });
    }
    tagInput.addEventListener('input',()=>{
      message(tagStatus);
      addTagButton.disabled=!tagInput.value.trim();
    });
    tagInput.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing)return;
      event.preventDefault();
      if(!busy)addTag();
    });
    imageInput.addEventListener('change',async()=>{
      const files=Array.from(imageInput.files);
      imageInput.value='';
      if(!files.length||uploading||busy)return;
      const available=maxImages-images.length;
      uploading=true;
      saveButton.disabled=true;
      renderImages();
      message(imageStatus,'正在处理图片…');
      const results=await Promise.allSettled(files.slice(0,available).map(readProductPhoto));
      if(!editor.isConnected||!dialog.open)return;
      uploading=false;
      saveButton.disabled=false;
      images.push(...results.filter(result=>result.status==='fulfilled').map(result=>result.value));
      renderImages();
      const failure=results.find(result=>result.status==='rejected');
      message(imageStatus,failure?(results.some(result=>result.status==='fulfilled')?'部分图片未添加。':'')+failure.reason.message:files.length>available?`最多添加 ${maxImages} 张图片。`:'');
      (imageList.querySelector('[data-mx-pick]')||imageList.querySelector(`[data-mx-drop-image="${images.length-1}"]`))?.focus();
    });
    const syncRemove = () => Array.from(rows.children).forEach(row => {
      const remove=row.querySelector('[data-mx-remove]');
      remove.disabled=rows.children.length===1;
      remove.title=remove.disabled?'至少保留一个规格':'';
    });
    function moveImage(from,to){
      if(from===to||to<0||to>=images.length)return;
      images.splice(to,0,...images.splice(from,1));
      renderImages();
      sortStatus.textContent=`已移到第 ${to+1} 位${to?'':'，设为主图'}。`;
      imageList.querySelector(`[data-mx-sort="${to}"]`).focus({preventScroll:true});
    }
    imageList.addEventListener('keydown',event=>{
      const handle=event.target.closest('[data-mx-sort]');
      if(!handle||uploading||busy)return;
      const from=Number(handle.dataset.mxSort);
      const target={ArrowLeft:from-1,ArrowRight:from+1,Home:0,End:images.length-1}[event.key];
      if(target===undefined)return;
      event.preventDefault();
      moveImage(from,target);
    });
    let drag;
    imageList.addEventListener('pointerdown',event=>{
      const tile=event.target.closest('[data-mx-tile]');
      const handle=event.target.closest('[data-mx-sort]');
      if(!tile||event.button!==0||!event.isPrimary||uploading||busy||images.length<2)return;
      if(!handle&&(event.pointerType!=='mouse'||event.target.closest('button')))return;
      drag={pointer:event.pointerId,tile,index:Number(tile.dataset.mxTile),startX:event.clientX,startY:event.clientY};
      imageList.setPointerCapture(event.pointerId);
    });
    imageList.addEventListener('dragstart',event=>event.preventDefault());
    imageList.addEventListener('pointermove',event=>{
      if(drag?.pointer!==event.pointerId)return;
      const deltaX=event.clientX-drag.startX, deltaY=event.clientY-drag.startY;
      if(!drag.ghost){
        if(Math.hypot(deltaX,deltaY)<6)return;
        const box=drag.tile.getBoundingClientRect();
        const ghost=drag.tile.querySelector('.photo').cloneNode(true);
        ghost.classList.add('mx-media-ghost');
        ghost.setAttribute('aria-hidden','true');
        Object.assign(ghost.style,{left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`});
        dialog.append(ghost);
        drag.ghost=ghost;
        drag.tile.classList.add('is-drag-source');
      }
      drag.ghost.style.transform=`translate(${deltaX}px,${deltaY}px)`;
      drag.target?.classList.remove('is-drop-target');
      drag.target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-mx-tile]');
      if(drag.target!==drag.tile)drag.target?.classList.add('is-drop-target');
    });
    function finishDrag(event){
      if(drag?.pointer!==event.pointerId)return;
      const {tile,ghost,target,index}=drag;
      drag=undefined;
      ghost?.remove();
      tile.classList.remove('is-drag-source');
      target?.classList.remove('is-drop-target');
      if(event.type==='pointerup'&&target)moveImage(index,Number(target.dataset.mxTile));
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture'])imageList.addEventListener(type,finishDrag);
    syncRemove();
    renderTags();
    renderImages();
    renderGroups();
    editor.addEventListener('click', event => {
      const control=event.target.closest('button');
      if (!control||control.disabled||busy) return;
      const data=control.dataset;
      if ('mxAddTag' in data) {
        addTag();
        tagInput.focus();
      } else if ('mxDropTag' in data) {
        tags.splice(Number(data.mxDropTag),1);
        message(tagStatus);
        renderTags();
        (tagList.querySelector(`[data-mx-drop-tag="${data.mxDropTag}"]`)||tagInput).focus();
      } else if ('mxPick' in data) {
        imageInput.click();
      } else if ('mxDropImage' in data) {
        if(uploading)return;
        images.splice(Number(data.mxDropImage),1);
        message(imageStatus);
        renderImages();
        (imageList.querySelector(`[data-mx-drop-image="${data.mxDropImage}"]`)||imageList.querySelector('[data-mx-pick]')).focus();
      } else if ('mxAddGroup' in data) {
        groups.insertAdjacentHTML('beforeend',groupRow({id:newId(),name:'',choices:[newChoice()]}));
        renderGroups();
        groups.lastElementChild.querySelector('input').focus();
      } else if ('mxRemoveGroup' in data) {
        control.closest('[data-group]').remove();
        renderGroups();
        editor.querySelector('[data-mx-add-group]').focus();
      } else if ('mxAddChoice' in data || 'mxRemoveChoice' in data) {
        const list=control.closest('[data-group]').querySelector('.mx-choices');
        if ('mxAddChoice' in data) {
          list.insertAdjacentHTML('beforeend',choiceRow(newChoice()));
          list.lastElementChild.querySelector('input').focus();
        } else {
          const row=control.closest('[data-choice]');
          (row.nextElementSibling||row.previousElementSibling)?.querySelector('input').focus();
          row.remove();
        }
        renderGroups();
      } else if ('mxAdd' in data) {
        rows.insertAdjacentHTML('beforeend', skuRow(newSku()));
        rows.lastElementChild.querySelector('input').focus();
        syncRemove();
      } else if ('mxRemove' in data) {
        control.closest('[data-sku]').remove();
        editor.querySelector('[data-mx-add]').focus();
        syncRemove();
      }
    });
  };

  render();
})();
