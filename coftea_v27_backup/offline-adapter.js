/* CoF/Tea Offline-First Adapter
   - Keeps the existing Supabase API contract intact.
   - Reads from Supabase when online and caches usable snapshots in IndexedDB.
   - Queues safe client-side writes while offline, then replays them when back online.
   - Does not store raw passwords. A SHA-256 proof is stored only to allow the last
     successfully authenticated account to unlock this same device while offline.
*/
(function(){
  'use strict';

  const remote = window.api || null;
  const DB_NAME = 'coftea-pos-offline-v1';
  const DB_VERSION = 1;
  const META = 'meta';
  const QUEUE = 'queue';
  const PENDING = 'pending';
  const MANILA_TZ = 'Asia/Manila';

  let dbPromise = null;
  let syncing = false;

  function emitStatus(extra={}){
    window.dispatchEvent(new CustomEvent('coftea-sync-status',{detail:{
      online:navigator.onLine,
      syncing,
      remoteReady:!!remote,
      ...extra
    }}));
  }

  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        if(!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE,{keyPath:'id',autoIncrement:true});
        if(!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING,{keyPath:'localId'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store,mode,fn){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const t=db.transaction(store,mode), s=t.objectStore(store);
      let out;
      try{out=fn(s);}catch(e){reject(e);return;}
      t.oncomplete=()=>resolve(out?.result ?? out);
      t.onerror=()=>reject(t.error||out?.error);
      t.onabort=()=>reject(t.error||new Error('IndexedDB transaction aborted'));
    });
  }

  const kvGet=key=>tx(META,'readonly',s=>s.get(key));
  const kvSet=(key,value)=>tx(META,'readwrite',s=>s.put(value,key));
  const kvDel=key=>tx(META,'readwrite',s=>s.delete(key));
  const queueAdd=value=>tx(QUEUE,'readwrite',s=>s.add(value));
  const queueDelete=id=>tx(QUEUE,'readwrite',s=>s.delete(id));
  async function queueAll(){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const t=db.transaction(QUEUE,'readonly'), req=t.objectStore(QUEUE).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
  }
  async function queueUpdateByLocalId(localId,payload){
    const all=await queueAll();
    const q=all.find(x=>x.localId===localId);
    if(!q)return false;
    q.payload=payload;q.updatedAt=new Date().toISOString();
    await tx(QUEUE,'readwrite',s=>s.put(q));
    return true;
  }
  async function queueDeleteByLocalId(localId){
    const all=await queueAll();
    const q=all.find(x=>x.localId===localId);
    if(q)await queueDelete(q.id);
  }

  function manilaParts(d=new Date()){
    return new Intl.DateTimeFormat('en-CA',{timeZone:MANILA_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})
      .formatToParts(d).reduce((o,p)=>(o[p.type]=p.value,o),{});
  }
  function today(){const p=manilaParts();return `${p.year}-${p.month}-${p.day}`;}
  function nowTime(){const p=manilaParts();return `${p.hour}:${p.minute}:${p.second}`;}
  function moneyNum(v){return Number(v)||0;}
  function networkError(e){
    if(!navigator.onLine)return true;
    const s=String(e?.message||e||'').toLowerCase();
    return e instanceof TypeError || s.includes('fetch') || s.includes('network') || s.includes('failed to fetch') || s.includes('load failed');
  }
  function uid(prefix='LOCAL'){
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  }
  function localNumericId(){return -Math.max(1,Date.now()+Math.floor(Math.random()*1000));}
  function deepClone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

  async function digest(text){
    if(!crypto?.subtle)return String(text);
    const bytes=new TextEncoder().encode(String(text));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function saveOfflineCredential(username,password,user){
    const salt=uid('AUTH');
    await kvSet('offline_auth',{
      username:String(username||'').trim().toLowerCase(),
      proof:await digest(`${salt}:${password}`),salt,user:deepClone(user),savedAt:new Date().toISOString()
    });
  }
  async function offlineLogin(username,password){
    const a=await kvGet('offline_auth');
    if(!a)return null;
    if(String(username||'').trim().toLowerCase()!==a.username)return null;
    const proof=await digest(`${a.salt}:${password}`);
    return proof===a.proof?deepClone(a.user):null;
  }

  function itemToDetail(x){
    const qty=Math.max(1,Number(x.qty||x.quantity)||1);
    const unit=moneyNum(x.unit??x.unit_price);
    const addonPrice=moneyNum(x.addonPrice??x.addon_price);
    const lineTotal=moneyNum(x.lineTotal??x.line_total??(unit+addonPrice+(x.tutti?10:0)));
    return {
      product_name:x.product||x.product_name||'', category:x.category||'', size:x.size||'',
      temperature:x.temperature||'Cold', quantity:qty, unit_price:unit,
      addon:x.addon||'No Add-on', addon_price:addonPrice, tutti_frutti:!!(x.tutti??x.tutti_frutti),
      line_total:lineTotal, free_upsize:!!(x.freeUpsize??x.free_upsize),
      free_drink:!!(x.freeDrink??x.free_drink), original_size:x.originalSize??x.original_size??null,
      customized:!!x.customized
    };
  }
  function saleFromPayload(d,localId,clientRef){
    const details=(d.items||[]).map(itemToDetail);
    const total=details.reduce((s,i)=>s+moneyNum(i.line_total)*moneyNum(i.quantity),0);
    const cash=moneyNum(d.cash);
    return {
      id:localId, client_ref:clientRef, sale_date:today(), sale_time:nowTime(),
      transaction_id:`OFF-${String(Math.abs(localId)).slice(-8)}`, payment_method:d.payment||'Cash',
      cash_received:cash, change_amount:(d.payment||'Cash')==='Cash'?Math.max(0,cash-total):0,
      total, status:'completed', username:'', name:'', item_details:details,
      items:details.map(i=>`${i.product_name} ${i.size} x${i.quantity}`).join(' | '),
      sync_state:'pending', user_id:d.userId||null
    };
  }
  function cupName(detail){
    if(String(detail.temperature||'').toLowerCase()==='hot')return 'Hot Cups';
    const s=String(detail.size||'').toLowerCase().replace(/\s+/g,'');
    if(s==='12oz')return '12 oz'; if(s==='16oz')return '16 oz'; if(s==='22oz')return '22 oz';
    return null;
  }
  function normalizeCupName(name){
    const n=String(name||'').trim().toLowerCase().replace(/\s+/g,'');
    if(n==='12oz')return '12 oz';if(n==='16oz')return '16 oz';if(n==='22oz')return '22 oz';if(n==='hotcup'||n==='hotcups')return 'Hot Cups';
    return String(name||'').trim();
  }
  async function adjustCachedCups(details,sign){
    const inv=deepClone(await kvGet('inventory')||[]);
    if(!inv.length)return;
    for(const i of details){
      const wanted=cupName(i); if(!wanted)continue;
      let remaining=Math.max(0,moneyNum(i.quantity))*sign;
      const row=inv.find(r=>normalizeCupName(r.name||r.item).toLowerCase()===wanted.toLowerCase());
      if(!row)continue;
      if(remaining<0){
        let need=-remaining;
        const out=Math.max(0,moneyNum(row.outside)); const takeOut=Math.min(out,need); row.outside=out-takeOut; need-=takeOut;
        if(need>0){const inside=Math.max(0,moneyNum(row.inside)); const takeIn=Math.min(inside,need); row.inside=inside-takeIn;need-=takeIn;}
      }else{
        row.outside=moneyNum(row.outside)+remaining;
      }
      row.total=moneyNum(row.inside)+moneyNum(row.outside)+moneyNum(row.stock_in)+moneyNum(row.adjustments);
    }
    await kvSet('inventory',inv);
  }

  async function mergeSaleCache(date,updater){
    const key=`sales:${date}`, rows=deepClone(await kvGet(key)||[]);
    const out=await updater(rows)||rows; await kvSet(key,out); return out;
  }
  async function mergeExpenseCache(date,updater){
    const key=`expenses:${date}`, rows=deepClone(await kvGet(key)||[]);
    const out=await updater(rows)||rows; await kvSet(key,out); return out;
  }

  function reportKey(kind){return `report:${kind}`;}
  async function applyReportDelta(date,{sales=0,cash=0,gcash=0,expenses=0,cups=0}={}){
    const defs=[['daily',date,'date'],['monthly',date.slice(0,7),'month'],['yearly',date.slice(0,4),'year']];
    for(const [kind,key,keyName] of defs){
      const rows=deepClone(await kvGet(reportKey(kind))||[]);
      let r=rows.find(x=>String(x[keyName])===key);
      if(!r){r={[keyName]:key,sales:0,cash:0,gcash:0,expenses:0,cups:0,expenseCash:0,expenseGcash:0,net:0};rows.push(r);}
      r.sales=moneyNum(r.sales)+sales;r.cash=moneyNum(r.cash)+cash;r.gcash=moneyNum(r.gcash)+gcash;r.expenses=moneyNum(r.expenses)+expenses;
      if(kind==='daily')r.cups=moneyNum(r.cups)+cups;
      r.net=moneyNum(r.sales)-moneyNum(r.expenses);
      rows.sort((a,b)=>String(b[keyName]).localeCompare(String(a[keyName])));
      await kvSet(reportKey(kind),rows);
    }
    await rebuildDashboard();
  }
  async function rebuildDashboard(){
    const d=today(),m=d.slice(0,7),y=d.slice(0,4);
    const dr=await kvGet(reportKey('daily'))||[], mr=await kvGet(reportKey('monthly'))||[], yr=await kvGet(reportKey('yearly'))||[];
    const a=dr.find(x=>x.date===d)||{},b=mr.find(x=>x.month===m)||{},c=yr.find(x=>x.year===y)||{};
    const dash={daily:moneyNum(a.sales),expensesToday:moneyNum(a.expenses),netToday:moneyNum(a.sales)-moneyNum(a.expenses),monthly:moneyNum(b.sales),expensesMonth:moneyNum(b.expenses),netMonth:moneyNum(b.sales)-moneyNum(b.expenses),yearly:moneyNum(c.sales),expensesYear:moneyNum(c.expenses),netYear:moneyNum(c.sales)-moneyNum(c.expenses)};
    await kvSet('dashboard',dash);return dash;
  }

  async function cacheRemoteReports(){
    if(!remote||!navigator.onLine)return;
    try{
      const [d,m,y]=await Promise.all([remote.dailyTracker(),remote.monthly(),remote.yearly()]);
      await Promise.all([kvSet(reportKey('daily'),d),kvSet(reportKey('monthly'),m),kvSet(reportKey('yearly'),y)]);
      await rebuildDashboard();
    }catch(e){if(!networkError(e))console.warn('CoF/Tea report cache:',e);}
  }

  async function syncQueue(){
    if(syncing||!navigator.onLine||!remote)return {ok:false};
    syncing=true; emitStatus({message:'Syncing...'});
    let synced=0,failed=0;
    try{
      const items=await queueAll();
      for(const q of items){
        try{
          let result;
          switch(q.op){
            case 'saveSale': result=await remote.saveSale(q.payload);break;
            case 'updateSale': result=await remote.updateSale(q.payload);break;
            case 'deleteSale': result=await remote.deleteSale(q.payload.id);break;
            case 'addExpense': result=await remote.addExpense(q.payload);break;
            case 'deleteExpense': result=await remote.deleteExpense(q.payload.id);break;
            case 'saveInventory': result=await remote.saveInventory(q.payload);break;
            case 'deleteInventory': result=await remote.deleteInventory(q.payload.id);break;
            case 'addInventory': result=await remote.addInventory(q.payload);break;
            case 'setInventory': result=await remote.setInventory(q.payload);break;
            case 'saveProduct': result=await remote.saveProduct(q.payload);break;
            case 'addHistorical': result=await remote.addHistorical(q.payload);break;
            case 'reportAdjustmentSave': result=await remote.reportAdjustmentSave(q.payload);break;
            case 'reportAdjustmentDelete': result=await remote.reportAdjustmentDelete(q.payload.type,q.payload.key);break;
            default: throw new Error(`Unknown queued operation: ${q.op}`);
          }
          await queueDelete(q.id); synced++;
        }catch(e){
          failed++;
          if(networkError(e))break;
          console.error('CoF/Tea sync item failed',q,e);
          q.lastError=String(e?.message||e);q.attempts=moneyNum(q.attempts)+1;
          await tx(QUEUE,'readwrite',s=>s.put(q));
        }
      }
      if(synced){
        try{
          const [p,inv]=await Promise.all([remote.products(),remote.inventory()]);
          await Promise.all([kvSet('products',p),kvSet('inventory',inv)]);
          const d=today();
          const [s,e]=await Promise.all([remote.sales(d),remote.expenses(d)]);
          await Promise.all([kvSet(`sales:${d}`,s),kvSet(`expenses:${d}`,e)]);
          await cacheRemoteReports();
        }catch(e){console.warn('Post-sync refresh failed',e);}
      }
      return {ok:true,synced,failed};
    }finally{
      syncing=false;const left=(await queueAll()).length;emitStatus({pending:left,synced,failed,message:left?'Pending sync':'All data synced'});
    }
  }

  async function queued(op,payload,localId){
    await queueAdd({op,payload:deepClone(payload),localId:localId??null,createdAt:new Date().toISOString(),attempts:0});
    emitStatus({pending:(await queueAll()).length,message:'Saved offline'});
  }

  async function remoteRead(name,args,cacheKey,fallback){
    if(remote&&navigator.onLine){
      try{const r=await remote[name](...args);if(cacheKey)await kvSet(cacheKey,r);return r;}catch(e){if(!networkError(e))throw e;}
    }
    const cached=cacheKey?await kvGet(cacheKey):undefined;
    if(cached!==undefined)return deepClone(cached);
    if(fallback!==undefined)return typeof fallback==='function'?fallback():deepClone(fallback);
    throw new Error('This data has not been cached on this device yet. Connect to the internet once, then it will be available offline.');
  }

  async function login(username,password){
    if(remote&&navigator.onLine){
      try{
        const r=await remote.login(username,password);
        if(r){const u=r.user||r;await saveOfflineCredential(username,password,u);await kvSet('account',u);}
        return r;
      }catch(e){if(!networkError(e))throw e;}
    }
    const u=await offlineLogin(username,password);
    if(u)return {...u,offline:true};
    return null;
  }
  async function account(){return remoteRead('account',[{}],'account',async()=>{const a=await kvGet('offline_auth');return a?.user||null;});}
  async function updateAccount(d){
    if(remote&&navigator.onLine){const r=await remote.updateAccount(d);await kvSet('account',r);return r;}
    throw new Error('Account profile changes require an internet connection.');
  }
  async function changePassword(d){if(remote&&navigator.onLine)return remote.changePassword(d);throw new Error('Changing your password requires an internet connection.');}

  async function products(){return remoteRead('products',[],'products',[]);}
  async function saveProduct(d){
    if(remote&&navigator.onLine){try{const r=await remote.saveProduct(d);await kvSet('products',await remote.products());return r;}catch(e){if(!networkError(e))throw e;}}
    const row={product_id:uid('P'),category:d.category,name:d.name,p12:moneyNum(d.p12),p16:moneyNum(d.p16),p22:moneyNum(d.p22),active:true,offline:true};
    const rows=deepClone(await kvGet('products')||[]);rows.push(row);await kvSet('products',rows);await queued('saveProduct',d,row.product_id);return row;
  }

  async function inventory(){return remoteRead('inventory',[],'inventory',[]);}
  async function saveInventory(d){
    if(remote&&navigator.onLine){try{const r=await remote.saveInventory(d);await kvSet('inventory',await remote.inventory());return r;}catch(e){if(!networkError(e))throw e;}}
    const rows=deepClone(await kvGet('inventory')||[]);let id=Number(d.id)||localNumericId();let row=rows.find(x=>Number(x.id)===Number(id));
    const payload={id,sku:d.sku||uid('INV'),name:d.item||d.name, item:d.item||d.name,category:d.category||'Other',unit:d.unit||'pcs',inside:moneyNum(d.inside),outside:moneyNum(d.outside),reorder:moneyNum(d.reorder),offline:true};
    payload.total=payload.inside+payload.outside+moneyNum(payload.stock_in)+moneyNum(payload.adjustments);
    if(row)Object.assign(row,payload);else rows.push(payload);await kvSet('inventory',rows);
    const q={...d,id:Number(d.id)>0?Number(d.id):0};await queued('saveInventory',q,id);return payload;
  }
  async function deleteInventory(id){
    if(remote&&navigator.onLine&&Number(id)>0){try{const r=await remote.deleteInventory(id);await kvSet('inventory',await remote.inventory());return r;}catch(e){if(!networkError(e))throw e;}}
    const rows=(await kvGet('inventory')||[]).filter(x=>Number(x.id)!==Number(id));await kvSet('inventory',rows);
    if(Number(id)<0)await queueDeleteByLocalId(id);else await queued('deleteInventory',{id},id);return {ok:true,id};
  }
  async function addInventory(d){
    if(remote&&navigator.onLine){try{const r=await remote.addInventory(d);await kvSet('inventory',r);return r;}catch(e){if(!networkError(e))throw e;}}
    const rows=deepClone(await kvGet('inventory')||[]),clean=normalizeCupName(d.name);let row=rows.find(x=>normalizeCupName(x.name||x.item).toLowerCase()===clean.toLowerCase());
    if(row)row.outside=moneyNum(row.outside)+moneyNum(d.quantity);else rows.push({id:localNumericId(),sku:uid('INV'),name:clean,item:clean,category:d.category||'Other',unit:d.unit||'pcs',inside:0,outside:moneyNum(d.quantity),reorder:moneyNum(d.minimum_stock),offline:true});
    rows.forEach(x=>x.total=moneyNum(x.inside)+moneyNum(x.outside)+moneyNum(x.stock_in)+moneyNum(x.adjustments));await kvSet('inventory',rows);await queued('addInventory',d,uid('INVQ'));return rows;
  }
  async function setInventory(d){
    if(remote&&navigator.onLine&&Number(d.id)>0){try{const r=await remote.setInventory(d);await kvSet('inventory',r);return r;}catch(e){if(!networkError(e))throw e;}}
    const rows=deepClone(await kvGet('inventory')||[]),row=rows.find(x=>Number(x.id)===Number(d.id));if(row){row.outside=Math.max(0,moneyNum(d.quantity));row.total=moneyNum(row.inside)+moneyNum(row.outside)+moneyNum(row.stock_in)+moneyNum(row.adjustments);}await kvSet('inventory',rows);await queued('setInventory',d,d.id);return rows;
  }

  async function saveSale(d){
    if(remote&&navigator.onLine){try{const r=await remote.saveSale(d);await refreshToday();return r;}catch(e){if(!networkError(e))throw e;}}
    const localId=localNumericId(),ref=uid('SALE'),sale=saleFromPayload(d,localId,ref);
    await mergeSaleCache(sale.sale_date,rows=>[sale,...rows]);await adjustCachedCups(sale.item_details,-1);
    const cash=sale.payment_method==='Cash'?sale.total:0,gcash=sale.payment_method==='GCash'?sale.total:0,cups=sale.item_details.reduce((s,i)=>s+moneyNum(i.quantity),0);
    await applyReportDelta(sale.sale_date,{sales:sale.total,cash,gcash,cups});await queued('saveSale',{...d,clientRef:ref},localId);
    return {transactionId:sale.transaction_id,id:localId,offline:true};
  }
  async function updateSale(d){
    if(Number(d.saleId)>0&&remote&&navigator.onLine){try{const r=await remote.updateSale(d);await refreshToday();return r;}catch(e){if(!networkError(e))throw e;}}
    const localId=Number(d.saleId),date=today();const rows=deepClone(await kvGet(`sales:${date}`)||[]),old=rows.find(x=>Number(x.id)===localId);
    if(!old)throw new Error('Offline transaction not found.');
    await adjustCachedCups(old.item_details,+1);
    await applyReportDelta(date,{sales:-moneyNum(old.total),cash:old.payment_method==='Cash'?-moneyNum(old.total):0,gcash:old.payment_method==='GCash'?-moneyNum(old.total):0,cups:-old.item_details.reduce((s,i)=>s+moneyNum(i.quantity),0)});
    const replacement=saleFromPayload(d,localId,old.client_ref||uid('SALE'));replacement.transaction_id=old.transaction_id;
    const idx=rows.indexOf(old);rows[idx]=replacement;await kvSet(`sales:${date}`,rows);await adjustCachedCups(replacement.item_details,-1);
    await applyReportDelta(date,{sales:replacement.total,cash:replacement.payment_method==='Cash'?replacement.total:0,gcash:replacement.payment_method==='GCash'?replacement.total:0,cups:replacement.item_details.reduce((s,i)=>s+moneyNum(i.quantity),0)});
    await queueUpdateByLocalId(localId,{...d,saleId:0,clientRef:replacement.client_ref});return {transactionId:replacement.transaction_id,id:localId,offline:true};
  }
  async function sales(date=today()){return remoteRead('sales',[date],`sales:${date}`,[]);}
  async function deleteSale(id){
    if(Number(id)>0&&remote&&navigator.onLine){try{const r=await remote.deleteSale(id);await refreshToday();return r;}catch(e){if(!networkError(e))throw e;}}
    const date=today(),rows=deepClone(await kvGet(`sales:${date}`)||[]),sale=rows.find(x=>Number(x.id)===Number(id));if(!sale)throw new Error('Offline transaction not found.');
    await kvSet(`sales:${date}`,rows.filter(x=>Number(x.id)!==Number(id)));await adjustCachedCups(sale.item_details,+1);
    await applyReportDelta(date,{sales:-moneyNum(sale.total),cash:sale.payment_method==='Cash'?-moneyNum(sale.total):0,gcash:sale.payment_method==='GCash'?-moneyNum(sale.total):0,cups:-sale.item_details.reduce((s,i)=>s+moneyNum(i.quantity),0)});
    if(Number(id)<0)await queueDeleteByLocalId(Number(id));else await queued('deleteSale',{id},id);return {ok:true,id};
  }

  async function expenses(date=today()){return remoteRead('expenses',[date],`expenses:${date}`,[]);}
  async function addExpense(d){
    if(remote&&navigator.onLine&&(!d.id||Number(d.id)>0)){try{const r=await remote.addExpense(d);await refreshToday();return r;}catch(e){if(!networkError(e))throw e;}}
    const date=d.date||today();let rows=deepClone(await kvGet(`expenses:${date}`)||[]);let old=null;
    if(Number(d.id)){old=rows.find(x=>Number(x.id)===Number(d.id));}
    if(old)await applyReportDelta(old.expense_date,{expenses:-moneyNum(old.amount)});
    const id=Number(d.id)||localNumericId(),row={id,expense_date:date,category:d.category||'General',description:d.description||'',amount:moneyNum(d.amount),payment_method:d.payment||'Cash',notes:d.notes||'',sync_state:'pending'};
    if(old)rows[rows.indexOf(old)]=row;else rows.unshift(row);await kvSet(`expenses:${date}`,rows);await applyReportDelta(date,{expenses:row.amount});
    if(Number(id)<0)await queued('addExpense',{...d,id:0},id);else await queued('addExpense',d,id);return {ok:true,id,offline:true};
  }
  async function deleteExpense(id){
    if(Number(id)>0&&remote&&navigator.onLine){try{const r=await remote.deleteExpense(id);await refreshToday();return r;}catch(e){if(!networkError(e))throw e;}}
    const date=today(),rows=deepClone(await kvGet(`expenses:${date}`)||[]),row=rows.find(x=>Number(x.id)===Number(id));
    if(row){await kvSet(`expenses:${date}`,rows.filter(x=>Number(x.id)!==Number(id)));await applyReportDelta(date,{expenses:-moneyNum(row.amount)});}if(Number(id)<0)await queueDeleteByLocalId(Number(id));else await queued('deleteExpense',{id},id);return {ok:true,id};
  }

  async function historical(){return remoteRead('historical',[],'historical',[]);}
  async function addHistorical(d){
    if(remote&&navigator.onLine){try{const r=await remote.addHistorical(d);await kvSet('historical',await remote.historical());await cacheRemoteReports();return r;}catch(e){if(!networkError(e))throw e;}}
    const rows=deepClone(await kvGet('historical')||[]),row={id:localNumericId(),record_date:d.date,sales:moneyNum(d.sales)||moneyNum(d.cashSales)+moneyNum(d.gcashSales),expenses:moneyNum(d.expenses)||moneyNum(d.cashExpenses)+moneyNum(d.gcashExpenses),cash_sales:moneyNum(d.cashSales),gcash_sales:moneyNum(d.gcashSales),cash_expenses:moneyNum(d.cashExpenses),gcash_expenses:moneyNum(d.gcashExpenses),cups:moneyNum(d.cups),notes:d.notes||'',sync_state:'pending'};
    rows.unshift(row);await kvSet('historical',rows);await applyReportDelta(row.record_date,{sales:row.sales,cash:row.cash_sales,gcash:row.gcash_sales,expenses:row.expenses,cups:row.cups});await queued('addHistorical',d,row.id);return {ok:true,offline:true};
  }

  async function dashboard(){return remoteRead('dashboard',[],'dashboard',async()=>rebuildDashboard());}
  async function monthly(){return remoteRead('monthly',[],reportKey('monthly'),[]);}
  async function yearly(){return remoteRead('yearly',[],reportKey('yearly'),[]);}
  async function dailyTracker(){return remoteRead('dailyTracker',[],reportKey('daily'),[]);}

  async function reportAdjustmentGet(type,key){return remoteRead('reportAdjustmentGet',[type,key],`adjust:${type}:${key}`,null);}
  async function reportAdjustmentSave(d){
    if(remote&&navigator.onLine){try{const r=await remote.reportAdjustmentSave(d);await cacheRemoteReports();return r;}catch(e){if(!networkError(e))throw e;}}
    await kvSet(`adjust:${d.type}:${d.key}`,d);await queued('reportAdjustmentSave',d,uid('ADJ'));
    const rows=deepClone(await kvGet(reportKey(d.type))||[]),field=d.type==='daily'?'date':d.type==='monthly'?'month':'year';let r=rows.find(x=>String(x[field])===String(d.key));if(!r){r={[field]:d.key};rows.push(r);}Object.assign(r,{sales:moneyNum(d.sales),cash:moneyNum(d.cash),gcash:moneyNum(d.gcash),expenses:moneyNum(d.expenses),cups:moneyNum(d.cups),net:moneyNum(d.sales)-moneyNum(d.expenses)});await kvSet(reportKey(d.type),rows);await rebuildDashboard();return {ok:true,offline:true};
  }
  async function reportAdjustmentDelete(type,key){
    if(remote&&navigator.onLine){try{const r=await remote.reportAdjustmentDelete(type,key);await cacheRemoteReports();return r;}catch(e){if(!networkError(e))throw e;}}
    await kvDel(`adjust:${type}:${key}`);await queued('reportAdjustmentDelete',{type,key},uid('ADJDEL'));return {ok:true,offline:true};
  }

  async function cupSummary(date=today()){
    if(remote&&navigator.onLine){try{const r=await remote.cupSummary(date);await kvSet(`cups:${date}`,r);return r;}catch(e){if(!networkError(e))throw e;}}
    const inv=await inventory(), salesRows=await sales(date), sold={'12oz':0,'16oz':0,'22oz':0,'Hot Cups':0};
    for(const s of salesRows)for(const i of (s.item_details||[])){const t=String(i.temperature||'Cold').toLowerCase();let k=t==='hot'?'Hot Cups':String(i.size||'').replace(/\s+/g,'');if(sold[k]!==undefined)sold[k]+=moneyNum(i.quantity);}
    const rows=['12oz','16oz','22oz','Hot Cups'].map(size=>{const wanted=normalizeCupName(size);const remaining=(inv||[]).filter(i=>normalizeCupName(i.name||i.item).toLowerCase()===wanted.toLowerCase()).reduce((s,i)=>s+moneyNum(i.total??(moneyNum(i.inside)+moneyNum(i.outside)+moneyNum(i.stock_in)+moneyNum(i.adjustments))),0);return {size,soldToday:sold[size],remaining};});
    return {rows,totalSold:Object.values(sold).reduce((a,b)=>a+b,0)};
  }

  async function refreshToday(){
    if(!remote||!navigator.onLine)return;
    const d=today();
    try{
      const [p,inv,s,e]=await Promise.all([remote.products(),remote.inventory(),remote.sales(d),remote.expenses(d)]);
      await Promise.all([kvSet('products',p),kvSet('inventory',inv),kvSet(`sales:${d}`,s),kvSet(`expenses:${d}`,e)]);
      await cacheRemoteReports();
    }catch(e){if(!networkError(e))throw e;}
  }

  async function backup(){
    if(remote&&navigator.onLine)return remote.backup?.()||{ok:false};
    const data={version:1,exportedAt:new Date().toISOString(),offline:true,products:await kvGet('products')||[],inventory:await kvGet('inventory')||[],sales:await kvGet(`sales:${today()}`)||[],expenses:await kvGet(`expenses:${today()}`)||[],historical:await kvGet('historical')||[],queue:await queueAll()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`CoFTea_Offline_Backup_${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return {ok:true};
  }
  async function restore(){if(remote&&navigator.onLine&&remote.restore)return remote.restore();throw new Error('Cloud restore requires an internet connection.');}
  async function startRealtime(){if(remote?.startRealtime&&navigator.onLine)return remote.startRealtime();}
  async function syncNow(){return syncQueue();}
  async function pendingCount(){return (await queueAll()).length;}

  window.api={login,account,updateAccount,changePassword,products,saveProduct,inventory,saveInventory,deleteInventory,addInventory,setInventory,saveSale,updateSale,sales,deleteSale,expenses,addExpense,deleteExpense,historical,addHistorical,dashboard,monthly,yearly,dailyTracker,reportAdjustmentGet,reportAdjustmentSave,reportAdjustmentDelete,cupSummary,backup,restore,startRealtime,syncNow,pendingCount,refreshToday};
  window.CofTeaOffline={syncNow,pendingCount,refreshToday,dbName:DB_NAME};

  window.addEventListener('online',()=>{emitStatus({message:'Online'});setTimeout(syncQueue,500);});
  window.addEventListener('offline',()=>emitStatus({message:'Offline mode'}));
  openDB().then(async()=>{emitStatus({pending:(await queueAll()).length});if(navigator.onLine&&remote){refreshToday().catch(()=>{});syncQueue().catch(()=>{});}}).catch(console.error);
})();
