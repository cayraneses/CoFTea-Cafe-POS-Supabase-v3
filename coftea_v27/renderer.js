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
function toggleLoginPassword(){
  const i=$("loginPass"),b=document.querySelector("#loginPage .password-toggle");
  if(!i)return;
  const show=i.type==="password";
  i.type=show?"text":"password";
  if(b){b.textContent=show?"HIDE":"SHOW";b.setAttribute("aria-label",show?"Hide password":"Show password");b.type="button";}
  try{i.focus({preventScroll:true});}catch(_e){i.focus();}
}

async function login(){
  const u=$("loginUser").value.trim(),p=$("loginPass").value;
  if(!u||!p){$("loginMsg").textContent="Enter your username and password.";return}
  $("loginMsg").textContent="Signing in...";
  try{const result=await window.api.login(u,p);const user=result?.user||result;if(!user||result?.ok===false){$("loginMsg").textContent=result?.message||"Invalid username or password.";return}currentUser=user;sessionStorage.setItem("posUser",JSON.stringify(user));enterApp()}catch(e){$("loginMsg").textContent=e?.message||"Login failed."}
}
function enterApp(){
  $("loginPage").classList.add("hidden");$("app").classList.remove("hidden");$("headerName").textContent=(String(currentUser.role||"").toLowerCase()==="owner"?"Owner":(currentUser.role||currentUser.name||currentUser.username));if($("headerRole"))$("headerRole").textContent="";applyRolePermissions();loadAll();showPage("dashboard");try{window.api.startRealtime?.()}catch(_e){}
}
function logout(){currentUser=null;cart=[];editingTransactionId=null;sessionStorage.removeItem("posUser");$("app").classList.add("hidden");$("loginPage").classList.remove("hidden");$("loginUser").value="";$("loginPass").value="";$("loginMsg").textContent="";$("loginUser")?.focus()}
function applyRolePermissions(){
  const staffPages=new Set(["pos","inventory","cups","sales","expenses","daily","history","account"]);
  document.querySelectorAll(".nav-btn").forEach(btn=>{
    const page=btn.dataset.page;
    const visible=!isStaff()||staffPages.has(page);
    btn.style.display=visible?"flex":"none";
  });
  const notice=document.querySelector("#page-sales .notice");
  if(notice)notice.innerHTML=isStaff()?"Sales records are viewable. <strong>Staff accounts cannot edit or delete sales orders.</strong>":"Owner accounts can edit or delete completed sales.";
  if(isStaff()&&["dashboard","monthly","yearly"].includes(document.querySelector(".page.active")?.id?.replace("page-","")))showPage("pos");
}
async function loadAll(){try{products=await window.api.products();ensureProductManagerUI();renderPosSizeChoices();await Promise.all([loadDashboard(),loadSales(),loadExpenses(),loadInventory(),loadCups(),loadDailySalesTracker(),loadAccount(),loadMonthlyYearly(),loadHistory()]);renderCategories();renderProducts();renderCart()}catch(e){err(e)}}

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
function refreshAll(){loadAll()}

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
    ? cleaned.slice(0,firstDot+1)+cleaned.slice(firstDot+1).replace(/\./g,"")
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
    const r=wasEditing?await window.api.updateSale({saleId:editingTransactionId,items:cart,payment,cash,userId:currentUser.id}):await window.api.saveSale({items:cart,payment,cash,userId:currentUser.id});
    clearCart();
    await Promise.all([loadDashboard(),loadInventory(),loadCups(),loadDailySalesTracker(),loadSales()]);
    restoreInputFocus("cashReceived");
    notify(wasEditing?"Sale updated successfully.":`Sale saved • ${r.transactionId}`);
  }catch(e){err(e)}finally{saleBusy=false}
}

async function loadDashboard(){try{const d=await window.api.dashboard();[["dDaily",d.daily],["dExpToday",d.expensesToday],["dNetToday",d.netToday],["dMonth",d.monthly],["dExpMonth",d.expensesMonth],["dNetMonth",d.netMonth],["dYear",d.yearly],["dExpYear",d.expensesYear],["dNetYear",d.netYear]].forEach(([id,v])=>$(id).textContent=money(v))}catch(e){err(e)}}

async function loadSales(){if(!$ ("salesTable"))return;const date=$("salesDate")?.value||today();$("salesTable").innerHTML=`<tr><td colspan="11" class="muted">Loading...</td></tr>`;try{const rows=await window.api.sales(date);$("salesTable").innerHTML=rows.length?rows.flatMap(s=>s.item_details.map((i,idx)=>`<tr><td>${displayDate(s.sale_date)}</td><td>${esc(s.sale_time)}</td><td><strong>${esc(s.transaction_id)}</strong></td><td>${esc(i.product_name)}</td><td>${esc(i.category)}</td><td>${esc(i.size)}${i.free_upsize?` <small>(free upsize from ${esc(i.original_size)})`:""}</small></td><td>${esc(i.temperature)}</td><td>${i.quantity}</td><td>${money(Number(i.line_total)*Number(i.quantity))}${i.free_drink?' <small>(FREE)</small>':''}</td><td>${esc(s.payment_method)}</td><td><div class="action-group">${idx===0&&!isStaff()?`<button class="small-btn" onclick="editTransaction(${s.id})">Edit</button><button class="small-btn danger" onclick="removeTransaction(${s.id})">Delete</button>`:""}</div></td></tr>`)).join(""):`<tr><td colspan="11" class="muted">No sales recorded for ${displayDate(date)}.</td></tr>`}catch(e){err(e)}}
async function editTransaction(id){if(isStaff())return alert("Staff accounts cannot edit sales.");try{const rows=await window.api.sales($("salesDate").value||today()),tx=rows.find(x=>x.id===Number(id));if(!tx)return alert("Transaction not found.");cart=tx.item_details.map(i=>({product:i.product_name,category:i.category,size:i.size,cupType:(String(i.temperature||"Cold").toLowerCase()==="hot"?"Hot Cups":i.size),temperature:i.temperature||"Cold",tutti:!!i.tutti_frutti,addon:i.addon||"No Add-on",addonPrice:Number(i.addon_price)||0,customized:!!i.customized,freeUpsize:!!i.free_upsize,freeDrink:!!i.free_drink,originalSize:i.original_size||null,unit:Number(i.unit_price)||0,qty:Number(i.quantity)||1,lineTotal:Number(i.line_total)||0}));editingTransactionId=tx.id;payment=tx.payment_method||"Cash";$("cashReceived").value=tx.cash_received||"";$("orderTitle").textContent=`Editing ${tx.transaction_id}`;setPayment(payment);renderCart();showPage("pos")}catch(e){err(e)}}
async function removeTransaction(id){if(isStaff())return alert("Staff accounts cannot delete sales.");if(!confirm("Delete this transaction? The cup inventory used by it will be restored."))return;try{await window.api.deleteSale(id);await loadSales();await loadDashboard();await loadInventory();await loadCups();await loadDailySalesTracker();notify("Sale deleted and cup inventory restored.")}catch(e){err(e)}}

async function loadExpenses(){if(!$ ("expensesTable"))return;const date=$("expDate")?.value||today();$("expensesTable").innerHTML=`<tr><td colspan="9" class="muted">Loading...</td></tr>`;try{expenses=await window.api.expenses(date);$("expensesTable").innerHTML=expenses.length?expenses.map(e=>`<tr><td>${displayDate(e.expense_date)}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td>${money(e.amount)}</td><td>${esc(e.payment_method)}</td><td>${esc(e.notes||"")}</td><td><div class="action-group"><button class="small-btn" onclick="editExpense(${e.id})">Edit</button><button class="small-btn danger" onclick="removeExpense(${e.id})">Delete</button></div></td></tr>`).join(""):`<tr><td colspan="7" class="muted">No expenses recorded.</td></tr>`}catch(e){err(e)}}
async function saveExpense(){if(expenseBusy)return;const data={id:Number($("expId").value)||0,date:today(),category:$("expCategory").value.trim(),description:$("expDescription").value.trim(),amount:Number($("expAmount").value)||0,payment:$("expPayment").value,notes:$("expNotes").value.trim()};if(!data.category||!data.description||data.amount<=0)return alert("Please complete the expense form.");expenseBusy=true;try{await window.api.addExpense(data);clearExpenseForm();await loadExpenses();await loadDashboard();notify(data.id?"Expense updated successfully.":"Expense saved successfully.")}catch(e){err(e)}finally{expenseBusy=false}}
function editExpense(id){const e=expenses.find(x=>x.id===Number(id));if(!e)return;$("expId").value=e.id;$("expCategory").value=e.category;$("expDescription").value=e.description;$("expAmount").value=e.amount;$("expPayment").value=e.payment_method||"Cash";$("expNotes").value=e.notes||"";$("expenseSaveBtn").textContent="UPDATE EXPENSE";showPage("expenses")}
function clearExpenseForm(){["expRow","expId","expCategory","expDescription","expAmount","expNotes"].forEach(id=>{if($(id))$(id).value=""});$("expPayment").value="Cash";$("expenseSaveBtn").textContent="SAVE EXPENSE"}
async function removeExpense(id){if(!confirm("Delete this expense?"))return;try{await window.api.deleteExpense(id);await loadExpenses();await loadDashboard();notify("Expense deleted.")}catch(e){err(e)}}

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
    const saved=await window.api.saveProduct(d);
    products=await window.api.products();
    activeCategory=d.category;
    closeProductManager();renderCategories();renderProducts();
    notify(`POS item "${saved.name||d.name}" added successfully.`);
  }catch(e){err(e)}finally{btn.disabled=false}
}

async function loadInventory(){if(!$ ("inventoryTable"))return;try{inventoryData=await window.api.inventory();renderInventoryFilters();renderInventory()}catch(e){err(e)}}
function renderInventoryFilters(){const cats=["All",...Array.from(new Set(inventoryData.map(x=>String(x.category||"Other")))).sort()];const el=$("inventoryFilters");if(!el)return;el.innerHTML=cats.map(c=>`<button type="button" class="inventory-cat ${c===inventoryFilter?"active":""}" data-inventory-category="${esc(c)}">${esc(c)}</button>`).join("")}
function setInventoryCategory(category){inventoryFilter=String(category||"All");renderInventoryFilters();renderInventory()}
function renderInventory(){const q=inventorySearch.trim().toLowerCase();const rows=inventoryData.filter(x=>{const category=String(x.category||"Other");const matchesCategory=inventoryFilter==="All"||category===inventoryFilter;const hay=[x.sku,x.name,category,x.unit].map(v=>String(v||"").toLowerCase()).join(" ");return matchesCategory&&(!q||hay.includes(q));});$("inventoryTable").innerHTML=rows.map(x=>{const category=String(x.category||"Other");const zero=Number(x.total)<=0;return `<tr class="${zero?"inventory-zero-stock":""}"><td>${esc(x.sku)}</td><td><strong>${esc(x.name)}</strong>${zero?' <span class="stock-zero-badge">OUT OF STOCK</span>':""}</td><td class="inventory-category-cell"><button type="button" class="inventory-category-link ${category===inventoryFilter?"active":""}" data-inventory-category="${esc(category)}" title="Click to show only ${esc(category)} items">${esc(category)}</button></td><td>${esc(x.unit)}</td><td>${Number(x.inside)||0}</td><td>${Number(x.outside)||0}</td><td><strong>${Number(x.total)||0}</strong></td><td><div class="action-group"><button type="button" class="small-btn" onclick="editInventory(${x.id})">Edit</button><button type="button" class="small-btn danger" onclick="removeInventory(${x.id})">Delete</button></div></td></tr>`}).join("")||`<tr><td colspan="8" class="muted">No inventory items.</td></tr>`}
function openInventoryModal(){$("invRow").value="";$("invSKU").value="";$("invOriginalSKU").value="";$("invItem").value="";$("invCategory").value="Other";$("invUnit").value="pcs";$("invInside").value=0;$("invOutside").value=0;$("invTitle").textContent="Add Inventory Item";$("inventoryModal").classList.remove("hidden")}
function editInventory(id){const x=inventoryData.find(z=>z.id===Number(id));if(!x)return;$("invRow").value=x.id;$("invSKU").value=x.sku;$("invOriginalSKU").value=x.sku;$("invItem").value=x.name;$("invCategory").value=x.category;$("invUnit").value=x.unit;$("invInside").value=x.inside;$("invOutside").value=x.outside;$("invTitle").textContent="Edit Inventory Item";$("inventoryModal").classList.remove("hidden")}
function closeInventoryModal(){$("inventoryModal").classList.add("hidden")}
async function saveInventoryItem(){if(inventoryBusy)return;const d={id:Number($("invRow").value)||0,sku:$("invSKU").value.trim(),item:$("invItem").value.trim(),category:$("invCategory").value,unit:$("invUnit").value.trim()||"pcs",inside:Number($("invInside").value)||0,outside:Number($("invOutside").value)||0};if(!d.item)return alert("Item name is required.");inventoryBusy=true;try{await window.api.saveInventory(d);closeInventoryModal();await loadInventory();await loadCups();notify(d.id?"Inventory item updated.":"Inventory item added.")}catch(e){err(e)}finally{inventoryBusy=false}}
async function removeInventory(id){if(!confirm("Delete this inventory item?"))return;try{await window.api.deleteInventory(id);await loadInventory();await loadCups()}catch(e){err(e)}}

async function loadCups(){if(!$ ("cupsTable"))return;try{const result=await window.api.cupSummary(today());const rows=result.rows||[];const totalSold=Number(result.totalSold||0);$("cupsReleased").textContent="—";$("cupsSold").textContent=totalSold;$("cupQuota").textContent="60 cups";$("cupProgress").style.width=Math.min(100,totalSold/60*100)+"%";$("cupProgressText").textContent=`${totalSold} / 60 cups`;$("cupsReleased").textContent=Math.min(100,Math.round(totalSold/60*100))+"%";$("cupsTable").innerHTML=rows.map(r=>{const remaining=Number(r.remaining)||0;return `<tr><td><strong>${esc(r.size)}</strong></td><td>${Number(r.soldToday)||0}</td><td><strong>${remaining}</strong></td><td>${remaining<=0?'<span class="stock-zero-badge">OUT OF STOCK</span>':'<span class="muted">Available</span>'}</td></tr>`}).join("");await loadCupSummary()}catch(e){err(e)}}
async function loadCupSummary(){const el=$("cupSummaryTable");if(!el)return;try{const rows=await window.api.dailyTracker();el.innerHTML=rows.length?rows.map(r=>`<tr><td>${displayDate(r.date)}</td><td><strong>${Number(r.cups)||0}</strong></td></tr>`).join(""):`<tr><td colspan="2" class="muted">No cup sales recorded.</td></tr>`}catch(e){err(e)}}
async function loadDailySalesTracker(){const el=$("dailySalesTable");if(!el)return;try{const rows=await window.api.dailyTracker();el.innerHTML=rows.length?rows.map(r=>`<tr><td>${displayDate(r.date)}</td><td>${money(r.sales)}</td><td>${Number(r.cups)||0}</td><td>${money(r.expenses)}</td><td>${money(r.net)}</td><td>${money(r.gcash)}</td><td>${money(r.cash)}</td><td><strong>${money(Number(r.cash)-Number(r.expenses))}</strong></td><td><div class="action-group"><button class="small-btn" onclick="editReport('daily','${esc(r.date)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('daily','${esc(r.date)}')">Delete</button></div></td></tr>`).join(""):`<tr><td colspan="9" class="muted">No daily sales recorded.</td></tr>`}catch(e){err(e)}}
// Kept for compatibility with the original HTML; cup stock is now inventory-linked.
function releaseCups(){alert("Cup releasing is no longer required. Add cup stock directly in Inventory; POS sales automatically deduct it.")}
function openCupStatus(size){alert(`${size} remaining is controlled by Inventory. Open Inventory to correct the stock.`)}
function closeCupStatusModal(){$("cupStatusModal")?.classList.add("hidden")}
function saveCupStatus(){closeCupStatusModal();showPage("inventory")}

async function loadMonthlyYearly(){
  try{
    const [m,y]=await Promise.all([window.api.monthly(),window.api.yearly()]);
    if($("monthlyTable")){
      $("monthlyTable").innerHTML=m.length?m.map(r=>`
        <tr><td>${esc(r.month)}</td><td><strong>${money(r.sales)}</strong></td><td>${money(r.cash)}</td><td>${money(r.gcash)}</td><td>${money(r.expenses)}</td><td><strong>${money(r.net)}</strong></td><td><div class="action-group"><button class="small-btn" onclick="editReport('monthly','${esc(r.month)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('monthly','${esc(r.month)}')">Delete</button></div></td></tr>`).join(""):
        `<tr><td colspan="6" class="muted">No monthly data.</td></tr>`;
    }
    if($("yearlyTable")){
      $("yearlyTable").innerHTML=y.length?y.map(r=>`
        <tr><td>${esc(r.year)}</td><td><strong>${money(r.sales)}</strong></td><td>${money(r.cash)}</td><td>${money(r.gcash)}</td><td>${money(r.expenses)}</td><td><strong>${money(r.net)}</strong></td><td><div class="action-group"><button class="small-btn" onclick="editReport('yearly','${esc(r.year)}')">Edit</button><button class="small-btn danger" onclick="deleteReport('yearly','${esc(r.year)}')">Delete</button></div></td></tr>`).join(""):
        `<tr><td colspan="6" class="muted">No yearly data.</td></tr>`;
    }
  }catch(e){err(e)}
}

function closeReportEdit(){$("reportEditModal")?.classList.add("hidden")}
async function editReport(type,key){try{const rows=type==='daily'?await window.api.dailyTracker():type==='monthly'?await window.api.monthly():await window.api.yearly();const r=rows.find(x=>String(x[type==='daily'?'date':type==='monthly'?'month':'year'])===String(key));if(!r)return alert('Report period not found.');$("reportEditType").value=type;$("reportEditKey").value=key;$("reportEditTitle").textContent=`Edit ${type==='daily'?'Daily':type==='monthly'?'Monthly':'Yearly'} Sales • ${key}`;$("reportEditSales").value=Number(r.sales||0);$("reportEditCash").value=Number(r.cash||0);$("reportEditGcash").value=Number(r.gcash||0);$("reportEditExpenses").value=Number(r.expenses||0);$("reportEditCups").value=Number(r.cups||0);$("reportEditCupsWrap").classList.toggle('hidden',type!=='daily');$("reportEditModal").classList.remove('hidden')}catch(e){err(e)}}
async function saveReportEdit(){const type=$("reportEditType").value,key=$("reportEditKey").value;const d={type,key,sales:Number($("reportEditSales").value)||0,cash:Number($("reportEditCash").value)||0,gcash:Number($("reportEditGcash").value)||0,expenses:Number($("reportEditExpenses").value)||0,cups:type==='daily'?(Number($("reportEditCups").value)||0):0};if(d.cash+d.gcash>d.sales+0.000001)return alert('Cash Paid + GCash Paid cannot be greater than Total Sales.');try{await window.api.reportAdjustmentSave(d);closeReportEdit();await Promise.all([loadDailySalesTracker(),loadMonthlyYearly(),loadDashboard(),loadCups()]);alert('Report updated successfully.')}catch(e){err(e)}}
async function deleteReport(type,key){if(!confirm(`Delete the manual correction for ${type==='daily'?'this day':type==='monthly'?'this month':'this year'}? The report will return to the automatically calculated totals. Your individual POS sales will NOT be deleted.`))return;try{await window.api.reportAdjustmentDelete(type,key);await Promise.all([loadDailySalesTracker(),loadMonthlyYearly(),loadDashboard(),loadCups()]);alert('Report correction deleted.')}catch(e){err(e)}}

async function loadHistory(){
  if(!$("historyTable"))return;
  try{
    const rows=await window.api.historical();
    $("historyTable").innerHTML=rows.length?rows.map(r=>`
      <tr><td>${displayDate(r.record_date)}</td><td><strong>${money(r.sales)}</strong></td><td>${money(r.cash_sales||0)}</td><td>${money(r.gcash_sales||0)}</td><td><strong>${money(r.expenses)}</strong></td><td>${money(r.cash_expenses||0)}</td><td>${money(r.gcash_expenses||0)}</td><td><strong>${Number(r.cups||0)}</strong></td><td>${esc(r.notes||"")}</td></tr>`).join(""):
      `<tr><td colspan="9" class="muted">No historical records.</td></tr>`;
  }catch(e){err(e)}
}
async function addHistory(){
  const d={date:$("hDate").value||today(),sales:Number($("hSales").value)||0,cashSales:Number($("hCashSales").value)||0,gcashSales:Number($("hGcashSales").value)||0,expenses:Number($("hExpenses").value)||0,cashExpenses:Number($("hCashExpenses").value)||0,gcashExpenses:Number($("hGcashExpenses").value)||0,cups:Number($("hCups").value)||0,notes:$("hNotes").value.trim()};
  try{
    await window.api.addHistorical(d);
    ["hSales","hCashSales","hGcashSales","hExpenses","hCashExpenses","hGcashExpenses","hCups","hNotes"].forEach(id=>$(id).value="");
    await loadHistory();await loadDashboard();await loadMonthlyYearly();await loadDailySalesTracker();await loadCups();
    notify("Historical data saved.");
  }catch(e){err(e)}
}

async function loadAccount(){if(!currentUser)return;try{const a=await window.api.account({userId:currentUser.id});$("accountName").textContent=a.name;$("accountUsername").textContent=a.username;$("accountRole").textContent=a.role;$("accountActive").textContent=a.active?"Active":"Inactive";$("accountEditName").value=a.name;$("accountEditUsername").value=a.username}catch(e){err(e)}}
async function saveAccountDetails(){try{const a=await window.api.updateAccount({userId:currentUser.id,name:$("accountEditName").value.trim(),username:$("accountEditUsername").value.trim()});currentUser={...currentUser,...a};sessionStorage.setItem("posUser",JSON.stringify(currentUser));$("headerName").textContent=(String(a.role||currentUser.role||"").toLowerCase()==="owner"?"Owner":(a.role||a.name||currentUser.name||currentUser.username));if($("headerRole"))$("headerRole").textContent="";await loadAccount();notify("Account details updated.")}catch(e){err(e)}}
async function changePassword(){const cur=$("currentPassword").value,next=$("newPassword").value,con=$("confirmPassword").value;if(!cur||!next)return alert("Enter your current and new password.");if(next!==con)return alert("New passwords do not match.");try{await window.api.changePassword({userId:currentUser.id,oldPassword:cur,newPassword:next});$("accountMsg").textContent="Password changed successfully.";["currentPassword","newPassword","confirmPassword"].forEach(id=>$(id).value="")}catch(e){err(e)}}
async function backup(){try{const r=await window.api.backup();if(r.ok)notify("Backup saved successfully.")}catch(e){err(e)}}
async function restore(){if(!confirm("Restore a CoFTea backup? Current local data will be replaced."))return;try{const r=await window.api.restore();if(r.ok){alert("Backup restored. Please log in again.");location.reload()}}catch(e){err(e)}}

let realtimeReloadTimer=null;
window.__cofteaRealtime=()=>{if(!currentUser)return;clearTimeout(realtimeReloadTimer);realtimeReloadTimer=setTimeout(()=>{loadDashboard();loadInventory();loadCups();loadDailySalesTracker();loadMonthlyYearly();loadSales();loadExpenses()},250)};

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

$("loginPass")?.addEventListener("keydown",e=>{if(e.key==="Enter")login()});
$("loginPage")?.querySelector(".password-toggle")?.addEventListener("click",e=>{e.preventDefault();toggleLoginPassword();});
$("loginPage")?.querySelector(".password-toggle")?.setAttribute("type","button");
initStableInputs();
$("salesDate")?.addEventListener("change",loadSales);
window.addEventListener("load",()=>{const saved=sessionStorage.getItem("posUser");if(saved){try{currentUser=JSON.parse(saved);enterApp()}catch(e){sessionStorage.removeItem("posUser")}}else{$("loginUser")?.focus()}});
