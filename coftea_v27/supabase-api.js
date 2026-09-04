/* CoF/Tea cloud API. Uses Supabase Auth + Postgres + Realtime. */
(function(){
  const cfg=window.COFTEA_SUPABASE_URL, key=window.COFTEA_SUPABASE_ANON_KEY;
  if(!cfg || cfg.includes("PASTE_YOUR") || !key || key.includes("PASTE_YOUR")){
    window.api={login:async()=>{throw new Error("Supabase is not connected yet. Open supabase-config.js and add your Project URL and anon/publishable key.")}};
    return;
  }
  const sb=window.supabase.createClient(cfg,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const err=async(e)=>{if(e)throw new Error(e.message||String(e));};
  const today=()=>new Date().toISOString().slice(0,10);
  async function currentProfile(){
    const {data:{user}}=await sb.auth.getUser(); if(!user)return null;
    const {data,error}=await sb.from("app_users").select("*").eq("auth_user_id",user.id).maybeSingle(); if(error)throw error; return data;
  }
  async function login(username,password){
    const u=String(username||"").trim().toLowerCase();
    const {data:lookup,error:le}=await sb.rpc("lookup_login_email",{p_username:u});
    if(le)throw le; const profile=lookup?.[0]||lookup; if(!profile||!profile.email||!profile.active)return null;
    const {error}=await sb.auth.signInWithPassword({email:profile.email,password}); if(error)return null;
    const p=await currentProfile(); return p?{id:p.id,username:p.username,name:p.name||p.username,role:p.role,active:p.active}:null;
  }
  async function account(d){const p=await currentProfile();if(!p)throw new Error("Not signed in.");return {id:p.id,username:p.username,name:p.name||p.username,role:p.role,active:p.active};}
  async function updateAccount(d){
    const p=await currentProfile();if(!p)throw new Error("Not signed in.");
    const username=String(d.username||p.username).trim().toLowerCase(),name=String(d.name||username).trim();
    const {data:dup}=await sb.from("app_users").select("id").eq("username",username).neq("id",p.id).maybeSingle();if(dup)throw new Error("Username is already in use.");
    const {data,error}=await sb.from("app_users").update({username,name}).eq("id",p.id).select("*").single();if(error)throw error;
    return {id:data.id,username:data.username,name:data.name,role:data.role,active:data.active};
  }
  async function changePassword(d){const p=await currentProfile();if(!p)throw new Error("Not signed in.");const reauth=await sb.auth.signInWithPassword({email:p.email,password:d.oldPassword});if(reauth.error)throw new Error("Current password is incorrect.");const {error}=await sb.auth.updateUser({password:d.newPassword});if(error)throw error;return {ok:true};}
  async function products(){const {data,error}=await sb.from("products").select("*").eq("active",true).order("category").order("name");if(error)throw error;return data.map(p=>({...p,hotAllowed:["Cafe Latte","Amerikano","Amerikano Twist","Milktea"].includes(p.category)}));}
  async function saveProduct(d){
    const name=String(d.name||"").trim();
    const category=String(d.category||"").trim();
    if(!name)throw new Error("Product name is required.");
    if(!category)throw new Error("Product category is required.");
    const payload={
      product_id:String(d.product_id||("P"+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase())),
      category,name,
      p12:Math.max(0,Number(d.p12)||0),
      p16:Math.max(0,Number(d.p16)||0),
      p22:Math.max(0,Number(d.p22)||0),
      active:true
    };
    const {data,error}=await sb.from("products").insert(payload).select("*").single();
    if(error){
      if(error.code==="23505")throw new Error("A product with the same name already exists in this category.");
      throw error;
    }
    return data;
  }
  async function inventory(){const {data,error}=await sb.from("inventory").select("*").order("category").order("name");if(error)throw error;return data.map(x=>({...x,item:x.name,total:Number(x.inside||0)+Number(x.outside||0)+Number(x.stock_in||0)+Number(x.adjustments||0)}));}
  async function saveInventory(d){
  const sku=String(d.sku||"").trim()||("INV-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,8).toUpperCase()); const payload={sku,name:String(d.item||"").trim(),category:d.category||"Other",unit:d.unit||"pcs",inside:Math.max(0,Number(d.inside)||0),outside:Math.max(0,Number(d.outside)||0),reorder:Math.max(0,Number(d.reorder)||0)};
  if(!payload.name)throw new Error("Item name is required.");
  let q=d.id?sb.from("inventory").update(payload).eq("id",d.id):sb.from("inventory").insert(payload);
  const {data,error}=await q.select("*").single();if(error)throw error;return {...data,item:data.name,total:Number(data.inside||0)+Number(data.outside||0)+Number(data.stock_in||0)+Number(data.adjustments||0)};
}
  async function deleteInventory(id){const {error}=await sb.from("inventory").delete().eq("id",id);if(error)throw error;return {ok:true,id};}
  async function addInventory(d){const clean=String(d.name||"").trim();if(!clean)throw new Error("Item name is required.");const {data:old}=await sb.from("inventory").select("*").ilike("name",clean).maybeSingle();if(old){const {error}=await sb.from("inventory").update({outside:Number(old.outside||0)+Number(d.quantity||0),reorder:Number(d.minimum_stock)||Number(old.reorder||0)}).eq("id",old.id);if(error)throw error;}else{const {error}=await sb.from("inventory").insert({sku:"INV-"+Date.now().toString(36).toUpperCase(),name:clean,category:d.category||"Other",unit:d.unit||"pcs",outside:Math.max(0,Number(d.quantity)||0),reorder:Number(d.minimum_stock)||0});if(error)throw error;}return inventory();}
  async function setInventory(d){const {error}=await sb.from("inventory").update({outside:Math.max(0,Number(d.quantity)||0)}).eq("id",d.id);if(error)throw error;return inventory();}
  async function saveSale(d){return saveSaleRpc(d,0)}
  async function updateSale(d){return saveSaleRpc(d,d.saleId)}
  async function saveSaleRpc(d,saleId){
    const {data,error}=await sb.rpc("save_sale",{p_sale_id:Number(saleId)||null,p_items:d.items,p_payment:d.payment||"Cash",p_cash:Number(d.cash)||0,p_user_id:Number(d.userId)||null});if(error)throw error;return data;
  }
  async function sales(date=today()){
    const {data,error}=await sb.from("sales").select("*,app_users(username,name),sale_items(*)").eq("sale_date",date).eq("status","completed").order("id",{ascending:false});if(error)throw error;
    return data.map(s=>({...s,username:s.app_users?.username||"",name:s.app_users?.name||"",items:s.sale_items.map(i=>`${i.product_name} ${i.size} x${i.quantity}`).join(" | "),item_details:s.sale_items}));
  }
  async function deleteSale(id){const {data,error}=await sb.rpc("delete_sale",{p_sale_id:Number(id)});if(error)throw error;return data;}
  async function expenses(date=today()){const {data,error}=await sb.from("expenses").select("*").eq("expense_date",date).order("id",{ascending:false});if(error)throw error;return data;}
  async function addExpense(d){const payload={expense_date:d.date||today(),category:d.category||"General",description:d.description||"",amount:Number(d.amount)||0,payment_method:d.payment||"Cash",notes:d.notes||""};if(payload.amount<=0)throw new Error("Expense amount must be greater than 0.");let q=d.id?sb.from("expenses").update(payload).eq("id",d.id):sb.from("expenses").insert(payload);const {error}=await q;if(error)throw error;return {ok:true};}
  async function deleteExpense(id){const {error}=await sb.from("expenses").delete().eq("id",id);if(error)throw error;return {ok:true};}
  async function historical(){const {data,error}=await sb.from("historical").select("*").order("record_date",{ascending:false});if(error)throw error;return data;}
  async function addHistorical(d){const cs=Number(d.cashSales)||0,gs=Number(d.gcashSales)||0,ce=Number(d.cashExpenses)||0,ge=Number(d.gcashExpenses)||0;const sales=(cs+gs)>0?cs+gs:Number(d.sales)||0,expenses=(ce+ge)>0?ce+ge:Number(d.expenses)||0;const {error}=await sb.from("historical").insert({record_date:d.date,sales,expenses,cash_sales:cs,gcash_sales:gs,cash_expenses:ce,gcash_expenses:ge,cups:Number(d.cups)||0,notes:d.notes||""});if(error)throw error;return {ok:true};}
  async function reportRows(kind,includeAdjustments=true){
    const [{data:sales,error:se},{data:exps,error:ee},{data:hist,error:he},{data:adj,error:ae}]=await Promise.all([sb.from("sales").select("*").eq("status","completed"),sb.from("expenses").select("*"),sb.from("historical").select("*"),sb.from("report_adjustments").select("*").eq("type",kind)]);if(se||ee||he||ae)throw(se||ee||he||ae);
    const map=new Map();const add=k=>{if(!map.has(k))map.set(k,{sales:0,cash:0,gcash:0,expenses:0,cups:0});return map.get(k)};
    sales.forEach(s=>{const k=kind==='daily'?s.sale_date:kind==='monthly'?String(s.sale_date).slice(0,7):String(s.sale_date).slice(0,4);const r=add(k);r.sales+=Number(s.total||0);if(s.payment_method==='Cash')r.cash+=Number(s.total||0);if(s.payment_method==='GCash')r.gcash+=Number(s.total||0);if(kind==='daily')r.cups+=0;});
    hist.forEach(h=>{const k=kind==='daily'?h.record_date:kind==='monthly'?String(h.record_date).slice(0,7):String(h.record_date).slice(0,4);const r=add(k);r.sales+=Number(h.sales||0);r.cash+=Number(h.cash_sales||0);r.gcash+=Number(h.gcash_sales||0);r.expenses+=Number(h.expenses||0);if(kind==='daily')r.cups+=Number(h.cups||0);});
    exps.forEach(e=>{const k=kind==='daily'?e.expense_date:kind==='monthly'?String(e.expense_date).slice(0,7):String(e.expense_date).slice(0,4);const r=add(k);r.expenses+=Number(e.amount||0);});
    if(kind==='daily'){const {data:items}=await sb.from("sale_items").select("sale_id,quantity");const ids=new Set(sales.filter(s=>map.has(s.sale_date)).map(s=>s.id));(items||[]).forEach(i=>{if(ids.has(i.sale_id)){const s=sales.find(x=>x.id===i.sale_id);if(s){const r=add(s.sale_date);r.cups+=Number(i.quantity||0)}}});}
    if(includeAdjustments)(adj||[]).forEach(a=>{const r=add(a.key);r.sales+=Number(a.sales_delta||0);r.cash+=Number(a.cash_delta||0);r.gcash+=Number(a.gcash_delta||0);r.expenses+=Number(a.expenses_delta||0);r.cups+=Number(a.cups_delta||0);});
    return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([k,r])=>kind==='daily'?{date:k,...r,net:r.sales-r.expenses}:kind==='monthly'?{month:k,...r,expenseCash:0,expenseGcash:0,net:r.sales-r.expenses}:{year:k,...r,expenseCash:0,expenseGcash:0,net:r.sales-r.expenses});
  }
  async function dashboard(){const d=today(),m=d.slice(0,7),y=d.slice(0,4);const [dr,mr,yr]=await Promise.all([reportRows("daily"),reportRows("monthly"),reportRows("yearly")]);const a=dr.find(x=>x.date===d)||{sales:0,expenses:0,net:0},b=mr.find(x=>x.month===m)||{sales:0,expenses:0,net:0},c=yr.find(x=>x.year===y)||{sales:0,expenses:0,net:0};return {daily:a.sales,expensesToday:a.expenses,netToday:a.net,monthly:b.sales,expensesMonth:b.expenses,netMonth:b.net,yearly:c.sales,expensesYear:c.expenses,netYear:c.net};}
  async function monthly(){return reportRows("monthly")}; async function yearly(){return reportRows("yearly")}; async function dailyTracker(){return reportRows("daily")};
  async function reportAdjustmentGet(type,key){const {data,error}=await sb.from("report_adjustments").select("*").eq("type",type).eq("key",key).maybeSingle();if(error)throw error;return data;}
  async function reportAdjustmentSave(d){const [baseRows]=await Promise.all([reportRows(d.type,false)]);const key=d.key,r=baseRows.find(x=>String(x[d.type==='daily'?'date':d.type==='monthly'?'month':'year'])===String(key));const base=r||{sales:0,cash:0,gcash:0,expenses:0,cups:0};const payload={type:d.type,key,sales_delta:Number(d.sales||0)-base.sales,cash_delta:Number(d.cash||0)-base.cash,gcash_delta:Number(d.gcash||0)-base.gcash,expenses_delta:Number(d.expenses||0)-base.expenses,cups_delta:Number(d.cups||0)-base.cups};const existing=await reportAdjustmentGet(d.type,key);let q=existing?sb.from("report_adjustments").update(payload).eq("id",existing.id):sb.from("report_adjustments").insert(payload);const {error}=await q;if(error)throw error;return {ok:true};}
  async function reportAdjustmentDelete(type,key){const {error}=await sb.from("report_adjustments").delete().eq("type",type).eq("key",key);if(error)throw error;return {ok:true};}
  async function cupSummary(date=today()){
    const {data:salesRows,error:se}=await sb.from("sales").select("id").eq("sale_date",date).eq("status","completed");if(se)throw se;const ids=(salesRows||[]).map(x=>x.id);let sold={"12oz":0,"16oz":0,"22oz":0,"Hot Cups":0};if(ids.length){const {data:items,error}=await sb.from("sale_items").select("size,quantity").in("sale_id",ids);if(error)throw error;(items||[]).forEach(i=>{const k=["12oz","16oz","22oz"].includes(i.size)?i.size:"Hot Cups";sold[k]+=Number(i.quantity||0)});}const inv=await inventory();const rows=["12oz","16oz","22oz","Hot Cups"].map(size=>{const name=size==='12oz'?'12 oz':size==='16oz'?'16 oz':size==='22oz'?'22 oz':'Hot Cups';const x=inv.find(i=>i.name===name);return {size,soldToday:sold[size],remaining:x?x.total:0};});return {rows,totalSold:Object.values(sold).reduce((a,b)=>a+b,0)};
  }
  function subscribe(){const channel=sb.channel("coftea-live");["sales","sale_items","expenses","inventory","products","historical","report_adjustments","app_users"].forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table},()=>{if(window.__cofteaRealtime)window.__cofteaRealtime();}));channel.subscribe();return channel;}
  let channel=null; async function startRealtime(){if(channel)return;channel=subscribe();}
  async function backup(){const tables=["app_users","products","inventory","sales","sale_items","expenses","historical","report_adjustments"];const out={version:1,exportedAt:new Date().toISOString(),tables:{}};for(const t of tables){const {data,error}=await sb.from(t).select("*");if(error)throw error;out.tables[t]=data;}const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`CoFTea_Supabase_Backup_${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return {ok:true};}
  async function restore(){const input=document.createElement("input");input.type="file";input.accept="application/json,.json";return new Promise((resolve,reject)=>{input.onchange=async()=>{try{const f=input.files?.[0];if(!f)return resolve({ok:false,canceled:true});const data=JSON.parse(await f.text());const order=["products","inventory","historical","expenses","report_adjustments","sales","sale_items"];for(const t of order){const rows=data.tables?.[t]||[];if(rows.length){const {error}=await sb.from(t).upsert(rows);if(error)throw error;}}notify("Cloud backup restored.");resolve({ok:true});}catch(e){reject(e)}};input.click()});}
  window.api={login,account,updateAccount,changePassword,products,saveProduct,inventory,saveInventory,deleteInventory,addInventory,setInventory,saveSale,updateSale,sales,deleteSale,expenses,addExpense,deleteExpense,dashboard,monthly,yearly,dailyTracker,reportAdjustmentGet,reportAdjustmentSave,reportAdjustmentDelete,cupSummary,historical,addHistorical,backup,restore,startRealtime};
  window.cofteaSupabase=sb;
})();
