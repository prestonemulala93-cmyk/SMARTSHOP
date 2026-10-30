const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;
const DATABASE_PATH = path.resolve(process.env.SMARTSHOP_DB_PATH || path.join(__dirname, 'smartshop.db'));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (path.basename(filePath) === 'service-worker.js' || path.basename(filePath) === 'app.webmanifest') {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
app.use(express.json({ limit: '10mb' }));

// HTML served directly from memory with zero file dependency
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1329">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>SmartShop - Express Pick-up Engine</title>
  <link rel="manifest" href="/app.webmanifest">
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0b1329; color: #f1f5f9; }
    .glass-card { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(56, 189, 248, 0.15); }
    .glass-input { background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); color: #ffffff; }
    .glass-input:focus { border-color: #38bdf8; outline: none; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between">
  <header class="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center space-x-3 cursor-pointer" onclick="navigateTo('stores')">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-black shadow-lg shadow-sky-500/20">S</div>
        <div>
          <div class="font-black text-lg text-white">SMARTSHOP</div>
          <p class="text-xs text-slate-400">Smart Express Retail Engine</p>
        </div>
      </div>
      <nav id="app-nav" class="hidden flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
        <button onclick="navigateTo('stores')" id="nav-btn-stores" class="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"><i class="fa-solid fa-store mr-1.5"></i>Store Directory</button>
        <button onclick="navigateTo('yp-store')" id="nav-btn-yp-store" class="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hidden"><i class="fa-solid fa-cart-shopping mr-1.5"></i>Young Phiroz Portal</button>
      </nav>
      <div id="user-pill" class="hidden flex items-center gap-3">
        <div class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span id="user-pill-name">User</span>
        </div>
        <button onclick="logout()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-xs font-semibold border border-slate-700"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    </div>
  </header>
  <main class="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
    <section id="screen-auth" class="max-w-md mx-auto space-y-6">
      <div class="text-center space-y-3">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 mx-auto flex items-center justify-center text-white text-3xl font-black">S</div>
        <h1 class="text-3xl font-black text-white">Welcome to SmartShop</h1>
        <p class="text-xs text-slate-400">Sign in or create an account to start shopping</p>
      </div>
      <div class="p-6 rounded-2xl glass-card space-y-6">
        <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button id="tab-login" onclick="switchAuthTab('login')" class="flex-1 py-2 text-sm font-semibold rounded-lg bg-sky-500 text-slate-950">Login</button>
          <button id="tab-create" onclick="switchAuthTab('create')" class="flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white">Create Account</button>
        </div>
        <form id="form-login" onsubmit="handleLogin(event)" class="space-y-4">
          <div><label class="block text-xs font-semibold text-slate-300 mb-1">Email or Phone</label><input type="text" id="login-id" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="0971234567 or email@domain.com"></div>
          <div><label class="block text-xs font-semibold text-slate-300 mb-1">Password</label><input type="password" id="login-pass" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="••••••••"></div>
          <button type="submit" class="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm">Sign In</button>
        </form>
        <form id="form-create" onsubmit="handleCreateAccount(event)" class="hidden space-y-4">
          <div><label class="block text-xs font-semibold text-slate-300 mb-1">Name</label><input type="text" id="reg-name" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="Full Name"></div>
          <div><label class="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label><input type="tel" id="reg-phone" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="0971234567"></div>
          <div><label class="block text-xs font-semibold text-slate-300 mb-1">Email</label><input type="email" id="reg-email" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="name@example.com"></div>
          <div><label class="block text-xs font-semibold text-slate-300 mb-1">Password</label><input type="password" id="reg-pass" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="••••••••"></div>
          <button type="submit" class="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm">Create Account</button>
        </form>
      </div>
    </section>
    <section id="screen-stores" class="hidden space-y-8">
      <div class="text-center space-y-2 max-w-xl mx-auto">
        <h2 class="text-3xl font-black text-white">Select a Store to Buy From</h2>
        <p class="text-xs text-slate-400">Pre-order merchandise in Zambian Kwacha (ZMW)</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div onclick="openStore('young-phiroz')" class="p-6 rounded-3xl glass-card hover:border-sky-500/50 transition cursor-pointer group flex flex-col justify-between space-y-6">
          <div class="space-y-4">
            <div class="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center font-black text-slate-900 text-xl">YP</div>
            <div>
              <h3 class="text-xl font-extrabold text-white group-hover:text-sky-400">Young Phiroz General Dealers</h3>
              <p class="text-xs text-slate-400 mt-1">Express Counter Pickup Platform</p>
            </div>
          </div>
          <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-sky-400">
            <span>Enter Store Portal</span><i class="fa-solid fa-arrow-right"></i>
          </div>
        </div>
      </div>
    </section>
    <section id="screen-yp-store" class="hidden space-y-8">
      <div class="p-8 rounded-3xl glass-card flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="space-y-3 max-w-xl text-center md:text-left">
          <h2 class="text-4xl font-black text-white uppercase">SHOP AT HOME. <span class="text-sky-400">SHOP EASY</span></h2>
          <p class="text-xs sm:text-sm text-slate-300">Select items in Kwacha (ZMW), pay instantly, and scan 1 single barcode at pickup.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="switchYPView('customer')" id="btn-yp-cust-view" class="px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs"><i class="fa-solid fa-cart-shopping mr-1"></i> Pre-Order Portal</button>
          <button onclick="switchYPView('history')" id="btn-yp-history-view" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700"><i class="fa-solid fa-clock-rotate-left mr-1"></i> Order History</button>
          <button onclick="switchYPView('cashier')" id="btn-yp-cashier-view" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700"><i class="fa-solid fa-barcode mr-1"></i> Cashier Terminal</button>
          <button onclick="switchYPView('admin')" id="btn-yp-admin-view" class="px-4 py-2.5 rounded-xl bg-slate-800 text-purple-400 font-bold text-xs border border-slate-700"><i class="fa-solid fa-lock mr-1"></i> ADMIN LOGIN</button>
        </div>
      </div>
      <div id="yp-subview-customer" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-sky-400">Available Merchandise (ZMW)</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" id="yp-products-grid"></div>
        </div>
        <div class="space-y-6">
          <div class="p-6 rounded-2xl glass-card space-y-4">
            <h3 class="text-base font-bold text-white flex items-center justify-between">
              <span>Your Package</span><span id="yp-cart-badge" class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold">0 Items</span>
            </h3>
            <div id="yp-cart-list" class="space-y-2 max-h-56 overflow-y-auto pr-1"></div>
            <div class="border-t border-slate-800 pt-4 flex justify-between font-extrabold text-white">
              <span>Total Amount</span><span id="yp-cart-total" class="text-emerald-400">ZMW 0.00</span>
            </div>
            <button id="btn-yp-pay" onclick="openYPPayModal()" disabled class="w-full py-3.5 rounded-xl bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed">Proceed to Payment</button>
          </div>
        </div>
      </div>
      <div id="yp-subview-history" class="hidden max-w-3xl mx-auto space-y-6">
        <div class="p-6 rounded-2xl glass-card space-y-6">
          <div class="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 class="text-xl font-bold text-white">Customer Order History</h3>
              <p class="text-xs text-slate-400">Your paid packages and active collection barcodes</p>
            </div>
            <span id="history-count" class="px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold">0 Orders</span>
          </div>
          <div id="history-orders-list" class="space-y-4">
            <p class="text-xs text-slate-500 text-center py-8">No order history found. Complete a pre-order to generate a barcode.</p>
          </div>
        </div>
      </div>
      <div id="yp-subview-cashier" class="hidden max-w-2xl mx-auto space-y-6">
        <div class="p-6 rounded-2xl glass-card space-y-6">
          <div class="text-center space-y-1">
            <h3 class="text-xl font-bold text-white">Cashier Pickup Terminal</h3>
            <p class="text-xs text-slate-400">Manual lookup or barcode hardware trigger</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">Manual Code Lookup</label>
              <div class="flex gap-1">
                <input type="text" id="cashier-code-input" class="w-full px-3 py-2 rounded-xl glass-input text-xs font-mono" placeholder="e.g. YP-8492">
                <button onclick="lookupByCode()" class="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs">Find</button>
              </div>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Hardware / Optical Scanner</label>
              <button onclick="triggerBarcodeScanner()" class="w-full py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2">
                <i class="fa-solid fa-barcode text-base"></i> Scan Package Barcode
              </button>
            </div>
          </div>
          <div id="cashier-details" class="hidden space-y-6 border-t border-slate-800 pt-6">
            <div id="cashier-scanned-barcode-visual" class="bg-white p-3 rounded-xl flex flex-col items-center justify-center">
              <svg id="cashier-barcode-svg" class="w-full max-w-xs"></svg>
            </div>
            <div class="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <p class="text-xs text-slate-400">Customer</p>
                <p id="c-cust-name" class="text-sm font-bold text-white">Chipo Banda</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-slate-400">Raw Code</p>
                <span id="c-raw-code" class="text-xs font-mono font-bold text-sky-400">YP-0000</span>
              </div>
            </div>
            <div class="space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">Enumerated Package Contents</h4>
              <div id="c-items-list" class="space-y-2 max-h-48 overflow-y-auto"></div>
            </div>
            <div class="space-y-3 pt-2">
              <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                Barcode Status: <span id="c-barcode-status" class="font-bold text-emerald-400">ACTIVE / VALID</span>
              </div>
              <button id="btn-process-receipt" onclick="processThermalReceipt()" class="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm">
                Process & Print Physical Receipt
              </button>
            </div>
          </div>
          <div id="cashier-empty" class="text-center py-8 text-slate-500 text-xs">Scan a barcode or enter a package code above to display contents.</div>
        </div>
      </div>
      <div id="yp-subview-admin" class="hidden space-y-8">
        <div id="admin-login-guard" class="max-w-sm mx-auto p-6 rounded-2xl glass-card space-y-4 border border-purple-500/30">
          <div class="text-center space-y-1">
            <div class="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center mx-auto text-xl font-bold"><i class="fa-solid fa-lock"></i></div>
            <h3 class="text-lg font-bold text-white">Admin Authentication</h3>
            <p class="text-xs text-slate-400">Enter the administrator passcode configured by your deployment.</p>
          </div>
          <form onsubmit="handleAdminPasscode(event)" class="space-y-3">
            <div><label class="block text-xs font-semibold text-slate-300 mb-1">Passcode</label><input type="password" id="admin-passcode-input" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-center font-mono tracking-widest" placeholder="••••"></div>
            <button type="submit" class="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs">Unlock Terminal</button>
          </form>
        </div>
        <div id="admin-terminal-content" class="hidden grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="p-6 rounded-2xl glass-card space-y-4 border border-purple-500/30">
            <h3 class="text-lg font-bold text-white">Add New Product Listing</h3>
            <form onsubmit="handleAdminAddProduct(event)" class="space-y-4">
              <div><label class="block text-xs font-semibold text-slate-300 mb-1">Product Name</label><input type="text" id="admin-pname" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="Product Name"></div>
              <div><label class="block text-xs font-semibold text-slate-300 mb-1">Price (ZMW)</label><input type="number" step="0.01" id="admin-pprice" required class="w-full px-4 py-2.5 rounded-xl glass-input text-sm" placeholder="0.00"></div>
              <div><label class="block text-xs font-semibold text-slate-300 mb-1">Upload Product Photo</label><input type="file" id="admin-pfile" accept="image/*" onchange="convertImageToBase64(this)" class="w-full text-xs text-slate-400 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-slate-800 file:text-purple-300"></div>
              <button type="submit" class="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm">Save Listing</button>
            </form>
          </div>
          <div class="lg:col-span-2 p-6 rounded-2xl glass-card space-y-4">
            <h3 class="text-lg font-bold text-white">Active Product Inventory</h3>
            <div id="admin-products-list" class="space-y-2 max-h-96 overflow-y-auto"></div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <div id="payment-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 hidden">
    <div class="w-full max-w-md rounded-2xl glass-card p-6 space-y-6">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-bold text-white">Young Phiroz Express Payment</h3>
        <button onclick="closePayModal()" class="text-slate-400"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="bg-slate-900 p-4 rounded-xl flex justify-between items-center">
        <span class="text-xs text-slate-400">Total Amount</span>
        <span id="pay-modal-total" class="text-xl font-extrabold text-emerald-400">ZMW 0.00</span>
      </div>
      <button onclick="executePayment()" class="w-full py-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm">Pay Now & Issue Master Barcode</button>
    </div>
  </div>
  <script>
    let YP_PRODUCTS = [];
    let currentUser = null;
    let adminPasscode = null;
    let cart = [];
    let customerOrders = [];
    let tempImageBase64 = null;
    document.addEventListener('DOMContentLoaded', () => {
      fetchProducts();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').catch(err => {
          console.error('Service worker registration failed', err);
        });
      }
    });
    function navigateTo(screen) {
      ['auth', 'stores', 'yp-store'].forEach(s => {
        document.getElementById('screen-' + s).classList.toggle('hidden', s !== screen);
      });
    }
    function switchAuthTab(tab) {
      document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
      document.getElementById('form-create').classList.toggle('hidden', tab !== 'create');
    }
    async function handleLogin(e) {
      e.preventDefault();
      const identifier = document.getElementById('login-id').value;
      const password = document.getElementById('login-pass').value;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        loadCustomerOrders();
        onAuthenticated();
      } else { alert(data.error || 'Login failed'); }
    }
    async function handleCreateAccount(e) {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const phone = document.getElementById('reg-phone').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-pass').value;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        loadCustomerOrders();
        onAuthenticated();
      } else { alert(data.error || 'Registration failed'); }
    }
    function onAuthenticated() {
      document.getElementById('app-nav').classList.remove('hidden');
      document.getElementById('user-pill').classList.remove('hidden');
      document.getElementById('user-pill-name').textContent = currentUser.name;
      navigateTo('stores');
    }
    function logout() {
      currentUser = null;
      adminPasscode = null;
      cart = [];
      customerOrders = [];
      document.getElementById('app-nav').classList.add('hidden');
      document.getElementById('user-pill').classList.add('hidden');
      navigateTo('auth');
    }
    function openStore(key) {
      document.getElementById('nav-btn-yp-store').classList.remove('hidden');
      navigateTo('yp-store');
      switchYPView('customer');
    }
    function switchYPView(sub) {
      document.getElementById('yp-subview-customer').classList.toggle('hidden', sub !== 'customer');
      document.getElementById('yp-subview-history').classList.toggle('hidden', sub !== 'history');
      document.getElementById('yp-subview-cashier').classList.toggle('hidden', sub !== 'cashier');
      document.getElementById('yp-subview-admin').classList.toggle('hidden', sub !== 'admin');
      ['customer', 'history', 'cashier', 'admin'].forEach(v => {
        const btn = document.getElementById('btn-yp-' + (v === 'customer' ? 'cust' : v) + '-view');
        if (btn) {
          btn.className = (v === sub) ? "px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs" : "px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700";
        }
      });
      if (sub === 'history') renderOrderHistory();
    }
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products');
        YP_PRODUCTS = await res.json();
        renderProducts();
        renderAdminProducts();
      } catch (err) { console.error('Failed to load products', err); }
    }
    function loadCustomerOrders() {
      const stored = localStorage.getItem('yp_orders_' + currentUser.phone);
      customerOrders = stored ? JSON.parse(stored) : [];
    }
    function saveCustomerOrders() {
      if (currentUser) localStorage.setItem('yp_orders_' + currentUser.phone, JSON.stringify(customerOrders));
    }
    async function handleAdminPasscode(e) {
      e.preventDefault();
      const passcode = document.getElementById('admin-passcode-input').value;
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminPasscode = passcode;
        document.getElementById('admin-passcode-input').value = '';
        document.getElementById('admin-login-guard').classList.add('hidden');
        document.getElementById('admin-terminal-content').classList.remove('hidden');
      } else { alert(data.error || 'Admin authentication failed.'); }
    }
    function convertImageToBase64(input) {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => tempImageBase64 = e.target.result;
        reader.readAsDataURL(input.files[0]);
      }
    }
    async function handleAdminAddProduct(e) {
      e.preventDefault();
      const name = document.getElementById('admin-pname').value;
      const price = parseFloat(document.getElementById('admin-pprice').value);
      const img = tempImageBase64 || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150';
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, img, passcode: adminPasscode })
      });
      const data = await res.json();
      if (data.success) {
        tempImageBase64 = null;
        document.getElementById('admin-pname').value = '';
        document.getElementById('admin-pprice').value = '';
        fetchProducts();
        alert('Product added successfully!');
      } else { alert(data.error); }
    }
    function renderProducts() {
      document.getElementById('yp-products-grid').innerHTML = YP_PRODUCTS.map(p => \`
        <div class="p-4 rounded-2xl glass-card flex flex-col justify-between space-y-3">
          <img src="\${p.img}" class="w-full h-28 object-cover rounded-xl">
          <div><h4 class="font-bold text-sm text-white">\${p.name}</h4><p class="text-emerald-400 font-extrabold text-sm">ZMW \${p.price.toFixed(2)}</p></div>
          <button onclick="addToCart('\${p.id}')" class="w-full py-2 rounded-lg bg-slate-800 text-xs font-semibold hover:bg-sky-500 hover:text-slate-950 transition">Add to Package</button>
        </div>
      \`).join('');
    }
    function renderAdminProducts() {
      document.getElementById('admin-products-list').innerHTML = YP_PRODUCTS.map(p => \`
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div class="flex items-center gap-3">
            <img src="\${p.img}" class="w-10 h-10 object-cover rounded-lg">
            <div><p class="font-bold text-white text-xs">\${p.name}</p><p class="text-emerald-400 font-bold text-xs">ZMW \${p.price.toFixed(2)}</p></div>
          </div>
        </div>
      \`).join('');
    }
    function addToCart(id) {
      const p = YP_PRODUCTS.find(item => item.id === id);
      const existing = cart.find(i => i.product.id === id);
      if (existing) existing.qty++;
      else cart.push({ product: p, qty: 1 });
      renderCart();
    }
    function removeFromCart(id) {
      cart = cart.filter(i => i.product.id !== id);
      renderCart();
    }
    function updateQty(id, delta) {
      const existing = cart.find(i => i.product.id === id);
      if (existing) {
        existing.qty += delta;
        if (existing.qty <= 0) removeFromCart(id);
        else renderCart();
      }
    }
    function renderCart() {
      const total = cart.reduce((acc, i) => acc + (i.product.price * i.qty), 0);
      document.getElementById('yp-cart-total').textContent = 'ZMW ' + total.toFixed(2);
      document.getElementById('yp-cart-badge').textContent = cart.reduce((a, b) => a + b.qty, 0) + ' Items';
      document.getElementById('btn-yp-pay').disabled = cart.length === 0;
      document.getElementById('btn-yp-pay').className = cart.length ? "w-full py-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm cursor-pointer" : "w-full py-3.5 rounded-xl bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed";
      document.getElementById('yp-cart-list').innerHTML = cart.length === 0 ? 
        '<p class="text-xs text-slate-500 italic text-center py-6">Your package is empty.</p>' :
        cart.map(i => \`
          <div class="flex justify-between items-center p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <div class="flex-1 pr-2">
              <p class="font-bold text-white truncate">\${i.product.name}</p>
              <p class="text-slate-400 text-[10px]">ZMW \${(i.product.price * i.qty).toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="updateQty('\${i.product.id}', -1)" class="w-5 h-5 rounded bg-slate-800 text-slate-300 font-bold flex items-center justify-center">-</button>
              <span class="font-bold text-white px-1">\${i.qty}</span>
              <button onclick="updateQty('\${i.product.id}', 1)" class="w-5 h-5 rounded bg-slate-800 text-slate-300 font-bold flex items-center justify-center">+</button>
              <button onclick="removeFromCart('\${i.product.id}')" class="w-5 h-5 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white font-bold flex items-center justify-center ml-1"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
          </div>
        \`).join('');
    }
    function openYPPayModal() {
      const total = cart.reduce((acc, i) => acc + (i.product.price * i.qty), 0);
      document.getElementById('pay-modal-total').textContent = 'ZMW ' + total.toFixed(2);
      document.getElementById('payment-modal').classList.remove('hidden');
    }
    function closePayModal() { document.getElementById('payment-modal').classList.add('hidden'); }
    async function executePayment() {
      const total = cart.reduce((acc, i) => acc + (i.product.price * i.qty), 0);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: currentUser, items: cart, total, payMethod: 'Mobile Money' })
      });
      const data = await res.json();
      if (data.success) {
        customerOrders.unshift(data.order);
        saveCustomerOrders();
        cart = [];
        renderCart();
        closePayModal();
        alert('Payment successful! Package saved to Order History.');
        switchYPView('history');
      } else { alert(data.error); }
    }
    function renderOrderHistory() {
      const container = document.getElementById('history-orders-list');
      document.getElementById('history-count').textContent = customerOrders.length + ' Orders';
      if (customerOrders.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">No order history found. Complete a pre-order to generate a barcode.</p>';
        return;
      }
      container.innerHTML = customerOrders.map((o, idx) => \`
        <div class="p-5 rounded-2xl glass-card space-y-4 border \${o.isExpired ? 'border-red-500/30 opacity-75' : 'border-emerald-500/40'}">
          <div class="flex justify-between items-center">
            <div>
              <span class="text-xs font-mono font-bold text-sky-400">\${o.pkgId}</span>
              <p class="text-[10px] text-slate-400">Ref: \${o.payRef} • Paid: ZMW \${o.total.toFixed(2)}</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold \${o.isExpired ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">
              \${o.isExpired ? 'REDEEMED / EXPIRED' : 'PAID & READY'}
            </span>
          </div>
          <div class="bg-slate-900 p-3 rounded-xl space-y-1">
            \${o.items.map(i => \`<div class="flex justify-between text-xs text-slate-300"><span>\${i.product.name} (x\${i.qty})</span><span>ZMW \${(i.product.price * i.qty).toFixed(2)}</span></div>\`).join('')}
          </div>
          <div class="bg-white p-3 rounded-xl flex flex-col items-center justify-center">
            <svg id="history-barcode-\${idx}" class="w-full max-w-xs"></svg>
          </div>
        </div>
      \`).join('');
      customerOrders.forEach((o, idx) => {
        JsBarcode('#history-barcode-' + idx, o.pkgId, { format: "CODE128", width: 2, height: 45, displayValue: true });
      });
    }
    async function lookupByCode() {
      const code = document.getElementById('cashier-code-input').value.trim();
      await fetchCashierOrder(code);
    }
    async function triggerBarcodeScanner() {
      const code = customerOrders.length > 0 ? customerOrders[0].pkgId : 'YP-8492';
      await fetchCashierOrder(code);
    }
    async function fetchCashierOrder(code) {
      const res = await fetch('/api/orders/' + encodeURIComponent(code));
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Order not found'); return; }
      const order = data.order;
      document.getElementById('cashier-empty').classList.add('hidden');
      document.getElementById('cashier-details').classList.remove('hidden');
      document.getElementById('c-raw-code').textContent = order.pkgId;
      document.getElementById('c-cust-name').textContent = order.customer.name;
      JsBarcode("#cashier-barcode-svg", order.pkgId, { format: "CODE128", width: 2, height: 50 });
      document.getElementById('c-items-list').innerHTML = order.items.map(i => \`
        <div class="flex justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs text-white">
          <span>\${i.product.name} (x\${i.qty})</span><span>ZMW \${(i.product.price * i.qty).toFixed(2)}</span>
        </div>
      \`).join('');
      const statusEl = document.getElementById('c-barcode-status');
      const btn = document.getElementById('btn-process-receipt');
      if (order.isExpired) {
        statusEl.textContent = "EXPIRED / REDEEMED";
        statusEl.className = "font-bold text-red-400";
        btn.disabled = true;
      } else {
        statusEl.textContent = "ACTIVE / VALID";
        statusEl.className = "font-bold text-emerald-400";
        btn.disabled = false;
        btn.onclick = () => processThermalReceipt(order.pkgId);
      }
    }
    async function processThermalReceipt(pkgId) {
      const res = await fetch('/api/orders/' + encodeURIComponent(pkgId) + '/redeem', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        document.getElementById('c-barcode-status').textContent = "EXPIRED / REDEEMED";
        document.getElementById('c-barcode-status').className = "font-bold text-red-400";
        document.getElementById('btn-process-receipt').disabled = true;
        const found = customerOrders.find(o => o.pkgId === pkgId);
        if (found) { found.isExpired = true; saveCustomerOrders(); }
        alert('Receipt processed! Barcode marked as redeemed & expired.');
      }
    }
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(htmlContent);
});

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
const db = new sqlite3.Database(DATABASE_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initializeDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    img TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    pkg_id TEXT PRIMARY KEY,
    pay_ref TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    pay_method TEXT NOT NULL,
    status TEXT DEFAULT 'PAID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const row = await get('SELECT COUNT(*) AS count FROM products');
  if (row.count === 0) {
    const defaults = [
      ['p1', 'Mealile Breakfast Meal 25kg', 320.00, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=150'],
      ['p2', 'Cooking Oil 5 Litres', 215.00, 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=150'],
      ['p3', 'White Sugar 2kg', 58.00, 'https://images.unsplash.com/photo-1581443285078-3e475720d20d?w=150'],
      ['p4', 'Rice 5kg Super White', 145.00, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=150']
    ];
    for (const product of defaults) {
      await run('INSERT INTO products (id, name, price, img) VALUES (?, ?, ?, ?)', product);
    }
  }
}

function isValidAdminPasscode(passcode) {
  if (!ADMIN_PASSCODE || typeof passcode !== 'string') return false;
  const expected = Buffer.from(ADMIN_PASSCODE);
  const supplied = Buffer.from(passcode);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

app.get('/healthz', (req, res) => {
  db.get('SELECT 1 AS ok', [], (err) => {
    if (err) return res.status(503).json({ status: 'error', database: 'unavailable' });
    res.json({ status: 'ok', database: 'ok' });
  });
});

// --- API ROUTES ---
app.post('/api/auth/register', (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ error: 'All 4 fields are required.' });
  }
  const id = uuidv4();
  db.run(`INSERT INTO users (id, name, phone, email, password) VALUES (?, ?, ?, ?, ?)`,
    [id, name, phone, email, password],
    function(err) {
      if (err) return res.status(400).json({ error: 'Phone or Email already registered.' });
      res.json({ success: true, user: { id, name, phone, email } });
    }
  );
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  db.get(`SELECT * FROM users WHERE (phone = ? OR email = ?) AND password = ?`, [identifier, identifier, password], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials.' });
    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
  });
});

app.get('/api/products', (req, res) => {
  db.all(`SELECT * FROM products`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/products', (req, res) => {
  const { name, price, img, passcode } = req.body;
  if (!ADMIN_PASSCODE) {
    return res.status(503).json({ error: 'Admin access is not configured on this deployment.' });
  }
  if (!isValidAdminPasscode(passcode)) {
    return res.status(403).json({ error: 'Unauthorized admin passcode.' });
  }
  const id = 'p-' + Date.now();
  db.run(`INSERT INTO products (id, name, price, img) VALUES (?, ?, ?, ?)`, [id, name, price, img], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, product: { id, name, price, img } });
  });
});

app.post('/api/admin/auth', (req, res) => {
  if (!ADMIN_PASSCODE) {
    return res.status(503).json({ error: 'Admin access is not configured on this deployment.' });
  }
  if (!isValidAdminPasscode(req.body.passcode)) {
    return res.status(403).json({ error: 'Invalid admin passcode.' });
  }
  res.json({ success: true });
});

app.post('/api/orders', (req, res) => {
  const { customer, items, total, payMethod } = req.body;
  const pkgId = 'YP-' + Math.floor(1000 + Math.random() * 9000);
  const payRef = 'PAY-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  db.run(`INSERT INTO orders (pkg_id, pay_ref, customer_phone, customer_name, items, total, pay_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pkgId, payRef, customer.phone || '0971234567', customer.name, JSON.stringify(items), total, payMethod, 'PAID'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, order: { pkgId, payRef, customer, items, total, payMethod, status: 'PAID' } });
    }
  );
});

app.get('/api/orders/:pkgId', (req, res) => {
  const pkgId = req.params.pkgId.toUpperCase();
  db.get(`SELECT * FROM orders WHERE pkg_id = ?`, [pkgId], (err, order) => {
    if (err || !order) return res.status(404).json({ error: 'Order / Barcode not found.' });
    res.json({
      success: true,
      order: {
        pkgId: order.pkg_id,
        payRef: order.pay_ref,
        customer: { name: order.customer_name, phone: order.customer_phone },
        items: JSON.parse(order.items),
        total: order.total,
        payMethod: order.pay_method,
        status: order.status,
        isExpired: order.status !== 'PAID'
      }
    });
  });
});

app.post('/api/orders/:pkgId/redeem', (req, res) => {
  const pkgId = req.params.pkgId.toUpperCase();
  db.run(`UPDATE orders SET status = 'EXPIRED / REDEEMED' WHERE pkg_id = ?`, [pkgId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: `Order ${pkgId} redeemed and expired.` });
  });
});

let server;
let shuttingDown = false;

async function start() {
  await initializeDatabase();
  server = app.listen(PORT, HOST, () => {
    console.log(`SmartShop listening on ${HOST}:${PORT}; database: ${DATABASE_PATH}`);
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down.`);
  const closeDatabase = () => db.close((err) => {
    if (err) {
      console.error('Database close error:', err.message);
      process.exitCode = 1;
    }
  });
  if (server) server.close(closeDatabase);
  else closeDatabase();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('Server startup failed:', err);
  db.close(() => {
    process.exitCode = 1;
  });
});