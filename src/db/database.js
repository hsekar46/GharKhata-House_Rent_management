import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);
const DB_NAME = "gharkhata";
let db = null;

const defaultSettings = {
  appName: "Gharkhata",
  landlordName: "",
  houseName: "My House",
  currency: "NPR",
  developer: "Rakesh Poudel"
};

const demoTenants = [
  { id: "t1", name: "Ramesh Sharma", phone: "9801234567", rooms: 1, rent: 5000, status: "pending" },
  { id: "t2", name: "Sita Gurung", phone: "9812345678", rooms: 1, rent: 6500, status: "pending" },
  { id: "t3", name: "Hari Adhikari", phone: "9823456789", rooms: 1, rent: 5500, status: "pending" }
];

const native = () => Capacitor.isNativePlatform();
const uid = () => crypto.randomUUID();

const browserDefaults = () => ({
  settings: defaultSettings,
  tenants: [],
  payments: [],
  electricity: [],
  wifi: [],
  expenses: []
});

export async function initializeDatabase() {
  if (!native()) {
    const existing = localStorage.getItem("gharkhata_data");
    if (!existing) {
      localStorage.setItem("gharkhata_data", JSON.stringify({
        ...browserDefaults(),
        tenants: demoTenants
      }));
    } else {
      // Add newly introduced collections without destroying existing local data.
      const data = JSON.parse(existing);
      if (!Array.isArray(data.payments)) data.payments = [];
      if (!Array.isArray(data.wifi)) data.wifi = [];
      if (!Array.isArray(data.electricity)) data.electricity = [];
      if (!Array.isArray(data.expenses)) data.expenses = [];
      data.tenants = (data.tenants || []).map(t => ({ ...t, rooms: Math.max(1, Number(t.rooms ?? t.no_of_rooms ?? 1)) }));
      data.settings = { ...defaultSettings, ...(data.settings || {}) };
      localStorage.setItem("gharkhata_data", JSON.stringify(data));
    }
    return;
  }

  if (!db) {
    db = await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
    await db.open();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        room TEXT,
        rooms REAL DEFAULT 1,
        rent REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        date TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS electricity (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        units REAL NOT NULL,
        rate REAL NOT NULL,
        amount REAL NOT NULL,
        water_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        note TEXT,
        date TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wifi (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        months REAL NOT NULL,
        amount REAL NOT NULL,
        total_amount REAL NOT NULL,
        note TEXT,
        date TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL
      );
    `);

    // Safe migrations for databases created by earlier Gharkhata versions.
    try { await db.execute("ALTER TABLE electricity ADD COLUMN water_amount REAL DEFAULT 0"); } catch {}
    try { await db.execute("ALTER TABLE electricity ADD COLUMN total_amount REAL DEFAULT 0"); } catch {}
    try { await db.execute("ALTER TABLE electricity ADD COLUMN note TEXT"); } catch {}
    try { await db.execute("ALTER TABLE tenants ADD COLUMN rooms REAL DEFAULT 1"); } catch {}
    try { await db.run("UPDATE tenants SET rooms = 1 WHERE rooms IS NULL OR rooms <= 0"); } catch {}

    const count = await db.query("SELECT COUNT(*) AS count FROM settings");
    if (!count.values?.[0]?.count) {
      for (const [key, value] of Object.entries(defaultSettings)) {
        await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
      }
      for (const t of demoTenants) {
        await db.run(
          "INSERT INTO tenants (id,name,phone,room,rooms,rent,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
          [t.id, t.name, t.phone, "", t.rooms, t.rent, t.status, new Date().toISOString()]
        );
      }
    }
  }
}

function browserData() {
  return JSON.parse(localStorage.getItem("gharkhata_data") || JSON.stringify(browserDefaults()));
}

function saveBrowser(data) {
  localStorage.setItem("gharkhata_data", JSON.stringify(data));
  return data;
}

export async function getSettings() {
  if (!native()) return browserData().settings;
  const r = await db.query("SELECT key,value FROM settings");
  return Object.fromEntries((r.values || []).map(x => [x.key, x.value]));
}

export async function saveSettings(patch) {
  if (!native()) {
    const d = browserData();
    d.settings = { ...d.settings, ...patch };
    saveBrowser(d);
    return d.settings;
  }
  for (const [key, value] of Object.entries(patch)) {
    await db.run("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", [key, String(value)]);
  }
  return getSettings();
}

export async function getTenants() {
  if (!native()) return browserData().tenants.map(t => ({ ...t, rooms: Math.max(1, Number(t.rooms ?? t.no_of_rooms ?? 1)) }));
  const r = await db.query("SELECT * FROM tenants ORDER BY name");
  return (r.values || []).map(t => ({ ...t, rooms: Math.max(1, Number(t.rooms ?? 1)) }));
}

export async function addTenant(t) {
  const item = {
    ...t,
    id: uid(),
    status: "pending",
    created_at: new Date().toISOString()
  };
  if (!native()) {
    const d = browserData();
    d.tenants.push(item);
    saveBrowser(d);
    return item;
  }
  await db.run(
    "INSERT INTO tenants (id,name,phone,room,rooms,rent,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
    [item.id, item.name, item.phone, "", Math.max(1, Number(item.rooms ?? item.no_of_rooms ?? 1)), Number(item.rent || 0), item.status, item.created_at]
  );
  return item;
}

export async function getPayments() {
  if (!native()) return browserData().payments;
  const r = await db.query("SELECT * FROM payments ORDER BY date DESC");
  return r.values || [];
}

export async function addPayment(x) {
  const item = {
    id: uid(),
    tenant_id: x.tenant_id,
    amount: Number(x.amount || 0),
    month: x.month || new Date().toISOString().slice(0, 7),
    date: x.date || new Date().toISOString().slice(0, 10)
  };
  if (!native()) {
    const d = browserData();
    d.payments.push(item);
    saveBrowser(d);
    return item;
  }
  await db.run(
    "INSERT INTO payments (id,tenant_id,amount,month,date) VALUES (?,?,?,?,?)",
    [item.id, item.tenant_id, item.amount, item.month, item.date]
  );
  return item;
}

export async function getElectricity() {
  if (!native()) return browserData().electricity;
  const r = await db.query("SELECT * FROM electricity ORDER BY date DESC");
  return r.values || [];
}

export async function addElectricity(x) {
  const amount = Number(x.units || 0) * Number(x.rate || 0);
  const water_amount = Number(x.water_amount || 0);
  const item = {
    ...x,
    id: uid(),
    amount,
    water_amount,
    total_amount: amount + water_amount,
    note: x.note || "",
    date: x.date || new Date().toISOString().slice(0, 10)
  };
  if (!native()) {
    const d = browserData();
    d.electricity.push(item);
    saveBrowser(d);
    return item;
  }
  await db.run(
    "INSERT INTO electricity (id,tenant_id,units,rate,amount,water_amount,total_amount,note,date) VALUES (?,?,?,?,?,?,?,?,?)",
    [item.id, item.tenant_id, item.units, item.rate, item.amount, item.water_amount, item.total_amount, item.note, item.date]
  );
  return item;
}

export async function getWifi() {
  if (!native()) return browserData().wifi;
  const r = await db.query("SELECT * FROM wifi ORDER BY date DESC");
  return r.values || [];
}

export async function addWifi(x) {
  const months = Number(x.months || 0);
  const amount = Number(x.amount || 0);
  const item = {
    ...x,
    id: uid(),
    months,
    amount,
    total_amount: months * amount,
    note: x.note || "",
    date: x.date || new Date().toISOString().slice(0, 10)
  };
  if (!native()) {
    const d = browserData();
    d.wifi.push(item);
    saveBrowser(d);
    return item;
  }
  await db.run(
    "INSERT INTO wifi (id,tenant_id,months,amount,total_amount,note,date) VALUES (?,?,?,?,?,?,?)",
    [item.id, item.tenant_id, item.months, item.amount, item.total_amount, item.note, item.date]
  );
  return item;
}

export async function getExpenses() {
  if (!native()) return browserData().expenses;
  const r = await db.query("SELECT * FROM expenses ORDER BY date DESC");
  return r.values || [];
}

export async function addExpense(x) {
  const item = { ...x, id: uid(), date: new Date().toISOString() };
  if (!native()) {
    const d = browserData();
    d.expenses.push(item);
    saveBrowser(d);
    return item;
  }
  await db.run("INSERT INTO expenses (id,title,amount,date) VALUES (?,?,?,?)", [item.id, item.title, item.amount, item.date]);
  return item;
}

export async function deleteTenant(tenantId) {
  if (!tenantId) throw new Error("Tenant ID is required");
  if (!native()) {
    const d = browserData();
    d.tenants = (d.tenants || []).filter(t => t.id !== tenantId);
    d.payments = (d.payments || []).filter(x => x.tenant_id !== tenantId);
    d.electricity = (d.electricity || []).filter(x => x.tenant_id !== tenantId);
    d.wifi = (d.wifi || []).filter(x => x.tenant_id !== tenantId);
    saveBrowser(d);
    return true;
  }
  await db.run("DELETE FROM payments WHERE tenant_id = ?", [tenantId]);
  await db.run("DELETE FROM electricity WHERE tenant_id = ?", [tenantId]);
  await db.run("DELETE FROM wifi WHERE tenant_id = ?", [tenantId]);
  await db.run("DELETE FROM tenants WHERE id = ?", [tenantId]);
  return true;
}
