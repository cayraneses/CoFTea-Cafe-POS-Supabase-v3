const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// Offline local JSON database. No server, Google Apps Script, or native rebuild required.
const dbPath = path.join(app.getPath("userData"), "coftea-data.json");
let data;

const productSeed = [
  ["P001","Cafe Latte","Original Latte",39,49,59],["P002","Cafe Latte","Spanish Latte",39,49,59],["P003","Cafe Latte","Strawberry Latte",39,49,59],["P004","Cafe Latte","Hazelnut Brew",39,49,59],["P005","Cafe Latte","Caramel Macchiato",39,49,59],["P006","Cafe Latte","Chocolate Latte",39,49,59],["P007","Cafe Latte","Salted Caramel",39,49,59],["P008","Cafe Latte","Vanilla Blanca",39,49,59],["P009","Cafe Latte","White Cappuccino",39,49,59],["P010","Cafe Latte","Matcha Latte",49,59,69],["P011","Cafe Latte","Red Velvet",49,59,69],
  ["P012","Amerikano","Original",39,49,59],["P013","Amerikano","Caramel Macchiato",39,49,59],["P014","Amerikano","Hazelnut Brew",39,49,59],["P015","Amerikano","Salted Caramel",39,49,59],["P016","Amerikano","Black Cappuccino",39,49,59],
  ["P017","Amerikano Twist","Red Velvet",49,59,69],["P018","Amerikano Twist","Orange Americano",49,59,69],["P019","Amerikano Twist","Lychee Americano",49,59,69],["P020","Amerikano Twist","Blueberry Americano",49,59,69],
  ["P021","Milktea","Original",39,49,59],["P022","Milktea","Okinawa",39,49,59],["P023","Milktea","Wintermelon",39,49,59],["P024","Milktea","Cookies & Cream",39,49,59],["P025","Milktea","Hokkaido",39,49,59],["P026","Milktea","Purple Taro",39,49,59],["P027","Milktea","Brown Sugar",39,49,59],["P028","Milktea","Chocolate",39,49,59],["P029","Milktea","Green Matcha",49,59,69],["P030","Milktea","Red Velvet",49,59,69],
  ["P031","Frappe","Java Chip",59,69,79],["P032","Frappe","Vanilla Espresso",59,69,79],["P033","Frappe","Wintermelon Espresso",59,69,79],["P034","Frappe","Okinawa Espresso",59,69,79],["P035","Frappe","Hokkaido Espresso",59,69,79],["P036","Frappe","Cheesecake",59,69,79],["P037","Frappe","Cookies & Cream",59,69,79],["P038","Frappe","Dark Choco",59,69,79],["P039","Frappe","Strawberry",59,69,79],["P040","Frappe","Matcha",59,69,79],["P041","Frappe","Red Velvet",59,69,79],
  ["P042","Fruit Series","Green Apple",39,49,59],["P043","Fruit Series","Blueberry",39,49,59],["P044","Fruit Series","Kiwi",39,49,59],["P045","Fruit Series","Lychee",39,49,59],["P046","Fruit Series","Strawberry",39,49,59],["P047","Fruit Series","Passionfruit",39,49,59],["P048","Fruit Series","Honey Peach",39,49,59],
  ["P049","Soda Series","Green Apple",49,59,69],["P050","Soda Series","Blueberry",49,59,69],["P051","Soda Series","Kiwi",49,59,69],["P052","Soda Series","Lychee",49,59,69],["P053","Soda Series","Strawberry",49,59,69],["P054","Soda Series","Passionfruit",49,59,69],["P055","Soda Series","Honey Peach",49,59,69]
];

const inventorySeed = [
  ["INV-001",'Cheesecake','Powder',"pcs",0,0,0],
  ["INV-002",'Cookies & Cream','Powder',"pcs",0,0,0],
  ["INV-003",'Cream Cheese','Powder',"pcs",0,0,0],
  ["INV-004",'Creamer','Powder',"pcs",0,0,0],
  ["INV-005",'Dark Chocolate','Powder',"pcs",0,0,0],
  ["INV-006",'Java Chip','Powder',"pcs",0,0,0],
  ["INV-007",'Matcha','Powder',"pcs",0,0,0],
  ["INV-008",'Red Velvet','Powder',"pcs",0,0,0],
  ["INV-009",'Whipping Cream','Powder',"pcs",0,0,0],
  ["INV-010",'Blueberry','Syrup',"pcs",0,0,0],
  ["INV-011",'Brown Sugar','Syrup',"pcs",0,0,0],
  ["INV-012",'Caramel','Syrup',"pcs",0,0,0],
  ["INV-013",'Caramel Drizzle','Syrup',"pcs",0,0,0],
  ["INV-014",'Chocolate','Syrup',"pcs",0,0,0],
  ["INV-015",'Green Apple','Syrup',"pcs",0,0,0],
  ["INV-016",'Hazelnut','Syrup',"pcs",0,0,0],
  ["INV-017",'Hokkaido','Syrup',"pcs",0,0,0],
  ["INV-018",'Kiwi','Syrup',"pcs",0,0,0],
  ["INV-019",'Lychee','Syrup',"pcs",0,0,0],
  ["INV-020",'Okinawa','Syrup',"pcs",0,0,0],
  ["INV-021",'Passion Fruit','Syrup',"pcs",0,0,0],
  ["INV-022",'Salted Caramel','Syrup',"pcs",0,0,0],
  ["INV-023",'Strawberry','Syrup',"pcs",0,0,0],
  ["INV-024",'Sweetener','Syrup',"pcs",0,0,0],
  ["INV-025",'Taro','Syrup',"pcs",0,0,0],
  ["INV-026",'Vanilla','Syrup',"pcs",0,0,0],
  ["INV-027",'White Chocolate','Syrup',"pcs",0,0,0],
  ["INV-028",'Wintermelon','Syrup',"pcs",0,0,0],
  ["INV-029",'Coffee','Tea & Coffee',"pcs",0,0,0],
  ["INV-030",'Tea','Tea & Coffee',"pcs",0,0,0],
  ["INV-031",'Nata','Other',"pcs",0,0,0],
  ["INV-032",'Pearl','Other',"pcs",0,0,0],
  ["INV-033",'Powdered Sugar','Other',"pcs",0,0,0],
  ["INV-034",'Sprite','Other',"pcs",0,0,0],
  ["INV-035",'Sugar','Other',"pcs",0,0,0],
  ["INV-036",'Condensed','Other',"pcs",0,0,0],
  ["INV-037",'12 oz','Cups',"pcs",0,0,0],
  ["INV-038",'16 oz','Cups',"pcs",0,0,0],
  ["INV-039",'22 oz','Cups',"pcs",0,0,0],
  ["INV-040",'Hot Cups','Cups',"pcs",0,0,0],
  ["INV-041",'Dome Lids','Packaging',"pcs",0,0,0],
  ["INV-042",'Regular Lids','Packaging',"pcs",0,0,0],
  ["INV-043",'Large Straws','Packaging',"pcs",0,0,0],
  ["INV-044",'Small (Paper & Plastic) Straws','Packaging',"pcs",0,0,0],
  ["INV-045",'Double Take-out Bags','Packaging',"pcs",0,0,0],
  ["INV-046",'Single Take-out Bags','Packaging',"pcs",0,0,0]
];

function makeInitialData(){
  return {
    version:4,
    nextIds:{user:3,product:56,inventory:47,sale:1,saleItem:1,expense:1,historical:1},
    users:[
      {id:1,username:"owner",password:"owner123",name:"Owner",role:"Owner",active:1},
      {id:2,username:"staff",password:"staff123",name:"Staff",role:"Staff",active:1}
    ],
    products:productSeed.map((p,i)=>({id:i+1,product_id:p[0],category:p[1],name:p[2],p12:p[3],p16:p[4],p22:p[5],active:1})),
    inventory:inventorySeed.map((p,i)=>({id:i+1,sku:p[0],name:p[1],category:p[2],unit:p[3],inside:Number(p[4])||0,outside:Number(p[5])||0,stock_in:Number(p[6])||0,adjustments:0,reorder:0})),
    sales:[],sale_items:[],expenses:[],historical:[],report_adjustments:[]
  };
}
function maxId(arr,key){return arr.reduce((m,x)=>Math.max(m,Number(x[key])||0),0)}
function ensureNextIds(){
  data.nextIds=data.nextIds||{};
  data.nextIds.user=Math.max(Number(data.nextIds.user)||1,maxId(data.users,"id")+1);
  data.nextIds.product=Math.max(Number(data.nextIds.product)||1,maxId(data.products,"id")+1);
  data.nextIds.inventory=Math.max(Number(data.nextIds.inventory)||1,maxId(data.inventory,"id")+1);
  data.nextIds.sale=Math.max(Number(data.nextIds.sale)||1,maxId(data.sales,"id")+1);
  data.nextIds.saleItem=Math.max(Number(data.nextIds.saleItem)||1,maxId(data.sale_items,"id")+1);
  data.nextIds.expense=Math.max(Number(data.nextIds.expense)||1,maxId(data.expenses,"id")+1);
  data.nextIds.historical=Math.max(Number(data.nextIds.historical)||1,maxId(data.historical,"id")+1);
}
function save(){fs.mkdirSync(path.dirname(dbPath),{recursive:true});const tmp=dbPath+".tmp";fs.writeFileSync(tmp,JSON.stringify(data,null,2),"utf8");if(fs.existsSync(dbPath))fs.unlinkSync(dbPath);fs.renameSync(tmp,dbPath)}
function normalizeLoaded(raw){
  const base=makeInitialData();
  data=Object.assign(base,raw||{});
  for(const k of ["users","products","inventory","sales","sale_items","expenses","historical","report_adjustments"]){if(!Array.isArray(data[k]))data[k]=[]}
  data.users=data.users.map(u=>({...u,name:u.name||u.username,active:u.active===undefined?1:u.active}));
  data.inventory=data.inventory.map(x=>({...x,sku:x.sku||("INV-"+String(x.id).padStart(3,"0")),inside:Number(x.inside??x.quantity??0)||0,outside:Number(x.outside??0)||0,reorder:Number(x.reorder??x.minimum_stock??0)||0,total:undefined}));
  data.historical=data.historical.map(x=>({...x,
    cash_sales:Number(x.cash_sales??0)||0,
    gcash_sales:Number(x.gcash_sales??0)||0,
    cash_expenses:Number(x.cash_expenses??0)||0,
    gcash_expenses:Number(x.gcash_expenses??0)||0,
    cups:Number(x.cups??((Number(x.cups12)||0)+(Number(x.cups16)||0)+(Number(x.cups22)||0)+(Number(x.hot_cups)||0)))||0
  }));
  ensureCatalog();
  ensureNextIds();
  save();
}
function ensureCatalog(){
  // Keep the product catalog exactly aligned with the current CoF/Tea menu.
  const oldProducts=new Map((data.products||[]).map(x=>[`${x.category}\u0000${x.name}`,x]));
  data.products=productSeed.map((p,i)=>{const old=oldProducts.get(`${p[1]}\u0000${p[2]}`)||{};return {id:i+1,product_id:p[0],category:p[1],name:p[2],p12:p[3],p16:p[4],p22:p[5],active:1,...old,id:i+1,product_id:p[0],category:p[1],name:p[2],p12:p[3],p16:p[4],p22:p[5],active:1}});
  const oldInv=new Map((data.inventory||[]).map(x=>[String(x.name).toLowerCase(),x]));
  data.inventory=inventorySeed.map((p,i)=>{const old=oldInv.get(String(p[1]).toLowerCase())||{};return {id:i+1,sku:p[0],name:p[1],category:p[2],unit:p[3],inside:Number(old.inside??p[4])||0,outside:Number(old.outside??p[5])||0,stock_in:Number(old.stock_in??p[6])||0,adjustments:Number(old.adjustments)||0,reorder:Number(old.reorder)||0}});
}
function open(){fs.mkdirSync(path.dirname(dbPath),{recursive:true});if(fs.existsSync(dbPath)){try{normalizeLoaded(JSON.parse(fs.readFileSync(dbPath,"utf8")))}catch(e){try{fs.copyFileSync(dbPath,dbPath+".corrupt-"+Date.now())}catch(_){} data=makeInitialData();save()}}else{data=makeInitialData();save()}}
open();
function close(){save()} function reopen(){open()} function nextId(t){const n=data.nextIds[t]||1;data.nextIds[t]=n+1;return n}
function today(){return new Date().toISOString().slice(0,10)} function timeNow(){return new Date().toTimeString().slice(0,8)} function txId(){return "TRX-"+Date.now().toString(36).toUpperCase()}

function login(username,password){const u=data.users.find(x=>String(x.username).trim().toLowerCase()===String(username).trim().toLowerCase()&&x.password===password&&x.active===1);return u?{id:u.id,username:u.username,name:u.name||u.username,role:u.role,active:u.active}:null}
function getAccount(userId){const u=data.users.find(x=>x.id===Number(userId));if(!u)throw new Error("Account not found.");return {id:u.id,username:u.username,name:u.name||u.username,role:u.role,active:u.active}}
function updateAccount({userId,username,name,oldPassword,newPassword}){const u=data.users.find(x=>x.id===Number(userId));if(!u)throw new Error("Account not found.");const un=String(username||u.username).trim();if(!un)throw new Error("Username is required.");if(data.users.some(x=>x.id!==u.id&&x.username.toLowerCase()===un.toLowerCase()))throw new Error("Username is already in use.");if(oldPassword!==undefined&&oldPassword!==""&&oldPassword!==u.password)throw new Error("Current password is incorrect.");if(newPassword!==undefined&&newPassword!==""){if(newPassword.length<6)throw new Error("New password must be at least 6 characters.");u.password=newPassword}u.username=un;u.name=String(name||un).trim();save();return getAccount(u.id)}
function changePassword({userId,oldPassword,newPassword}){return updateAccount({userId,oldPassword,newPassword})}

function getProducts(){return data.products.filter(x=>x.active===1).sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)).map(x=>({...x,hotAllowed:["Cafe Latte","Amerikano","Amerikano Twist","Milktea"].includes(x.category)}))}
function inventoryView(x){return {...x,total:Number(x.inside||0)+Number(x.outside||0)}}
function getInventory(){return data.inventory.map(inventoryView).sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name))}
function saveInventory({id,sku,item,category,unit,inside,outside,reorder}){const name=String(item||"").trim();if(!name)throw new Error("Item name is required.");let x=id?data.inventory.find(i=>i.id===Number(id)):null;if(!x&&sku)x=data.inventory.find(i=>i.sku===sku);if(!x){x={id:nextId("inventory"),sku:sku||("INV-"+String(Date.now()).slice(-8)),name,category:category||"Other",unit:unit||"pcs",inside:0,outside:0,stock_in:0,adjustments:0,reorder:0};data.inventory.push(x)}Object.assign(x,{name,category:category||x.category||"Other",unit:unit||x.unit||"pcs",inside:Math.max(0,Number(inside)||0),outside:Math.max(0,Number(outside)||0),reorder:Math.max(0,Number(reorder)||0)});save();return inventoryView(x)}
function deleteInventory(id){const n=Number(id);const idx=data.inventory.findIndex(x=>x.id===n||x.sku===String(id));if(idx<0)throw new Error("Inventory item not found.");const removed=data.inventory.splice(idx,1)[0];save();return {ok:true,id:removed.id,sku:removed.sku}}
function addInventory({name,category,quantity,unit,minimum_stock}){const clean=String(name||"").trim();if(!clean)throw new Error("Item name is required.");const q=Number(quantity)||0;let x=data.inventory.find(i=>i.name.toLowerCase()===clean.toLowerCase());if(!x){x={id:nextId("inventory"),sku:"INV-"+Date.now().toString(36).toUpperCase(),name:clean,category:category||"Other",unit:unit||"pcs",inside:0,outside:Math.max(0,q),stock_in:0,adjustments:0,reorder:Number(minimum_stock)||0};data.inventory.push(x)}else{x.outside=Math.max(0,Number(x.outside)||0)+q;x.reorder=Number(minimum_stock)||x.reorder}save();return getInventory()}
function setInventory({id,quantity}){const x=data.inventory.find(i=>i.id===Number(id));if(!x)throw new Error("Inventory item not found.");x.outside=Math.max(0,Number(quantity)||0);save();return getInventory()}

function cupName(size){return size==="12oz"?"12 oz":size==="16oz"?"16 oz":size==="22oz"?"22 oz":"Hot Cups"}
function cupInventory(size){return data.inventory.find(x=>x.name===cupName(size))}
function deductCup(stock,qty){let n=Number(qty)||0;const out=Math.min(Number(stock.outside)||0,n);stock.outside-=out;n-=out;if(n>0){stock.inside=Math.max(0,Number(stock.inside||0)-n)}}
function restoreCup(stock,qty){stock.outside=Number(stock.outside||0)+Number(qty||0)}
function validateAndDeductCups(items){const req={};for(const x of items){const q=Math.max(1,Number(x.qty)||1);const k=cupName(x.size);req[k]=(req[k]||0)+q}for(const [name,q] of Object.entries(req)){const s=data.inventory.find(i=>i.name===name);if(s&&Number(s.inside||0)+Number(s.outside||0)<q)throw new Error(`Not enough ${name} cups. Remaining: ${Number(s.inside||0)+Number(s.outside||0)}`)}for(const [name,q] of Object.entries(req)){const s=data.inventory.find(i=>i.name===name);if(s)deductCup(s,q)}return req}
function restoreSaleCups(saleId){for(const i of data.sale_items.filter(x=>x.sale_id===saleId)){const s=data.inventory.find(z=>z.name===cupName(i.size));if(s)restoreCup(s,i.quantity)}}
function normalizeSaleItems(items){return items.map(x=>({...x,qty:Math.max(1,Number(x.qty)||1),unit:Number(x.unit)||0,addonPrice:Number(x.addonPrice)||0,lineTotal:Number(x.lineTotal)||0}))}
function createSaleRecord({items,payment,cash,userId,existingSaleId=null}){
  items=normalizeSaleItems(items);if(!items.length)throw new Error("Order is empty.");
  const total=items.reduce((s,x)=>s+Number(x.lineTotal||0)*x.qty,0);const cashReceived=payment==="Cash"?Number(cash||0):0;if(payment==="Cash"&&cashReceived<total)throw new Error("Cash received is less than total.");
  const change=payment==="Cash"?cashReceived-total:0;const date=today(),time=timeNow();let sale;
  if(existingSaleId){sale=data.sales.find(s=>s.id===Number(existingSaleId));if(!sale)throw new Error("Sale not found.");restoreSaleCups(sale.id);data.sale_items=data.sale_items.filter(i=>i.sale_id!==sale.id);sale.sale_date=date;sale.sale_time=time;sale.subtotal=total;sale.total=total;sale.payment_method=payment;sale.cash_received=cashReceived;sale.change_amount=change;sale.user_id=userId?Number(userId):sale.user_id}
  else{sale={id:nextId("sale"),transaction_id:txId(),sale_date:date,sale_time:time,subtotal:total,total,payment_method:payment,cash_received:cashReceived,change_amount:change,user_id:userId?Number(userId):null,status:"completed"};data.sales.push(sale)}
  validateAndDeductCups(items);
  items.forEach(x=>data.sale_items.push({id:nextId("saleItem"),sale_id:sale.id,product_name:x.product,category:x.category||"",size:x.size||"",temperature:x.temperature||"Cold",quantity:x.qty,unit_price:x.unit,addon:x.addon||"No Add-on",addon_price:x.addonPrice||0,tutti_frutti:x.tutti?1:0,free_upsize:x.freeUpsize?1:0,original_size:x.originalSize||null,free_drink:x.freeDrink?1:0,customized:x.customized?1:0,line_total:x.lineTotal||0}));
  save();return {ok:true,transactionId:sale.transaction_id};
}
function saveSale(d){return createSaleRecord(d)}
function updateSale(d){return createSaleRecord({...d,existingSaleId:d.saleId})}
function getSales(date=today()){
  return data.sales.filter(s=>s.sale_date===date&&s.status==="completed").sort((a,b)=>b.id-a.id).map(s=>{const u=data.users.find(x=>x.id===s.user_id);const items=data.sale_items.filter(i=>i.sale_id===s.id);return {...s,username:u?.username||"",name:u?.name||"",items:items.map(i=>`${i.product_name} ${i.size} x${i.quantity}`).join(" | "),item_details:items.map(i=>({...i}))}})
}
function deleteSale(id){const sale=data.sales.find(s=>s.id===Number(id));if(!sale)throw new Error("Sale not found.");if(sale.status==="deleted")throw new Error("Sale is already deleted.");restoreSaleCups(sale.id);sale.status="deleted";save();return {ok:true}}

function getExpenses(date=today()){return data.expenses.filter(x=>x.expense_date===date).sort((a,b)=>b.id-a.id)}
function addExpense({date,category,description,amount,payment,notes,id}){const n=Number(amount)||0;if(n<=0)throw new Error("Expense amount must be greater than 0.");if(id){const x=data.expenses.find(e=>e.id===Number(id));if(!x)throw new Error("Expense not found.");Object.assign(x,{expense_date:date||x.expense_date,category:category||"General",description:description||"",amount:n,payment_method:payment||"Cash",notes:notes||""})}else data.expenses.push({id:nextId("expense"),expense_date:date||today(),category:category||"General",description:description||"",amount:n,payment_method:payment||"Cash",notes:notes||""});save();return {ok:true}}
function deleteExpense(id){const idx=data.expenses.findIndex(x=>x.id===Number(id));if(idx<0)throw new Error("Expense not found.");data.expenses.splice(idx,1);save();return {ok:true}}

function salesBreakdownForPrefix(prefix){
  const out={sales:0,cash:0,gcash:0};
  data.sales.filter(x=>x.status==="completed"&&x.sale_date.startsWith(prefix)).forEach(x=>{out.sales+=Number(x.total||0);if(x.payment_method==="Cash")out.cash+=Number(x.total||0);if(x.payment_method==="GCash")out.gcash+=Number(x.total||0)});
  data.historical.filter(x=>x.record_date.startsWith(prefix)).forEach(x=>{out.sales+=Number(x.sales||0);out.cash+=Number(x.cash_sales||0);out.gcash+=Number(x.gcash_sales||0)});
  return out;
}
function expenseBreakdownForPrefix(prefix){
  const out={expenses:0,cash:0,gcash:0};
  data.expenses.filter(x=>x.expense_date.startsWith(prefix)).forEach(x=>{out.expenses+=Number(x.amount||0);if(x.payment_method==="Cash")out.cash+=Number(x.amount||0);if(x.payment_method==="GCash")out.gcash+=Number(x.amount||0)});
  data.historical.filter(x=>x.record_date.startsWith(prefix)).forEach(x=>{out.expenses+=Number(x.expenses||0);out.cash+=Number(x.cash_expenses||0);out.gcash+=Number(x.gcash_expenses||0)});
  return out;
}
function sumSalesForPrefix(prefix){return salesBreakdownForPrefix(prefix).sales}
function sumExpensesForPrefix(prefix){return expenseBreakdownForPrefix(prefix).expenses}
function getDashboard(){const d=today(),m=d.slice(0,7),y=d.slice(0,4);const day=applyReportAdjustment("daily",d,reportBase("daily",d)),mon=applyReportAdjustment("monthly",m,reportBase("monthly",m)),yr=applyReportAdjustment("yearly",y,reportBase("yearly",y));return {daily:day.sales,expensesToday:day.expenses,netToday:day.net,monthly:mon.sales,expensesMonth:mon.expenses,netMonth:mon.net,yearly:yr.sales,expensesYear:yr.expenses,netYear:yr.net}}
function getReportAdjustment(type,key){return data.report_adjustments.find(x=>x.type===type&&x.key===key)||null}
function num(v){return Number(v)||0}
function applyReportAdjustment(type,key,base){const a=getReportAdjustment(type,key);if(!a)return base;return {...base,sales:num(base.sales)+num(a.sales_delta),cash:num(base.cash)+num(a.cash_delta),gcash:num(base.gcash)+num(a.gcash_delta),expenses:num(base.expenses)+num(a.expenses_delta),cups:num(base.cups)+num(a.cups_delta),net:(num(base.sales)+num(a.sales_delta))-(num(base.expenses)+num(a.expenses_delta))}}
function reportBase(type,key){
  const sales=salesBreakdownForPrefix(key),expenses=expenseBreakdownForPrefix(key);
  const base={sales:sales.sales,cash:sales.cash,gcash:sales.gcash,expenses:expenses.expenses,cups:0,net:sales.sales-expenses.expenses};
  if(type==='daily'){const daySales=data.sales.filter(s=>s.sale_date===key&&s.status==='completed');base.cups=data.sale_items.filter(i=>daySales.some(s=>s.id===i.sale_id)).reduce((n,i)=>n+num(i.quantity),0)+data.historical.filter(x=>x.record_date===key).reduce((n,x)=>n+num(x.cups),0)}
  return base;
}
function saveReportAdjustment({type,key,sales,cash,gcash,expenses,cups}){if(!['daily','monthly','yearly'].includes(type)||!key)throw new Error('Invalid report period.');const base=reportBase(type,key),vals={sales:num(sales),cash:num(cash),gcash:num(gcash),expenses:num(expenses),cups:num(cups)};let a=getReportAdjustment(type,key);const deltas={sales_delta:vals.sales-base.sales,cash_delta:vals.cash-base.cash,gcash_delta:vals.gcash-base.gcash,expenses_delta:vals.expenses-base.expenses,cups_delta:vals.cups-base.cups};const allZero=Object.values(deltas).every(v=>Math.abs(v)<0.000001);if(allZero){data.report_adjustments=data.report_adjustments.filter(x=>!(x.type===type&&x.key===key));}else{if(!a){a={id:Date.now()+Math.floor(Math.random()*1000),type,key};data.report_adjustments.push(a)}Object.assign(a,deltas, {updated_at:new Date().toISOString()});}save();return {ok:true,type,key,adjustment:getReportAdjustment(type,key)}}
function deleteReportAdjustment(type,key){const before=data.report_adjustments.length;data.report_adjustments=data.report_adjustments.filter(x=>!(x.type===type&&x.key===key));save();return {ok:true,deleted:data.report_adjustments.length!==before}}
function getMonthly(){const set=new Set();[...data.sales.map(x=>x.sale_date),...data.expenses.map(x=>x.expense_date),...data.historical.map(x=>x.record_date),...data.report_adjustments.filter(x=>x.type==='monthly').map(x=>x.key)].filter(Boolean).forEach(x=>set.add(x.slice(0,7)));return [...set].sort().reverse().map(month=>{const r=applyReportAdjustment('monthly',month,reportBase('monthly',month));return {month,sales:r.sales,cash:r.cash,gcash:r.gcash,expenses:r.expenses,expenseCash:0,expenseGcash:0,net:r.net,hasAdjustment:!!getReportAdjustment('monthly',month)}})}
function getYearly(){const set=new Set();[...data.sales.map(x=>x.sale_date),...data.expenses.map(x=>x.expense_date),...data.historical.map(x=>x.record_date),...data.report_adjustments.filter(x=>x.type==='yearly').map(x=>x.key)].filter(Boolean).forEach(x=>set.add(x.slice(0,4)));return [...set].sort().reverse().map(year=>{const r=applyReportAdjustment('yearly',year,reportBase('yearly',year));return {year,sales:r.sales,cash:r.cash,gcash:r.gcash,expenses:r.expenses,expenseCash:0,expenseGcash:0,net:r.net,hasAdjustment:!!getReportAdjustment('yearly',year)}})}
function addHistorical({date,sales,expenses,cashSales,gcashSales,cashExpenses,gcashExpenses,cups,notes}){if(!date)throw new Error("Date is required.");const cs=Number(cashSales)||0,gs=Number(gcashSales)||0,ce=Number(cashExpenses)||0,ge=Number(gcashExpenses)||0;const enteredSales=Number(sales)||0,enteredExpenses=Number(expenses)||0;const totalSales=(cs+gs)>0?(cs+gs):enteredSales;const totalExpenses=(ce+ge)>0?(ce+ge):enteredExpenses;data.historical.push({id:nextId("historical"),record_date:date,sales:totalSales,expenses:totalExpenses,cash_sales:cs,gcash_sales:gs,cash_expenses:ce,gcash_expenses:ge,cups:Number(cups)||0,notes:notes||""});save();return {ok:true}}
function getHistorical(){return [...data.historical].sort((a,b)=>String(b.record_date).localeCompare(String(a.record_date)))}
function getCupSummary(date=today()){
  const sales=data.sales.filter(s=>s.sale_date===date&&s.status==="completed");const sold={"12oz":0,"16oz":0,"22oz":0,"Hot Cups":0};
  data.sale_items.filter(i=>sales.some(s=>s.id===i.sale_id)).forEach(i=>{const k=["12oz","16oz","22oz"].includes(i.size)?i.size:"Hot Cups";sold[k]+=Number(i.quantity||0)});
  const historicalTotal=data.historical.filter(x=>x.record_date===date).reduce((n,x)=>n+Number(x.cups||0),0);
  const rows=["12oz","16oz","22oz","Hot Cups"].map(size=>{const inv=cupInventory(size);return {size,soldToday:sold[size],remaining:inv?Number(inv.inside||0)+Number(inv.outside||0):0}});
  return {rows,totalSold:rows.reduce((n,x)=>n+Number(x.soldToday||0),0)+historicalTotal,historicalSold:historicalTotal};
}
function getDailyTracker(){
  const dates=new Set([...data.sales.map(x=>x.sale_date),...data.expenses.map(x=>x.expense_date),...data.historical.map(x=>x.record_date),...data.report_adjustments.filter(x=>x.type==='daily').map(x=>x.key)].filter(Boolean));
  return [...dates].sort().reverse().map(date=>{const r=applyReportAdjustment('daily',date,reportBase('daily',date));return {date,sales:r.sales,cups:r.cups,expenses:r.expenses,net:r.net,gcash:r.gcash,cash:r.cash,hasAdjustment:!!getReportAdjustment('daily',date)}})}

module.exports={dbPath,login,getAccount,updateAccount,changePassword,getProducts,getInventory,saveInventory,deleteInventory,addInventory,setInventory,saveSale,updateSale,getSales,deleteSale,getExpenses,addExpense,deleteExpense,getDashboard,getMonthly,getYearly,addHistorical,getHistorical,getCupSummary,getDailyTracker,getReportAdjustment,saveReportAdjustment,deleteReportAdjustment,close,reopen,exportData:()=>{save();return fs.readFileSync(dbPath)}};
