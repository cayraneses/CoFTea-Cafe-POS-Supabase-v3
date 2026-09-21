/* CoF/Tea cloud API. Uses Supabase Auth + Postgres + Realtime. */

(function(){

  const cfg=window.COFTEA_SUPABASE_URL, key=window.COFTEA_SUPABASE_ANON_KEY;

  if(!cfg || cfg.includes("PASTE_YOUR") || !key || key.includes("https://penlbovwiuzhkhqopqjv.supabase.co")){

    window.cofteaCloudApi={login:async()=>{throw new Error("Supabase is not connected yet. Open supabase-config.js and add your Project URL and anon/publishable key.")}};

    return;

  }

  const sb=window.supabase.createClient(cfg,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  const err=async(e)=>{if(e)throw new Error(e.message||String(e));};

  // All business dates use Philippine time (Asia/Manila), not UTC.

  const manilaParts=(date=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).reduce((o,x)=>(o[x.type]=x.value,o),{});

  const today=()=>{const p=manilaParts();return `${p.year}-${p.month}-${p.day}`;};

  const manilaTime=(value)=>{

    const s=String(value??"").trim();

    if(!s)return "";

    // PostgreSQL TIME values have no timezone. The POS database currently records

    // these values in UTC, so convert time-only values to Philippine time.

    const m=s.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);

    if(m){

      let h=(Number(m[1])+8)%24;

      return `${String(h).padStart(2,"0")}:${m[2]}:${m[3]||"00"}${m[4]?"."+m[4]:""}`;

    }

    const d=new Date(s);

    if(!Number.isNaN(d.getTime())){

      return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(d);

    }

    return s;

  };

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

  function normalizeCupInventoryName(name){

  const n=String(name||"").trim().toLowerCase().replace(/\s+/g," ");



  if(n==="12oz" || n==="12 oz") return "12 oz";

  if(n==="16oz" || n==="16 oz") return "16 oz";

  if(n==="22oz" || n==="22 oz") return "22 oz";

  if(n==="hot cups" || n==="hot cup") return "Hot Cups";



  return String(name||"").trim();

}



async function inventory(){

  const {data,error}=await sb

    .from("inventory")

    .select("*")

    .order("category")

    .order("name");



  if(error)throw error;



  return data.map(x=>({

    ...x,

    item:x.name,

    total:

      Number(x.inside||0)+

      Number(x.outside||0)+

      Number(x.stock_in||0)+

      Number(x.adjustments||0)

  }));

}

  async function saveInventory(d){

  const sku=

    String(d.sku||"").trim() ||

    ("INV-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,8).toUpperCase());



  const rawName=String(d.item||"").trim();

  const normalizedName=normalizeCupInventoryName(rawName);



  const payload={

    sku,

    name:normalizedName,

    category:d.category||"Other",

    unit:d.unit||"pcs",

    inside:Math.max(0,Number(d.inside)||0),

    outside:Math.max(0,Number(d.outside)||0),

    reorder:Math.max(0,Number(d.reorder)||0)

  };



  if(!payload.name)throw new Error("Item name is required.");



  let q=d.id

    ? sb.from("inventory").update(payload).eq("id",d.id)

    : sb.from("inventory").insert(payload);



  const {data,error}=await q.select("*").single();



  if(error)throw error;



  return {

    ...data,

    item:data.name,

    total:

      Number(data.inside||0)+

      Number(data.outside||0)+

      Number(data.stock_in||0)+

      Number(data.adjustments||0)

  };

}

  async function deleteInventory(id){const {error}=await sb.from("inventory").delete().eq("id",id);if(error)throw error;return {ok:true,id};}

  async function addInventory(d){

  const clean=normalizeCupInventoryName(d.name);



  if(!clean)throw new Error("Item name is required.");



  const {data:all,error:findError}=await sb

    .from("inventory")

    .select("*");



  if(findError)throw findError;



  const old=(all||[]).find(x=>

    normalizeCupInventoryName(x.name).toLowerCase()===clean.toLowerCase()

  );



  if(old){

    const {error}=await sb

      .from("inventory")

      .update({

        name:clean,

        outside:Number(old.outside||0)+Number(d.quantity||0),

        reorder:Number(d.minimum_stock)||Number(old.reorder||0)

      })

      .eq("id",old.id);



    if(error)throw error;

  }else{

    const {error}=await sb

      .from("inventory")

      .insert({

        sku:"INV-"+Date.now().toString(36).toUpperCase(),

        name:clean,

        category:d.category||"Other",

        unit:d.unit||"pcs",

        outside:Math.max(0,Number(d.quantity)||0),

        reorder:Number(d.minimum_stock)||0

      });



    if(error)throw error;

  }



  return inventory();

}

  async function setInventory(d){const {error}=await sb.from("inventory").update({outside:Math.max(0,Number(d.quantity)||0)}).eq("id",d.id);if(error)throw error;return inventory();}

  async function saveSale(d){return saveSaleRpc(d,0)}

  async function updateSale(d){return saveSaleRpc(d,d.saleId)}

  async function ensureCupInventoryNames(){

    const {data,error}=await sb.from("inventory").select("id,name");

    if(error)throw error;

    const canonical=["12 oz","16 oz","22 oz","Hot Cups"];

    for(const wanted of canonical){

      const matches=(data||[]).filter(x=>normalizeCupInventoryName(x.name).toLowerCase()===wanted.toLowerCase());

      if(!matches.length)continue;

      const exact=matches.find(x=>String(x.name||"").trim().toLowerCase()===wanted.toLowerCase());

      if(exact)continue;

      // Rename only when the canonical row does not already exist. This fixes

      // older rows such as 22oz without creating duplicate unique names.

      const target=matches[0];

      const {error:updateError}=await sb.from("inventory").update({name:wanted}).eq("id",target.id);

      if(updateError)throw updateError;

    }

  }

  async function saveSaleRpc(d,saleId){

    await ensureCupInventoryNames();

    const items=(Array.isArray(d.items)?d.items:[]).map(item=>({

      ...item,

      cupType:String(item.temperature||"").trim().toLowerCase()==="hot"?"Hot Cups":(

        String(item.size||"").trim().toLowerCase().replace(/\s+/g,"")==="12oz"?"12 oz":

        String(item.size||"").trim().toLowerCase().replace(/\s+/g,"")==="16oz"?"16 oz":

        String(item.size||"").trim().toLowerCase().replace(/\s+/g,"")==="22oz"?"22 oz":item.cupType

      )

    }));

    const {data,error}=await sb.rpc("save_sale",{p_sale_id:Number(saleId)||null,p_items:items,p_payment:d.payment||"Cash",p_cash:Number(d.cash)||0,p_user_id:Number(d.userId)||null});if(error)throw error;return data;

  }

  async function sales(date=today()){

    // Do not embed app_users here. sales now has more than one FK to app_users
    // (user_id + completed_by), so PostgREST considers an unqualified embed
    // ambiguous. Fetch the creator profiles separately and map by user_id.
    const {data,error}=await sb.from("sales")
      .select("*,sale_items(*)")
      .eq("sale_date",date)
      .eq("status","completed")
      .order("id",{ascending:false});
    if(error)throw error;

    const userIds=[...new Set((data||[]).map(s=>Number(s.user_id)).filter(Boolean))];
    let usersById=new Map();

    if(userIds.length){
      const {data:users,error:userError}=await sb.from("app_users")
        .select("id,username,name")
        .in("id",userIds);
      if(userError)throw userError;
      usersById=new Map((users||[]).map(u=>[Number(u.id),u]));
    }

    return (data||[]).map(s=>{
      const u=usersById.get(Number(s.user_id))||{};
      const details=s.sale_items||[];
      return {
        ...s,
        sale_time:manilaTime(s.sale_time),
        username:u.username||"",
        name:u.name||"",
        items:details.map(i=>`${i.product_name} ${i.size} x${i.quantity}`).join(" | "),
        item_details:details
      };
    });

  }

  async function deleteSale(id){const {data,error}=await sb.rpc("delete_sale",{p_sale_id:Number(id)});if(error)throw error;return data;}

  async function expenses(date=today()){const {data,error}=await sb.from("expenses").select("*").eq("expense_date",date).order("id",{ascending:false});if(error)throw error;return data;}

  async function addExpense(d){

    const payload={expense_date:d.date||today(),category:d.category||"General",description:d.description||"",amount:Number(d.amount)||0,payment_method:d.payment||"Cash",notes:d.notes||""};

    if(payload.amount<=0)throw new Error("Expense amount must be greater than 0.");

    let q=d.id?sb.from("expenses").update(payload).eq("id",d.id):sb.from("expenses").insert(payload);

    const {data,error}=await q.select("*").single();

    if(error)throw error;

    return {ok:true,id:data.id,row:data};

  }

  async function deleteExpense(id){const {error}=await sb.from("expenses").delete().eq("id",id);if(error)throw error;return {ok:true};}

  async function historical(){const {data,error}=await sb.from("historical").select("*").order("record_date",{ascending:false});if(error)throw error;return data;}

  async function addHistorical(d){const cs=Number(d.cashSales)||0,gs=Number(d.gcashSales)||0,ce=Number(d.cashExpenses)||0,ge=Number(d.gcashExpenses)||0;const sales=(cs+gs)>0?cs+gs:Number(d.sales)||0,expenses=(ce+ge)>0?ce+ge:Number(d.expenses)||0;const {error}=await sb.from("historical").insert({record_date:d.date,sales,expenses,cash_sales:cs,gcash_sales:gs,cash_expenses:ce,gcash_expenses:ge,cups:Number(d.cups)||0,notes:d.notes||""});if(error)throw error;return {ok:true};}

  async function reportRows(kind,includeAdjustments=true){
    const todayKey=today();

    const [summaryQ,salesQ,expenseQ,adjustQ]=await Promise.all([
      sb.from("daily_sales_summary").select("*"),
      sb.from("sales")
        .select("id,sale_date,total,payment_method,details_archived")
        .eq("status","completed")
        .eq("details_archived",false),
      sb.from("expenses").select("*").eq("expense_date",todayKey),
      includeAdjustments
        ? sb.from("report_adjustments").select("*").eq("type",kind)
        : Promise.resolve({data:[],error:null})
    ]);

    const firstError=summaryQ.error||salesQ.error||expenseQ.error||adjustQ.error;
    if(firstError)throw firstError;

    const dailyMap=new Map();
    const saleDates=new Map();

    const addDaily=k=>{
      k=String(k||"").slice(0,10);
      if(!dailyMap.has(k))dailyMap.set(k,{
        date:k,sales:0,cash:0,gcash:0,expenses:0,cups:0,transactions:0
      });
      return dailyMap.get(k);
    };

    (summaryQ.data||[]).forEach(s=>{
      const r=addDaily(s.summary_date);
      r.sales=Number(s.total_sales||0);
      r.cash=Number(s.cash_sales||0);
      r.gcash=Number(s.gcash_sales||0);
      r.expenses=Number(s.total_expenses||0);
      r.cups=Number(s.total_cups||0);
      r.transactions=Number(s.transaction_count||0);
    });

    (salesQ.data||[]).forEach(s=>{
      const k=String(s.sale_date||"").slice(0,10);
      saleDates.set(Number(s.id),k);
      const r=addDaily(k);
      r.sales+=Number(s.total||0);
      const pm=String(s.payment_method||"").toLowerCase();
      if(pm==="cash")r.cash+=Number(s.total||0);
      if(pm==="gcash")r.gcash+=Number(s.total||0);
      r.transactions+=1;
    });

    const ids=[...saleDates.keys()];
    if(ids.length){
      const {data:items,error:itemError}=await sb.from("sale_items")
        .select("sale_id,quantity")
        .in("sale_id",ids);
      if(itemError)throw itemError;

      (items||[]).forEach(i=>{
        const k=saleDates.get(Number(i.sale_id));
        if(k)addDaily(k).cups+=Number(i.quantity||0);
      });
    }

    (expenseQ.data||[]).forEach(e=>{
      addDaily(todayKey).expenses+=Number(e.amount||0);
    });

    const daily=[...dailyMap.values()].map(r=>({
      ...r,
      net:r.sales-r.expenses,
      totalCash:r.cash-r.expenses
    }));

    if(kind==="daily"){
      (adjustQ.data||[]).forEach(a=>{
        const r=dailyMap.get(String(a.key))||addDaily(a.key);
        r.sales+=Number(a.sales_delta||0);
        r.cash+=Number(a.cash_delta||0);
        r.gcash+=Number(a.gcash_delta||0);
        r.expenses+=Number(a.expenses_delta||0);
        r.cups+=Number(a.cups_delta||0);
      });

      return [...dailyMap.values()]
        .map(r=>({...r,net:r.sales-r.expenses,totalCash:r.cash-r.expenses}))
        .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    }

    const field=kind==="monthly"?"month":"year";
    const grouped=new Map();
    const addGroup=k=>{
      if(!grouped.has(k))grouped.set(k,{
        [field]:k,sales:0,cash:0,gcash:0,expenses:0,cups:0,transactions:0
      });
      return grouped.get(k);
    };

    daily.forEach(d=>{
      const k=kind==="monthly"?d.date.slice(0,7):d.date.slice(0,4);
      const r=addGroup(k);
      r.sales+=Number(d.sales||0);
      r.cash+=Number(d.cash||0);
      r.gcash+=Number(d.gcash||0);
      r.expenses+=Number(d.expenses||0);
      r.cups+=Number(d.cups||0);
      r.transactions+=Number(d.transactions||0);
    });

    (adjustQ.data||[]).forEach(a=>{
      const r=addGroup(String(a.key));
      r.sales+=Number(a.sales_delta||0);
      r.cash+=Number(a.cash_delta||0);
      r.gcash+=Number(a.gcash_delta||0);
      r.expenses+=Number(a.expenses_delta||0);
      r.cups+=Number(a.cups_delta||0);
    });

    return [...grouped.values()]
      .map(r=>({...r,net:r.sales-r.expenses,totalCash:r.cash-r.expenses}))
      .sort((a,b)=>String(b[field]).localeCompare(String(a[field])));
  }

  async function dashboard(){
    const d=today(),m=d.slice(0,7),y=d.slice(0,4);
    const dr=await reportRows("daily");

    const a=dr.find(x=>x.date===d)||{sales:0,expenses:0};
    const monthRows=dr.filter(x=>String(x.date||"").slice(0,7)===m);
    const yearRows=dr.filter(x=>String(x.date||"").slice(0,4)===y);

    const sum=rows=>rows.reduce((o,r)=>{
      o.sales+=Number(r.sales||0);
      o.expenses+=Number(r.expenses||0);
      return o;
    },{sales:0,expenses:0});

    const b=sum(monthRows),c=sum(yearRows);

    return {
      daily:Number(a.sales||0),
      expensesToday:Number(a.expenses||0),
      netToday:Number(a.sales||0)-Number(a.expenses||0),
      monthly:b.sales,
      expensesMonth:b.expenses,
      netMonth:b.sales-b.expenses,
      yearly:c.sales,
      expensesYear:c.expenses,
      netYear:c.sales-c.expenses
    };
  }

  async function monthly(){return reportRows("monthly")}; async function yearly(){return reportRows("yearly")}; async function dailyTracker(){return reportRows("daily")};

  async function reportAdjustmentGet(type,key){const {data,error}=await sb.from("report_adjustments").select("*").eq("type",type).eq("key",key).maybeSingle();if(error)throw error;return data;}

  async function reportAdjustmentSave(d){const [baseRows]=await Promise.all([reportRows(d.type,false)]);const key=d.key,r=baseRows.find(x=>String(x[d.type==='daily'?'date':d.type==='monthly'?'month':'year'])===String(key));const base=r||{sales:0,cash:0,gcash:0,expenses:0,cups:0};const payload={type:d.type,key,sales_delta:Number(d.sales||0)-base.sales,cash_delta:Number(d.cash||0)-base.cash,gcash_delta:Number(d.gcash||0)-base.gcash,expenses_delta:Number(d.expenses||0)-base.expenses,cups_delta:Number(d.cups||0)-base.cups};const existing=await reportAdjustmentGet(d.type,key);let q=existing?sb.from("report_adjustments").update(payload).eq("id",existing.id):sb.from("report_adjustments").insert(payload);const {error}=await q;if(error)throw error;return {ok:true};}

  async function reportAdjustmentDelete(type,key){const {error}=await sb.from("report_adjustments").delete().eq("type",type).eq("key",key);if(error)throw error;return {ok:true};}

 async function cupSummary(date=today()){

  const {data:salesRows,error:se}=await sb

    .from("sales")

    .select("id")

    .eq("sale_date",date)

    .eq("status","completed");



  if(se)throw se;



  const ids=(salesRows||[]).map(x=>x.id);



  let sold={

    "12oz":0,

    "16oz":0,

    "22oz":0,

    "Hot Cups":0

  };



  if(ids.length){

    const {data:items,error}=await sb

      .from("sale_items")

      .select("size,quantity,temperature")

      .in("sale_id",ids);



    if(error)throw error;



    (items||[]).forEach(i=>{

      const temperature=String(i.temperature||"Cold").trim().toLowerCase();



      let k;



      if(temperature==="hot"){

        k="Hot Cups";

      }else{

        const size=String(i.size||"").trim().toLowerCase().replace(/\s+/g,"");



        if(size==="12oz") k="12oz";

        else if(size==="16oz") k="16oz";

        else if(size==="22oz") k="22oz";

      }



      if(k){

        sold[k]+=Number(i.quantity||0);

      }

    });

  }



  const inv=await inventory();



  const rows=["12oz","16oz","22oz","Hot Cups"].map(size=>{

    const name=

      size==="12oz" ? "12 oz" :

      size==="16oz" ? "16 oz" :

      size==="22oz" ? "22 oz" :

      "Hot Cups";



    /*

      Match cup inventory regardless of how it was typed:

      22oz / 22 oz / 22 OZ / 22 Oz

    */

    const matches=(inv||[]).filter(i=>

      normalizeCupInventoryName(i.name).toLowerCase()===name.toLowerCase()

    );



    /*

      Sum all matching rows.

      This also protects you if you accidentally have

      both "22oz" and "22 oz" in the database.

    */

    const remaining=matches.reduce(

      (sum,i)=>sum+Number(i.total||0),

      0

    );



    return {

      size,

      soldToday:sold[size],

      remaining

    };

  });



    return {

    rows,

    totalSold:Object.values(sold).reduce((a,b)=>a+b,0)

  };

}





  async function saleByTransactionId(transactionId){

    const tx=String(transactionId||"").trim();
    if(!tx)return null;

    const {data,error}=await sb.from("sales")
      .select("*,sale_items(*)")
      .eq("transaction_id",tx)
      .eq("status","completed")
      .maybeSingle();

    if(error)throw error;
    if(!data)return null;

    let user={};
    if(Number(data.user_id)){
      const {data:u,error:userError}=await sb.from("app_users")
        .select("id,username,name")
        .eq("id",Number(data.user_id))
        .maybeSingle();
      if(userError)throw userError;
      user=u||{};
    }

    return {
      ...data,
      sale_time:manilaTime(data.sale_time),
      username:user.username||"",
      name:user.name||"",
      items:(data.sale_items||[]).map(i=>`${i.product_name} ${i.size} x${i.quantity}`).join(" | "),
      item_details:data.sale_items||[]
    };

  }



  async function expenseById(id){

    if(!id)return null;

    const {data,error}=await sb.from("expenses").select("*").eq("id",id).maybeSingle();

    if(error)throw error;

    return data||null;

  }



  async function syncHealth(){

    try{

      const {data,error}=await sb.auth.getSession();

      if(error)throw error;

      const session=data?.session||null;

      return {ok:true,authenticated:!!session?.user,authUserId:session?.user?.id||null,online:navigator.onLine};

    }catch(e){

      return {ok:false,authenticated:false,online:navigator.onLine,error:String(e?.message||e)};

    }

  }



  async function cloudSnapshot(){

    const [dash,inv,s,e,m,y]=await Promise.all([dashboard(),inventory(),sales(today()),expenses(today()),monthly(),yearly()]);

    return {

      ok:true,date:today(),dashboard:dash,

      inventoryCount:(inv||[]).length,salesCount:(s||[]).length,expensesCount:(e||[]).length,

      monthly:m,yearly:y,checkedAt:new Date().toISOString()

    };

  }



  let realtimeChannel=null;

  function subscribeRealtime(){

    if(realtimeChannel)return realtimeChannel;

    realtimeChannel=sb.channel("coftea-pos-live-v2");

    ["products","inventory","sales","sale_items","expenses","historical","report_adjustments","app_users"].forEach(table=>{

      realtimeChannel.on("postgres_changes",{event:"*",schema:"public",table},()=>{

        try{window.__cofteaRealtime?.();}catch(_e){}

      });

    });

    realtimeChannel.subscribe(status=>{

      window.dispatchEvent(new CustomEvent("coftea-realtime-status",{detail:{status}}));

    });

    return realtimeChannel;

  }

  async function startRealtime(){subscribeRealtime();return {ok:true};}



    window.cofteaCloudApi = {

    login,

    account,

    updateAccount,

    changePassword,



    products,

    saveProduct,



    inventory,

    saveInventory,

    deleteInventory,

    addInventory,

    setInventory,



    saveSale,

    updateSale,

    sales,

    deleteSale,



    expenses,

    addExpense,

    deleteExpense,



    historical,

    addHistorical,



    dashboard,

    monthly,

    yearly,

    dailyTracker,



    reportAdjustmentGet,

    reportAdjustmentSave,

    reportAdjustmentDelete,



    cupSummary,

    saleByTransactionId,

    expenseById,

    syncHealth,

    cloudSnapshot,

    __source:"supabase-cloud",

    startRealtime

  };



  window.cofteaSupabase=sb;

})();