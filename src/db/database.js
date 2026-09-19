const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let initPromise = null;

function initDatabase() {
  if (db) return Promise.resolve(db);
  if (initPromise) return initPromise;

  // Resolve sql-wasm.wasm path for both local and Vercel serverless environments
  const wasmPathCwd = path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmPathDir = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmPathVarTask = '/var/task/node_modules/sql.js/dist/sql-wasm.wasm';

  let resolvedWasmPath = wasmPathCwd;
  if (fs.existsSync(wasmPathVarTask)) {
    resolvedWasmPath = wasmPathVarTask;
  } else if (fs.existsSync(wasmPathDir)) {
    resolvedWasmPath = wasmPathDir;
  } else if (fs.existsSync(wasmPathCwd)) {
    resolvedWasmPath = wasmPathCwd;
  }

  initPromise = initSqlJs({
    locateFile: file => resolvedWasmPath
  }).then(SQL => {
    db = new SQL.Database();

    // Create Customers table
    db.run(`
      CREATE TABLE IF NOT EXISTS Customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        city TEXT NOT NULL,
        email TEXT UNIQUE,
        signup_date DATE NOT NULL
      )
    `);

    // Create Orders table
    db.run(`
      CREATE TABLE IF NOT EXISTS Orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
      )
    `);

    // Create Products table
    db.run(`
      CREATE TABLE IF NOT EXISTS Products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL
      )
    `);

    // Create OrderItems table
    db.run(`
      CREATE TABLE IF NOT EXISTS OrderItems (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES Orders(order_id),
        FOREIGN KEY (product_id) REFERENCES Products(product_id)
      )
    `);

    // Create CustomerVisits table
    db.run(`
      CREATE TABLE IF NOT EXISTS CustomerVisits (
        visit_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        visit_date DATE NOT NULL,
        channel TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
      )
    `);

    seedDatabase();
    return db;
  }).catch(err => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

function seedDatabase() {
  if (!db) return;

  // 1. Seed Customers
  const stmtCust = db.prepare(`INSERT INTO Customers (customer_name, city, email, signup_date) VALUES (?, ?, ?, ?)`);
  stmtCust.run(['Rajesh Kumar', 'Delhi', 'rajesh.k@example.com', '2026-01-15']);
  stmtCust.run(['Priya Sharma', 'Mumbai', 'priya.s@example.com', '2026-02-10']);
  stmtCust.run(['Amit Singh', 'Pune', 'amit.s@example.com', '2026-03-05']);
  stmtCust.run(['Sneha Patel', 'Bangalore', 'sneha.p@example.com', '2026-08-12']);
  stmtCust.run(['Vikram Reddy', 'Hyderabad', 'vikram.r@example.com', '2026-08-28']);
  stmtCust.run(['Ananya Roy', 'Kolkata', 'ananya.r@example.com', '2026-08-30']);
  stmtCust.free();

  // 2. Seed Products
  const stmtProd = db.prepare(`INSERT INTO Products (product_name, category, price, stock_quantity) VALUES (?, ?, ?, ?)`);
  stmtProd.run(['Enterprise Cloud License', 'Software', 45000, 50]);
  stmtProd.run(['AI Analytics Server', 'Hardware', 120000, 10]);
  stmtProd.run(['Database Connector Pro', 'Software', 15000, 100]);
  stmtProd.run(['Security Audit Suite', 'Services', 35000, 25]);
  stmtProd.run(['Smart Dashboard Module', 'Software', 25000, 60]);
  stmtProd.free();

  // 3. Seed Orders
  const stmtOrders = db.prepare(`INSERT INTO Orders (customer_id, order_date, total_amount, status) VALUES (?, ?, ?, ?)`);
  stmtOrders.run([1, '2026-08-01', 25000, 'Completed']);
  stmtOrders.run([1, '2026-08-08', 15000, 'Completed']);
  stmtOrders.run([1, '2026-08-15', 30000, 'Completed']);
  stmtOrders.run([1, '2026-08-22', 20000, 'Completed']);
  stmtOrders.run([1, '2026-09-02', 20000, 'Completed']);

  stmtOrders.run([2, '2026-08-05', 80000, 'Completed']);
  stmtOrders.run([2, '2026-08-18', 60000, 'Completed']);
  stmtOrders.run([2, '2026-09-05', 40000, 'Completed']);

  stmtOrders.run([3, '2026-08-10', 35000, 'Completed']);
  stmtOrders.run([3, '2026-08-25', 25000, 'Completed']);

  stmtOrders.run([4, '2026-08-14', 45000, 'Completed']);
  stmtOrders.run([5, '2026-09-01', 30000, 'Completed']);
  stmtOrders.free();

  // 4. Seed CustomerVisits
  const stmtVisits = db.prepare(`INSERT INTO CustomerVisits (customer_id, visit_date, channel) VALUES (?, ?, ?)`);
  for (let i = 1; i <= 14; i++) {
    const day = (i % 28) + 1;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    stmtVisits.run([3, `2026-08-${dayStr}`, i % 2 === 0 ? 'Mobile App' : 'Web Portal']);
  }
  for (let i = 1; i <= 5; i++) {
    stmtVisits.run([1, `2026-08-0${i}`, 'Web Portal']);
  }
  for (let i = 1; i <= 4; i++) {
    stmtVisits.run([2, `2026-08-0${i}`, 'Mobile App']);
  }
  stmtVisits.free();
}

function runQuery(sql, params = []) {
  return new Promise(async (resolve, reject) => {
    try {
      await initDatabase();
      const stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      resolve(results);
    } catch (err) {
      reject(err);
    }
  });
}

async function getSchemaSummary() {
  await initDatabase();
  const tables = await runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const schema = {};
  for (const t of tables) {
    const cols = await runQuery(`PRAGMA table_info(${t.name})`);
    schema[t.name] = cols.map(c => ({ name: c.name, type: c.type, pk: c.pk === 1 }));
  }
  return schema;
}

module.exports = {
  get db() { return db; },
  initDatabase,
  runQuery,
  getSchemaSummary
};
