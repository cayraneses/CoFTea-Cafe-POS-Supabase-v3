/* FINAL STABLE STORAGE-SAFE BUILD — 2026-09-21 */
/* AUG29 RECOVERY / CUP DEDUP BUILD — 2026-09-21 */
const CATEGORIES=["Cafe Latte","Amerikano","Amerikano Twist","Milktea","Frappe","Fruit Series","Soda Series","Customized Drink"];

const ADDONS=[["Espresso",5],["Pearls",10],["Nata",10],["Coffee Jelly",10],["Popping Boba",10],["Yakult",15],["Cream Cheese",10],["Whipped Cream",10],["Oreo",10]];

const CUP_SIZES=["12oz","16oz","22oz","Hot Cups"];

let currentUser=null,products=[],cart=[],activeCategory="Cafe Latte",payment="Cash",inventoryData=[],inventoryFilter="All",inventorySearch="",expenses=[];

let selectedProduct=null,posSize="12oz",selectedSize="12oz",selectedTemp="Cold",selectedAddons=[],tutti=false,freeUpsize=false,freeUpsizeOriginalSize="12oz",freeDrink=false,freeDrinkSelection=null,editingCartIndex=-1,editingTransactionId=null;

let saleBusy=false,expenseBusy=false,inventoryBusy=false;



const $=id=>document.getElementById(id);

const money=n=>"₱"+Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});

const today=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});return `${p.year}-${p.month}-${p.day}`};

const displayDate=v=>{const s=String(v||"").slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}/${m[1]}`:s};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function err(e){const msg=e?.message||String(e)||"Unknown error";console.error(e);notify(msg,true)}

function notify(msg,isError=false){let t=$("cofteaToast");if(!t){t=document.createElement("div");t.id="cofteaToast";t.style.cssText="position:fixed;right:22px;bottom:22px;z-index:99999;max-width:360px;padding:12px 16px;border-radius:12px;background:#fff;border:1px solid #dfd0bf;box-shadow:0 12px 30px rgba(70,45,25,.15);font-weight:800;color:#241c17;opacity:0;transform:translateY(8px);transition:.2s;pointer-events:none";document.body.appendChild(t)}t.textContent=msg;t.style.borderColor=isError?"#e8aaa4":"#dfd0bf";t.style.color=isError?"#b84b43":"#241c17";t.style.opacity="1";t.style.transform="translateY(0)";clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity="0";t.style.transform="translateY(8px)"},2200)}

function restoreInputFocus(id){setTimeout(()=>{const el=$(id);if(el){el.focus({preventScroll:true});if(typeof el.setSelectionRange==="function"){const n=el.value.length;try{el.setSelectionRange(n,n)}catch(_e){}}}},80)}

function isStaff(){return String(currentUser?.role||"").toLowerCase()==="staff"}



async function login(){

  const u=$("loginUser").value.trim(),p=$("loginPass").value;

  if(!u||!p){$("loginMsg").textContent="Enter your username and password.";return}

  $("loginMsg").textContent="Signing in...";

  try{const result=await window.posApi.login(u,p);const user=result?.user||result;if(!user||result?.ok===false){$("loginMsg").textContent=result?.message||"Invalid username or password.";return}currentUser=user;sessionStorage.setItem("posUser",JSON.stringify(user));enterApp()}catch(e){$("loginMsg").textContent=e?.message||"Login failed."}

}

function enterApp(){

  $("loginPage").classList.add("hidden");$("app").classList.remove("hidden");$("headerName").textContent=(String(currentUser.role||"").toLowerCase()==="owner"?"Owner":(currentUser.role||currentUser.name||currentUser.username));if($("headerRole"))$("headerRole").textContent="";applyRolePermissions();loadAll();showPage("dashboard");try{window.posApi.startRealtime?.()}catch(_e){}setTimeout(()=>refreshFromCloud(),250);

}

function logout(){

  currentUser=null;cart=[];editingTransactionId=null;sessionStorage.removeItem("posUser");

  $("app").classList.add("hidden");$("loginPage").classList.remove("hidden");

  $("loginUser").value="";

  const pass=$("loginPass"); if(pass){pass.value="";pass.type="password";}

  const toggle=$("loginPassToggle"); if(toggle){toggle.textContent="SHOW";toggle.setAttribute("aria-label","Show password");toggle.type="button";}

  $("loginMsg").textContent="";$("loginUser")?.focus();

}

function applyRolePermissions(){

  const staffPages=new Set(["pos","inventory","cups","sales","expenses","daily","history","account"]);

  document.querySelectorAll(".nav-btn").forEach(btn=>{

    const page=btn.dataset.page;

    const visible=!isStaff()||staffPages.has(page);

    btn.style.display=visible?"flex":"none";

  });

  const notice=document.querySelector("#page-sales .notice");

  if(notice)notice.innerHTML=isStaff()?"Staff can mark orders Completed and edit an order after Owner authorization. <strong>Staff cannot delete orders.</strong>":"Owner can mark orders Completed, edit, or delete orders.";

  if(isStaff()&&["dashboard","monthly","yearly"].includes(document.querySelector(".page.active")?.id?.replace("page-","")))showPage("pos");

}

async function loadAll(){try{products=await window.posApi.products();ensureProductManagerUI();renderPosSizeChoices();await Promise.all([loadDashboard(),loadSales(),loadExpenses(),loadInventory(),loadCups(),loadDailySalesTracker(),loadAccount(),loadMonthlyYearly(),loadHistory()]);renderCategories();renderProducts();renderCart()}catch(e){err(e)}}



document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));

document.addEventListener("click",e=>{const btn=e.target.closest("[data-inventory-category]");if(!btn)return;e.preventDefault();e.stopPropagation();setInventoryCategory(btn.dataset.inventoryCategory)});



document.addEventListener("input",e=>{if(e.target?.id!=="inventorySearch")return;inventorySearch=e.target.value||"";renderInventory();});

function showPage(page){

  const allowed=["dashboard","pos","sales","expenses","inventory","cups","daily","monthly","yearly","history","account"];if(!allowed.includes(page))page="dashboard";

  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));const target=$("page-"+page);if(target)target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.page===page));

  const title={dashboard:"Business Summary",pos:"Point of Sale",sales:"Sales",expenses:"Expenses",inventory:"Inventory",cups:"Daily Cup Tracker",daily:"Daily Sales Tracker",monthly:"Monthly Sales & Expenses",yearly:"Yearly Sales & Expenses",history:"Historical Data",account:"My Account"}[page];document.title=`cof/tea Café POS • ${title}`;

  if(page==="dashboard")loadDashboard();if(page==="pos"){ensureProductManagerUI();renderCategories();renderPosSizeChoices();renderProducts();renderCart()}if(page==="sales"){if($("salesDate"))$("salesDate").value=today();loadSales()}if(page==="expenses")loadExpenses();if(page==="inventory")loadInventory();if(page==="cups")loadCups();if(page==="daily")loadDailySalesTracker();if(page==="monthly"||page==="yearly")loadMonthlyYearly();if(page==="history")loadHistory();if(page==="account")loadAccount();

}

async function refreshCloudPage(page="dashboard"){

  try{

    // This is a TRUE cloud refresh. It first downloads the newest Supabase

    // state to this device, then redraws the requested page.

    if(!navigator.onLine){

      throw new Error("This device is offline. Connect to the internet before refreshing cloud data.");

    }



    if(!window.posApi?.forceCloudRefresh){

      throw new Error("Cloud refresh is not available in this build.");

    }



    const state=await window.posApi.forceCloudRefresh();



    if(page==="dashboard"){

      await loadDashboard();

    }else if(page==="sales"){

      await loadSales();

      await loadDashboard();

    }else if(page==="expenses"){

      await loadExpenses();

      await loadDashboard();

    }else if(page==="inventory"){

      await loadInventory();

      await loadCups();

    }else if(page==="cups"){

      await loadCups();

      await loadInventory();

    }else if(page==="daily"){

      await loadDailySalesTracker();

      await loadDashboard();

    }else if(page==="reports"){

      await loadMonthlyYearly();

      await loadDashboard();

    }else{

      await loadAll();

    }



    updateSyncStatus({

      online:true,

      pending:await window.posApi?.pendingCount?.()||0

    });



    notify("Fresh Supabase data loaded.");

    return state;

  }catch(e){

    err(e);

    throw e;

  }

}



async function refreshAll(){

  return refreshCloudPage("dashboard");

}



window.refreshCloudPage=refreshCloudPage;

window.refreshAll=refreshAll;



function setPosSize(size){posSize=size;selectedSize=size;document.querySelectorAll(".pos-size-btn").forEach(b=>b.classList.toggle("active",b.dataset.size===size));}

function renderPosSizeChoices(){document.querySelectorAll(".pos-size-btn").forEach(b=>b.classList.toggle("active",b.dataset.size===posSize));}

function renderCategories(){$("categories").innerHTML=CATEGORIES.map(c=>`<button class="cat-btn ${c===activeCategory?"active":""}" onclick="selectCategory('${c}')">${esc(c)}</button>`).join("")}

function selectCategory(c){activeCategory=c;renderCategories();renderProducts()}

function renderProducts(){

  const el=$("products");if(!el)return;

  ensureProductManagerUI();

  if(activeCategory==="Customized Drink"){el.innerHTML=`<button class="product-btn" onclick="openCustomDrink()"><div class="product-name">➕ Customized Drink</div><div class="price-line">Choose base drink, size, temperature, Tutti Frutti and add-ons.</div></button>`;return}

  const list=products.filter(p=>p.category===activeCategory);

  el.innerHTML=list.map(p=>`<button class="product-btn" onclick='openProduct(${JSON.stringify(p)})'><div class="product-name">${esc(p.name)}</div><div class="price-line">12oz ${money(p.p12)} • 16oz ${money(p.p16)} • 22oz ${money(p.p22)}</div></button>`).join("")||`<div class="notice">No products in this category.</div>`;

}

function openProduct(p){selectedProduct=p;editingCartIndex=-1;selectedSize="12oz";setupProductModal(p,false)}

function openCustomDrink(){selectedProduct=products[0]||null;editingCartIndex=-1;selectedSize="12oz";$("modalTitle").textContent="Customized Drink";$("customBaseWrap").classList.remove("hidden");$("customFlavor").value="";const types=CATEGORIES.slice(0,7);$("customBase").innerHTML=types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");customBaseChanged();$("productModal").classList.remove("hidden")}

function customBaseChanged(){const p=products.find(x=>x.category===$("customBase").value);if(p){selectedProduct=p;setupProductChoices(p)}}

function setupProductModal(p,isCustom){

  $("productModal").classList.remove("hidden");$("modalTitle").textContent=isCustom?"Customized Drink":`${p.category} • ${p.name}`;$("customBaseWrap").classList.toggle("hidden",!isCustom);if(editingCartIndex<0)selectedSize="12oz";selectedTemp="Cold";selectedAddons=[];tutti=false;freeUpsize=false;freeUpsizeOriginalSize="12oz";freeDrink=false;freeDrinkSelection=null;if(isCustom&&$("customBase")){const types=CATEGORIES.slice(0,7);$("customBase").innerHTML=types.map(t=>`<option value="${esc(t)}" ${t===p.category?"selected":""}>${esc(t)}</option>`).join("");$("customFlavor").value=""}setupProductChoices(p)}

function setupProductChoices(p){

  const prices=[["12oz",p.p12],["16oz",p.p16],["22oz",p.p22]];

  $("sizeChoices").innerHTML=prices.map(([s,v])=>{const originalIndex={"12oz":0,"16oz":1,"22oz":2};const oi=originalIndex[freeUpsizeOriginalSize],si=originalIndex[s];const allowed=!freeUpsize||si>oi;const customFee=$("customBaseWrap").classList.contains("hidden")?0:5;const shown=freeUpsize&&allowed?"FREE UPSIZE":money(Number(v||0)+customFee);return `<button type="button" class="choice size-choice ${s===selectedSize?"active":""}" ${allowed?`onclick="selectSize('${s}')"`:`disabled`}><strong>${s.replace("oz"," oz")}</strong><span>${shown}</span>${customFee?"<small>+₱5 customized</small>":""}${freeUpsize&&allowed?"<small>Original price kept</small>":""}</button>`}).join("");

  const hotAllowed=["Cafe Latte","Amerikano","Amerikano Twist","Milktea"].includes(p.category)||(p.category==="Fruit Series"&&(selectedSize==="16oz"||selectedSize==="22oz"));if(!hotAllowed&&selectedTemp==="Hot")selectedTemp="Cold";$("tempChoices").innerHTML=(hotAllowed?["Hot","Cold"]:["Cold"]).map(t=>`<button class="choice ${t===selectedTemp?"active":""}" onclick="selectTemp('${t}')">${t}</button>`).join("");

  const tuttiAllowed=p.category==="Fruit Series"||p.category==="Soda Series";$("tuttiWrap").classList.toggle("hidden",!tuttiAllowed);$("tuttiBtn").classList.toggle("active",tutti);

  $("freeUpsizeBtn").classList.toggle("active",freeUpsize);$("freeDrinkBtn").classList.toggle("active",freeDrink);$("freeDrinkBtn").textContent=freeDrink&&freeDrinkSelection?`FREE DRINK: ${freeDrinkSelection.name}`:"ADD 1 FREE DRINK";$("freePromoNote").classList.toggle("hidden",!(freeUpsize||freeDrink));

  $("addonChoices").innerHTML=ADDONS.map(([name,price])=>{const on=selectedAddons.some(a=>a[0]===name);return `<button class="choice ${on?"active":""}" onclick="toggleAddon('${name}',${price})">${esc(name)}<br>+${money(price)}</button>`}).join("");

}

function selectSize(s){if(freeUpsize){const idx={"12oz":0,"16oz":1,"22oz":2};if(idx[s]<=idx[freeUpsizeOriginalSize])return}selectedSize=s;setupProductChoices(selectedProduct)}

function selectTemp(t){selectedTemp=t;setupProductChoices(selectedProduct)}

function toggleFreeUpsize(){if(!freeUpsize){if(selectedSize==="22oz")return alert("22oz is already the largest size.");freeUpsizeOriginalSize=selectedSize;freeUpsize=true}else{freeUpsize=false}setupProductChoices(selectedProduct)}

function toggleFreeDrink(){if(freeDrink){freeDrink=false;freeDrinkSelection=null;setupProductChoices(selectedProduct);return}freeDrink=true;openFreeDrinkSelector()}

function openFreeDrinkSelector(){$("freeDrinkModal").classList.remove("hidden");renderFreeDrinkCategories();renderFreeDrinkProducts()}

let freeDrinkCategory="Cafe Latte";

function renderFreeDrinkCategories(){$("freeDrinkCategories").innerHTML=CATEGORIES.slice(0,7).map(c=>`<button class="cat-btn ${c===freeDrinkCategory?"active":""}" onclick="selectFreeDrinkCategory('${c}')">${esc(c)}</button>`).join("")}

function selectFreeDrinkCategory(c){freeDrinkCategory=c;renderFreeDrinkCategories();renderFreeDrinkProducts()}

function renderFreeDrinkProducts(){const list=products.filter(p=>p.category===freeDrinkCategory);$("freeDrinkProducts").innerHTML=list.map(p=>`<button class="product-btn" onclick='selectFreeDrink(${JSON.stringify(p)})'><div class="product-name">${esc(p.name)}</div><div class="price-line">FREE • ${selectedSize} • ${selectedTemp}</div></button>`).join("")}

function selectFreeDrink(p){freeDrinkSelection=p;$ ("freeDrinkModal").classList.add("hidden");setupProductChoices(selectedProduct)}

function cancelFreeDrinkSelection(){freeDrink=false;freeDrinkSelection=null;$("freeDrinkModal").classList.add("hidden");setupProductChoices(selectedProduct)}

function toggleAddon(name,price){const i=selectedAddons.findIndex(a=>a[0]===name);if(i>=0)selectedAddons.splice(i,1);else selectedAddons.push([name,price]);setupProductChoices(selectedProduct)}

function clearAddons(){selectedAddons=[];setupProductChoices(selectedProduct)}

function toggleTutti(){tutti=!tutti;setupProductChoices(selectedProduct)}

function closeProductModal(){$("productModal").classList.add("hidden")}

function lineTotal(x){return Math.max(0,Number(x.unit||0)+Number(x.addonPrice||0)+(x.tutti?10:0))}

function addConfiguredDrink(){

  if(!selectedProduct)return;

  let actualSize=selectedSize,unitSize=freeUpsize?freeUpsizeOriginalSize:selectedSize;const priceMap={"12oz":selectedProduct.p12,"16oz":selectedProduct.p16,"22oz":selectedProduct.p22};const isCustomized=!$("customBaseWrap").classList.contains("hidden");const customFee=isCustomized?5:0;let unit=Number(priceMap[unitSize]||0)+customFee;let addonPrice=selectedAddons.reduce((s,a)=>s+Number(a[1]),0);let addon=selectedAddons.map(a=>a[0]).join(", ")||"No Add-on";if(tutti)addon=addon==="No Add-on"?"Tutti Frutti":addon+", Tutti Frutti";

  let name=$("customBaseWrap").classList.contains("hidden")?selectedProduct.name:(($("customFlavor").value.trim())||selectedProduct.name);let category=selectedProduct.category;const cupType=selectedTemp==="Hot"?"Hot Cups":actualSize;

  const item={product:name,category,size:actualSize,cupType,originalSize:freeUpsize?unitSize:null,temperature:selectedTemp,tutti,addon,addonPrice,unit,qty:1,lineTotal:unit+addonPrice+(tutti?10:0),freeUpsize,freeDrink:false,customFee,customized:isCustomized};

  if(editingCartIndex>=0)cart[editingCartIndex]=item;else cart.push(item);

  if(freeDrink&&freeDrinkSelection){cart.push({product:freeDrinkSelection.name,category:freeDrinkSelection.category,size:actualSize,cupType:selectedTemp==="Hot"?"Hot Cups":actualSize,originalSize:null,temperature:selectedTemp,tutti:false,addon:"FREE DRINK",addonPrice:0,unit:0,qty:1,lineTotal:0,freeUpsize:false,freeDrink:true,customized:false})}

  closeProductModal();editingCartIndex=-1;renderCart();

}

function editCartItem(i){const x=cart[i];const p=products.find(p=>p.name===x.product&&p.category===x.category)||products.find(p=>p.category===x.category);if(!p)return;selectedProduct=p;editingCartIndex=i;selectedSize=x.size;selectedTemp=x.temperature||"Cold";selectedAddons=[];const addonText=String(x.addon||"");ADDONS.forEach(a=>{if(addonText.includes(a[0]))selectedAddons.push(a)});tutti=addonText.includes("Tutti Frutti");freeUpsize=!!x.freeUpsize;freeUpsizeOriginalSize=x.originalSize||"12oz";freeDrink=false;freeDrinkSelection=null;setupProductModal(p,!!x.customized);}

function changeQty(i,delta){if(!cart[i])return;cart[i].qty=Math.max(1,Number(cart[i].qty||1)+delta);renderCart()}

function removeItem(i){cart.splice(i,1);renderCart()}

function clearCart(){cart=[];editingTransactionId=null;$("orderTitle").textContent="Current Order";$("cashReceived").value="";renderCart()}

function cartTotal(){return cart.reduce((s,x)=>s+lineTotal(x)*Number(x.qty||1),0)}

function renderCart(){const total=cartTotal();$("cartList").innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-row"><div class="cart-top"><span>${Number(x.qty)} × ${esc(x.product)} ${esc(x.size)}</span><strong>${money(lineTotal(x)*x.qty)}</strong></div><div class="cart-sub">${esc(x.temperature||"Cold")} • ${esc(x.addon||"No Add-on")}${x.freeUpsize?` • FREE UPSIZE from ${esc(x.originalSize)}`:""}${x.freeDrink?" • FREE DRINK":""}</div><div class="qty-controls"><button class="mini" onclick="changeQty(${i},-1)">−</button><span>${x.qty}</span><button class="mini" onclick="changeQty(${i},1)">+</button><button class="mini" onclick="editCartItem(${i})">Edit</button><button class="mini" onclick="removeItem(${i})">×</button></div></div>`).join(""):`<div class="notice">No items in the order. Select a drink to begin.</div>`;$("subtotal").textContent=money(total);$("total").textContent=money(total);const cash=Number($("cashReceived").value||0);$("change").textContent=money(payment==="Cash"?Math.max(0,cash-total):0)}

function setPayment(p,btn){payment=p;document.querySelectorAll(".pay-btn").forEach(b=>b.classList.remove("active"));if(btn)btn.classList.add("active");else document.querySelectorAll(".pay-btn").forEach(b=>{if(b.textContent.trim()===p)b.classList.add("active")});if(p!=="Cash")$("cashReceived").value="";renderCart()}

function handleCashInput(value){

  const input=$("cashReceived");

  if(!input)return;

  const raw=String(value??"");

  const cleaned=raw.replace(/[^0-9.]/g,"");

  const firstDot=cleaned.indexOf(".");

  const normalized=firstDot>=0

    ? cleaned.slice(0,firstDot+1)+cleaned.slice(firstDot+1).replace(/**\.**/g,"")

    : cleaned;

  // Do not rebuild the POS or replace the input while the user is typing.

  // This keeps the caret/focus stable in Electron.

  if(input.value!==normalized){

    const start=input.selectionStart;

    input.value=normalized;

    if(document.activeElement===input && start!=null){

      const pos=Math.min(start,normalized.length);

      try{input.setSelectionRange(pos,pos)}catch(_e){}

    }

  }

  const total=cartTotal();

  const cash=Number(normalized||0);

  const change=payment==="Cash"?Math.max(0,cash-total):0;

  const changeEl=$("change");

  if(changeEl)changeEl.textContent=money(change);

}

function quickCash(n){$("cashReceived").value=n;setPayment("Cash",document.querySelector('.pay-btn'));renderCart()}

async function saveCurrentSale(){

  if(saleBusy)return;

  if(!cart.length)return alert("Add at least one drink.");

  const total=cartTotal(),cash=Number($("cashReceived").value||0);

  if(payment==="Cash"&&cash<total)return alert(`Cash received is ${money(cash)} but total is ${money(total)}.`);

  saleBusy=true;

  const wasEditing=!!editingTransactionId;

  try{

    const r=wasEditing?await window.posApi.updateSale({saleId:editingTransactionId,items:cart,payment,cash,userId:currentUser.id}):await window.posApi.saveSale({items:cart,payment,cash,userId:currentUser.id});

    clearCart();

    await Promise.all([loadDashboard(),loadInventory(),loadCups(),loadDailySalesTracker(),loadSales()]);

    restoreInputFocus("cashReceived");

    notify(wasEditing?"Sale updated successfully.":`Sale saved • ${r.transactionId}`);

  }catch(e){err(e)}finally{saleBusy=false}

}



async function loadDashboard(){try{const d=await window.posApi.dashboard();[["dDaily",d.daily],["dExpToday",d.expensesToday],["dNetToday",d.netToday],["dMonth",d.monthly],["dExpMonth",d.expensesMonth],["dNetMonth",d.netMonth],["dYear",d.yearly],["dExpYear",d.expensesYear],["dNetYear",d.netYear]].forEach(([id,v])=>$(id).textContent=money(v))}catch(e){err(e)}}



async function loadSales(){if(!$ ("salesTable"))return;const date=$("salesDate")?.value||today();$("salesTable").innerHTML=`<tr><td colspan="11" class="muted">Loading...</td></tr>`;try{const rows=await window.posApi.sales(date);$("salesTable").innerHTML=rows.length?rows.flatMap(s=>s.item_details.map((i,idx)=>`<tr><td>${displayDate(s.sale_date)}</td><td>${esc(s.sale_time)}</td><td><strong>${esc(s.transaction_id)}</strong></td><td>${esc(i.product_name)}</td><td>${esc(i.category)}</td><td>${esc(i.size)}${i.free_upsize?` <small>(free upsize from ${esc(i.original_size)})`:""}</small></td><td>${esc(i.temperature)}</td><td>${i.quantity}</td><td>${money(Number(i.line_total)*Number(i.quantity))}${i.free_drink?' <small>(FREE)</small>':''}</td><td>${esc(s.payment_method)}</td><td><div class="action-group">${idx===0&&!isStaff()?`<button class="small-btn" onclick="editTransaction(${s.id})">Edit</button><button class="small-btn danger" onclick="removeTransaction(${s.id})">Delete</button>`:""}</div></td></tr>`)).join(""):`<tr><td colspan="11" class="muted">No sales recorded for ${displayDate(date)}.</td></tr>`}catch(e){err(e)}}

async function editTransaction(id,ownerAuthorized=false){
  if(isStaff()&&!ownerAuthorized)return alert("Owner authorization is required before Staff can edit a sale.");
  try{
    const rows=await window.posApi.sales($("salesDate").value||today());
    const tx=rows.find(x=>x.id===Number(id));
    if(!tx)return alert("Transaction not found.");

    if(tx.details_archived || !(tx.item_details||[]).length){
      return alert("This order's detailed items were already archived to save database space. The transaction and report totals are still preserved, but the old item details can no longer be edited.");
    }

    cart=tx.item_details.map(i=>({
      product:i.product_name,
      category:i.category,
      size:i.size,
      cupType:(String(i.temperature||"Cold").toLowerCase()==="hot"?"Hot Cups":i.size),
      temperature:i.temperature||"Cold",
      tutti:!!i.tutti_frutti,
      addon:i.addon||"No Add-on",
      addons:Array.isArray(i.addons_json)?i.addons_json:[],
      addonPrice:Number(i.addon_price)||0,
      customized:!!i.customized,
      freeUpsize:!!i.free_upsize,
      freeDrink:!!i.free_drink,
      originalSize:i.original_size||null,
      unit:Number(i.unit_price)||0,
      qty:Number(i.quantity)||1,
      lineTotal:Number(i.line_total)||0
    }));

    editingTransactionId=tx.id;
    payment=tx.payment_method||"Cash";
    $("cashReceived").value=tx.cash_received||"";
    $("orderTitle").textContent=`Editing ${tx.transaction_id}`;
    setPayment(payment);
    renderCart();
    showPage("pos");
  }catch(e){err(e)}
}

async function removeTransaction(id){if(isStaff())return alert("Staff accounts cannot delete sales.");if(!confirm("Delete this transaction? The cup inventory used by it will be restored."))return;try{await window.posApi.deleteSale(id);await loadSales();await loadDashboard();await loadInventory();await loadCups();await loadDailySalesTracker();notify("Sale deleted and cup inventory restored.")}catch(e){err(e)}}



async function loadExpenses(){if(!$ ("expensesTable"))return;const date=$("expDate")?.value||today();$("expensesTable").innerHTML=`<tr><td colspan="9" class="muted">Loading...</td></tr>`;try{expenses=await window.posApi.expenses(date);$("expensesTable").innerHTML=expenses.length?expenses.map(e=>`<tr><td>${displayDate(e.expense_date)}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td>${money(e.amount)}</td><td>${esc(e.payment_method)}</td><td>${esc(e.notes||"")}</td><td><div class="action-group"><button class="small-btn" onclick="editExpense(${e.id})">Edit</button><button class="small-btn danger" onclick="removeExpense(${e.id})">Delete</button></div></td></tr>`).join(""):`<tr><td colspan="7" class="muted">No expenses recorded.</td></tr>`}catch(e){err(e)}}

async function saveExpense(){if(expenseBusy)return;const data={id:Number($("expId").value)||0,date:today(),category:$("expCategory").value.trim(),description:$("expDescription").value.trim(),amount:Number($("expAmount").value)||0,payment:$("expPayment").value,notes:$("expNotes").value.trim()};if(!data.category||!data.description||data.amount<=0)return alert("Please complete the expense form.");expenseBusy=true;try{await window.posApi.addExpense(data);clearExpenseForm();await loadExpenses();await loadDashboard();notify(data.id?"Expense updated successfully.":"Expense saved successfully.")}catch(e){err(e)}finally{expenseBusy=false}}

function editExpense(id){const e=expenses.find(x=>x.id===Number(id));if(!e)return;$("expId").value=e.id;$("expCategory").value=e.category;$("expDescription").value=e.description;$("expAmount").value=e.amount;$("expPayment").value=e.payment_method||"Cash";$("expNotes").value=e.notes||"";$("expenseSaveBtn").textContent="UPDATE EXPENSE";showPage("expenses")}

function clearExpenseForm(){["expRow","expId","expCategory","expDescription","expAmount","expNotes"].forEach(id=>{if($(id))$(id).value=""});$("expPayment").value="Cash";$("expenseSaveBtn").textContent="SAVE EXPENSE"}

async function removeExpense(id){if(!confirm("Delete this expense?"))return;try{await window.posApi.deleteExpense(id);await loadExpenses();await loadDashboard();notify("Expense deleted.")}catch(e){err(e)}}



// Product manager: injected without changing the existing HTML layout.

function ensureProductManagerUI(){

  if($("productManagerTools")||!$("products"))return;

  const wrap=document.createElement("div");

  wrap.id="productManagerTools";

  wrap.style.cssText="display:flex;justify-content:flex-end;gap:8px;margin:0 0 10px;";

  wrap.innerHTML=`<button type="button" class="small-btn" onclick="openProductManager()">＋ ADD NEW POS ITEM</button>`;

  $("products").parentNode.insertBefore(wrap,$("products"));

}

function openProductManager(){

  let m=$("productManagerModal");

  if(!m){

    m=document.createElement("div");m.id="productManagerModal";m.className="hidden";

    m.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:20px;";

    m.innerHTML=`<div style="background:#fff;border-radius:16px;padding:22px;width:min(520px,96vw);box-shadow:0 20px 60px rgba(0,0,0,.2);color:#241c17;">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="margin:0;">Add New POS Item</h3><button type="button" class="small-btn" onclick="closeProductManager()">×</button></div>

      <div style="display:grid;gap:10px;">

        <label>Category<select id="pmCategory" style="width:100%;padding:9px;"><option>Cafe Latte</option><option>Amerikano</option><option>Amerikano Twist</option><option>Milktea</option><option>Frappe</option><option>Fruit Series</option><option>Soda Series</option></select></label>

        <label>Product Name<input id="pmName" type="text" style="width:100%;padding:9px;" placeholder="Product name"></label>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">

          <label>12oz<input id="pmP12" type="number" min="0" step="0.01" style="width:100%;padding:9px;"></label>

          <label>16oz<input id="pmP16" type="number" min="0" step="0.01" style="width:100%;padding:9px;"></label>

          <label>22oz<input id="pmP22" type="number" min="0" step="0.01" style="width:100%;padding:9px;"></label>

        </div>

        <div style="font-size:12px;color:#6f6259;">The new item will immediately appear in its selected POS category.</div>

        <button type="button" class="small-btn" onclick="saveNewProduct()" id="pmSaveBtn">SAVE POS ITEM</button>

      </div>

    </div>`;

    document.body.appendChild(m);

  }

  m.classList.remove("hidden");m.style.display="flex";$("pmName").value="";$("pmP12").value="";$("pmP16").value="";$("pmP22").value="";$("pmCategory").value=CATEGORIES.slice(0,7).includes(activeCategory)?activeCategory:"Cafe Latte";$("pmName").focus();

}

function closeProductManager(){const m=$("productManagerModal");if(m){m.classList.add("hidden");m.style.display="none"}}

async function saveNewProduct(){

  const btn=$("pmSaveBtn");if(!btn)return;

  const d={category:$("pmCategory").value,name:$("pmName").value.trim(),p12:Number($("pmP12").value)||0,p16:Number($("pmP16").value)||0,p22:Number($("pmP22").value)||0};

  if(!d.name)return alert("Product name is required.");

  if(d.p12<=0&&d.p16<=0&&d.p22<=0)return alert("Enter at least one price.");

  btn.disabled=true;

  try{

    const saved=await window.posApi.saveProduct(d);

    products=await window.posApi.products();

    activeCategory=d.category;

    closeProductManager();renderCategories();renderProducts();

    notify(`POS item "${saved.name||d.name}" added successfully.`);

  }catch(e){err(e)}finally{btn.disabled=false}

}



async function loadInventory(){if(!$ ("inventoryTable"))return;try{inventoryData=await window.posApi.inventory();renderInventoryFilters();renderInventory()}catch(e){err(e)}}

function renderInventoryFilters(){const cats=["All",...Array.from(new Set(inventoryData.map(x=>String(x.category||"Other")))).sort()];const el=$("inventoryFilters");if(!el)return;el.innerHTML=cats.map(c=>`<button type="button" class="inventory-cat ${c===inventoryFilter?"active":""}" data-inventory-category="${esc(c)}">${esc(c)}</button>`).join("")}

function setInventoryCategory(category){inventoryFilter=String(category||"All");renderInventoryFilters();renderInventory()}

function renderInventory(){const q=inventorySearch.trim().toLowerCase();const rows=inventoryData.filter(x=>{const category=String(x.category||"Other");const matchesCategory=inventoryFilter==="All"||category===inventoryFilter;const hay=[x.sku,x.name,category,x.unit].map(v=>String(v||"").toLowerCase()).join(" ");return matchesCategory&&(!q||hay.includes(q));});$("inventoryTable").innerHTML=rows.map(x=>{const category=String(x.category||"Other");const zero=Number(x.total)<=0;return `<tr class="${zero?"inventory-zero-stock":""}"><td>${esc(x.sku)}</td><td><strong>${esc(x.name)}</strong>${zero?' <span class="stock-zero-badge">OUT OF STOCK</span>':""}</td><td class="inventory-category-cell"><button type="button" class="inventory-category-link ${category===inventoryFilter?"active":""}" data-inventory-category="${esc(category)}" title="Click to show only ${esc(category)} items">${esc(category)}</button></td><td>${esc(x.unit)}</td><td>${Number(x.inside)||0}</td><td>${Number(x.outside)||0}</td><td><strong>${Number(x.total)||0}</strong></td><td><div class="action-group"><button type="button" class="small-btn" onclick="editInventory(${x.id})">Edit</button><button type="button" class="small-btn danger" onclick="removeInventory(${x.id})">Delete</button></div></td></tr>`}).join("")||`<tr><td colspan="8" class="muted">No inventory items.</td></tr>`}

function openInventoryModal(){$("invRow").value="";$("invSKU").value="";$("invOriginalSKU").value="";$("invItem").value="";$("invCategory").value="Other";$("invUnit").value="pcs";$("invInside").value=0;$("invOutside").value=0;$("invTitle").textContent="Add Inventory Item";$("inventoryModal").classList.remove("hidden")}

function editInventory(id){const x=inventoryData.find(z=>z.id===Number(id));if(!x)return;$("invRow").value=x.id;$("invSKU").value=x.sku;$("invOriginalSKU").value=x.sku;$("invItem").value=x.name;$("invCategory").value=x.category;$("invUnit").value=x.unit;$("invInside").value=x.inside;$("invOutside").value=x.outside;$("invTitle").textContent="Edit Inventory Item";$("inventoryModal").classList.remove("hidden")}

function closeInventoryModal(){$("inventoryModal").classList.add("hidden")}

async function saveInventoryItem(){if(inventoryBusy)return;const d={id:Number($("invRow").value)||0,sku:$("invSKU").value.trim(),item:$("invItem").value.trim(),category:$("invCategory").value,unit:$("invUnit").value.trim()||"pcs",inside:Number($("invInside").value)||0,outside:Number($("invOutside").value)||0};if(!d.item)return alert("Item name is required.");inventoryBusy=true;try{await window.posApi.saveInventory(d);closeInventoryModal();await loadInventory();await loadCups();notify(d.id?"Inventory item updated.":"Inventory item added.")}catch(e){err(e)}finally{inventoryBusy=false}}

async function removeInventory(id){if(!confirm("Delete this inventory item?"))return;try{await window.posApi.deleteInventory(id);await loadInventory();await loadCups()}catch(e){err(e)}}



async function loadCups(){if(!$ ("cupsTable"))return;try{const result=await window.posApi.cupSummary(today());const rows=result.rows||[];const totalSold=Number(result.totalSold||0);$("cupsReleased").textContent="—";$("cupsSold").textContent=totalSold;$("cupQuota").textContent="60 cups";$("cupProgress").style.width=Math.min(100,totalSold/60*100)+"%";$("cupProgressText").textContent=`${totalSold} / 60 cups`;$("cupsReleased").textContent=Math.min(100,Math.round(totalSold/60*100))+"%";$("cupsTable").innerHTML=rows.map(r=>{const remaining=Number(r.remaining)||0;return `<tr><td><strong>${esc(r.size)}</strong></td><td>${Number(r.soldToday)||0}</td><td><strong>${remaining}</strong></td><td>${remaining<=0?'<span class="stock-zero-badge">OUT OF STOCK</span>':'<span class="muted">Available</span>'}</td></tr>`}).join("");await loadCupSummary()}catch(e){err(e)}}

async function loadCupSummary(){
  // Cup Tracker history uses dailyTracker(), which includes archived
  // daily_sales_summary.total_cups after sale_items are deleted.
  const el=$("cupSummaryTable");if(!el)return;try{const rows=await window.posApi.dailyTracker();el.innerHTML=rows.length?rows.map(r=>`<tr><td>${displayDate(r.date)}</td><td><strong>${Number(r.cups)||0}</strong></td></tr>`).join(""):`<tr><td colspan="2" class="muted">No cup sales recorded.</td></tr>`}catch(e){err(e)}}

async function loadDailySalesTracker(){
  // Daily Sales uses the same permanent cup source as Cup Tracker.
  const el=$("dailySalesTable");if(!el)return;try{const rows=await window.posApi.dailyTracker();el.innerHTML=rows.length?rows.map(r=>`<tr><td>${displayDate(r.date)}</td><td>${money(r.sales)}</td><td>${Number(r.cups)||0}</td><td>${money(r.expenses)}</td><td>${money(r.net)}</td><td>${money(r.gcash)}</td><td>${money(r.cash)}</td><td><strong>${money(Number(r.cash)-Number(r.expenses))}</strong></td><td><div class="action-group"><button class="small-btn" onclick="editReport('daily','${esc(r.date)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('daily','${esc(r.date)}')">Delete</button></div></td></tr>`).join(""):`<tr><td colspan="9" class="muted">No daily sales recorded.</td></tr>`}catch(e){err(e)}}

// Kept for compatibility with the original HTML; cup stock is now inventory-linked.

function releaseCups(){alert("Cup releasing is no longer required. Add cup stock directly in Inventory; POS sales automatically deduct it.")}

function openCupStatus(size){alert(`${size} remaining is controlled by Inventory. Open Inventory to correct the stock.`)}

function closeCupStatusModal(){$("cupStatusModal")?.classList.add("hidden")}

function saveCupStatus(){closeCupStatusModal();showPage("inventory")}



async function loadMonthlyYearly(){

  try{

    const [m,y]=await Promise.all([window.posApi.monthly(),window.posApi.yearly()]);

    if($("monthlyTable")){

      $("monthlyTable").innerHTML=m.length?m.map(r=>`

        <tr><td>${esc(r.month)}</td><td><strong>${money(r.sales)}</strong></td><td>${money(r.cash)}</td><td>${money(r.gcash)}</td><td>${money(r.expenses)}</td><td><strong>${money(r.net)}</strong></td><td><div class="action-group"><button class="small-btn" onclick="editReport('monthly','${esc(r.month)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('monthly','${esc(r.month)}')">Delete</button></div></td></tr>`).join(""):

        `<tr><td colspan="7" class="muted">No monthly data.</td></tr>`;

    }

    if($("yearlyTable")){

      $("yearlyTable").innerHTML=y.length?y.map(r=>`

        <tr><td>${esc(r.year)}</td><td><strong>${money(r.sales)}</strong></td><td>${money(r.cash)}</td><td>${money(r.gcash)}</td><td>${money(r.expenses)}</td><td><strong>${money(r.net)}</strong></td><td><div class="action-group"><button class="small-btn" onclick="editReport('yearly','${esc(r.year)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('yearly','${esc(r.year)}')">Delete</button></div></td></tr>`).join(""):

        `<tr><td colspan="7" class="muted">No yearly data.</td></tr>`;

    }

  }catch(e){err(e)}

}



function closeReportEdit(){$("reportEditModal")?.classList.add("hidden")}

async function editReport(type,key){try{const rows=type==='daily'?await window.posApi.dailyTracker():type==='monthly'?await window.posApi.monthly():await window.posApi.yearly();const r=rows.find(x=>String(x[type==='daily'?'date':type==='monthly'?'month':'year'])===String(key));if(!r)return alert('Report period not found.');$("reportEditType").value=type;$("reportEditKey").value=key;$("reportEditTitle").textContent=`Edit ${type==='daily'?'Daily':type==='monthly'?'Monthly':'Yearly'} Sales • ${key}`;$("reportEditSales").value=Number(r.sales||0);$("reportEditCash").value=Number(r.cash||0);$("reportEditGcash").value=Number(r.gcash||0);$("reportEditExpenses").value=Number(r.expenses||0);$("reportEditCups").value=Number(r.cups||0);$("reportEditCupsWrap").classList.toggle('hidden',type!=='daily');$("reportEditModal").classList.remove('hidden')}catch(e){err(e)}}

async function saveReportEdit(){const type=$("reportEditType").value,key=$("reportEditKey").value;const d={type,key,sales:Number($("reportEditSales").value)||0,cash:Number($("reportEditCash").value)||0,gcash:Number($("reportEditGcash").value)||0,expenses:Number($("reportEditExpenses").value)||0,cups:type==='daily'?(Number($("reportEditCups").value)||0):0};if(d.cash+d.gcash>d.sales+0.000001)return alert('Cash Paid + GCash Paid cannot be greater than Total Sales.');try{await window.posApi.reportAdjustmentSave(d);closeReportEdit();await Promise.all([loadDailySalesTracker(),loadMonthlyYearly(),loadDashboard(),loadCups()]);alert('Report updated successfully.')}catch(e){err(e)}}

async function deleteReport(type,key){if(!confirm(`Delete the manual correction for ${type==='daily'?'this day':type==='monthly'?'this month':'this year'}? The report will return to the automatically calculated totals. Your individual POS sales will NOT be deleted.`))return;try{await window.posApi.reportAdjustmentDelete(type,key);await Promise.all([loadDailySalesTracker(),loadMonthlyYearly(),loadDashboard(),loadCups()]);alert('Report correction deleted.')}catch(e){err(e)}}



async function loadHistory(){

  if(!$("historyTable"))return;

  try{

    const rows=await window.posApi.historical();

    $("historyTable").innerHTML=rows.length?rows.map(r=>`

      <tr><td>${displayDate(r.record_date)}</td><td><strong>${money(r.sales)}</strong></td><td>${money(r.cash_sales||0)}</td><td>${money(r.gcash_sales||0)}</td><td><strong>${money(r.expenses)}</strong></td><td>${money(r.cash_expenses||0)}</td><td>${money(r.gcash_expenses||0)}</td><td><strong>${Number(r.cups||0)}</strong></td><td>${esc(r.notes||"")}</td></tr>`).join(""):

      `<tr><td colspan="9" class="muted">No historical records.</td></tr>`;

  }catch(e){err(e)}

}

async function addHistory(){

  const d={date:$("hDate").value||today(),sales:Number($("hSales").value)||0,cashSales:Number($("hCashSales").value)||0,gcashSales:Number($("hGcashSales").value)||0,expenses:Number($("hExpenses").value)||0,cashExpenses:Number($("hCashExpenses").value)||0,gcashExpenses:Number($("hGcashExpenses").value)||0,cups:Number($("hCups").value)||0,notes:$("hNotes").value.trim()};

  try{

    await window.posApi.addHistorical(d);

    ["hSales","hCashSales","hGcashSales","hExpenses","hCashExpenses","hGcashExpenses","hCups","hNotes"].forEach(id=>$(id).value="");

    await loadHistory();await loadDashboard();await loadMonthlyYearly();await loadDailySalesTracker();await loadCups();

    notify("Historical data saved.");

  }catch(e){err(e)}

}



async function loadAccount(){if(!currentUser)return;try{const a=await window.posApi.account({userId:currentUser.id});$("accountName").textContent=a.name;$("accountUsername").textContent=a.username;$("accountRole").textContent=a.role;$("accountActive").textContent=a.active?"Active":"Inactive";$("accountEditName").value=a.name;$("accountEditUsername").value=a.username}catch(e){err(e)}}

async function saveAccountDetails(){try{const a=await window.posApi.updateAccount({userId:currentUser.id,name:$("accountEditName").value.trim(),username:$("accountEditUsername").value.trim()});currentUser={...currentUser,...a};sessionStorage.setItem("posUser",JSON.stringify(currentUser));$("headerName").textContent=(String(a.role||currentUser.role||"").toLowerCase()==="owner"?"Owner":(a.role||a.name||currentUser.name||currentUser.username));if($("headerRole"))$("headerRole").textContent="";await loadAccount();notify("Account details updated.")}catch(e){err(e)}}

async function changePassword(){const cur=$("currentPassword").value,next=$("newPassword").value,con=$("confirmPassword").value;if(!cur||!next)return alert("Enter your current and new password.");if(next!==con)return alert("New passwords do not match.");try{await window.posApi.changePassword({userId:currentUser.id,oldPassword:cur,newPassword:next});$("accountMsg").textContent="Password changed successfully.";["currentPassword","newPassword","confirmPassword"].forEach(id=>$(id).value="")}catch(e){err(e)}}

async function backup(){try{const r=await window.posApi.backup();if(r.ok)notify("Backup saved successfully.")}catch(e){err(e)}}

async function restore(){if(!confirm("Restore a CoFTea backup? Current local data will be replaced."))return;try{const r=await window.posApi.restore();if(r.ok){alert("Backup restored. Please log in again.");location.reload()}}catch(e){err(e)}}



let realtimeReloadTimer=null;

window.__cofteaRealtime=()=>{
  if(!currentUser)return;
  clearTimeout(realtimeReloadTimer);
  realtimeReloadTimer=setTimeout(async()=>{
    try{
      // Realtime already tells us something changed. Pull only the small live
      // dataset into IndexedDB, then redraw from cache.
      await window.posApi?.refreshToday?.();
      await loadAll();
    }catch(_e){}
  },1200);
};



// Stable input handling. Do NOT force BrowserWindow focus on every click/keystroke.

// Re-focusing the Electron window from pointer/focus events can steal the caret

// and make every text field appear frozen. Normal DOM focus is sufficient.

function initStableInputs(){

  document.querySelectorAll("input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])").forEach(el=>{

    el.style.pointerEvents="auto";

    el.style.userSelect="text";

    el.style.webkitUserSelect="text";

    el.style.webkitAppRegion="no-drag";

  });

}



// Only remember the last field; never call window.focus() while typing.

let lastEditableInput=null;

document.addEventListener("focusin",e=>{

  if(e.target?.matches?.("input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])")){

    lastEditableInput=e.target;

  }

},true);



// Re-apply input styles when pages/modals are rendered dynamically.

const inputObserver=new MutationObserver(()=>initStableInputs());

inputObserver.observe(document.body,{childList:true,subtree:true});

initStableInputs();





// ===== Connection indicator + cross-device refresh =====

function updateSyncStatus(detail={}){

  const badge=$("syncStatus"),text=$("syncStatusText");

  if(!badge)return;

  const online=detail.online??navigator.onLine;

  const syncing=!!detail.syncing;

  const pending=Number(detail.pending||0);

  badge.classList.remove("online","offline","syncing");

  badge.classList.add(syncing?"syncing":online?"online":"offline");

  const label=syncing?"Syncing...":online?(pending?`${pending} pending`:"Cloud • Ready"):(pending?`Offline • ${pending} pending`:"Offline");

  if(text)text.textContent=label;

  badge.title=online?(pending?"Tap to upload pending changes and download fresh cloud data.":"Tap to verify Supabase and download the latest data from all devices."):("Offline mode. Local changes stay on this device until they are synced.");

}



window.addEventListener("coftea-sync-status",e=>updateSyncStatus(e.detail||{}));

window.addEventListener("online",async()=>{

  updateSyncStatus({online:true,syncing:true});

  try{

    await window.posApi?.startRealtime?.();

    await (window.posApi?.forceCloudRefresh?.() || window.posApi?.refreshToday?.());

    if(currentUser)await loadAll();

  }catch(e){console.warn("Online refresh failed",e);}

  try{updateSyncStatus({online:true,pending:await window.posApi?.pendingCount?.()||0});}catch(_e){updateSyncStatus({online:true});}

});

window.addEventListener("offline",()=>updateSyncStatus({online:false}));



let cloudRefreshBusy=false;
let lastAutomaticCloudRefresh=0;
const CLOUD_FALLBACK_REFRESH_MS=10*60*1000; // 10 minutes, not every 15 seconds
const CLOUD_FOCUS_STALE_MS=2*60*1000;

async function refreshFromCloud(){
  if(cloudRefreshBusy||!currentUser||!navigator.onLine)return;

  cloudRefreshBusy=true;
  try{
    await (window.posApi?.forceCloudRefresh?.() || window.posApi?.refreshToday?.());
    lastAutomaticCloudRefresh=Date.now();

    // loadAll() is cache-first in the egress-safe adapter, so this redraw does
    // not download every table again.
    await loadAll();

    updateSyncStatus({
      online:true,
      pending:await window.posApi?.pendingCount?.()||0
    });
  }catch(e){
    console.warn("Cloud refresh failed",e);
    updateSyncStatus({online:navigator.onLine});
  }finally{
    cloudRefreshBusy=false;
  }
}

// Realtime is the normal cross-device sync path.
// This slow fallback exists only in case a Realtime event is missed.
setInterval(()=>{
  if(!document.hidden)refreshFromCloud();
},CLOUD_FALLBACK_REFRESH_MS);

// Focusing the window no longer causes a full download every time.
// Only refresh when the cached cloud state is actually stale.
window.addEventListener("focus",()=>{
  if(Date.now()-lastAutomaticCloudRefresh>CLOUD_FOCUS_STALE_MS){
    setTimeout(refreshFromCloud,250);
  }
});

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden && Date.now()-lastAutomaticCloudRefresh>CLOUD_FOCUS_STALE_MS){
    setTimeout(refreshFromCloud,250);
  }
});

setTimeout(async()=>{

  try{

    updateSyncStatus({online:navigator.onLine,pending:await window.posApi?.pendingCount?.()||0});

    if(navigator.onLine)await window.posApi?.startRealtime?.();

  }catch(_e){updateSyncStatus({online:navigator.onLine});}

},300);



$("loginPass")?.addEventListener("keydown",e=>{if(e.key==="Enter")login()});

initStableInputs();

$("salesDate")?.addEventListener("change",loadSales);

window.addEventListener("load",()=>{const saved=sessionStorage.getItem("posUser");if(saved){try{currentUser=JSON.parse(saved);enterApp()}catch(e){sessionStorage.removeItem("posUser")}}else{$("loginUser")?.focus()}});









function syncOperationLabel(op){

  const labels={

    saveSale:"Sale",updateSale:"Edited sale",deleteSale:"Deleted sale",

    addExpense:"Expense",deleteExpense:"Deleted expense",

    saveInventory:"Inventory change",deleteInventory:"Deleted inventory",

    addInventory:"Inventory stock-in",setInventory:"Inventory quantity",

    saveProduct:"Product",addHistorical:"Historical data",

    reportAdjustmentSave:"Report adjustment",reportAdjustmentDelete:"Deleted report adjustment"

  };

  return labels[op]||op||"Pending item";

}



window.syncAndShowResult=async function(){

  const badge=$("syncStatus"),text=$("syncStatusText");

  try{

    if(badge)badge.disabled=true;

    if(text)text.textContent="Syncing...";



    try{await window.posApi?.repairOrphanedPending?.();}catch(_e){}

    const result=await window.posApi?.syncNow?.();

    const details=await window.posApi?.pendingDetails?.()||[];

    const pending=details.length;



    if(result?.reason==="already-syncing"){

      alert("A previous sync attempt is still running.\n\nClose POS System completely, reopen it, log in while online, and tap the pending button ONCE.\n\nDo not uninstall or clear app data.");

      return;

    }



    updateSyncStatus({

      online:navigator.onLine,

      pending,

      syncing:false,

      error:result?.errors?.[0]?.error||details?.[0]?.lastError||""

    });



    if(!pending){

      try{await refreshFromCloud();}catch(_e){}

      alert("Cloud sync complete. Pending changes were verified in Supabase, then fresh cloud data was downloaded to this device.");

      return;

    }



    const lines=details.slice(0,8).map((d,i)=>{

      const err=String(d.lastError||"Waiting to retry").replace(/\s+/g," ").trim();

      return `${i+1}. ${syncOperationLabel(d.op)}\n${err}\nAttempts: ${Number(d.attempts||0)}`;

    });



    alert(

      `SYNC COULD NOT FINISH\n\n${pending} item${pending===1?"":"s"} still pending.\n\n`+

      lines.join("\n\n")+

      `\n\nIf the message says the cloud login/session expired: Logout, log in again while connected to the internet, then tap the sync button again.\n\nDo not uninstall or clear app data while items are pending.`

    );

  }catch(e){

    alert("Sync error:\n\n"+String(e?.message||e));

  }finally{

    if(badge)badge.disabled=false;

  }

};





// Explicit globals for inline HTML controls across Electron and Android WebView.

window.login=login;

window.logout=logout;





window.showCloudSourceInfo=async function(){

  try{

    const source=window.posApi?.__source||"missing";

    const cloud=window.cofteaCloudApi?.__source||"missing";

    const snap=await window.cofteaCloudApi?.cloudSnapshot?.();

    alert(

      "DATA SOURCE CHECK\n\n"+

      "POS API: "+source+"\n"+

      "Cloud API: "+cloud+"\n\n"+

      (snap

        ? `Supabase today: ${money(snap.dashboard?.daily||0)} sales / ${money(snap.dashboard?.expensesToday||0)} expenses\n`+

          `Supabase month: ${money(snap.dashboard?.monthly||0)} sales / ${money(snap.dashboard?.expensesMonth||0)} expenses`

        : "Could not read a direct Supabase snapshot.")

    );

  }catch(e){

    alert("Cloud source check failed:\n\n"+String(e?.message||e));

  }

};

/* KEEP TRANSACTIONS / DELETE DETAILS BUILD — 2026-09-21 */

/* ========================================================================
   MERGED MAJOR FEATURES
   Previously in major-features.js.
   Kept here so the POS only needs renderer.js + index.html for these UI
   features.
   ======================================================================== */
/* CoF/Tea Café POS - Major Features Overlay
   Requires:
   01_RUN_IN_SUPABASE_SQL_EDITOR.sql
   Loads AFTER renderer.js.
*/
(function(){
  const VERSION="20260920-major1";
  const ADDON_CACHE_KEY="coftea-major-addons-v1";
  const DEFAULT_ADDONS=[
    {id:"default-1",name:"Espresso",price:5,active:true},
    {id:"default-2",name:"Pearls",price:10,active:true},
    {id:"default-3",name:"Nata",price:10,active:true},
    {id:"default-4",name:"Coffee Jelly",price:10,active:true},
    {id:"default-5",name:"Popping Boba",price:10,active:true},
    {id:"default-6",name:"Yakult",price:15,active:true},
    {id:"default-7",name:"Cream Cheese",price:10,active:true},
    {id:"default-8",name:"Whipped Cream",price:10,active:true},
    {id:"default-9",name:"Oreo",price:10,active:true}
  ];

  const state={
    addons:[],
    staffUnlockedUntil:0,
    lastFinalizeAt:0,
    realtimeChannel:null,
    installed:false
  };

  const phpDate=()=>{
    const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"})
      .formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
    return `${p.year}-${p.month}-${p.day}`;
  };
  const phpTime=()=>{
    const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Manila",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})
      .formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
    return `${p.hour||"00"}:${p.minute||"00"}:${p.second||"00"}`;
  };
  const ref=()=>`SALE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
  const money2=n=>"₱"+Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc2=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const staffNow=()=>String(currentUser?.role||"").toLowerCase()==="staff";

  function normalizeAddonRows(rows){
    return (Array.isArray(rows)?rows:[]).filter(a=>a&&a.active!==false).map((a,i)=>({
      id:a.id??`local-${i}`,
      name:String(a.name||"").trim(),
      price:Math.max(0,Number(a.price)||0),
      active:a.active!==false
    })).filter(a=>a.name);
  }

  async function loadAddons(){
    const cloud=window.cofteaCloudApi;
    let rows=[];
    if(navigator.onLine&&cloud?.addons){
      try{
        rows=normalizeAddonRows(await cloud.addons());
        localStorage.setItem(ADDON_CACHE_KEY,JSON.stringify(rows));
      }catch(e){
        console.warn("CoF/Tea add-on refresh failed:",e);
      }
    }
    if(!rows.length){
      try{rows=normalizeAddonRows(JSON.parse(localStorage.getItem(ADDON_CACHE_KEY)||"[]"))}catch(_e){}
    }
    if(!rows.length)rows=DEFAULT_ADDONS.map(x=>({...x}));
    state.addons=rows;
    return rows;
  }

  function installCloudFeatures(){
    const cloud=window.cofteaCloudApi;
    const pos=window.posApi;
    const sb=window.cofteaSupabase;
    if(!cloud||!pos||!sb)return false;

    const original={
      addHistorical:cloud.addHistorical?.bind(cloud),
      saleByTransactionId:cloud.saleByTransactionId?.bind(cloud),
      startRealtime:cloud.startRealtime?.bind(cloud),
      forceCloudRefresh:pos.forceCloudRefresh?.bind(pos),
      posSaveSale:pos.saveSale?.bind(pos),
      posUpdateSale:pos.updateSale?.bind(pos)
    };

    cloud.addons=async function(){
      const {data,error}=await sb.from("addons").select("*").eq("active",true).order("name");
      if(error)throw error;
      return data||[];
    };

    cloud.saveAddon=async function(d){
      const {data,error}=await sb.rpc("save_addon",{
        p_id:Number(d?.id)||null,
        p_name:String(d?.name||"").trim(),
        p_price:Math.max(0,Number(d?.price)||0)
      });
      if(error)throw error;
      return data;
    };

    cloud.deleteAddon=async function(id){
      const {data,error}=await sb.rpc("delete_addon",{p_id:Number(id)});
      if(error)throw error;
      return data;
    };

    cloud.verifyOwnerCredentials=async function(username,password,saleId=null){
      const user=String(username||"owner").trim().toLowerCase();
      const pw=String(password||"");
      if(!pw)throw new Error("Enter the owner password.");

      const {data:lookup,error:lookupError}=await sb.rpc("lookup_login_email",{p_username:user});
      if(lookupError)throw lookupError;
      const account=lookup?.[0]||lookup;
      if(!account?.email||account.active===false)throw new Error("Owner account was not found.");

      const {data:mainAuth,error:mainAuthError}=await sb.auth.getUser();
      if(mainAuthError)throw mainAuthError;
      const staffAuthUser=mainAuth?.user||null;

      const cfg=window.COFTEA_SUPABASE_URL,key=window.COFTEA_SUPABASE_ANON_KEY;
      const verifier=window.supabase.createClient(cfg,key,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });

      try{
        const {data,error}=await verifier.auth.signInWithPassword({email:account.email,password:pw});
        if(error||!data?.user)throw new Error("Owner password is incorrect.");

        const {data:profile,error:profileError}=await verifier.from("app_users")
          .select("role,active").eq("auth_user_id",data.user.id).maybeSingle();
        if(profileError)throw profileError;

        if(!profile||String(profile.role||"").toLowerCase()!=="owner"||profile.active===false){
          throw new Error("The entered account is not an active owner.");
        }

        // For Staff sale editing, the Owner session creates a short-lived,
        // server-side authorization for exactly this sale and this Staff user.
        if(Number(saleId)>0){
          if(!staffAuthUser?.id)throw new Error("Staff session was not found.");
          const {error:grantError}=await verifier.rpc("grant_staff_sale_edit",{
            p_staff_auth_user_id:staffAuthUser.id,
            p_sale_id:Number(saleId)
          });
          if(grantError)throw grantError;
        }

        return {ok:true};
      }finally{
        try{await verifier.auth.signOut()}catch(_e){}
      }
    };

    cloud.authorizedChangePassword=async function(d){
      const password=String(d?.newPassword||"");
      if(password.length<6)throw new Error("New password must be at least 6 characters.");
      const {error}=await sb.auth.updateUser({password});
      if(error)throw error;
      return {ok:true};
    };

    function canonicalCup(item){
      if(String(item?.temperature||"").trim().toLowerCase()==="hot")return "Hot Cups";
      const s=String(item?.size||"").trim().toLowerCase().replace(/\s+/g,"");
      if(s==="12oz")return "12 oz";
      if(s==="16oz")return "16 oz";
      if(s==="22oz")return "22 oz";
      return item?.cupType||null;
    }

    async function saveSaleV2(d,saleId){
      const items=(Array.isArray(d?.items)?d.items:[]).map(item=>({
        ...item,
        cupType:canonicalCup(item),
        addons:Array.isArray(item.addons)?item.addons:(Array.isArray(item.addons_json)?item.addons_json:[])
      }));
      const {data,error}=await sb.rpc("save_sale_v2",{
        p_sale_id:Number(saleId)||null,
        p_items:items,
        p_payment:d?.payment||"Cash",
        p_cash:Number(d?.cash)||0,
        p_user_id:Number(d?.userId)||null,
        p_sale_date:d?.saleDate||phpDate(),
        p_sale_time:d?.saleTime||phpTime(),
        p_client_ref:d?.clientRef||null,
        p_fulfillment_status:d?.fulfillmentStatus||"pending"
      });
      if(error)throw error;
      return data;
    }

    cloud.saveSale=d=>saveSaleV2(d,null);
    cloud.updateSale=d=>saveSaleV2(d,d?.saleId);

    cloud.completeSale=async function(id){
      const {data,error}=await sb.rpc("mark_order_completed",{p_sale_id:Number(id)});
      if(error)throw error;
      return data;
    };

    cloud.finalizePreviousDays=async function(){
      const {data,error}=await sb.rpc("finalize_previous_sales_days");
      if(error)throw error;
      return data||{ok:true,finalizedDays:0};
    };

    cloud.saleRefStatus=async function(clientRef){
      const {data,error}=await sb.rpc("sale_ref_status",{p_client_ref:String(clientRef||"")});
      if(error)throw error;
      return data?.[0]||data||null;
    };

    cloud.saleByTransactionId=async function(transactionId){
      let row=null;
      if(original.saleByTransactionId){
        row=await original.saleByTransactionId(transactionId);
        if(row)return row;
      }
      const {data,error}=await sb.rpc("sale_transaction_status",{p_transaction_id:String(transactionId||"")});
      if(error)throw error;
      if(!data)return null;
      return {
        id:data.id??null,
        transaction_id:data.transactionId||transactionId,
        sale_date:data.saleDate||"",
        archived:!!data.archived,
        item_details:[]
      };
    };

    cloud.addHistorical=async function(d){
      const result=original.addHistorical?await original.addHistorical(d):{ok:true};
      try{await sb.rpc("refresh_summary_periods_for_date",{p_date:d.date})}catch(_e){}
      return result;
    };

    async function buildDailyRows(includeDailyAdjustments=true){
      const todayKey=phpDate();

      // EGRESS-SAFE REPORT SOURCE
      // Closed dates: one tiny permanent row from daily_sales_summary.
      // Current/late dates: only unarchived transaction headers + their live items.
      // Expenses: only today's detail rows; older expenses are already summarized.
      const [summaryQ,salesQ,todayExpenseQ,adjustQ]=await Promise.all([
        sb.from("daily_sales_summary").select("*"),
        sb.from("sales")
          .select("id,sale_date,total,payment_method,details_archived")
          .eq("status","completed")
          .eq("details_archived",false),
        sb.from("expenses").select("*").eq("expense_date",todayKey),
        includeDailyAdjustments
          ? sb.from("report_adjustments").select("*").eq("type","daily")
          : Promise.resolve({data:[],error:null})
      ]);

      const firstError=summaryQ.error||salesQ.error||todayExpenseQ.error||adjustQ.error;
      if(firstError)throw firstError;

      const map=new Map();
      const saleDateById=new Map();

      const add=date=>{
        const key=String(date||"").slice(0,10);
        if(!map.has(key))map.set(key,{
          date:key,sales:0,cash:0,gcash:0,expenses:0,cups:0,transactions:0
        });
        return map.get(key);
      };

      // Permanent source for all closed days, including recovered Aug 29.
      (summaryQ.data||[]).forEach(s=>{
        const key=String(s.summary_date||"").slice(0,10);
        if(!key)return;
        const r=add(key);
        r.sales=Number(s.total_sales||0);
        r.cash=Number(s.cash_sales||0);
        r.gcash=Number(s.gcash_sales||0);
        r.expenses=Number(s.total_expenses||0);
        r.cups=Number(s.total_cups||0);
        r.transactions=Number(s.transaction_count||0);
      });

      // Current day and a rare late/offline transaction remain live until they
      // are folded into the permanent closed-day summary.
      (salesQ.data||[]).forEach(s=>{
        const key=String(s.sale_date||"").slice(0,10);
        if(!key)return;

        saleDateById.set(Number(s.id),key);
        const r=add(key);
        r.sales+=Number(s.total||0);

        const method=String(s.payment_method||"").toLowerCase();
        if(method==="cash")r.cash+=Number(s.total||0);
        if(method==="gcash")r.gcash+=Number(s.total||0);
        r.transactions+=1;
      });

      const liveIds=[...saleDateById.keys()];
      if(liveIds.length){
        const {data:items,error:itemError}=await sb.from("sale_items")
          .select("sale_id,quantity")
          .in("sale_id",liveIds);
        if(itemError)throw itemError;

        (items||[]).forEach(i=>{
          const key=saleDateById.get(Number(i.sale_id));
          if(key)add(key).cups+=Number(i.quantity||0);
        });
      }

      // Current-day expenses are still live. Closed dates are already in the
      // daily summary, so the app does not download all old expense rows.
      (todayExpenseQ.data||[]).forEach(e=>{
        add(todayKey).expenses+=Number(e.amount||0);
      });

      (adjustQ.data||[]).forEach(a=>{
        const r=add(a.key);
        r.sales+=Number(a.sales_delta||0);
        r.cash+=Number(a.cash_delta||0);
        r.gcash+=Number(a.gcash_delta||0);
        r.expenses+=Number(a.expenses_delta||0);
        r.cups+=Number(a.cups_delta||0);
      });

      return [...map.values()]
        .filter(r=>r.date)
        .map(r=>({
          ...r,
          net:Number(r.sales||0)-Number(r.expenses||0),
          totalCash:Number(r.cash||0)-Number(r.expenses||0)
        }))
        .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    }

    async function reportRows(kind,includeAdjustments=true){
      if(kind==="daily")return buildDailyRows(includeAdjustments);

      const daily=await buildDailyRows(true);
      const field=kind==="monthly"?"month":"year", map=new Map();
      const add=key=>{
        if(!map.has(key))map.set(key,{[field]:key,sales:0,cash:0,gcash:0,expenses:0,cups:0,transactions:0});
        return map.get(key);
      };

      daily.forEach(d=>{
        const key=kind==="monthly"?String(d.date).slice(0,7):String(d.date).slice(0,4);
        const r=add(key);
        r.sales+=Number(d.sales||0);
        r.cash+=Number(d.cash||0);
        r.gcash+=Number(d.gcash||0);
        r.expenses+=Number(d.expenses||0);
        r.cups+=Number(d.cups||0);
        r.transactions+=Number(d.transactions||0);
      });

      if(includeAdjustments){
        const {data,error}=await sb.from("report_adjustments").select("*").eq("type",kind);
        if(error)throw error;
        (data||[]).forEach(a=>{
          const r=add(a.key);
          r.sales+=Number(a.sales_delta||0);
          r.cash+=Number(a.cash_delta||0);
          r.gcash+=Number(a.gcash_delta||0);
          r.expenses+=Number(a.expenses_delta||0);
          r.cups+=Number(a.cups_delta||0);
        });
      }

      return [...map.values()].map(r=>({
        ...r,
        net:r.sales-r.expenses,
        totalCash:r.cash-r.expenses
      })).sort((a,b)=>String(b[field]).localeCompare(String(a[field])));
    }

    cloud.dailyTracker=()=>reportRows("daily",true);
    cloud.monthly=()=>reportRows("monthly",true);
    cloud.yearly=()=>reportRows("yearly",true);

    cloud.dashboard=async function(){
      const d=phpDate(),m=d.slice(0,7),y=d.slice(0,4);
      const rows=await buildDailyRows(true);

      const a=rows.find(x=>x.date===d)||{};
      const monthRows=rows.filter(x=>String(x.date||"").slice(0,7)===m);
      const yearRows=rows.filter(x=>String(x.date||"").slice(0,4)===y);

      const sumRows=list=>list.reduce((o,r)=>{
        o.sales+=Number(r.sales||0);
        o.expenses+=Number(r.expenses||0);
        o.cups+=Number(r.cups||0);
        o.cash+=Number(r.cash||0);
        o.gcash+=Number(r.gcash||0);
        return o;
      },{sales:0,expenses:0,cups:0,cash:0,gcash:0});

      const b=sumRows(monthRows),c=sumRows(yearRows);

      return {
        daily:Number(a.sales||0),expensesToday:Number(a.expenses||0),netToday:Number(a.sales||0)-Number(a.expenses||0),
        cupsToday:Number(a.cups||0),cashToday:Number(a.cash||0),gcashToday:Number(a.gcash||0),totalCashToday:Number(a.cash||0)-Number(a.expenses||0),

        monthly:b.sales,expensesMonth:b.expenses,netMonth:b.sales-b.expenses,
        cupsMonth:b.cups,cashMonth:b.cash,gcashMonth:b.gcash,totalCashMonth:b.cash-b.expenses,

        yearly:c.sales,expensesYear:c.expenses,netYear:c.sales-c.expenses,
        cupsYear:c.cups,cashYear:c.cash,gcashYear:c.gcash,totalCashYear:c.cash-c.expenses
      };
    };

    cloud.reportAdjustmentSave=async function(d){
      const baseRows=await reportRows(d.type,false);
      const field=d.type==="daily"?"date":d.type==="monthly"?"month":"year";
      const base=baseRows.find(x=>String(x[field])===String(d.key))||{sales:0,cash:0,gcash:0,expenses:0,cups:0};
      const payload={
        type:d.type,key:d.key,
        sales_delta:Number(d.sales||0)-Number(base.sales||0),
        cash_delta:Number(d.cash||0)-Number(base.cash||0),
        gcash_delta:Number(d.gcash||0)-Number(base.gcash||0),
        expenses_delta:Number(d.expenses||0)-Number(base.expenses||0),
        cups_delta:Number(d.cups||0)-Number(base.cups||0),
        updated_at:new Date().toISOString()
      };
      const {data:existing,error:findError}=await sb.from("report_adjustments").select("*").eq("type",d.type).eq("key",d.key).maybeSingle();
      if(findError)throw findError;
      const q=existing
        ? sb.from("report_adjustments").update(payload).eq("id",existing.id)
        : sb.from("report_adjustments").insert(payload);
      const {error}=await q;
      if(error)throw error;
      return {ok:true};
    };

    cloud.cupSummary=async function(date=phpDate()){
      const [salesQ,summaryQ,historicalQ,adjustQ,inventoryRows]=await Promise.all([
        sb.from("sales").select("id,details_archived").eq("sale_date",date).eq("status","completed"),
        sb.from("daily_sales_summary").select("total_cups").eq("summary_date",date).maybeSingle(),
        sb.from("historical").select("cups").eq("record_date",date),
        sb.from("report_adjustments").select("cups_delta").eq("type","daily").eq("key",date),
        cloud.inventory()
      ]);

      const firstError=salesQ.error||summaryQ.error||historicalQ.error||adjustQ.error;
      if(firstError)throw firstError;

      const unarchivedIds=(salesQ.data||[])
        .filter(x=>x.details_archived!==true)
        .map(x=>x.id);

      const sold={"12oz":0,"16oz":0,"22oz":0,"Hot Cups":0};

      if(unarchivedIds.length){
        const {data,error}=await sb.from("sale_items")
          .select("size,quantity,temperature")
          .in("sale_id",unarchivedIds);
        if(error)throw error;

        (data||[]).forEach(i=>{
          const temp=String(i.temperature||"Cold").toLowerCase();
          let key=temp==="hot"
            ?"Hot Cups"
            :String(i.size||"").toLowerCase().replace(/\s+/g,"");

          if(key==="12oz"||key==="16oz"||key==="22oz"||key==="Hot Cups"){
            sold[key]+=Number(i.quantity||0);
          }
        });
      }

      const normalize=name=>{
        const n=String(name||"").trim().toLowerCase().replace(/\s+/g,"");
        if(n==="12oz")return "12 oz";
        if(n==="16oz")return "16 oz";
        if(n==="22oz")return "22 oz";
        if(n==="hotcup"||n==="hotcups")return "Hot Cups";
        return String(name||"").trim();
      };

      const rows=["12oz","16oz","22oz","Hot Cups"].map(size=>{
        const wanted=normalize(size);
        const remaining=(inventoryRows||[])
          .filter(i=>normalize(i.name||i.item).toLowerCase()===wanted.toLowerCase())
          .reduce((sum,i)=>sum+Number(
            i.total??(
              Number(i.inside||0)+
              Number(i.outside||0)+
              Number(i.stock_in||0)+
              Number(i.adjustments||0)
            )
          ),0);

        return {size,soldToday:sold[size],remaining};
      });

      const liveTotal=Object.values(sold).reduce((a,b)=>a+b,0);
      const archived=Number(summaryQ.data?.total_cups||0);

      // Historical is only a fallback when there is no real sale/summary data
      // for the date. Never add historical on top of an archived summary.
      const hasRealSource=!!summaryQ.data||(salesQ.data||[]).length>0;
      const historical=hasRealSource
        ?0
        :(historicalQ.data||[]).reduce((s,x)=>s+Number(x.cups||0),0);

      const adjusted=(adjustQ.data||[])
        .reduce((s,x)=>s+Number(x.cups_delta||0),0);

      return {
        rows,
        totalSold:archived+liveTotal+historical+adjusted
      };
    };

    cloud.cloudSnapshot=async function(){
      const [dashboard,inventory,sales,expenses,monthly,yearly]=await Promise.all([
        cloud.dashboard(),cloud.inventory(),cloud.sales(phpDate()),cloud.expenses(phpDate()),cloud.monthly(),cloud.yearly()
      ]);
      return {
        ok:true,date:phpDate(),dashboard,
        inventoryCount:(inventory||[]).length,
        salesCount:(sales||[]).length,
        expensesCount:(expenses||[]).length,
        monthly,yearly,checkedAt:new Date().toISOString()
      };
    };

    if(original.startRealtime){
      cloud.startRealtime=async function(){
        await original.startRealtime();
        if(!state.realtimeChannel){
          state.realtimeChannel=sb.channel("coftea-major-live-v1");
          ["addons","daily_sales_summary","monthly_sales_summary","yearly_sales_summary"].forEach(table=>{
            state.realtimeChannel.on("postgres_changes",{event:"*",schema:"public",table},()=>{
              try{window.__cofteaRealtime?.()}catch(_e){}
            });
          });
          state.realtimeChannel.subscribe();
        }
        return {ok:true};
      };
    }

    // Keep original offline-first save behavior, but stamp the ORIGINAL order date/time.
    if(original.posSaveSale){
      pos.saveSale=function(d){
        return original.posSaveSale({
          ...d,
          saleDate:d?.saleDate||phpDate(),
          saleTime:d?.saleTime||phpTime(),
          clientRef:d?.clientRef||ref(),
          fulfillmentStatus:d?.fulfillmentStatus||"pending"
        });
      };
    }
    if(original.posUpdateSale){
      pos.updateSale=function(d){
        return original.posUpdateSale({
          ...d,
          saleDate:d?.saleDate||phpDate(),
          saleTime:d?.saleTime||phpTime(),
          fulfillmentStatus:d?.fulfillmentStatus||"pending"
        });
      };
    }

    pos.completeSale=async function(id){
      if(!navigator.onLine)throw new Error("Marking an order completed requires an internet connection.");
      if(Number(id)<=0)throw new Error("Sync this sale first, then mark the order completed.");
      const result=await cloud.completeSale(id);
      try{await original.forceCloudRefresh?.()}catch(_e){}
      return result;
    };

    pos.verifyOwnerCredentials=async function(username,password,saleId=null){
      if(!navigator.onLine)throw new Error("Owner authorization requires an internet connection.");
      return cloud.verifyOwnerCredentials(username,password,saleId);
    };

    pos.authorizedChangePassword=async function(d){
      if(!navigator.onLine)throw new Error("Changing the password requires an internet connection.");
      return cloud.authorizedChangePassword(d);
    };

    // Finalize older detailed sales before every true cloud pull, throttled to once/minute.
    if(original.forceCloudRefresh){
      pos.forceCloudRefresh=async function(){
        if(navigator.onLine&&Date.now()-state.lastFinalizeAt>60000){
          state.lastFinalizeAt=Date.now();
          try{await cloud.finalizePreviousDays()}catch(e){
            console.warn("CoF/Tea end-of-day finalization:",e);
          }
        }
        const result=await original.forceCloudRefresh();
        await loadAddons();
        return result;
      };
    }

    return true;
  }

  function installAddonUI(){
    // Load current add-ons when any full app refresh happens.
    const originalLoadAll=window.loadAll;
    if(typeof originalLoadAll==="function"&&!originalLoadAll.__majorWrapped){
      const wrapped=async function(){
        await loadAddons();
        return originalLoadAll.apply(this,arguments);
      };
      wrapped.__majorWrapped=true;
      window.loadAll=wrapped;
    }

    window.setupProductModal=function(p,isCustom){
      document.getElementById("productModal")?.classList.remove("hidden");
      const title=document.getElementById("modalTitle");
      if(title)title.textContent=isCustom?"Customized Drink":`${p.category} • ${p.name}`;
      document.getElementById("customBaseWrap")?.classList.toggle("hidden",!isCustom);

      if(editingCartIndex<0){
        selectedSize="12oz";
        selectedTemp="Cold";
        selectedAddons=[];
        tutti=false;
        freeUpsize=false;
        freeUpsizeOriginalSize="12oz";
        freeDrink=false;
        freeDrinkSelection=null;
      }

      if(isCustom&&document.getElementById("customBase")&&editingCartIndex<0){
        const types=CATEGORIES?CATEGORIES.slice(0,7):[];
        document.getElementById("customBase").innerHTML=types.map(t=>`<option value="${esc2(t)}" ${t===p.category?"selected":""}>${esc2(t)}</option>`).join("");
        document.getElementById("customFlavor").value="";
      }
      window.setupProductChoices(p);
    };

    window.setupProductChoices=function(p){
      if(!p)return;
      const prices=[["12oz",p.p12],["16oz",p.p16],["22oz",p.p22]];
      const sizeEl=document.getElementById("sizeChoices");
      if(sizeEl){
        sizeEl.innerHTML=prices.map(([s,v])=>{
          const originalIndex={"12oz":0,"16oz":1,"22oz":2};
          const oi=originalIndex[freeUpsizeOriginalSize],si=originalIndex[s];
          const allowed=!freeUpsize||si>oi;
          const customFee=document.getElementById("customBaseWrap")?.classList.contains("hidden")?0:5;
          const shown=freeUpsize&&allowed?"FREE UPSIZE":money2(Number(v||0)+customFee);
          return `<button type="button" class="choice size-choice ${s===selectedSize?"active":""}" ${allowed?`onclick="selectSize('${s}')"`:`disabled`}><strong>${s.replace("oz"," oz")}</strong><span>${shown}</span>${customFee?"<small>+₱5 customized</small>":""}${freeUpsize&&allowed?"<small>Original price kept</small>":""}</button>`;
        }).join("");
      }

      const hotAllowed=["Cafe Latte","Amerikano","Amerikano Twist","Milktea"].includes(p.category)||(p.category==="Fruit Series"&&(selectedSize==="16oz"||selectedSize==="22oz"));
      if(!hotAllowed&&selectedTemp==="Hot")selectedTemp="Cold";
      const tempEl=document.getElementById("tempChoices");
      if(tempEl)tempEl.innerHTML=(hotAllowed?["Hot","Cold"]:["Cold"]).map(t=>`<button class="choice ${t===selectedTemp?"active":""}" onclick="selectTemp('${t}')">${t}</button>`).join("");

      const tuttiAllowed=p.category==="Fruit Series"||p.category==="Soda Series";
      document.getElementById("tuttiWrap")?.classList.toggle("hidden",!tuttiAllowed);
      document.getElementById("tuttiBtn")?.classList.toggle("active",!!tutti);
      document.getElementById("freeUpsizeBtn")?.classList.toggle("active",!!freeUpsize);
      document.getElementById("freeDrinkBtn")?.classList.toggle("active",!!freeDrink);
      if(document.getElementById("freeDrinkBtn")){
        document.getElementById("freeDrinkBtn").textContent=freeDrink&&freeDrinkSelection?`FREE DRINK: ${freeDrinkSelection.name}`:"ADD 1 FREE DRINK";
      }
      document.getElementById("freePromoNote")?.classList.toggle("hidden",!(freeUpsize||freeDrink));

      const inlineAddAddonBtn=document.getElementById("inlineAddAddonBtn");
      if(inlineAddAddonBtn)inlineAddAddonBtn.style.display=staffNow()?"none":"inline-flex";

      const addonEl=document.getElementById("addonChoices");
      if(addonEl){
        addonEl.classList.add("addon-qty-grid");
        addonEl.innerHTML=state.addons.map((a,index)=>{
          const chosen=(selectedAddons||[]).find(x=>String(x.id)===String(a.id)||String(x.name).toLowerCase()===a.name.toLowerCase());
          const qty=Math.max(0,Math.min(10,Number(chosen?.qty)||0));
          return `<article class="addon-qty-card ${qty?"active":""}" role="listitem" aria-label="${esc2(a.name)} add-on">
            <header class="addon-qty-info">
              <strong>${esc2(a.name)}</strong>
              <span>${money2(a.price)} each</span>
            </header>
            <div class="addon-qty-controls" aria-label="Quantity for ${esc2(a.name)}">
              <button
                type="button"
                onclick="changeAddonQty(${index},-1)"
                aria-label="Decrease ${esc2(a.name)} quantity"
                ${qty<=0?"disabled":""}
              >−</button>
              <output aria-live="polite" aria-label="${esc2(a.name)} quantity">${qty}×</output>
              <button
                type="button"
                onclick="changeAddonQty(${index},1)"
                aria-label="Increase ${esc2(a.name)} quantity"
                ${qty>=10?"disabled":""}
              >+</button>
            </div>
          </article>`;
        }).join("");
      }
    };

    window.changeAddonQty=function(index,delta){
      const addon=state.addons[Number(index)];
      if(!addon)return;
      if(!Array.isArray(selectedAddons))selectedAddons=[];
      let chosen=selectedAddons.find(x=>String(x.id)===String(addon.id)||String(x.name).toLowerCase()===addon.name.toLowerCase());
      if(!chosen&&delta>0){
        chosen={id:addon.id,name:addon.name,price:Number(addon.price)||0,qty:0};
        selectedAddons.push(chosen);
      }
      if(!chosen)return;
      chosen.qty=Math.max(0,Math.min(10,Number(chosen.qty||0)+Number(delta||0)));
      if(chosen.qty===0)selectedAddons=selectedAddons.filter(x=>x!==chosen);
      window.setupProductChoices(selectedProduct);
    };

    window.toggleAddon=function(name,price){
      const idx=state.addons.findIndex(a=>a.name===name);
      if(idx>=0)window.changeAddonQty(idx,1);
    };

    window.clearAddons=function(){
      selectedAddons=[];
      window.setupProductChoices(selectedProduct);
    };

    window.openCustomDrink=function(){
      selectedProduct=(products||[])[0]||null;
      editingCartIndex=-1;
      selectedSize="12oz";
      selectedTemp="Cold";
      selectedAddons=[];
      tutti=false;
      freeUpsize=false;
      freeUpsizeOriginalSize="12oz";
      freeDrink=false;
      freeDrinkSelection=null;
      const title=document.getElementById("modalTitle");if(title)title.textContent="Customized Drink";
      document.getElementById("customBaseWrap")?.classList.remove("hidden");
      if(document.getElementById("customFlavor"))document.getElementById("customFlavor").value="";
      const types=CATEGORIES?CATEGORIES.slice(0,7):[];
      if(document.getElementById("customBase"))document.getElementById("customBase").innerHTML=types.map(t=>`<option value="${esc2(t)}">${esc2(t)}</option>`).join("");
      if(typeof customBaseChanged==="function")customBaseChanged();
      document.getElementById("productModal")?.classList.remove("hidden");
    };

    window.addConfiguredDrink=function(){
      if(!selectedProduct)return;
      const actualSize=selectedSize;
      const unitSize=freeUpsize?freeUpsizeOriginalSize:selectedSize;
      const priceMap={"12oz":selectedProduct.p12,"16oz":selectedProduct.p16,"22oz":selectedProduct.p22};
      const isCustomized=!document.getElementById("customBaseWrap")?.classList.contains("hidden");
      const customFee=isCustomized?5:0;
      const unit=Number(priceMap[unitSize]||0)+customFee;
      const addons=(selectedAddons||[]).filter(a=>Number(a.qty)>0).map(a=>({
        id:a.id,name:a.name,price:Number(a.price)||0,qty:Math.max(1,Math.min(10,Number(a.qty)||1))
      }));
      const addonPrice=addons.reduce((sum,a)=>sum+a.price*a.qty,0);
      let addon=addons.map(a=>`${a.name}${a.qty>1?` x${a.qty}`:""}`).join(", ")||"No Add-on";
      if(tutti)addon=addon==="No Add-on"?"Tutti Frutti":addon+", Tutti Frutti";
      const name=document.getElementById("customBaseWrap")?.classList.contains("hidden")
        ?selectedProduct.name
        :(document.getElementById("customFlavor")?.value.trim()||selectedProduct.name);
      const category=selectedProduct.category;
      const cupType=selectedTemp==="Hot"?"Hot Cups":actualSize;
      const item={
        product:name,category,size:actualSize,cupType,
        originalSize:freeUpsize?unitSize:null,
        temperature:selectedTemp,
        tutti:!!tutti,
        addon,addons,addonPrice,unit,qty:1,
        lineTotal:unit+addonPrice+(tutti?10:0),
        freeUpsize:!!freeUpsize,freeDrink:false,customFee,customized:isCustomized
      };
      if(editingCartIndex>=0)cart[editingCartIndex]=item;
      else cart.push(item);

      if(freeDrink&&freeDrinkSelection){
        cart.push({
          product:freeDrinkSelection.name,category:freeDrinkSelection.category,
          size:actualSize,cupType:selectedTemp==="Hot"?"Hot Cups":actualSize,
          originalSize:null,temperature:selectedTemp,tutti:false,
          addon:"FREE DRINK",addons:[],addonPrice:0,unit:0,qty:1,lineTotal:0,
          freeUpsize:false,freeDrink:true,customized:false
        });
      }
      if(typeof closeProductModal==="function")closeProductModal();
      editingCartIndex=-1;
      renderCart?.();
    };

    window.editCartItem=function(i){
      const x=cart?.[i];
      if(!x)return;
      const p=(products||[]).find(p=>p.name===x.product&&p.category===x.category)||(products||[]).find(p=>p.category===x.category);
      if(!p)return;
      selectedProduct=p;
      editingCartIndex=i;
      selectedSize=x.size;
      selectedTemp=x.temperature||"Cold";
      selectedAddons=[];

      let structured=[];
      if(Array.isArray(x.addons))structured=x.addons;
      else if(Array.isArray(x.addons_json))structured=x.addons_json;
      if(structured.length){
        selectedAddons=structured.map(a=>{
          const catalog=state.addons.find(c=>String(c.id)===String(a.id)||c.name.toLowerCase()===String(a.name||"").toLowerCase());
          return {
            id:catalog?.id??a.id,
            name:catalog?.name??a.name,
            price:Number(catalog?.price??a.price)||0,
            qty:Math.max(1,Math.min(10,Number(a.qty)||1))
          };
        }).filter(a=>a.name);
      }else{
        const addonText=String(x.addon||"");
        state.addons.forEach(a=>{
          const re=new RegExp(a.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?:\\s*x(\\d+))?","i");
          const m=addonText.match(re);
          if(m)selectedAddons.push({id:a.id,name:a.name,price:a.price,qty:Math.max(1,Math.min(10,Number(m[1])||1))});
        });
      }

      tutti=String(x.addon||"").includes("Tutti Frutti")||!!x.tutti;
      freeUpsize=!!x.freeUpsize;
      freeUpsizeOriginalSize=x.originalSize||"12oz";
      freeDrink=false;
      freeDrinkSelection=null;
      window.setupProductModal(p,!!x.customized);
      if(x.customized&&document.getElementById("customFlavor"))document.getElementById("customFlavor").value=x.product||"";
    };
  }

  function installSalesUI(){
    const salesHead=document.querySelector("#page-sales thead tr");
    if(salesHead){
      salesHead.innerHTML="<th>Date</th><th>Time</th><th>Transaction</th><th>Product</th><th>Add-ons</th><th>Category</th><th>Size</th><th>Temp</th><th>Qty</th><th>Total</th><th>Payment</th><th>Order Status</th><th>Actions</th>";
    }

    const notice=document.querySelector("#page-sales .notice");
    if(notice)notice.innerHTML="Owner and Staff can mark an order as <strong>Completed</strong>. Owner can edit/delete orders. Staff can edit only after Owner username/password verification and cannot delete orders.";

    window.markSaleCompleted=async function(id){
      try{
        await window.posApi.completeSale(id);
        await window.loadSales();
        window.notify?.("Order marked completed.");
      }catch(e){window.err?.(e)}
    };

    window.openStaffSaleEditAuth=function(id){
      if(!staffNow()){
        return window.editTransaction?.(Number(id));
      }
      const modal=document.getElementById("staffSaleEditAuthModal");
      const saleId=document.getElementById("staffSaleEditId");
      const password=document.getElementById("staffSaleOwnerPassword");
      const msg=document.getElementById("staffSaleEditAuthMsg");
      if(saleId)saleId.value=String(Number(id)||"");
      if(password)password.value="";
      if(msg)msg.textContent="";
      modal?.classList.remove("hidden");
      setTimeout(()=>password?.focus(),80);
    };

    window.closeStaffSaleEditAuth=function(){
      document.getElementById("staffSaleEditAuthModal")?.classList.add("hidden");
      const password=document.getElementById("staffSaleOwnerPassword");
      const msg=document.getElementById("staffSaleEditAuthMsg");
      if(password)password.value="";
      if(msg)msg.textContent="";
    };

    window.authorizeStaffSaleEdit=async function(){
      const id=Number(document.getElementById("staffSaleEditId")?.value)||0;
      const username=document.getElementById("staffSaleOwnerUsername")?.value.trim()||"owner";
      const password=document.getElementById("staffSaleOwnerPassword")?.value||"";
      const msg=document.getElementById("staffSaleEditAuthMsg");
      if(!id)return;
      if(!password){
        if(msg)msg.textContent="Enter the Owner password.";
        return;
      }
      try{
        if(msg)msg.textContent="Verifying Owner...";
        await window.posApi.verifyOwnerCredentials(username,password,id);
        window.closeStaffSaleEditAuth();
        await window.editTransaction?.(id,true);
        window.notify?.("Owner verified. Staff may edit this order.");
      }catch(e){
        if(msg)msg.textContent=e?.message||"Owner verification failed.";
        else window.err?.(e);
      }
    };

    window.loadSales=async function(){
      const table=document.getElementById("salesTable");
      if(!table)return;
      const date=document.getElementById("salesDate")?.value||phpDate();
      table.innerHTML='<tr><td colspan="13" class="muted">Loading...</td></tr>';
      try{
        const rows=await window.posApi.sales(date);
        if(!rows.length){
          table.innerHTML=`<tr><td colspan="13" class="muted">No sales transactions recorded for ${esc2(date)}.</td></tr>`;
          return;
        }
        table.innerHTML=rows.flatMap(s=>{
          const archived=!!s.details_archived || !(s.item_details||[]).length;
          const details=(s.item_details||[]).length?s.item_details:[{
            product_name:"Archived transaction",
            category:"Details removed to save database space",
            size:"",
            temperature:"",
            quantity:1,
            line_total:s.total||0,
            addon:"Archived"
          }];
          const fulfillment=String(s.fulfillment_status||"pending").toLowerCase();
          return details.map((i,idx)=>{
            const addons=Array.isArray(i.addons_json)&&i.addons_json.length
              ?i.addons_json.map(a=>`${a.name}${Number(a.qty)>1?` x${a.qty}`:""}`).join(", ")
              :(i.addon||"No Add-on");
            const completeBtn=idx===0&&fulfillment!=="completed"
              ?`<button class="small-btn complete-order-btn" onclick="markSaleCompleted(${s.id})">Mark Completed</button>`:"";
            const editBtn=idx===0&&!archived
              ?(staffNow()
                ?`<button class="small-btn" onclick="openStaffSaleEditAuth(${s.id})">Edit</button>`
                :`<button class="small-btn" onclick="editTransaction(${s.id})">Edit</button>`)
              :"";
            const deleteBtn=idx===0&&!staffNow()&&!archived
              ?`<button class="small-btn danger" onclick="removeTransaction(${s.id})">Delete</button>`:"";
            return `<tr>
              <td>${esc2(s.sale_date)}</td>
              <td>${esc2(s.sale_time||"")}</td>
              <td><strong>${esc2(s.transaction_id)}</strong></td>
              <td>${esc2(i.product_name||"")}</td>
              <td>${esc2(addons)}</td>
              <td>${esc2(i.category||"")}</td>
              <td>${esc2(i.size||"")}${i.free_upsize?` <small>(free upsize from ${esc2(i.original_size||"")})</small>`:""}</td>
              <td>${esc2(i.temperature||"")}</td>
              <td>${Number(i.quantity||0)}</td>
              <td>${money2(Number(i.line_total||0)*Number(i.quantity||1))}${i.free_drink?' <small>(FREE)</small>':''}</td>
              <td>${esc2(s.payment_method||"")}</td>
              <td><span class="order-status-badge ${fulfillment}">${fulfillment==="completed"?"Completed":"Pending"}</span></td>
              <td><div class="action-group">${completeBtn}${editBtn}${deleteBtn}</div></td>
            </tr>`;
          });
        }).join("");
      }catch(e){window.err?.(e)}
    };
  }

  function installReportUI(){
    const cards=document.querySelector("#page-dashboard .cards");
    if(cards&&!document.getElementById("dCupsToday")){
      cards.insertAdjacentHTML("beforeend",`
        <div class="card"><div class="label">Today's Cups</div><div id="dCupsToday" class="value">0</div></div>
        <div class="card"><div class="label">Cash Today</div><div id="dCashToday" class="value">₱0.00</div></div>
        <div class="card"><div class="label">GCash Today</div><div id="dGcashToday" class="value">₱0.00</div></div>
        <div class="card"><div class="label">Total Cash</div><div id="dTotalCashToday" class="value">₱0.00</div></div>
      `);
    }

    const monthlyHead=document.querySelector("#page-monthly thead tr");
    if(monthlyHead)monthlyHead.innerHTML="<th>Month</th><th>Total Sales</th><th>Cash Paid</th><th>GCash Paid</th><th>Expenses</th><th>Net Sales</th><th>Total Cash</th><th>Actions</th>";
    const yearlyHead=document.querySelector("#page-yearly thead tr");
    if(yearlyHead)yearlyHead.innerHTML="<th>Year</th><th>Total Sales</th><th>Cash Paid</th><th>GCash Paid</th><th>Expenses</th><th>Net Sales</th><th>Total Cash</th><th>Actions</th>";

    const dailyNotice=document.querySelector("#page-daily .notice");
    if(dailyNotice)dailyNotice.innerHTML="Daily totals use live data for today and a <strong>permanent end-of-day summary</strong> for closed days. Detailed closed-day orders are deleted only after the summary is saved.";

    window.loadDashboard=async function(){
      try{
        const d=await window.posApi.dashboard();
        const values=[
          ["dDaily",money2(d.daily)],["dExpToday",money2(d.expensesToday)],["dNetToday",money2(d.netToday)],
          ["dMonth",money2(d.monthly)],["dExpMonth",money2(d.expensesMonth)],["dNetMonth",money2(d.netMonth)],
          ["dYear",money2(d.yearly)],["dExpYear",money2(d.expensesYear)],["dNetYear",money2(d.netYear)],
          ["dCupsToday",String(Number(d.cupsToday||0))],["dCashToday",money2(d.cashToday)],
          ["dGcashToday",money2(d.gcashToday)],["dTotalCashToday",money2(d.totalCashToday)]
        ];
        values.forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=value});
      }catch(e){window.err?.(e)}
    };

    window.loadDailySalesTracker=async function(){
      const el=document.getElementById("dailySalesTable");
      if(!el)return;
      try{
        const rows=await window.posApi.dailyTracker();
        el.innerHTML=rows.length?rows.map(r=>`<tr>
          <td>${esc2(r.date)}</td><td>${money2(r.sales)}</td><td>${Number(r.cups)||0}</td>
          <td>${money2(r.expenses)}</td><td>${money2(r.net)}</td><td>${money2(r.gcash)}</td>
          <td>${money2(r.cash)}</td><td><strong>${money2(r.totalCash??(Number(r.cash)-Number(r.expenses)))}</strong></td>
          <td><div class="action-group"><button class="small-btn" onclick="editReport('daily','${esc2(r.date)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('daily','${esc2(r.date)}')">Delete</button></div></td>
        </tr>`).join(""):'<tr><td colspan="9" class="muted">No daily sales recorded.</td></tr>';
      }catch(e){window.err?.(e)}
    };

    window.loadMonthlyYearly=async function(){
      try{
        const [m,y]=await Promise.all([window.posApi.monthly(),window.posApi.yearly()]);
        const mt=document.getElementById("monthlyTable"),yt=document.getElementById("yearlyTable");
        if(mt)mt.innerHTML=m.length?m.map(r=>`<tr>
          <td>${esc2(r.month)}</td><td><strong>${money2(r.sales)}</strong></td>
          <td>${money2(r.cash)}</td><td>${money2(r.gcash)}</td><td>${money2(r.expenses)}</td>
          <td><strong>${money2(r.net)}</strong></td><td><strong>${money2(r.totalCash??(Number(r.cash)-Number(r.expenses)))}</strong></td>
          <td><div class="action-group"><button class="small-btn" onclick="editReport('monthly','${esc2(r.month)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('monthly','${esc2(r.month)}')">Delete</button></div></td>
        </tr>`).join(""):'<tr><td colspan="8" class="muted">No monthly data.</td></tr>';
        if(yt)yt.innerHTML=y.length?y.map(r=>`<tr>
          <td>${esc2(r.year)}</td><td><strong>${money2(r.sales)}</strong></td>
          <td>${money2(r.cash)}</td><td>${money2(r.gcash)}</td><td>${money2(r.expenses)}</td>
          <td><strong>${money2(r.net)}</strong></td><td><strong>${money2(r.totalCash??(Number(r.cash)-Number(r.expenses)))}</strong></td>
          <td><div class="action-group"><button class="small-btn" onclick="editReport('yearly','${esc2(r.year)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('yearly','${esc2(r.year)}')">Delete</button></div></td>
        </tr>`).join(""):'<tr><td colspan="8" class="muted">No yearly data.</td></tr>';
      }catch(e){window.err?.(e)}
    };
  }

  function installAccountUI(){
    const form=document.querySelector("#page-account .account-form");
    if(!form)return;

    const saveBtn=form.querySelector('button[onclick="saveAccountDetails()"]');
    const passBtn=form.querySelector('button[onclick="changePassword()"]');
    if(saveBtn)saveBtn.id="accountSaveBtn";
    if(passBtn)passBtn.id="accountPasswordBtn";

    const current=document.getElementById("currentPassword");
    if(current?.parentElement)current.parentElement.id="currentPasswordWrap";

    if(!document.getElementById("staffOwnerAuthorization")){
      const box=document.createElement("div");
      box.id="staffOwnerAuthorization";
      box.className="owner-auth-box hidden";
      box.innerHTML=`
        <div class="owner-auth-head"><strong>Owner Authorization Required</strong><span>Staff account editing unlocks for 5 minutes.</span></div>
        <div class="form-grid two">
          <div><label>Owner Username</label><input id="staffOwnerUsername" value="owner" autocomplete="username"></div>
          <div><label>Owner Password</label><input id="staffOwnerPassword" type="password" autocomplete="current-password"></div>
        </div>
        <div class="owner-auth-actions">
          <button type="button" class="btn gold" onclick="unlockStaffAccount()">UNLOCK ACCOUNT EDITING</button>
          <span id="staffOwnerAuthStatus" class="muted"></span>
        </div>
      `;
      form.insertBefore(box,form.children[1]||form.firstChild);
    }

    const originalLoadAccount=window.loadAccount;
    const originalSaveAccount=window.saveAccountDetails;
    const originalChangePassword=window.changePassword;

    function unlocked(){return !staffNow()||Date.now()<state.staffUnlockedUntil}

    window.updateStaffAccountLock=function(){
      const staff=staffNow(),open=unlocked();
      document.getElementById("staffOwnerAuthorization")?.classList.toggle("hidden",!staff);
      ["accountEditName","accountEditUsername","newPassword","confirmPassword"].forEach(id=>{
        const el=document.getElementById(id);if(el)el.disabled=staff&&!open;
      });
      const save=document.getElementById("accountSaveBtn"),pass=document.getElementById("accountPasswordBtn");
      if(save)save.disabled=staff&&!open;
      if(pass)pass.disabled=staff&&!open;
      const currentWrap=document.getElementById("currentPasswordWrap");
      if(currentWrap)currentWrap.classList.toggle("hidden",staff);
      const status=document.getElementById("staffOwnerAuthStatus");
      if(status&&staff)status.textContent=open?"Unlocked by Owner • expires in 5 minutes":"Locked";
    };

    window.unlockStaffAccount=async function(){
      const username=document.getElementById("staffOwnerUsername")?.value.trim()||"owner";
      const password=document.getElementById("staffOwnerPassword")?.value||"";
      try{
        await window.posApi.verifyOwnerCredentials(username,password);
        state.staffUnlockedUntil=Date.now()+5*60*1000;
        if(document.getElementById("staffOwnerPassword"))document.getElementById("staffOwnerPassword").value="";
        window.updateStaffAccountLock();
        window.notify?.("Owner authorization accepted. Staff account editing is unlocked for 5 minutes.");
      }catch(e){window.err?.(e)}
    };

    if(typeof originalLoadAccount==="function"){
      window.loadAccount=async function(){
        const r=await originalLoadAccount.apply(this,arguments);
        window.updateStaffAccountLock();
        return r;
      };
    }

    if(typeof originalSaveAccount==="function"){
      window.saveAccountDetails=async function(){
        if(staffNow()&&!unlocked()){
          window.updateStaffAccountLock();
          return alert("Enter the Owner password to unlock Staff account editing.");
        }
        const r=await originalSaveAccount.apply(this,arguments);
        window.updateStaffAccountLock();
        return r;
      };
    }

    if(typeof originalChangePassword==="function"){
      window.changePassword=async function(){
        if(!staffNow())return originalChangePassword.apply(this,arguments);
        if(!unlocked()){
          window.updateStaffAccountLock();
          return alert("Enter the Owner password to unlock Staff password editing.");
        }
        const next=document.getElementById("newPassword")?.value||"";
        const confirmPass=document.getElementById("confirmPassword")?.value||"";
        if(!next)return alert("Enter a new password.");
        if(next!==confirmPass)return alert("New passwords do not match.");
        try{
          await window.posApi.authorizedChangePassword({newPassword:next});
          ["newPassword","confirmPassword"].forEach(id=>{if(document.getElementById(id))document.getElementById(id).value=""});
          const msg=document.getElementById("accountMsg");if(msg)msg.textContent="Password changed successfully with Owner authorization.";
          window.notify?.("Staff password changed successfully.");
        }catch(e){window.err?.(e)}
      };
    }
  }

  function installAddonManager(){
    const pageTitle=document.querySelector("#page-pos .page-title");
    if(pageTitle&&!document.getElementById("manageAddonsBtn")){
      const btn=document.createElement("button");
      btn.id="manageAddonsBtn";
      btn.className="btn";
      btn.type="button";
      btn.textContent="Manage Add-ons";
      btn.onclick=()=>window.openAddonManager();
      pageTitle.insertBefore(btn,pageTitle.lastElementChild);
    }

    if(!document.getElementById("addonManagerModal")){
      const modal=document.createElement("div");
      modal.id="addonManagerModal";
      modal.className="modal-back hidden";
      modal.innerHTML=`
        <div class="modal addon-manager-modal">
          <h2>Manage Add-ons</h2>
          <div class="notice">Owner only. Add new add-ons or change their price. Staff can use all active add-ons in the POS.</div>
          <input id="addonManagerId" type="hidden">
          <div class="form-grid two">
            <div><label>Add-on Name</label><input id="addonManagerName" autocomplete="off" placeholder="e.g. Extra Syrup"></div>
            <div><label>Price</label><input id="addonManagerPrice" type="number" min="0" step="0.01" placeholder="0.00"></div>
          </div>
          <div class="modal-actions"><button class="btn" type="button" onclick="clearAddonManagerForm()">CLEAR</button><button class="btn gold" type="button" onclick="saveAddonDefinition()">SAVE ADD-ON</button></div>
          <div class="addon-manager-list" id="addonManagerList"></div>
          <div class="modal-actions"><button class="btn" type="button" onclick="closeAddonManager()">CLOSE</button></div>
        </div>`;
      document.body.appendChild(modal);
    }

    window.renderAddonManager=()=>{
      const list=document.getElementById("addonManagerList");
      if(!list)return;
      list.innerHTML=state.addons.length?state.addons.map((a,i)=>`
        <div class="addon-manager-row">
          <div><strong>${esc2(a.name)}</strong><span>${money2(a.price)}</span></div>
          <div class="action-group"><button class="small-btn" onclick="editAddonDefinition(${i})">Edit</button><button class="small-btn danger" onclick="deleteAddonDefinition(${i})">Remove</button></div>
        </div>`).join(""):'<div class="muted">No active add-ons.</div>';
    };

    window.openAddonManager=async function(){
      if(staffNow())return alert("Only the Owner can manage add-ons.");
      if(!navigator.onLine)return alert("Managing add-ons requires an internet connection.");
      await loadAddons();
      window.renderAddonManager();
      document.getElementById("addonManagerModal")?.classList.remove("hidden");
    };
    window.closeAddonManager=()=>document.getElementById("addonManagerModal")?.classList.add("hidden");
    window.clearAddonManagerForm=function(){
      ["addonManagerId","addonManagerName","addonManagerPrice"].forEach(id=>{if(document.getElementById(id))document.getElementById(id).value=""});
    };
    window.editAddonDefinition=function(index){
      const a=state.addons[Number(index)];if(!a)return;
      document.getElementById("addonManagerId").value=a.id;
      document.getElementById("addonManagerName").value=a.name;
      document.getElementById("addonManagerPrice").value=a.price;
    };
    window.saveAddonDefinition=async function(){
      if(staffNow())return alert("Only the Owner can manage add-ons.");
      const d={
        id:Number(document.getElementById("addonManagerId")?.value)||null,
        name:document.getElementById("addonManagerName")?.value.trim()||"",
        price:Number(document.getElementById("addonManagerPrice")?.value)||0
      };
      if(!d.name)return alert("Enter an add-on name.");
      try{
        await window.cofteaCloudApi.saveAddon(d);
        await loadAddons();
        window.clearAddonManagerForm();
        window.renderAddonManager();
        if(selectedProduct)window.setupProductChoices(selectedProduct);
        window.notify?.("Add-on saved.");
      }catch(e){window.err?.(e)}
    };
    window.deleteAddonDefinition=async function(index){
      if(staffNow())return alert("Only the Owner can manage add-ons.");
      const a=state.addons[Number(index)];if(!a)return;
      if(!confirm(`Remove ${a.name} from the active add-on list?`))return;
      try{
        await window.cofteaCloudApi.deleteAddon(a.id);
        await loadAddons();
        window.renderAddonManager();
        window.notify?.("Add-on removed.");
      }catch(e){window.err?.(e)}
    };
  }

  function wrapRolePermissions(){
    const original=window.applyRolePermissions;
    if(typeof original!=="function"||original.__majorWrapped)return;
    const wrapped=function(){
      const r=original.apply(this,arguments);
      const btn=document.getElementById("manageAddonsBtn");
      if(btn)btn.style.display=staffNow()?"none":"inline-flex";
      const inlineBtn=document.getElementById("inlineAddAddonBtn");
      if(inlineBtn)inlineBtn.style.display=staffNow()?"none":"inline-flex";
      window.updateStaffAccountLock?.();
      return r;
    };
    wrapped.__majorWrapped=true;
    window.applyRolePermissions=wrapped;
  }

  async function install(){
    if(state.installed)return;
    if(!window.cofteaCloudApi||!window.posApi||!window.cofteaSupabase){
      setTimeout(install,400);
      return;
    }
    state.installed=true;
    window.CofTeaMajorFeatures={version:VERSION,state};

    installCloudFeatures();
    await loadAddons();
    installAddonUI();
    installSalesUI();
    installReportUI();
    installAccountUI();
    installAddonManager();
    wrapRolePermissions();

    // Apply role/UI rules now if already logged in.
    try{window.applyRolePermissions?.()}catch(_e){}
    try{if(currentUser)await window.loadAll?.()}catch(_e){}
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(install,0),{once:true});
  }else{
    setTimeout(install,0);
  }
})();
