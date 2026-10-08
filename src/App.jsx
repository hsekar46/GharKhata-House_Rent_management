import React, { useEffect, useMemo, useState } from "react";
import {
  Bell, Menu, Home, Users, Zap, WalletCards, MoreHorizontal, Plus,
  Search, ChevronRight, ReceiptText, Settings, BarChart3, UserPlus,
  X, Save, DoorOpen, Calculator, ArrowLeft, Wifi, CalendarDays, IndianRupee, Trash2, MessageCircle
} from "lucide-react";
import {
  initializeDatabase, getSettings, saveSettings, getTenants, addTenant,
  getPayments, addPayment, getElectricity, addElectricity, getWifi, addWifi,
  getExpenses, addExpense, deleteTenant
} from "./db/database";

const money = n => `NPR ${Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits: 2})}`;
const dateOnly = v => v ? new Date(v).toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"}) : "-";
const monthKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const todayInput = () => new Date().toISOString().slice(0,10);
function greeting(){const h=new Date().getHours();if(h<12)return"Good morning";if(h<17)return"Good afternoon";if(h<21)return"Good evening";return"Good night";}
const roomCount = t => Math.max(1, Number(t?.rooms ?? t?.no_of_rooms ?? 1));
const rentTotal = t => Number(t?.rent || 0) * roomCount(t);
const tenantCharges = (tenant,electricity,wifi) => {
  const bills=electricity.filter(x=>x.tenant_id===tenant.id);
  const internet=wifi.filter(x=>x.tenant_id===tenant.id);
  const electricityWater=bills.reduce((s,x)=>s+Number(x.total_amount ?? (Number(x.amount||0)+Number(x.water_amount||0))),0);
  const wifiTotal=internet.reduce((s,x)=>s+Number(x.total_amount||0),0);
  return {rent:rentTotal(tenant), electricityWater, wifiTotal, total:rentTotal(tenant)+electricityWater+wifiTotal};
};
const whatsappPhone = phone => {
  const digits=String(phone||"").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.startsWith("977")) return digits;
  if(digits.startsWith("0")) return "977"+digits.slice(1);
  if(digits.length===10) return "977"+digits;
  return digits;
};
function shareWhatsApp(tenant, due){
  const phone=whatsappPhone(tenant.phone);
  if(!phone){ window.alert("Please add a phone number for this tenant first."); return; }
  const amount=Math.max(0,Number(due||0));
  const message=`Dear ${tenant.name},\n\nYour total amount of NPR ${amount.toLocaleString("en-IN",{maximumFractionDigits:2})} is due, including rent, electricity, water, and internet charges.\n\nPlease make the payment at your earliest convenience.\n\nThank you.\nRakesh Poudel`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,"_blank");
}

function App(){
  const [ready,setReady]=useState(false),[page,setPage]=useState("home"),[settings,setSettings]=useState({appName:"Gharkhata",landlordName:"",houseName:"My House",developer:"Rakesh Poudel"});
  const [tenants,setTenants]=useState([]),[payments,setPayments]=useState([]),[electricity,setElectricity]=useState([]),[wifi,setWifi]=useState([]),[expenses,setExpenses]=useState([]);
  const [modal,setModal]=useState(null),[selectedTenant,setSelectedTenant]=useState(null),[search,setSearch]=useState("");
  async function refresh(){setSettings(await getSettings());setTenants(await getTenants());setPayments(await getPayments());setElectricity(await getElectricity());setWifi(await getWifi());setExpenses(await getExpenses());}
  useEffect(()=>{(async()=>{await initializeDatabase();await refresh();setReady(true)})()},[]);
  const currentMonth=monthKey();
  const totals=useMemo(()=>{
    const monthly=tenants.reduce((s,t)=>s+rentTotal(t),0);
    const collected=tenants.reduce((s,t)=>s+payments.filter(p=>p.tenant_id===t.id&&p.month===currentMonth).reduce((a,p)=>a+Number(p.amount||0),0),0);
    const pending=Math.max(0,monthly-collected);
    const elec=electricity.reduce((s,x)=>s+Number(x.total_amount ?? (Number(x.amount||0)+Number(x.water_amount||0))),0);
    const wifiTotal=wifi.reduce((s,x)=>s+Number(x.total_amount||0),0),exp=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
    return {monthly,collected,pending,elec,wifiTotal,exp,net:collected-exp};
  },[tenants,payments,electricity,wifi,expenses,currentMonth]);
  if(!ready)return <div className="splash"><div className="logoMark">GH</div><h1>Gharkhata</h1><p>Landlord management, made simple.</p></div>;
  const openTenant=t=>{setSelectedTenant(t);setPage("tenant-detail")};
  const openTenantBill=(t,type="electricity")=>{setSelectedTenant(t);setPage("tenant-detail");setModal(type)};
  return <div className="appShell">
    <header className="topbar"><div className="brand"><div className="miniLogo">GH</div><div><strong>{settings.appName||"Gharkhata"}</strong><small>{settings.houseName||"My House"}</small></div></div><div className="topActions"><button className="iconBtn"><Bell size={19}/></button><button className="iconBtn" onClick={()=>setPage("settings")}><Menu size={20}/></button></div></header>
    <main className="content">
      {page==="home"&&<HomePage settings={settings} totals={totals} tenants={tenants} payments={payments} onPage={setPage} onModal={setModal} onTenant={openTenant}/>} 
      {page==="tenants"&&<TenantsPage tenants={tenants} payments={payments} search={search} setSearch={setSearch} onModal={setModal} onTenant={openTenant} onTenantBill={openTenantBill}/>} 
      {page==="tenant-detail"&&selectedTenant&&<TenantDetails tenant={selectedTenant} payments={payments} electricity={electricity} wifi={wifi} onBack={()=>setPage("tenants")} onModal={setModal} onDelete={async()=>{if(!window.confirm(`Delete ${selectedTenant.name}?\n\nThis will also delete their rent payments, electricity/water bills, and WiFi/Internet records.`))return;await deleteTenant(selectedTenant.id);setSelectedTenant(null);await refresh();setPage("tenants")}}/>} 
      {page==="bills"&&<BillsPage tenants={tenants} electricity={electricity} wifi={wifi} onModal={setModal}/>} 
      {page==="expenses"&&<ExpensesPage expenses={expenses} onModal={setModal}/>} 
      {page==="more"&&<MorePage settings={settings} onSettings={()=>setPage("settings")} onPage={setPage}/>} 
      {page==="settings"&&<SettingsPage settings={settings} onSave={async p=>{await saveSettings(p);await refresh();setPage("home")}}/>}
      {page==="reports"&&<ReportsPage totals={totals} tenants={tenants}/>} {page==="rooms"&&<RoomsPage tenants={tenants} onTenant={openTenant}/>} 
    </main>
    <BottomNav page={page} setPage={setPage}/>
    {modal==="tenant"&&<TenantModal onClose={()=>setModal(null)} onSave={async t=>{await addTenant(t);await refresh();setModal(null)}}/>}
    {modal==="payment"&&<PaymentModal tenant={selectedTenant} payments={payments} electricity={electricity} wifi={wifi} onClose={()=>setModal(null)} onSave={async x=>{await addPayment(x);await refresh();setModal(null)}}/>}
    {modal==="electricity"&&<ElectricityModal tenants={tenants} selectedTenant={selectedTenant} onClose={()=>setModal(null)} onSave={async x=>{await addElectricity(x);await refresh();setModal(null)}}/>}
    {modal==="wifi"&&<WifiModal tenants={tenants} selectedTenant={selectedTenant} onClose={()=>setModal(null)} onSave={async x=>{await addWifi(x);await refresh();setModal(null)}}/>}
    {modal==="expense"&&<ExpenseModal onClose={()=>setModal(null)} onSave={async x=>{await addExpense(x);await refresh();setModal(null)}}/>}
  </div>
}

function HomePage({settings,totals,tenants,payments,onPage,onModal,onTenant}){return <section>
  <div className="welcome"><div><span>{greeting()},</span><h2>{settings.landlordName||"Landlord"} 👋</h2></div><div className="datePill">{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</div></div>
  <div className="heroCard"><div className="heroLabel">Total Monthly Rent</div><div className="heroValue">{money(totals.monthly)}</div><div className="heroStats"><span>Collected <b>{money(totals.collected)}</b></span><span>Pending <b>{money(totals.pending)}</b></span></div><div className="heroButtons"><button onClick={()=>onModal("tenant")}><UserPlus size={17}/>Tenant</button><button onClick={()=>onModal("electricity")}><Zap size={17}/>Bill</button><button onClick={()=>onPage("reports")}><BarChart3 size={17}/>Reports</button></div></div>
  <div className="quickGrid"><Quick icon={<Users/>} label="Tenants" value={tenants.length} onClick={()=>onPage("tenants")}/><Quick icon={<DoorOpen/>} label="Rooms" value={tenants.reduce((s,t)=>s+roomCount(t),0)} onClick={()=>onPage("rooms")}/><Quick icon={<Zap/>} label="Elec + Water" value={money(totals.elec)} onClick={()=>onPage("bills")}/><Quick icon={<Wifi/>} label="WiFi" value={money(totals.wifiTotal)} onClick={()=>onPage("bills")}/></div>
  <Card title="Quick Overview" action="See all" onAction={()=>onPage("reports")}><div className="overviewRows"><Stat icon="🏠" label="Total Rooms" value={tenants.reduce((s,t)=>s+roomCount(t),0)}/><Stat icon="🟢" label="Occupied" value={tenants.length}/><Stat icon="🟡" label="Rent Pending" value={tenants.filter(t=>{const p=paymentsFor(t.id,payments,monthKey());return p<rentTotal(t)}).length}/><Stat icon="📶" label="WiFi Total" value={money(totals.wifiTotal)}/></div></Card>
  <Card title="Recent Tenants" action="View all" onAction={()=>onPage("tenants")}>{tenants.slice(0,3).map(t=><button className="listRow listButton" key={t.id} onClick={()=>onTenant(t)}><div className="avatar">{t.name?.charAt(0)||"T"}</div><div className="grow"><b>{t.name}</b><small>{roomCount(t)} room(s) · {money(rentTotal(t))}/month</small></div><ChevronRight size={17}/></button>)}{!tenants.length&&<Empty text="Add your first tenant to get started."/>}</Card>
</section>}
function paymentsFor(id,payments,month){return payments.filter(p=>p.tenant_id===id&&p.month===month).reduce((s,p)=>s+Number(p.amount||0),0)}
function Quick({icon,label,value,onClick}){return <button className="quickCard" onClick={onClick}><span className="quickIcon">{icon}</span><small>{label}</small><b>{value}</b></button>}
function Card({title,action,onAction,children}){return <div className="card"><div className="cardHead"><h3>{title}</h3>{action&&<button onClick={onAction}>{action}</button>}</div>{children}</div>}
function Stat({icon,label,value}){return <div className="statRow"><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>}
function Status({text}){return <span className={`status ${text.toLowerCase().replaceAll(" ","-")}`}>{text}</span>}
function Empty({text}){return <div className="empty">{text}</div>}

function TenantsPage({tenants,payments,search,setSearch,onModal,onTenant,onTenantBill}){const list=tenants.filter(t=>`${t.name} ${t.rooms} ${t.phone}`.toLowerCase().includes(search.toLowerCase()));const month=monthKey();return <section><PageTitle title="Tenants" subtitle={`${tenants.length} people`} action={<button className="primary small" onClick={()=>onModal("tenant")}><Plus size={16}/>Add</button>}/><div className="search"><Search size={18}/><input placeholder="Search tenant or phone..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filterPills"><span className="active">All ({tenants.length})</span><span>Occupied ({tenants.length})</span><span>Pending ({tenants.filter(t=>paymentsFor(t.id,payments,month)<rentTotal(t)).length})</span></div><Card title="Tenant list">{list.map(t=>{const paid=paymentsFor(t.id,payments,month),monthlyRent=rentTotal(t),pending=Math.max(0,monthlyRent-paid);return <div className="tenantCard tenantButton" key={t.id} role="button" tabIndex={0} onClick={()=>onTenant(t)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onTenant(t)}}}><div className="avatar large">{t.name.charAt(0)}</div><div className="grow"><b>{t.name}</b><small>{roomCount(t)} room(s) · {t.phone||"No phone"}</small><strong>{money(monthlyRent)} <em>/ month</em></strong><small className={pending?"pendingText":"paidText"}>{pending?`Pending rent ${money(pending)}`:`Rent paid ${money(paid)}`}</small></div><Status text={pending?"Pending":"Paid"}/><button type="button" className="tenantBillBtn" onClick={e=>{e.stopPropagation();onTenantBill(t,"electricity")}}><Zap size={14}/>Bill</button><ChevronRight size={18}/></div>})}{!list.length&&<Empty text="No tenants found."/>}</Card></section>}

function TenantDetails({tenant,payments,electricity,wifi,onBack,onModal,onDelete}){
  const tenantPayments=payments.filter(p=>p.tenant_id===tenant.id);
  const bills=tenantCharges(tenant,electricity,wifi);
  const totalPaid=tenantPayments.reduce((s,p)=>s+Number(p.amount||0),0);
  const remaining=Math.max(0,bills.total-totalPaid);
  const month=monthKey();
  const paidThisMonth=tenantPayments.filter(p=>p.month===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const pendingRent=Math.max(0,bills.rent-paidThisMonth);
  const tenantBills=electricity.filter(x=>x.tenant_id===tenant.id);
  const tenantWifi=wifi.filter(x=>x.tenant_id===tenant.id);
  return <section>
    <button className="backBtn" onClick={onBack}><ArrowLeft size={18}/>Tenant list</button>
    <div className="detailHero"><div className="avatar large">{tenant.name.charAt(0)}</div><div className="grow"><h1>{tenant.name}</h1><p>{roomCount(tenant)} room(s) · {tenant.phone||"No phone"}</p></div></div>
    <div className="detailGrid"><Metric title="Room Rent" value={money(bills.rent)} sub={`${money(tenant.rent)} × ${roomCount(tenant)} room(s)`}/><Metric title="Total Paid" value={money(totalPaid)} sub="All recorded payments"/><Metric title="Remaining" value={money(remaining)} sub="Overall amount due"/><Metric title="Electricity + Water" value={money(bills.electricityWater)} sub={`${tenantBills.length} bill(s)`}/><Metric title="WiFi / Internet" value={money(bills.wifiTotal)} sub={`${tenantWifi.length} record(s)`}/></div>
    <div className="totalDueCard"><div><small>Total amount to pay</small><h2>{money(remaining)}</h2><span>Total {money(bills.total)} − Paid {money(totalPaid)}</span></div><ReceiptText size={28}/></div>
    <div className="detailActions"><button className="primary" onClick={()=>onModal("payment")}><IndianRupee size={17}/>Add Payment</button><button className="secondary" onClick={()=>onModal("electricity")}><Zap size={17}/>Add Bill</button><button className="secondary" onClick={()=>onModal("wifi")}><Wifi size={17}/>Add WiFi</button></div>
    <button className="whatsappBtn" onClick={()=>shareWhatsApp(tenant,remaining)}><MessageCircle size={18}/>Share Due Amount on WhatsApp</button>
    <Card title={`Payment history · ${tenantPayments.length} payment(s)`}>
      <div className="balanceRow"><span>Total bill</span><b>{money(bills.total)}</b></div>
      <div className="balanceRow"><span>Total paid</span><b className="paidText">{money(totalPaid)}</b></div>
      <div className="balanceRow"><span>Paid this month</span><b>{money(paidThisMonth)}</b></div>
      <div className="balanceRow"><span>Monthly room rent</span><b>{money(bills.rent)}</b></div>
      <div className="balanceRow total"><span>Remaining amount</span><b className="pendingText">{money(remaining)}</b></div>
      {tenantPayments.length?tenantPayments.map(p=><div className="historyRow" key={p.id}><div><b>{money(p.amount)}</b><small>Payment · {p.month}</small></div><span>{dateOnly(p.date)}</span></div>):<Empty text="No payments recorded yet."/>}
    </Card>
    <Card title="Electricity + Water"><div className="balanceRow total"><span>Total person-wise bill</span><b>{money(bills.electricityWater)}</b></div>{tenantBills.map(x=><div className="historyRow" key={x.id}><div><b>{money(x.total_amount ?? Number(x.amount||0)+Number(x.water_amount||0))}</b><small>{x.units} units × {money(x.rate)} · Water {money(x.water_amount||0)}{x.note?` · ${x.note}`:""}</small></div><span>{dateOnly(x.date)}</span></div>)}{!tenantBills.length&&<Empty text="No electricity or water bills for this tenant."/>}</Card>
    <Card title="WiFi / Internet"><div className="balanceRow total"><span>Total WiFi / Internet</span><b>{money(bills.wifiTotal)}</b></div>{tenantWifi.map(x=><div className="historyRow" key={x.id}><div><b>{x.months} month{x.months===1?"":"s"} · {money(x.amount)}/month</b><small>Total {money(x.total_amount)}{x.note?` · ${x.note}`:""}</small></div><span>{dateOnly(x.date)}</span></div>)}{!tenantWifi.length&&<Empty text="No WiFi / Internet bills for this tenant."/>}</Card>
    <button className="deleteTenantBtn" onClick={onDelete}><Trash2 size={17}/>Delete Tenant</button>
  </section>
}

function Metric({title,value,sub}){return <div className="metricCard"><small>{title}</small><h2>{value}</h2><span>{sub}</span></div>}

function BillsPage({tenants,electricity,wifi,onModal}){const total=electricity.reduce((s,x)=>s+Number(x.total_amount ?? Number(x.amount||0)+Number(x.water_amount||0)),0),wifiTotal=wifi.reduce((s,x)=>s+Number(x.total_amount||0),0);return <section><PageTitle title="Bills" subtitle="Electricity, water and WiFi" action={<button className="primary small" onClick={()=>onModal("electricity")}><Plus size={16}/>Add Bill</button>} /><div className="reportGrid"><div><small>Electricity + Water</small><b>{money(total)}</b></div><div><small>WiFi / Internet</small><b>{money(wifiTotal)}</b></div></div><Card title="Electricity + Water History" action="Add bill" onAction={()=>onModal("electricity")}>{electricity.map(x=><div className="listRow" key={x.id}><div className="billIcon small"><Zap size={17}/></div><div className="grow"><b>{tenants.find(t=>t.id===x.tenant_id)?.name||"Tenant"}</b><small>{x.units} units × {money(x.rate)}/unit · Water {money(x.water_amount||0)}</small>{x.note&&<small className="noteText">📝 {x.note}</small>}</div><strong>{money(x.total_amount ?? Number(x.amount||0)+Number(x.water_amount||0))}</strong></div>)}{!electricity.length&&<Empty text="No electricity bills yet."/>}</Card><Card title="WiFi / Internet History" action="Add WiFi" onAction={()=>onModal("wifi")}>{wifi.map(x=><div className="listRow" key={x.id}><div className="billIcon small"><Wifi size={17}/></div><div className="grow"><b>{tenants.find(t=>t.id===x.tenant_id)?.name||"Tenant"}</b><small>{x.months} month{x.months===1?"":"s"} × {money(x.amount)}/month</small>{x.note&&<small className="noteText">📝 {x.note}</small>}</div><strong>{money(x.total_amount)}</strong></div>)}{!wifi.length&&<Empty text="No WiFi / Internet records yet."/>}</Card></section>}
function ExpensesPage({expenses,onModal}){const total=expenses.reduce((s,x)=>s+Number(x.amount||0),0);return <section><PageTitle title="Expenses" subtitle="Household & maintenance costs" action={<button className="primary small" onClick={()=>onModal("expense")}><Plus size={16}/>Add</button>}/><div className="metricCard"><small>Total expenses</small><h2>{money(total)}</h2><span>This device's saved records</span></div><Card title="Expense History">{expenses.map(x=><div className="listRow" key={x.id}><div className="expenseIcon"><ReceiptText size={18}/></div><div className="grow"><b>{x.title}</b><small>{dateOnly(x.date)}</small></div><strong>{money(x.amount)}</strong></div>)}{!expenses.length&&<Empty text="No expenses recorded."/>}</Card></section>}
function ReportsPage({totals,tenants}){return <section><PageTitle title="Reports" subtitle="Your house at a glance"/><div className="reportGrid"><div><small>Monthly rent</small><b>{money(totals.monthly)}</b></div><div><small>Collected</small><b>{money(totals.collected)}</b></div><div><small>Pending</small><b>{money(totals.pending)}</b></div><div><small>Elec + Water</small><b>{money(totals.elec)}</b></div><div><small>WiFi</small><b>{money(totals.wifiTotal)}</b></div><div><small>Expenses</small><b>{money(totals.exp)}</b></div></div><Card title="Collection status"><div className="donutWrap"><div className="donut"><b>{tenants.length}</b><small>Tenants</small></div><div className="legend"><span>🟢 Paid</span><span>🟡 Pending</span></div></div></Card></section>}
function RoomsPage({tenants,onTenant}){return <section><PageTitle title="Rooms" subtitle={`${tenants.reduce((s,t)=>s+roomCount(t),0)} rooms across ${tenants.length} tenants`}/><div className="roomGrid">{tenants.map(t=><button className="roomCard roomButton" key={t.id} onClick={()=>onTenant(t)}><div className="roomTop"><span>No. of rooms</span><b>{roomCount(t)}</b></div><DoorOpen/><strong>{t.name}</strong><small>{money(rentTotal(t))}/month</small><Status text="Occupied"/></button>)}{!tenants.length&&<Empty text="Add tenants to see room allocation."/>}</div></section>}

function MorePage({settings,onSettings,onPage}){return <section><PageTitle title="More" subtitle="Manage your house"/><div className="menuCard">{[["🏠","Rooms","View occupancy",()=>onPage("rooms")],["📊","Reports","Income and expenses",()=>onPage("reports")],["⚙️","Settings","House, profile and preferences",onSettings],["💾","Backup & Restore","Keep a copy of your local data",()=>alert("Backup/restore can be added as the next release.")],["ℹ️","About Gharkhata",`Developed by ${settings.developer||"Rakesh Poudel"}`,()=>{}]].map(([i,t,s,fn])=><button className="menuRow" onClick={fn} key={t}><span className="menuEmoji">{i}</span><div className="grow"><b>{t}</b><small>{s}</small></div><ChevronRight/></button>)}</div></section>}
function SettingsPage({settings,onSave}){const [form,setForm]=useState(settings);return <section><PageTitle title="Settings" subtitle="Personalize Gharkhata"/><div className="profileCard"><div className="profileAvatar">{(form.landlordName||"R").charAt(0).toUpperCase()}</div><div><b>{form.landlordName||"Landlord"}</b><small>{form.houseName||"My House"}</small></div></div><Card title="House information"><Field label="Your name" value={form.landlordName||""} onChange={v=>setForm({...form,landlordName:v})} placeholder="e.g. Rakesh Poudel"/><Field label="House / property name" value={form.houseName||""} onChange={v=>setForm({...form,houseName:v})} placeholder="e.g. My House"/><Field label="App display name" value={form.appName||"Gharkhata"} onChange={v=>setForm({...form,appName:v})}/></Card><button className="primary wide" onClick={()=>onSave(form)}><Save size={18}/>Save settings</button><p className="developer">Gharkhata · Developed by {form.developer||"Rakesh Poudel"}</p></section>}

function TenantModal({onClose,onSave}){const [f,setF]=useState({name:"",phone:"",rooms:"1",rent:""});return <Modal title="Add Tenant" onClose={onClose}><Field label="Full name *" value={f.name} onChange={v=>setF({...f,name:v})} placeholder="e.g. Ramesh Sharma"/><Field label="Phone number" value={f.phone} onChange={v=>setF({...f,phone:v})} placeholder="98XXXXXXXX"/><Field label="No. of rooms *" value={f.rooms} onChange={v=>setF({...f,rooms:v})} placeholder="2"/><Field label="Rent per room *" value={f.rent} onChange={v=>setF({...f,rent:v})} placeholder="5000"/><div className="calcBox"><Calculator/><div><small>Monthly room rent</small><b>{money(Number(f.rent||0)*Math.max(1,Number(f.rooms||1)))}</b><span>{money(f.rent||0)} × {Math.max(1,Number(f.rooms||1))} room(s)</span></div></div><button className="primary wide" disabled={!f.name||!f.rooms||Number(f.rooms)<=0||!f.rent||Number(f.rent)<0} onClick={()=>onSave({...f,rooms:Math.max(1,Number(f.rooms)),rent:Number(f.rent)})}><Save size={18}/>Save Tenant</button></Modal>}

function PaymentModal({tenant,payments=[],electricity=[],wifi=[],onClose,onSave}){const [f,setF]=useState({amount:"",month:monthKey(),date:todayInput()});const bill=tenantCharges(tenant,electricity,wifi);const paid=payments.filter(p=>p.tenant_id===tenant?.id).reduce((s,p)=>s+Number(p.amount||0),0);const currentDue=Math.max(0,bill.total-paid);const entered=Math.max(0,Number(f.amount||0));const after=Math.max(0,currentDue-entered);return <Modal title={`Add Payment · ${tenant?.name||"Tenant"}`} onClose={onClose}><div className="infoBox"><div className="paymentSummary"><span>Total bill <b>{money(bill.total)}</b></span><span>Already paid <b>{money(paid)}</b></span><span>Remaining <b className={currentDue?"pendingText":"paidText"}>{money(currentDue)}</b></span></div><small className="modalHint">Payment is deducted from the complete rent + electricity + water + internet bill.</small></div><Field label="Amount paid *" value={f.amount} onChange={v=>setF({...f,amount:v})} placeholder="6000"/><div className="calcBox"><Calculator/><div><small>Remaining after this payment</small><b>{money(after)}</b><span>{money(currentDue)} − {money(entered)}</span></div></div><Field label="Payment month" value={f.month} onChange={v=>setF({...f,month:v})}/><Field label="Payment date" value={f.date} onChange={v=>setF({...f,date:v})}/><button className="primary wide" disabled={!f.amount||Number(f.amount)<=0||Number(f.amount)>currentDue} onClick={()=>onSave({...f,tenant_id:tenant.id,amount:Number(f.amount)})}><Save size={18}/>Save Payment</button>{Number(f.amount)>currentDue&&<small className="errorText">Payment cannot be greater than the remaining amount.</small>}</Modal>}

function ElectricityModal({tenants,selectedTenant,onClose,onSave}){const [f,setF]=useState({tenant_id:selectedTenant?.id||tenants[0]?.id||"",units:"",rate:"",water_amount:"",note:"",date:todayInput()});const electricityAmount=Number(f.units||0)*Number(f.rate||0),waterAmount=Number(f.water_amount||0),total=electricityAmount+waterAmount;return <Modal title="Add Electricity & Water Bill" onClose={onClose}><label className="field"><span>Tenant / Person *</span><select value={f.tenant_id} onChange={e=>setF({...f,tenant_id:e.target.value})}>{tenants.map(t=><option key={t.id} value={t.id}>{t.name} · {roomCount(t)} room(s)</option>)}</select></label><div className="sectionLabel"><Zap size={15}/> Electricity</div><Field label="Units consumed *" value={f.units} onChange={v=>setF({...f,units:v})} placeholder="e.g. 350"/><Field label="Rate per unit *" value={f.rate} onChange={v=>setF({...f,rate:v})} placeholder="e.g. 12"/><div className="miniBill"><span>Electricity amount</span><b>{money(electricityAmount)}</b><small>{f.units||0} × {money(f.rate||0)}</small></div><div className="sectionLabel waterLabel">💧 Water Bill</div><Field label="Water bill amount" value={f.water_amount} onChange={v=>setF({...f,water_amount:v})} placeholder="e.g. 300"/><Field label="Bill date" value={f.date} onChange={v=>setF({...f,date:v})}/><label className="field"><span>Note</span><textarea rows="3" value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="Write any note about this bill..."></textarea></label><div className="calcBox"><Calculator/><div><small>Total bill amount</small><b>{money(total)}</b><span>Electricity {money(electricityAmount)} + Water {money(waterAmount)}</span></div></div><button className="primary wide" disabled={!f.tenant_id||!f.units||!f.rate} onClick={()=>onSave({...f,units:Number(f.units),rate:Number(f.rate),water_amount:Number(f.water_amount||0)})}><Save size={18}/>Save Bill</button></Modal>}
function WifiModal({tenants,selectedTenant,onClose,onSave}){const [f,setF]=useState({tenant_id:selectedTenant?.id||tenants[0]?.id||"",months:"1",amount:"",note:"",date:todayInput()});const total=Number(f.months||0)*Number(f.amount||0);return <Modal title="Add WiFi / Internet" onClose={onClose}><label className="field"><span>Tenant / Person *</span><select value={f.tenant_id} onChange={e=>setF({...f,tenant_id:e.target.value})}>{tenants.map(t=><option key={t.id} value={t.id}>{t.name} · {roomCount(t)} room(s)</option>)}</select></label><Field label="For how many months? *" value={f.months} onChange={v=>setF({...f,months:v})} placeholder="1"/><Field label="Amount per month *" value={f.amount} onChange={v=>setF({...f,amount:v})} placeholder="1000"/><Field label="Bill date" value={f.date} onChange={v=>setF({...f,date:v})}/><label className="field"><span>Note</span><textarea rows="3" value={f.note} onChange={e=>setF({...f,note:e.target.value})} placeholder="e.g. WorldLink, 3 months prepaid"></textarea></label><div className="calcBox"><Wifi/><div><small>Total WiFi / Internet amount</small><b>{money(total)}</b><span>{f.months||0} month(s) × {money(f.amount||0)}</span></div></div><button className="primary wide" disabled={!f.tenant_id||!f.months||!f.amount} onClick={()=>onSave({...f,months:Number(f.months),amount:Number(f.amount)})}><Save size={18}/>Save WiFi Bill</button></Modal>}
function ExpenseModal({onClose,onSave}){const [f,setF]=useState({title:"",amount:""});return <Modal title="Add Expense" onClose={onClose}><Field label="Expense title *" value={f.title} onChange={v=>setF({...f,title:v})} placeholder="e.g. Plumbing repair"/><Field label="Amount *" value={f.amount} onChange={v=>setF({...f,amount:v})} placeholder="1000"/><button className="primary wide" disabled={!f.title||!f.amount} onClick={()=>onSave({...f,amount:Number(f.amount)})}><Save size={18}/>Save Expense</button></Modal>}
function Modal({title,onClose,children}){return <div className="modalBackdrop"><div className="modal"><div className="modalHead"><h2>{title}</h2><button className="iconBtn" onClick={onClose}><X/></button></div>{children}</div></div>}
function Field({label,value,onChange,placeholder}){return <label className="field"><span>{label}</span><input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>}
function PageTitle({title,subtitle,action}){return <div className="pageTitle"><div><h1>{title}</h1><small>{subtitle}</small></div>{action}</div>}
function BottomNav({page,setPage}){const items=[["home",Home,"Home"],["tenants",Users,"Tenants"],["bills",Zap,"Bills"],["expenses",WalletCards,"Expenses"],["more",MoreHorizontal,"More"]];return <nav className="bottomNav">{items.map(([id,I,label])=><button className={page===id?"active":""} onClick={()=>setPage(id)} key={id}><I size={19}/><span>{label}</span></button>)}</nav>}
export default App;
