'use strict';

const STORAGE_KEY = 'warkop-pos-v2';
const LEGACY_STORAGE_KEY = 'warkop-pos-v1';
const APP_VERSION = '1.5.2';
const SYNC_RETRY_DELAYS = [5000, 15000, 60000];
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const EXPENSE_CATEGORIES = ['Bahan Baku', 'Listrik', 'Gas', 'Gaji', 'Sewa', 'Lainnya'];
const MAX_MONEY = 999999999999;
const MAX_REJECTED = 50;

const APP_CONFIG = window.WARKOP_CONFIG || {};
const SUPABASE_URL = String(APP_CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = String(APP_CONFIG.SUPABASE_ANON_KEY || '').trim();

const jwtRole = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    return String(decoded?.role || '');
  } catch (error) {
    return '';
  }
};

const supabaseConfigIssue = (() => {
  if (!SUPABASE_URL && !SUPABASE_ANON_KEY) return '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'SUPABASE_URL dan SUPABASE_ANON_KEY harus diisi keduanya.';
  if (!/^https?:\/\//i.test(SUPABASE_URL)) return 'SUPABASE_URL harus berupa URL http atau https.';
  if (SUPABASE_ANON_KEY.startsWith('sbp_')
    || SUPABASE_ANON_KEY.startsWith('sb_secret_')
    || jwtRole(SUPABASE_ANON_KEY) === 'service_role') {
    return 'Jangan memakai service_role key di frontend. Gunakan anon key.';
  }
  return '';
})();

const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !supabaseConfigIssue);

const TAB_META = {
  kasir: {
    title: 'Kasir',
    subtitle: 'Pilih menu, lalu bayar dalam sekali sentuh.'
  },
  produk: {
    title: 'Produk',
    subtitle: 'Kelola menu, harga, dan ketersediaan.'
  },
  pengeluaran: {
    title: 'Pengeluaran',
    subtitle: 'Catat biaya operasional warkop.'
  },
  logbook: {
    title: 'Logbook',
    subtitle: 'Riwayat penjualan dan laporan periode.'
  }
};

const ICONS = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"></path></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m6 7 1 13h10l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"></path></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v11"></path><path d="m8 10 4 4 4-4"></path><path d="M4 19h16"></path></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20V9"></path><path d="m8 13 4-4 4 4"></path><path d="M4 5h16"></path></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v4h4"></path><path d="M9 13h6M9 17h4"></path></svg>',
  sheet: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 4h14v16H5z"></path><path d="M5 9h14M5 14h14M10 4v16"></path></svg>',
  database: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><ellipse cx="12" cy="5.5" rx="7.5" ry="3"></ellipse><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"></path><path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"></path></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 0 0-14.9-3"></path><path d="M4 4v4h4"></path><path d="M4 13a8 8 0 0 0 14.9 3"></path><path d="M20 20v-4h-4"></path></svg>',
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4H5v16h5"></path><path d="M14 8l4 4-4 4"></path><path d="M9 12h9"></path></svg>',
  cup: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 8h12l-1.2 8.2a4.2 4.2 0 0 1-4.1 3.6h-1.4a4.2 4.2 0 0 1-4.1-3.6L5 8Z"></path><path d="M17 10h1.8a3.2 3.2 0 0 1 0 6.4H16"></path><path d="M3 21h16"></path><path d="M8 4.5c.6-.7.6-1.3 0-2"></path><path d="M12 4.5c.6-.7.6-1.3 0-2"></path></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3.5h12v17H6z"></path><path d="M9 7.5h6M9 11.5h6M9 15.5h4"></path><path d="M3.5 6.5v13A1.5 1.5 0 0 0 5 21h1"></path></svg>'
};

const view = document.getElementById('view');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const cartBar = document.getElementById('cartBar');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const modalRoot = document.getElementById('modalRoot');
const authRoot = document.getElementById('authRoot');
const toastRoot = document.getElementById('toastRoot');
const syncStatusButton = document.getElementById('syncStatus');
const syncStatusText = document.getElementById('syncStatusText');
const syncStatusHint = document.getElementById('syncStatusHint');
const navButtons = Array.from(document.querySelectorAll('.nav-item'));

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const pad = (value) => String(value).padStart(2, '0');

const rp = (value) => {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `Rp ${Math.round(number).toLocaleString('id-ID')}`;
};

const signedRp = (value) => {
  const number = Number(value) || 0;
  return number < 0 ? `-${rp(Math.abs(number))}` : rp(number);
};

const parseMoney = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 12);
  if (!digits) return null;
  return Math.min(Number(digits), MAX_MONEY);
};

const formatMoneyField = (number) => {
  if (!Number.isFinite(Number(number))) return '';
  return Number(number).toLocaleString('id-ID');
};

const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback untuk browser lama; jalur utama tetap crypto.randomUUID().
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);

const dkey = (date = new Date()) => {
  const source = date instanceof Date ? date : new Date(date);
  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(source.getDate())}`;
};

const parseDayKey = (key) => {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isValidDay = (key) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return false;
  const date = parseDayKey(key);
  return !Number.isNaN(date.getTime()) && dkey(date) === key;
};

const startOfMonthKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;

const addDaysKey = (key, amount) => {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + amount);
  return dkey(date);
};

const formatLongDay = (key) => {
  const date = parseDayKey(key);
  if (Number.isNaN(date.getTime())) return key;
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

const formatShortDate = (key) => {
  const date = parseDayKey(key);
  if (Number.isNaN(date.getTime())) return key;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const monthLabel = (key) => {
  const date = parseDayKey(key);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

const formatTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatPrintDate = (date = new Date()) => (
  `${formatLongDay(dkey(date))} pukul ${pad(date.getHours())}.${pad(date.getMinutes())}`
);

const nowIso = () => new Date().toISOString();

const validIso = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatDateTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatShortDate(dkey(date))} ${pad(date.getHours())}.${pad(date.getMinutes())}`;
};

const isNewerOrEqual = (remoteUpdatedAt, localUpdatedAt) => {
  const remote = new Date(remoteUpdatedAt).getTime();
  const local = new Date(localUpdatedAt).getTime();
  if (Number.isNaN(remote)) return false;
  if (Number.isNaN(local)) return true;
  return remote >= local;
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const plural = (count, word) => `${count} ${word}`;

const dummyPhotoCache = new Map();

// Foto contoh sementara. Setelah fitur unggah foto ada, kolom image_url yang dipakai.
// Foto bawaan per nama produk (berkas ada di folder images/). image_url dari database selalu didahulukan.
const PRODUCT_PHOTOS = {
  'es teh': 'images/es-teh.jpeg',
  'kopi hitam': 'images/kopi-hitam.jpeg',
  'kopi susu': 'images/kopi-susu.jpeg',
  'gorengan': 'images/gorengan.jpeg',
  'indomie goreng': 'images/indomie-goreng.jpeg',
  'roti bakar': 'images/roti-bakar.jpeg'
};

const productPhoto = (product) => {
  if (product.image_url) return product.image_url;
  const bundled = PRODUCT_PHOTOS[String(product.name || '').trim().toLowerCase().replace(/\s+/g, ' ')];
  if (bundled) return bundled;
  const category = String(product.category || '').toLowerCase();
  const kind = /minum|kopi|teh|es/.test(category) ? 'drink' : (/makan|nasi|mie/.test(category) ? 'meal' : (/camil|snack|gorengan/.test(category) ? 'snack' : 'drink'));
  let hash = 0;
  String(product.name || '').split('').forEach((char) => { hash = (hash * 31 + char.charCodeAt(0)) % 360; });
  const key = `${kind}:${hash}`;
  if (dummyPhotoCache.has(key)) return dummyPhotoCache.get(key);
  const hue = 24 + (hash % 30);
  const icons = {
    drink: '<path d="M62 52h36l-4 38a12 12 0 0 1-12 11H78a12 12 0 0 1-12-11l-4-38Z" fill="#fff"/><path d="M98 60h6a10 10 0 0 1 0 20h-9" fill="none" stroke="#fff" stroke-width="5"/><path d="M70 40c3-4 3-8 0-12M82 40c3-4 3-8 0-12M94 40c3-4 3-8 0-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>',
    meal: '<ellipse cx="80" cy="76" rx="38" ry="22" fill="#fff"/><ellipse cx="80" cy="72" rx="26" ry="13" fill="hsl(' + hue + ',70%,72%)"/><path d="M34 40v26M28 40v14M40 40v14M34 54v12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M126 40c-7 6-7 18 0 24v22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
    snack: '<circle cx="64" cy="78" r="16" fill="#fff"/><circle cx="94" cy="70" r="20" fill="#fff" opacity=".92"/><circle cx="82" cy="92" r="13" fill="#fff" opacity=".85"/>'
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},78%,66%)"/><stop offset="1" stop-color="hsl(${hue - 8},70%,48%)"/></linearGradient></defs><rect width="160" height="120" fill="url(#g)"/>${icons[kind]}</svg>`;
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  dummyPhotoCache.set(key, uri);
  return uri;
};

const SEED_PRODUCTS = [
  { name: 'Kopi Hitam', price: 8000, cost: 3000, category: 'Minuman' },
  { name: 'Kopi Susu', price: 12000, cost: 5500, category: 'Minuman' },
  { name: 'Es Teh', price: 5000, cost: 1500, category: 'Minuman' },
  { name: 'Indomie Goreng', price: 12000, cost: 7000, category: 'Makanan' },
  { name: 'Roti Bakar', price: 10000, cost: 4500, category: 'Makanan' },
  { name: 'Gorengan', price: 3000, cost: 1200, category: 'Camilan' }
];

const createSeedProducts = () => {
  const timestamp = nowIso();
  return SEED_PRODUCTS.map((product) => ({
    id: uid(),
    name: product.name,
    price: product.price,
    cost: product.cost,
    image_url: null,
    category: product.category,
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null
  }));
};

const createEmptyDB = () => ({
  products: [],
  trx: [],
  expenses: [],
  outbox: [],
  rejected: [],
  lastSyncAt: null,
  pullCursor: null
});

const createSeedDB = () => ({
  products: createSeedProducts(),
  trx: [],
  expenses: [],
  outbox: [],
  rejected: [],
  lastSyncAt: null,
  pullCursor: null
});

const normalizeProduct = (item, fallbackNow) => {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name ?? '').trim();
  if (!name) return null;
  const rawPrice = Number(item.price);
  const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.round(rawPrice) : 0;
  const rawCost = Number(item.cost);
  const cost = Number.isFinite(rawCost) && rawCost >= 0 ? Math.round(rawCost) : 0;
  const imageUrl = typeof item.image_url === 'string' && item.image_url.trim() ? item.image_url.trim() : null;
  const category = String(item.category ?? '').trim() || 'Umum';
  const updatedAt = validIso(item.updated_at) || fallbackNow;
  const createdAt = validIso(item.created_at) || updatedAt;
  const deletedAt = validIso(item.deleted_at);
  const id = isUuid(item.id) ? String(item.id) : uid();
  return {
    id,
    name,
    price,
    cost,
    image_url: imageUrl,
    category,
    active: item.active !== false,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: deletedAt
  };
};

const normalizeTransaction = (item, fallbackNow) => {
  if (!item || typeof item !== 'object') return null;
  const createdAt = validIso(item.created_at) || validIso(item.date) || fallbackNow;
  const day = isValidDay(item.day) ? item.day : dkey(createdAt);
  if (!isValidDay(day)) return null;
  const items = Array.isArray(item.items) ? item.items.reduce((rows, row) => {
    if (!row || typeof row !== 'object') return rows;
    const name = String(row.name ?? '').trim();
    const qty = Math.floor(Number(row.qty));
    const rawPrice = Number(row.price);
    const rawItemCost = Number(row.cost);
    if (!name || !Number.isFinite(qty) || qty <= 0) return rows;
    const productId = String(row.product_id ?? row.id ?? '').trim();
    rows.push({
      product_id: productId || uid(),
      name,
      price: Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.round(rawPrice) : 0,
      cost: Number.isFinite(rawItemCost) && rawItemCost >= 0 ? Math.round(rawItemCost) : 0,
      qty
    });
    return rows;
  }, []) : [];
  if (!items.length) return null;

  const total = sum(items.map((row) => row.price * row.qty));
  const pay = item.pay === 'qris' ? 'qris' : 'tunai';
  let received = Math.round(Number(item.received));
  if (!Number.isFinite(received) || received < total) received = total;
  const change = pay === 'tunai' ? Math.max(0, received - total) : 0;
  return {
    id: isUuid(item.id) ? String(item.id) : uid(),
    day,
    created_at: createdAt,
    items,
    total,
    pay,
    received: pay === 'tunai' ? received : total,
    change,
    updated_at: validIso(item.updated_at) || createdAt
  };
};

const normalizeExpense = (item, fallbackNow) => {
  if (!item || typeof item !== 'object') return null;
  if (!isValidDay(item.date)) return null;
  const amount = Math.round(Number(item.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: isUuid(item.id) ? String(item.id) : uid(),
    date: item.date,
    category: String(item.category ?? '').trim() || 'Lainnya',
    amount,
    note: String(item.note ?? '').trim(),
    updated_at: validIso(item.updated_at) || fallbackNow,
    deleted_at: validIso(item.deleted_at)
  };
};

const normalizeOutbox = (item, fallbackNow) => {
  if (!item || typeof item !== 'object') return null;
  if (!['products', 'transactions', 'expenses'].includes(item.table)) return null;
  if (item.op !== 'upsert') return null;
  if (!item.payload || typeof item.payload !== 'object') return null;
  return {
    id: isUuid(item.id) ? String(item.id) : uid(),
    table: item.table,
    op: 'upsert',
    payload: item.payload,
    createdAt: validIso(item.createdAt) || fallbackNow
  };
};

const normalizeDB = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.products) || !Array.isArray(raw.trx) || !Array.isArray(raw.expenses)) return null;
  const fallbackNow = nowIso();
  const productIds = new Set();
  const trxIds = new Set();
  const expenseIds = new Set();

  const products = raw.products.reduce((list, item) => {
    const normalized = normalizeProduct(item, fallbackNow);
    if (!normalized) return list;
    if (productIds.has(normalized.id)) normalized.id = uid();
    productIds.add(normalized.id);
    list.push(normalized);
    return list;
  }, []);

  const trx = raw.trx.reduce((list, item) => {
    const normalized = normalizeTransaction(item, fallbackNow);
    if (!normalized) return list;
    if (trxIds.has(normalized.id)) normalized.id = uid();
    trxIds.add(normalized.id);
    list.push(normalized);
    return list;
  }, []);

  const expenses = raw.expenses.reduce((list, item) => {
    const normalized = normalizeExpense(item, fallbackNow);
    if (!normalized) return list;
    if (expenseIds.has(normalized.id)) normalized.id = uid();
    expenseIds.add(normalized.id);
    list.push(normalized);
    return list;
  }, []);

  const outbox = Array.isArray(raw.outbox)
    ? raw.outbox.reduce((list, item) => {
      const normalized = normalizeOutbox(item, fallbackNow);
      if (normalized) list.push(normalized);
      return list;
    }, [])
    : [];

  return {
    products,
    trx,
    expenses,
    outbox,
    rejected: Array.isArray(raw.rejected)
      ? raw.rejected.reduce((list, item) => {
        const normalized = normalizeOutbox(item, fallbackNow);
        if (normalized) list.push({ ...normalized, error: String(item.error || '').slice(0, 200) });
        return list;
      }, []).slice(-MAX_REJECTED)
      : [],
    lastSyncAt: validIso(raw.lastSyncAt),
    pullCursor: validIso(raw.pullCursor)
  };
};

const migrateLegacyDB = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.products) || !Array.isArray(raw.trx) || !Array.isArray(raw.expenses)) return null;
  const timestamp = nowIso();
  const idMap = new Map();
  const products = raw.products.reduce((list, item) => {
    if (!item || typeof item !== 'object') return list;
    const name = String(item.name ?? '').trim();
    if (!name) return list;
    const legacyId = String(item.id ?? '').trim();
    const id = isUuid(legacyId) ? legacyId : uid();
    if (legacyId) idMap.set(legacyId, id);
    const price = Math.round(Number(item.price));
    list.push({
      id,
      name,
      price: Number.isFinite(price) && price >= 0 ? price : 0,
      cost: 0,
      image_url: null,
      category: String(item.category ?? '').trim() || 'Umum',
      active: item.active !== false,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null
    });
    return list;
  }, []);

  const trx = raw.trx.reduce((list, item) => {
    if (!item || typeof item !== 'object') return list;
    const createdAt = validIso(item.date) || validIso(item.created_at) || timestamp;
    const day = isValidDay(item.day) ? item.day : dkey(createdAt);
    if (!isValidDay(day)) return list;
    const items = Array.isArray(item.items) ? item.items.reduce((rows, row) => {
      if (!row || typeof row !== 'object') return rows;
      const name = String(row.name ?? '').trim();
      const qty = Math.floor(Number(row.qty));
      const price = Math.round(Number(row.price));
      if (!name || !Number.isFinite(qty) || qty <= 0) return rows;
      const legacyProductId = String(row.product_id ?? row.id ?? '').trim();
      rows.push({
        product_id: idMap.get(legacyProductId) || (isUuid(legacyProductId) ? legacyProductId : uid()),
        name,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        cost: 0,
        qty
      });
      return rows;
    }, []) : [];
    if (!items.length) return list;
    const total = sum(items.map((row) => row.price * row.qty));
    const pay = item.pay === 'qris' ? 'qris' : 'tunai';
    let received = Math.round(Number(item.received));
    if (!Number.isFinite(received) || received < total) received = total;
    list.push({
      id: isUuid(item.id) ? item.id : uid(),
      day,
      created_at: createdAt,
      items,
      total,
      pay,
      received: pay === 'tunai' ? received : total,
      change: pay === 'tunai' ? Math.max(0, received - total) : 0,
      updated_at: createdAt
    });
    return list;
  }, []);

  const expenses = raw.expenses.reduce((list, item) => {
    if (!item || typeof item !== 'object' || !isValidDay(item.date)) return list;
    const amount = Math.round(Number(item.amount));
    if (!Number.isFinite(amount) || amount <= 0) return list;
    list.push({
      id: isUuid(item.id) ? item.id : uid(),
      date: item.date,
      category: String(item.category ?? '').trim() || 'Lainnya',
      amount,
      note: String(item.note ?? '').trim(),
      updated_at: timestamp,
      deleted_at: null
    });
    return list;
  }, []);

  return { products, trx, expenses, outbox: [], rejected: [], lastSyncAt: null, pullCursor: null };
};

let db = createEmptyDB();
let storageOK = true;
let startupNotice = '';
let startupNoticeType = 'error';

const persist = (silent = false) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    storageOK = true;
    return true;
  } catch (error) {
    storageOK = false;
    if (!silent) {
      toast('Data gagal disimpan ke perangkat. Penyimpanan penuh atau tidak tersedia.', 'error');
    }
    return false;
  }
};

const loadInitialData = () => {
  try {
    const probe = '__warkop_pos_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch (error) {
    storageOK = false;
    db = SUPABASE_CONFIGURED ? createEmptyDB() : createSeedDB();
    startupNotice = 'Penyimpanan perangkat tidak tersedia. Data hanya bertahan selama aplikasi terbuka.';
    return;
  }

  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageOK = false;
    db = SUPABASE_CONFIGURED ? createEmptyDB() : createSeedDB();
    startupNotice = 'Penyimpanan perangkat tidak dapat dibaca. Data hanya bertahan selama aplikasi terbuka.';
    return;
  }

  if (raw) {
    try {
      const normalized = normalizeDB(JSON.parse(raw));
      if (!normalized) throw new Error('Struktur data tidak valid');
      db = normalized;
      return;
    } catch (error) {
      startupNotice = 'Data lokal tidak dapat dibaca. Mencoba memulihkan data lama.';
    }
  }

  let legacyRaw = null;
  try {
    legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch (error) {
    legacyRaw = null;
  }

  if (legacyRaw) {
    try {
      const migrated = migrateLegacyDB(JSON.parse(legacyRaw));
      if (migrated) {
        db = migrated;
        const saved = persist(true);
        if (saved) {
          try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch (error) {
            // Data lama boleh tetap ada jika pembersihan gagal.
          }
        }
        startupNotice = 'Data dari versi lama berhasil dipindahkan ke penyimpanan baru.';
        startupNoticeType = 'success';
        return;
      }
    } catch (error) {
      // Lanjut ke data awal di bawah.
    }
  }

  db = SUPABASE_CONFIGURED ? createEmptyDB() : createSeedDB();
  persist(true);
};

const state = {
  tab: 'kasir',
  category: 'Semua',
  cart: [],
  logFrom: startOfMonthKey(),
  logTo: dkey(),
  saving: false
};

const syncState = {
  client: null,
  session: null,
  user: null,
  online: navigator.onLine,
  flushing: false,
  pulling: false,
  queued: false,
  queuedPull: false,
  retryTimer: null,
  retryIndex: 0,
  kickTimer: null,
  lastError: '',
  authMessage: '',
  authMessageType: 'info',
  authFatal: '',
  lastEmail: '',
  authBusy: false,
  authVisible: false,
  initialized: false
};

let lastFocus = null;
let confirmState = null;
let confirmLastFocus = null;

const cartCountValue = () => state.cart.reduce((total, item) => total + item.qty, 0);
const cartTotalValue = () => sum(state.cart.map((item) => item.price * item.qty));
const cartQty = (id) => state.cart.find((item) => item.id === id)?.qty || 0;

const toast = (message, type = 'success') => {
  // Satu toast aktif agar notifikasi beruntun tidak menutupi layar.
  toastRoot.replaceChildren();
  const element = document.createElement('div');
  element.className = `toast is-${type === 'error' ? 'error' : 'success'}`;
  element.setAttribute('role', type === 'error' ? 'alert' : 'status');
  element.textContent = message;
  toastRoot.appendChild(element);
  window.setTimeout(() => {
    element.classList.add('is-leaving');
    window.setTimeout(() => element.remove(), 210);
  }, 2200);
};

const emptyState = (title, text, action = '') => `
  <div class="empty-state">
    <div>
      ${ICONS.cup}
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${action}
    </div>
  </div>
`;

const sheetHeader = (titleId, title, kicker) => `
  <div class="sheet-head">
    <div>
      <p class="sheet-kicker">${esc(kicker)}</p>
      <h2 id="${titleId}" class="sheet-title">${esc(title)}</h2>
    </div>
    <button class="icon-btn sheet-close" type="button" data-act="close-modal" aria-label="Tutup">${ICONS.close}</button>
  </div>
`;

const openModal = (content, options = {}) => {
  const { labelledBy = 'modal-title', id = '', focus = null } = options;
  const hadModal = modalRoot.childElementCount > 0;
  closeConfirm();
  if (!hadModal) {
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  modalRoot.innerHTML = `
    <div class="overlay" data-act="backdrop">
      <section class="sheet"${id ? ` id="${esc(id)}"` : ''} role="dialog" aria-modal="true" aria-labelledby="${esc(labelledBy)}" tabindex="-1">
        ${content}
      </section>
    </div>
  `;
  document.body.classList.add('modal-open');
  window.requestAnimationFrame(() => {
    const focusTarget = focus ? document.querySelector(focus) : null;
    const sheet = modalRoot.querySelector('.sheet');
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    } else if (sheet instanceof HTMLElement) {
      sheet.focus();
    }
  });
};

const closeModal = () => {
  closeConfirm();
  if (!modalRoot.childElementCount) return;
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
  state.saving = false;
  if (lastFocus instanceof HTMLElement && document.contains(lastFocus)) {
    lastFocus.focus();
  }
  lastFocus = null;
};

const openConfirm = (options) => {
  const {
    title,
    message,
    confirmLabel = 'Hapus',
    cancelLabel = 'Batal',
    danger = true,
    onConfirm = null
  } = options;
  closeConfirm();
  confirmState = { onConfirm };
  confirmLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalRoot.insertAdjacentHTML('beforeend', `
    <div class="overlay confirm-overlay" data-act="confirm-backdrop">
      <section class="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" tabindex="-1">
        <h2 id="confirm-title">${esc(title)}</h2>
        <p id="confirm-message">${esc(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" type="button" data-act="confirm-cancel" id="confirm-cancel">${esc(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-act="confirm-accept" id="confirm-accept">${esc(confirmLabel)}</button>
        </div>
      </section>
    </div>
  `);
  window.requestAnimationFrame(() => document.getElementById('confirm-cancel')?.focus());
};

const closeConfirm = () => {
  const layer = modalRoot.querySelector('.confirm-overlay');
  if (!layer) return;
  layer.remove();
  const restore = confirmLastFocus;
  confirmLastFocus = null;
  confirmState = null;
  if (restore instanceof HTMLElement && document.contains(restore)) restore.focus();
};

const acceptConfirm = () => {
  const action = confirmState?.onConfirm;
  closeConfirm();
  if (typeof action === 'function') action();
};

const getLogData = () => {
  const trx = db.trx
    .filter((item) => item.day >= state.logFrom && item.day <= state.logTo)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const expenses = db.expenses
    .filter((item) => !item.deleted_at && item.date >= state.logFrom && item.date <= state.logTo)
    .map((item, index) => ({ ...item, _index: index }))
    .sort((a, b) => b.date.localeCompare(a.date) || b._index - a._index);
  return {
    trx,
    expenses,
    summary: summarize(trx, expenses),
    days: perDay(trx, expenses)
  };
};

const trxCost = (trx) => sum(trx.items.map((row) => (Number(row.cost) || 0) * row.qty));

const summarize = (trx, expenses) => {
  const omzet = sum(trx.map((item) => item.total));
  const modal = sum(trx.map(trxCost));
  const tunai = sum(trx.filter((item) => item.pay === 'tunai').map((item) => item.total));
  const qris = sum(trx.filter((item) => item.pay === 'qris').map((item) => item.total));
  const pengeluaran = sum(expenses.map((item) => item.amount));
  return {
    omzet,
    modal,
    tunai,
    qris,
    pengeluaran,
    labaKotor: omzet - modal,
    laba: omzet - modal - pengeluaran,
    count: trx.length
  };
};

const perDay = (trx, expenses) => {
  const groups = new Map();
  const ensure = (day) => {
    if (!groups.has(day)) groups.set(day, { day, trx: [], expenses: [] });
    return groups.get(day);
  };
  trx.forEach((item) => ensure(item.day).trx.push(item));
  expenses.forEach((item) => ensure(item.date).expenses.push(item));

  return Array.from(groups.values())
    .map((group) => {
      group.trx.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const omzet = sum(group.trx.map((item) => item.total));
      const modal = sum(group.trx.map(trxCost));
      const tunai = sum(group.trx.filter((item) => item.pay === 'tunai').map((item) => item.total));
      const qris = sum(group.trx.filter((item) => item.pay === 'qris').map((item) => item.total));
      const pengeluaran = sum(group.expenses.map((item) => item.amount));
      return {
        ...group,
        omzet,
        modal,
        tunai,
        qris,
        pengeluaran,
        laba: omzet - modal - pengeluaran,
        trxCount: group.trx.length
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
};

const renderCartBar = () => {
  const count = cartCountValue();
  const total = cartTotalValue();
  const visible = state.tab === 'kasir' && count > 0;
  cartBar.hidden = !visible;
  view.classList.toggle('with-cart', visible);
  cartCount.textContent = `${count} item`;
  cartTotal.textContent = rp(total);
  cartBar.setAttribute('aria-label', `Buka keranjang, ${count} item, total ${rp(total)}`);
};

// Tanggal: teks buatan sendiri + input asli transparan di atasnya, supaya tampilan identik di iOS dan Android.
const dateText = (value) => (isValidDay(value) ? formatShortDate(value) : 'Pilih tanggal');

const dateField = (id, value, extra = '') => `
  <div class="date-field">
    <span class="date-display" data-date-for="${id}">${esc(dateText(value))}</span>
    <svg class="date-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6h14v14H5z"></path><path d="M5 10h14M9 4v4M15 4v4"></path></svg>
    <input class="date-native" type="date" id="${id}" value="${esc(value)}" ${extra}>
  </div>
`;

const FORM_KEEP_IDS = ['e-date', 'e-category', 'e-amount', 'e-note'];

const render = (options = {}) => {
  const keptForm = options.keepForm && state.tab === 'pengeluaran'
    ? FORM_KEEP_IDS.map((id) => {
      const el = document.getElementById(id);
      return el ? { id, value: el.value, focused: document.activeElement === el } : null;
    }).filter(Boolean)
    : [];
  const meta = TAB_META[state.tab] || TAB_META.kasir;
  pageTitle.textContent = meta.title;
  pageSubtitle.textContent = meta.subtitle;
  document.title = `${meta.title} - Warkop POS`;

  navButtons.forEach((button) => {
    const active = button.dataset.tab === state.tab;
    button.classList.toggle('is-active', active);
    if (active) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  if (state.tab === 'kasir') {
    view.innerHTML = kasirView();
  } else if (state.tab === 'produk') {
    view.innerHTML = produkView();
  } else if (state.tab === 'pengeluaran') {
    view.innerHTML = pengeluaranView();
  } else {
    view.innerHTML = logbookView();
  }
  keptForm.forEach(({ id, value, focused }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    if (focused) el.focus({ preventScroll: true });
  });
  renderCartBar();
  renderSyncStatus();
};

const kasirView = () => {
  const activeProducts = db.products
    .filter((product) => product.active && !product.deleted_at)
    .sort((a, b) => a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' }));
  const categories = ['Semua', ...Array.from(new Set(activeProducts.map((product) => product.category)))
    .sort((a, b) => a.localeCompare(b, 'id-ID', { sensitivity: 'base' }))];

  if (state.category !== 'Semua' && !categories.includes(state.category)) {
    state.category = 'Semua';
  }
  const products = state.category === 'Semua'
    ? activeProducts
    : activeProducts.filter((product) => product.category === state.category);

  if (!activeProducts.length) {
    return `
      <section class="section">
        ${emptyState(
          'Belum ada menu aktif',
          'Tambahkan produk terlebih dahulu agar bisa dipilih di kasir.',
          '<button class="btn btn-primary" type="button" data-act="tab" data-tab="produk">Buka halaman Produk</button>'
        )}
      </section>
    `;
  }

  const chips = categories.map((category) => `
    <button class="chip ${state.category === category ? 'is-active' : ''}" type="button" data-act="category" data-category="${esc(category)}" aria-pressed="${state.category === category}">
      ${esc(category)}
    </button>
  `).join('');

  const cards = products.map((product) => {
    const qty = cartQty(product.id);
    const controls = qty
      ? `
        <div class="qty-control" role="group" aria-label="Jumlah ${esc(product.name)}">
          <button class="qty-btn" type="button" data-act="menu-dec" data-id="${esc(product.id)}" aria-label="Kurangi ${esc(product.name)}">${ICONS.minus}</button>
          <span class="qty-value" aria-live="polite">${qty}</span>
          <button class="qty-btn is-plus" type="button" data-act="add-cart" data-id="${esc(product.id)}" aria-label="Tambah ${esc(product.name)}">${ICONS.plus}</button>
        </div>`
      : `<button class="qty-btn is-plus is-solo" type="button" data-act="add-cart" data-id="${esc(product.id)}" aria-label="Tambah ${esc(product.name)} ke keranjang">${ICONS.plus}</button>`;
    return `
      <div class="menu-row ${qty ? 'is-selected' : ''}">
        <span class="menu-thumb"><img src="${esc(productPhoto(product))}" alt="" loading="lazy" decoding="async"></span>
        <span class="menu-info">
          <span class="menu-name">${esc(product.name)}</span>
          <span class="menu-price">${rp(product.price)}</span>
        </span>
        ${controls}
      </div>
    `;
  }).join('');

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Menu</h2>
          <p>Pilih menu untuk menambah ke keranjang.</p>
        </div>
        <span class="section-count">${plural(products.length, 'menu')}</span>
      </div>
      <div class="chip-row" role="group" aria-label="Filter kategori">
        ${chips}
      </div>
      ${products.length ? `<div class="menu-list">${cards}</div>` : emptyState('Menu tidak ditemukan', 'Coba pilih kategori lain.')}
    </section>
  `;
};

const produkView = () => {
  const products = db.products
    .filter((product) => !product.deleted_at)
    .sort((a, b) => (
      a.category.localeCompare(b.category, 'id-ID', { sensitivity: 'base' })
      || a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' })
    ));
  const activeCount = products.filter((product) => product.active).length;
  const categoryNames = Array.from(new Set(products.map((product) => product.category)))
    .sort((a, b) => a.localeCompare(b, 'id-ID', { sensitivity: 'base' }));

  const header = `
    <div class="section-head">
      <div>
        <h2>Daftar produk</h2>
        <p>${products.length} produk, ${activeCount} tampil di kasir.</p>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-act="new-product" aria-label="Tambah produk">
        ${ICONS.plus}
        <span>Tambah produk</span>
      </button>
    </div>
  `;

  if (!products.length) {
    return `
      <section class="section">
        ${header}
        ${emptyState(
          'Belum ada produk',
          'Tambahkan menu pertama warkop untuk mulai berjualan.',
          '<button class="btn btn-primary" type="button" data-act="new-product">Tambah produk</button>'
        )}
      </section>
    `;
  }

  const groups = categoryNames.map((category) => {
    const items = products.filter((product) => product.category === category);
    const rows = items.map((product) => `
      <button class="product-row ${product.active ? '' : 'is-inactive'}" type="button" data-act="edit-product" data-id="${esc(product.id)}" aria-label="Edit ${esc(product.name)}">
        <span class="product-row-thumb"><img src="${esc(productPhoto(product))}" alt="" loading="lazy" decoding="async"></span>
        <span class="product-row-main">
          <span class="product-row-name">${esc(product.name)}</span>
          <span class="product-row-meta">
            ${product.active ? '' : '<span class="badge-muted">Nonaktif</span>'}
            <span>Modal ${rp(product.cost || 0)}</span>
            <span class="${product.price - (product.cost || 0) >= 0 ? 'margin-pos' : 'margin-neg'}">Untung ${signedRp(product.price - (product.cost || 0))}</span>
          </span>
        </span>
        <span class="product-row-price">${rp(product.price)}</span>
        <span class="chevron">${ICONS.chevron}</span>
      </button>
    `).join('');
    return `
      <div class="category-block">
        <div class="category-title">${esc(category)} <span>${items.length}</span></div>
        <div class="product-list">${rows}</div>
      </div>
    `;
  }).join('');

  return `
    <section class="section">
      ${header}
      ${groups}
    </section>
  `;
};

const pengeluaranView = () => {
  const currentMonth = dkey().slice(0, 7);
  const expenses = db.expenses
    .map((item, index) => ({ ...item, _index: index }))
    .filter((item) => !item.deleted_at && item.date.slice(0, 7) === currentMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || b._index - a._index);
  const total = sum(expenses.map((item) => item.amount));

  const rows = expenses.map((item) => `
    <div class="expense-row">
      <div class="expense-main">
        <span class="expense-category">${esc(item.category)}</span>
        <span class="expense-date">${formatShortDate(item.date)}</span>
        <span class="expense-note">${item.note ? esc(item.note) : 'Tanpa catatan'}</span>
      </div>
      <div class="expense-side">
        <span class="expense-amount">-${rp(item.amount)}</span>
        <button class="delete-btn" type="button" data-act="delete-expense" data-id="${esc(item.id)}" aria-label="Hapus pengeluaran ${esc(item.category)} ${rp(item.amount)}">${ICONS.trash}</button>
      </div>
    </div>
  `).join('');

  return `
    <section class="section">
      <div class="card form-card">
        <div class="form-head">
          <h2>Catat pengeluaran</h2>
          <p>Masukkan biaya yang keluar hari ini atau tanggal lain.</p>
        </div>
        <form id="expense-form" autocomplete="off">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="e-date">Tanggal</label>
              ${dateField('e-date', dkey(), 'required')}
            </div>
            <div class="field">
              <label class="field-label" for="e-category">Kategori</label>
              <select class="select" id="e-category">
                ${EXPENSE_CATEGORIES.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="e-amount">Nominal</label>
              <div class="input-money">
                <span>Rp</span>
                <input class="input" type="text" id="e-amount" inputmode="numeric" placeholder="0" data-money-input autocomplete="off">
              </div>
            </div>
            <div class="field">
              <label class="field-label" for="e-note">Catatan <span class="hint">(opsional)</span></label>
              <input class="input" type="text" id="e-note" placeholder="Contoh: beli kopi dan gula" autocomplete="off">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" data-act="save-expense">${ICONS.plus} Tambah pengeluaran</button>
          </div>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="expense-summary">
        <div>
          <span>Total pengeluaran bulan ini</span>
          <strong>${rp(total)}</strong>
        </div>
        <div class="month-label">${monthLabel(currentMonth + '-01')}</div>
      </div>
      <div class="section-head">
        <div>
          <h2>Pengeluaran bulan berjalan</h2>
          <p>Daftar biaya yang sudah dicatat.</p>
        </div>
        <span class="section-count">${plural(expenses.length, 'catatan')}</span>
      </div>
      ${expenses.length ? `<div class="expense-list">${rows}</div>` : emptyState('Belum ada pengeluaran', 'Pengeluaran yang dicatat bulan ini akan muncul di sini.')}
    </section>
  `;
};

const logbookView = () => {
  const data = getLogData();
  const today = dkey();
  const lastSeven = addDaysKey(today, -6);
  const thisMonth = startOfMonthKey();
  const summary = data.summary;
  const isToday = state.logFrom === today && state.logTo === today;
  const isSeven = state.logFrom === lastSeven && state.logTo === today;
  const isMonth = state.logFrom === thisMonth && state.logTo === today;

  const summaryCards = `
    <div class="summary-grid">
      <article class="summary-hero">
        <span class="summary-label">Omzet</span>
        <strong class="summary-value">${rp(summary.omzet)}</strong>
        <span class="summary-meta">${plural(summary.count, 'transaksi')} pada periode ini</span>
      </article>
      <article class="summary-card">
        <span class="summary-label">Tunai</span>
        <strong class="summary-value">${rp(summary.tunai)}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">QRIS</span>
        <strong class="summary-value">${rp(summary.qris)}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Modal (HPP)</span>
        <strong class="summary-value">${rp(summary.modal)}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Pengeluaran</span>
        <strong class="summary-value">${rp(summary.pengeluaran)}</strong>
      </article>
      <article class="summary-card laba">
        <span class="summary-label">Laba bersih</span>
        <strong class="summary-value ${summary.laba >= 0 ? 'is-positive' : 'is-negative'}">${signedRp(summary.laba)}</strong>
      </article>
    </div>
  `;

  const dayCards = data.days.map((day) => {
    const trxRows = day.trx.map((trx) => `
      <div class="trx-row">
        <div class="trx-main">
          <div class="trx-meta">
            <span class="trx-time">${formatTime(trx.created_at)}</span>
            <span class="pay-badge ${trx.pay}">${trx.pay === 'tunai' ? 'TUNAI' : 'QRIS'}</span>
          </div>
          <p class="trx-items">${trx.items.map((item) => `${esc(item.name)} x${item.qty}`).join(', ')}</p>
        </div>
        <strong class="trx-total">${rp(trx.total)}</strong>
      </div>
    `).join('');

    const expenseRows = day.expenses.map((expense) => `
      <div class="day-expense">
        <span class="expense-tag">Pengeluaran</span>
        <span class="day-expense-text">${esc(expense.category)}${expense.note ? ` - ${esc(expense.note)}` : ''}</span>
        <strong class="day-expense-amount">-${rp(expense.amount)}</strong>
      </div>
    `).join('');

    return `
      <article class="day-card">
        <div class="day-head">
          <div>
            <span class="day-name">${formatLongDay(day.day)}</span>
            <span class="day-meta">${plural(day.trxCount, 'transaksi')}</span>
          </div>
          <strong class="day-total">${rp(day.omzet)}</strong>
        </div>
        ${trxRows}
        ${expenseRows}
      </article>
    `;
  }).join('');

  return `
    <section class="section">
      <div class="card log-filter">
        <div class="filter-grid">
          <div class="field">
            <label class="field-label" for="log-from">Dari tanggal</label>
            ${dateField('log-from', state.logFrom, 'data-log-date="from"')}
          </div>
          <div class="field">
            <label class="field-label" for="log-to">Sampai tanggal</label>
            ${dateField('log-to', state.logTo, 'data-log-date="to"')}
          </div>
        </div>
        <div class="quick-row" role="group" aria-label="Pilihan rentang cepat">
          <button class="quick-chip ${isToday ? 'is-active' : ''}" type="button" data-act="log-preset" data-preset="today" aria-pressed="${isToday}">Hari ini</button>
          <button class="quick-chip ${isSeven ? 'is-active' : ''}" type="button" data-act="log-preset" data-preset="seven" aria-pressed="${isSeven}">7 hari</button>
          <button class="quick-chip ${isMonth ? 'is-active' : ''}" type="button" data-act="log-preset" data-preset="month" aria-pressed="${isMonth}">Bulan ini</button>
        </div>
      </div>
    </section>

    <div class="export-row">
      <button class="btn btn-ghost" type="button" data-act="export-pdf">${ICONS.pdf} Ekspor PDF</button>
      <button class="btn btn-ghost" type="button" data-act="export-xlsx">${ICONS.sheet} Ekspor Excel</button>
    </div>

    ${summaryCards}

    <section class="section">
      <div class="section-head">
        <div>
          <h2>Rincian per hari</h2>
          <p>Transaksi dan pengeluaran diurutkan dari yang terbaru.</p>
        </div>
      </div>
      ${data.days.length
        ? `<div class="day-list">${dayCards}</div>`
        : emptyState('Tidak ada data pada periode ini', 'Coba pilih rentang tanggal lain atau catat transaksi baru di halaman Kasir.')}
    </section>
  `;
};

const paymentSheetContent = () => {
  const items = state.cart.map((item) => `
    <div class="pay-item">
      <div class="pay-item-info">
        <span class="pay-item-name">${esc(item.name)}</span>
        <span class="pay-item-price">${rp(item.price)} per item</span>
      </div>
      <div class="qty-control" aria-label="Atur jumlah ${esc(item.name)}">
        <button class="qty-btn" type="button" data-act="dec-item" data-id="${esc(item.id)}" aria-label="Kurangi ${esc(item.name)}">${ICONS.minus}</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn" type="button" data-act="inc-item" data-id="${esc(item.id)}" aria-label="Tambah ${esc(item.name)}">${ICONS.plus}</button>
      </div>
    </div>
  `).join('');

  return `
    ${sheetHeader('payment-title', 'Pembayaran', 'Keranjang kasir')}
    <div class="sheet-body">
      <div class="pay-list">${items}</div>
    </div>
    <div class="sheet-footer">
      <div class="sheet-total">
        <span>Total</span>
        <strong>${rp(cartTotalValue())}</strong>
      </div>
      <div class="pay-actions">
        <button class="btn btn-primary" type="button" data-act="open-cash">Tunai</button>
        <button class="btn btn-qris" type="button" data-act="open-qris">QRIS</button>
      </div>
      <div class="pay-secondary">
        <button class="link-btn" type="button" data-act="close-modal">Batal</button>
        <button class="link-btn danger" type="button" data-act="clear-cart">Kosongkan keranjang</button>
      </div>
    </div>
  `;
};

const openCartSheet = () => {
  if (!cartCountValue()) {
    toast('Keranjang kosong', 'error');
    return;
  }
  openModal(paymentSheetContent(), { labelledBy: 'payment-title', id: 'payment-sheet' });
};

const refreshPaymentSheet = () => {
  const sheet = document.getElementById('payment-sheet');
  if (!sheet) return;
  const scrollTop = sheet.scrollTop;
  sheet.innerHTML = paymentSheetContent();
  sheet.scrollTop = scrollTop;
};

const openCashModal = () => {
  if (!cartCountValue()) {
    toast('Keranjang kosong', 'error');
    return;
  }
  const total = cartTotalValue();
  const denominations = [10000, 20000, 50000, 100000];
  const quick = [{ label: 'Uang pas', value: total }];
  const seen = new Set([total]);
  const roundedUp = [50000, 100000].map((step) => Math.ceil(total / step) * step);
  [...denominations, ...roundedUp].sort((a, b) => a - b).forEach((value) => {
    if (value >= total && !seen.has(value) && quick.length < 5) {
      quick.push({ label: value.toLocaleString('id-ID'), value });
      seen.add(value);
    }
  });

  const content = `
    ${sheetHeader('cash-title', 'Pembayaran tunai', 'Metode TUNAI')}
    <div class="sheet-body">
      <div class="cash-total">
        <span>Total tagihan</span>
        <strong>${rp(total)}</strong>
      </div>
      <form id="cash-form" autocomplete="off">
        <div class="field">
          <label class="field-label" for="cash-received">Uang diterima</label>
          <div class="input-money">
            <span>Rp</span>
            <input class="input" type="text" id="cash-received" inputmode="numeric" placeholder="0" data-money-input aria-describedby="cash-status" autocomplete="off">
          </div>
        </div>
        <div class="quick-pay">
          ${quick.map((item) => `<button type="button" data-act="cash-quick" data-amount="${item.value}">${esc(item.label)}</button>`).join('')}
        </div>
        <div class="cash-status is-neutral" id="cash-status" aria-live="polite">Masukkan uang yang diterima.</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-act="close-modal">Batal</button>
          <button class="btn btn-primary" type="submit" id="cash-save" data-act="save-cash" disabled>Simpan</button>
        </div>
      </form>
    </div>
  `;
  openModal(content, { labelledBy: 'cash-title', focus: '#cash-received' });
};

const updateCashState = () => {
  const input = document.getElementById('cash-received');
  const status = document.getElementById('cash-status');
  const saveButton = document.getElementById('cash-save');
  if (!input || !status || !saveButton) return;

  const received = parseMoney(input.value);
  const total = cartTotalValue();
  let className = 'cash-status is-neutral';
  let message = 'Masukkan uang yang diterima.';
  let disabled = true;

  if (received !== null) {
    if (received < total) {
      className = 'cash-status is-error';
      message = `Kurang ${rp(total - received)}`;
    } else {
      className = 'cash-status is-success';
      message = `Kembalian ${rp(received - total)}`;
      disabled = false;
    }
  }

  status.className = className;
  status.textContent = message;
  saveButton.disabled = disabled || state.saving;
};

const setCashAmount = (amount) => {
  const input = document.getElementById('cash-received');
  if (!input) return;
  input.value = formatMoneyField(Math.max(0, Number(amount) || 0));
  updateCashState();
};

const openQrisModal = () => {
  if (!cartCountValue()) {
    toast('Keranjang kosong', 'error');
    return;
  }
  const total = cartTotalValue();
  const content = `
    ${sheetHeader('qris-title', 'Konfirmasi QRIS', 'Metode QRIS')}
    <div class="sheet-body">
      <div class="qris-box">
        <span class="qris-label">Total pembayaran</span>
        <strong class="qris-total">${rp(total)}</strong>
        <p class="qris-warning">Pastikan dana QRIS sudah masuk sebelum menyimpan</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" data-act="close-modal">Batal</button>
        <button class="btn btn-primary" type="button" data-act="save-qris">Konfirmasi &amp; Simpan</button>
      </div>
    </div>
  `;
  openModal(content, { labelledBy: 'qris-title' });
};

const completeSale = (pay, receivedAmount) => {
  if (state.saving) return;
  if (!state.cart.length) {
    toast('Keranjang kosong', 'error');
    closeModal();
    return;
  }

  state.saving = true;
  const actionButton = document.querySelector('[data-act="save-cash"], [data-act="save-qris"]');
  if (actionButton instanceof HTMLButtonElement) {
    actionButton.disabled = true;
    actionButton.textContent = 'Menyimpan...';
  }

  const items = state.cart.map((item) => ({
    product_id: item.id,
    name: item.name,
    price: item.price,
    cost: item.cost || 0,
    qty: item.qty
  }));
  const total = sum(items.map((item) => item.price * item.qty));
  const received = pay === 'tunai' ? Math.round(Number(receivedAmount) || 0) : total;
  const change = pay === 'tunai' ? Math.max(0, received - total) : 0;
  const now = new Date();
  const createdAt = now.toISOString();

  const trx = {
    id: uid(),
    day: dkey(now),
    created_at: createdAt,
    items,
    total,
    pay,
    received,
    change,
    updated_at: createdAt
  };
  db.trx.push(trx);
  state.cart = [];
  state.saving = false;
  const saved = enqueueChange('transactions', transactionToRow(trx));
  closeModal();
  render();

  if (saved) {
    toast(pay === 'tunai' ? 'Transaksi tunai berhasil disimpan.' : 'Transaksi QRIS berhasil disimpan.');
  } else {
    toast('Transaksi tersimpan di sesi ini, tetapi gagal disimpan permanen.', 'error');
  }
};

const saveCash = () => {
  if (state.saving) return;
  const input = document.getElementById('cash-received');
  if (!input) return;
  const received = parseMoney(input.value);
  const total = cartTotalValue();
  if (received === null) {
    toast('Masukkan uang diterima terlebih dahulu.', 'error');
    input.focus();
    return;
  }
  if (received < total) {
    toast('Uang diterima kurang dari total pembayaran.', 'error');
    return;
  }
  completeSale('tunai', received);
};

const addToCart = (id) => {
  const product = db.products.find((item) => item.id === id && !item.deleted_at);
  if (!product || !product.active) {
    toast('Produk tidak tersedia.', 'error');
    return;
  }
  const existing = state.cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
    existing.name = product.name;
    existing.price = product.price;
    existing.cost = product.cost || 0;
  } else {
    state.cart.push({ id: product.id, name: product.name, price: product.price, cost: product.cost || 0, qty: 1 });
  }
  render();
};

const decFromMenu = (id) => {
  const item = state.cart.find((row) => row.id === id);
  if (!item) return;
  item.qty -= 1;
  if (item.qty <= 0) state.cart = state.cart.filter((row) => row.id !== id);
  render();
};

const changeCartQty = (id, delta) => {
  const item = state.cart.find((row) => row.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter((row) => row.id !== id);
  }
  render();
  if (!state.cart.length) {
    closeModal();
    toast('Keranjang kosong');
    return;
  }
  refreshPaymentSheet();
};

const openProductModal = (id = '') => {
  const product = id ? db.products.find((item) => item.id === id && !item.deleted_at) : null;
  if (id && !product) {
    toast('Produk tidak ditemukan.', 'error');
    return;
  }
  const categories = Array.from(new Set(
    db.products.filter((item) => !item.deleted_at).map((item) => item.category)
  )).sort((a, b) => a.localeCompare(b, 'id-ID', { sensitivity: 'base' }));
  const initialCategory = product
    ? product.category
    : (state.category !== 'Semua' ? state.category : '');
  const content = `
    ${sheetHeader('product-title', product ? 'Edit produk' : 'Tambah produk', 'Menu warkop')}
    <div class="sheet-body">
      <form id="product-form" data-id="${product ? esc(product.id) : ''}" autocomplete="off">
        <div class="photo-field">
          <div class="photo-preview"><img src="${esc(productPhoto(product || { name: 'Produk baru', category: initialCategory }))}" alt="Foto produk"></div>
          <p class="field-hint">Foto contoh sementara. Fitur unggah foto produk menyusul.</p>
        </div>
        <div class="field">
          <label class="field-label" for="p-name">Nama produk</label>
          <input class="input" type="text" id="p-name" value="${product ? esc(product.name) : ''}" placeholder="Contoh: Kopi Susu" autocomplete="off">
        </div>
        <div class="field">
          <label class="field-label" for="p-price">Harga jual</label>
          <div class="input-money">
            <span>Rp</span>
            <input class="input" type="text" id="p-price" inputmode="numeric" value="${product ? formatMoneyField(product.price) : ''}" placeholder="0" data-money-input autocomplete="off">
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="p-cost">Harga modal</label>
          <div class="input-money">
            <span>Rp</span>
            <input class="input" type="text" id="p-cost" inputmode="numeric" value="${product ? formatMoneyField(product.cost || 0) : ''}" placeholder="0" data-money-input autocomplete="off">
          </div>
          <p class="field-hint margin-hint" id="p-margin" aria-live="polite"></p>
        </div>
        <div class="field">
          <label class="field-label" for="p-category">Kategori</label>
          <input class="input" type="text" id="p-category" value="${product ? esc(product.category) : esc(initialCategory)}" list="category-list" placeholder="Contoh: Minuman" autocomplete="off">
          <datalist id="category-list">
            ${categories.map((category) => `<option value="${esc(category)}"></option>`).join('')}
          </datalist>
          <p class="field-hint">Kosongkan untuk memakai kategori Umum. Kamu juga bisa mengetik kategori baru.</p>
        </div>
        <label class="switch-row" for="p-active">
          <span class="switch-copy">
            <strong>Tampilkan di kasir</strong>
            <span>Aktifkan agar produk muncul di halaman Kasir.</span>
          </span>
          <input type="checkbox" id="p-active" ${!product || product.active ? 'checked' : ''}>
          <span class="switch-control" aria-hidden="true"></span>
        </label>
        <div class="modal-actions">
          ${product ? `<button class="btn btn-danger-ghost btn-spacer" type="button" data-act="delete-product" data-id="${esc(product.id)}">${ICONS.trash} Hapus</button>` : ''}
          <button class="btn btn-ghost" type="button" data-act="close-modal">Batal</button>
          <button class="btn btn-primary" type="submit" data-act="save-product">Simpan</button>
        </div>
      </form>
    </div>
  `;
  openModal(content, { labelledBy: 'product-title', focus: '#p-name' });
  updateMarginHint();
};

const updateMarginHint = () => {
  const hint = document.getElementById('p-margin');
  const priceInput = document.getElementById('p-price');
  const costInput = document.getElementById('p-cost');
  if (!hint || !priceInput || !costInput) return;
  const price = parseMoney(priceInput.value);
  const cost = parseMoney(costInput.value) ?? 0;
  hint.classList.remove('is-pos', 'is-neg');
  if (price === null) {
    hint.textContent = 'Isi harga jual dan modal untuk melihat untung per item.';
    return;
  }
  const profit = price - cost;
  const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
  if (profit < 0) {
    hint.classList.add('is-neg');
    hint.textContent = `Rugi ${rp(Math.abs(profit))} per item. Harga jual di bawah modal.`;
  } else {
    hint.classList.add('is-pos');
    hint.textContent = `Untung ${rp(profit)} per item (margin ${margin}%).`;
  }
};

const saveProduct = () => {
  const form = document.getElementById('product-form');
  if (!form) return;
  const id = form.dataset.id;
  const nameInput = document.getElementById('p-name');
  const priceInput = document.getElementById('p-price');
  const costInput = document.getElementById('p-cost');
  const categoryInput = document.getElementById('p-category');
  const activeInput = document.getElementById('p-active');
  if (!nameInput || !priceInput || !costInput || !categoryInput || !activeInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    toast('Nama produk wajib diisi.', 'error');
    nameInput.focus();
    return;
  }
  const price = parseMoney(priceInput.value);
  if (price === null) {
    toast('Harga jual wajib diisi.', 'error');
    priceInput.focus();
    return;
  }
  if (price < 0) {
    toast('Harga produk tidak boleh negatif.', 'error');
    return;
  }
  const cost = parseMoney(costInput.value) ?? 0;
  const category = categoryInput.value.trim() || 'Umum';
  const active = activeInput.checked;
  let message = 'Produk berhasil ditambahkan.';
  let savedProduct = null;

  if (id) {
    const index = db.products.findIndex((item) => item.id === id && !item.deleted_at);
    if (index < 0) {
      toast('Produk tidak ditemukan.', 'error');
      return;
    }
    savedProduct = {
      ...db.products[index],
      name,
      price,
      cost,
      category,
      active,
      updated_at: nowIso()
    };
    db.products[index] = savedProduct;
    state.cart = state.cart
      .filter((item) => item.id !== id || active)
      .map((item) => (item.id === id ? { ...item, name, price, cost } : item));
    message = 'Produk berhasil diperbarui.';
  } else {
    const timestamp = nowIso();
    savedProduct = {
      id: uid(),
      name,
      price,
      cost,
      image_url: null,
      category,
      active,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null
    };
    db.products.push(savedProduct);
  }

  const saved = enqueueChange('products', productToRow(savedProduct));
  closeModal();
  render();
  toast(saved ? message : 'Perubahan tersimpan di sesi ini, tetapi gagal disimpan permanen.', saved ? 'success' : 'error');
};

const deleteProduct = (id) => {
  const product = db.products.find((item) => item.id === id && !item.deleted_at);
  if (!product) {
    toast('Produk tidak ditemukan.', 'error');
    return;
  }
  openConfirm({
    title: 'Hapus produk?',
    message: `${product.name} akan dihapus dari daftar produk. Transaksi lama tetap tersimpan.`,
    confirmLabel: 'Hapus',
    danger: true,
    onConfirm: () => {
      const index = db.products.findIndex((item) => item.id === id);
      if (index < 0) return;
      const timestamp = nowIso();
      db.products[index] = {
        ...db.products[index],
        active: false,
        deleted_at: timestamp,
        updated_at: timestamp
      };
      state.cart = state.cart.filter((item) => item.id !== id);
      const saved = enqueueChange('products', productToRow(db.products[index]));
      closeModal();
      render();
      toast(saved ? 'Produk berhasil dihapus.' : 'Produk terhapus di sesi ini, tetapi gagal disimpan permanen.', saved ? 'success' : 'error');
    }
  });
};

const saveExpense = () => {
  const dateInput = document.getElementById('e-date');
  const categoryInput = document.getElementById('e-category');
  const amountInput = document.getElementById('e-amount');
  const noteInput = document.getElementById('e-note');
  if (!dateInput || !categoryInput || !amountInput || !noteInput) return;

  const date = dateInput.value;
  if (!isValidDay(date)) {
    toast('Tanggal pengeluaran wajib diisi.', 'error');
    dateInput.focus();
    return;
  }
  const amount = parseMoney(amountInput.value);
  if (amount === null || amount <= 0) {
    toast('Nominal pengeluaran harus lebih dari 0.', 'error');
    amountInput.focus();
    return;
  }
  const category = EXPENSE_CATEGORIES.includes(categoryInput.value) ? categoryInput.value : 'Lainnya';
  const note = noteInput.value.trim();
  const timestamp = nowIso();
  const expense = {
    id: uid(),
    date,
    category,
    amount,
    note,
    updated_at: timestamp,
    deleted_at: null
  };

  db.expenses.push(expense);
  const saved = enqueueChange('expenses', expenseToRow(expense));
  render();
  toast(saved ? 'Pengeluaran berhasil ditambahkan.' : 'Pengeluaran tersimpan di sesi ini, tetapi gagal disimpan permanen.', saved ? 'success' : 'error');
};

const deleteExpense = (id) => {
  const expense = db.expenses.find((item) => item.id === id && !item.deleted_at);
  if (!expense) {
    toast('Pengeluaran tidak ditemukan.', 'error');
    return;
  }
  openConfirm({
    title: 'Hapus pengeluaran?',
    message: `Catatan ${expense.category} sebesar ${rp(expense.amount)} akan dihapus.`,
    confirmLabel: 'Hapus',
    danger: true,
    onConfirm: () => {
      const index = db.expenses.findIndex((item) => item.id === id);
      if (index < 0) return;
      const timestamp = nowIso();
      db.expenses[index] = {
        ...db.expenses[index],
        deleted_at: timestamp,
        updated_at: timestamp
      };
      const saved = enqueueChange('expenses', expenseToRow(db.expenses[index]));
      render();
      toast(saved ? 'Pengeluaran berhasil dihapus.' : 'Pengeluaran terhapus di sesi ini, tetapi gagal disimpan permanen.', saved ? 'success' : 'error');
    }
  });
};

const setLogPreset = (preset) => {
  const today = dkey();
  if (preset === 'today') {
    state.logFrom = today;
    state.logTo = today;
  } else if (preset === 'seven') {
    state.logFrom = addDaysKey(today, -6);
    state.logTo = today;
  } else {
    state.logFrom = startOfMonthKey();
    state.logTo = today;
  }
  render();
};

const productToRow = (product) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  cost: product.cost || 0,
  image_url: product.image_url || null,
  category: product.category,
  active: product.active,
  created_at: product.created_at,
  updated_at: product.updated_at,
  deleted_at: product.deleted_at || null
});

const transactionToRow = (trx) => {
  const items = trx.items.map((item) => ({
    product_id: item.product_id,
    name: item.name,
    price: item.price,
    cost: item.cost || 0,
    qty: item.qty
  }));
  return {
    id: trx.id,
    day: trx.day,
    created_at: trx.created_at,
    items,
    total: sum(items.map((item) => item.price * item.qty)),
    pay: trx.pay === 'qris' ? 'qris' : 'tunai',
    received: Math.max(0, Math.round(Number(trx.received) || 0)),
    change: Math.max(0, Math.round(Number(trx.change) || 0)),
    updated_at: trx.updated_at
  };
};

const expenseToRow = (expense) => ({
  id: expense.id,
  date: expense.date,
  category: expense.category,
  amount: expense.amount,
  note: expense.note || '',
  updated_at: expense.updated_at,
  deleted_at: expense.deleted_at || null
});

const enqueueChange = (table, payload) => {
  db.outbox.push({
    id: uid(),
    table,
    op: 'upsert',
    payload,
    createdAt: nowIso()
  });
  const saved = persist(true);
  renderSyncStatus();
  requestSync({ pull: false });
  return saved;
};

const getSyncStatus = () => {
  const pendingCount = db.outbox.length;
  if (supabaseConfigIssue) {
    return {
      kind: 'error',
      text: 'Konfigurasi bermasalah',
      hint: supabaseConfigIssue
    };
  }
  if (!syncState.online) {
    return {
      kind: 'offline',
      text: 'Offline',
      hint: pendingCount ? `${pendingCount} perubahan menunggu koneksi` : 'Memakai cache lokal'
    };
  }
  if (!SUPABASE_CONFIGURED) {
    return {
      kind: 'local',
      text: 'Mode lokal',
      hint: pendingCount ? `${pendingCount} perubahan lokal belum disinkronkan` : 'Supabase belum dikonfigurasi'
    };
  }
  if (!syncState.session) {
    return {
      kind: 'offline',
      text: 'Belum masuk',
      hint: 'Masuk untuk menyinkronkan data'
    };
  }
  if (syncState.lastError) {
    return {
      kind: 'error',
      text: 'Gagal sinkron',
      hint: syncState.lastError
    };
  }
  if (pendingCount) {
    return {
      kind: 'pending',
      text: `Menunggu sinkron (${pendingCount})`,
      hint: syncState.flushing || syncState.pulling ? 'Sedang mengirim perubahan...' : 'Ketuk untuk mencoba sekarang'
    };
  }
  if (syncState.flushing || syncState.pulling) {
    return {
      kind: 'pending',
      text: 'Menyinkronkan...',
      hint: 'Mengambil data terbaru'
    };
  }
  if (db.lastSyncAt) {
    return {
      kind: 'synced',
      text: 'Tersinkron',
      hint: `Terakhir ${formatDateTime(db.lastSyncAt)}`
    };
  }
  return {
    kind: 'pending',
    text: 'Menunggu sinkron (0)',
    hint: 'Siap menyinkronkan'
  };
};

const renderSyncStatus = () => {
  if (!syncStatusButton || !syncStatusText || !syncStatusHint) return;
  const status = getSyncStatus();
  syncStatusButton.className = `sync-status is-${status.kind}`;
  syncStatusText.textContent = status.text;
  syncStatusHint.textContent = status.hint;
  syncStatusButton.title = `${status.text}. ${status.hint}`;
  syncStatusButton.setAttribute('aria-label', `${status.text}. ${status.hint}. Ketuk untuk sinkronisasi.`);
};

const AUTH_BRAND = `
  <div class="auth-brand-mark" aria-hidden="true">
    <svg viewBox="0 0 64 64" role="img" focusable="false">
      <rect width="64" height="64" rx="18" fill="#2b1d13"></rect>
      <path d="M20 25h22l-2.5 14.5a8 8 0 0 1-7.9 6.5h-1.2a8 8 0 0 1-7.9-6.5L20 25Z" fill="#f6eee5"></path>
      <path d="M41 28h3.2a6.8 6.8 0 0 1 0 13.6H40" fill="none" stroke="#f6eee5" stroke-width="3.2"></path>
      <ellipse cx="31" cy="25" rx="11" ry="3.2" fill="#7a4a2a"></ellipse>
      <path d="M16 48h32" stroke="#e9a95b" stroke-width="3" stroke-linecap="round"></path>
    </svg>
  </div>
`;

const showAuthLoading = () => {
  if (!SUPABASE_CONFIGURED) return;
  closeModal();
  syncState.authVisible = true;
  document.body.classList.add('auth-locked');
  authRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          ${AUTH_BRAND}
          <div class="auth-brand-copy">
            <span>Warkop POS</span>
            <strong>Data &amp; sinkronisasi</strong>
          </div>
        </div>
        <h1>Memeriksa sesi</h1>
        <p class="auth-intro">Menghubungkan data lokal dengan Supabase.</p>
      </div>
    </div>
  `;
};

const showLoginError = (message) => {
  const box = document.getElementById('login-error');
  if (!box) {
    toast(message, 'error');
    return;
  }
  box.hidden = false;
  box.textContent = message;
};

const showAuthScreen = (message = '', type = 'info') => {
  if (!SUPABASE_CONFIGURED) return;
  closeModal();
  toastRoot.replaceChildren();
  syncState.authVisible = true;
  syncState.authMessage = message;
  syncState.authMessageType = type;
  document.body.classList.add('auth-locked');

  const fatal = syncState.authFatal;
  const offlineNote = !syncState.online
    ? '<div class="auth-info">Perangkat sedang offline. Masuk membutuhkan koneksi internet, tetapi data lokal tetap tersimpan.</div>'
    : '';
  const notice = message
    ? `<div class="${type === 'error' ? 'auth-error' : 'auth-info'}" role="alert">${esc(message)}</div>`
    : '';
  const email = esc(syncState.lastEmail || '');

  authRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          ${AUTH_BRAND}
          <div class="auth-brand-copy">
            <span>Warkop POS</span>
            <strong>Kasir warkop</strong>
          </div>
        </div>
        <h1>Masuk ke aplikasi</h1>
        <p class="auth-intro">Gunakan email dan kata sandi pemilik warkop. Akun dibuat manual dari dasbor Supabase.</p>
        ${notice}
        ${offlineNote}
        ${fatal ? `
          <div class="auth-error" role="alert">${esc(fatal)}</div>
          <button class="btn btn-primary auth-reload" type="button" data-act="reload-app">Muat ulang aplikasi</button>
        ` : `
          <form id="login-form" class="auth-form" autocomplete="on">
            <div class="field">
              <label class="field-label" for="login-email">Email</label>
              <input class="input" type="email" id="login-email" name="email" value="${email}" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
            </div>
            <div class="field">
              <label class="field-label" for="login-password">Kata sandi</label>
              <input class="input" type="password" id="login-password" name="password" autocomplete="current-password" required>
            </div>
            <div class="auth-error" id="login-error" role="alert" hidden></div>
            <button class="btn btn-primary auth-submit" type="submit" id="login-submit">Masuk</button>
          </form>
        `}
        <p class="auth-note"><strong>Data tetap aman di perangkat ini.</strong> Antrean perubahan tidak dihapus saat sesi berakhir atau saat kamu keluar.</p>
      </div>
    </div>
  `;
  window.requestAnimationFrame(() => {
    document.getElementById('login-email')?.focus({ preventScroll: true });
  });
};

const hideAuthScreen = () => {
  if (!syncState.authVisible) return;
  syncState.authVisible = false;
  authRoot.innerHTML = '';
  document.body.classList.remove('auth-locked');
};

const friendlyAuthError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
  if (message.includes('email not confirmed')) return 'Email belum dikonfirmasi. Periksa kotak masuk email.';
  if (message.includes('invalid api key')) return 'Kunci Supabase tidak valid. Periksa anon key di config.js.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Terlalu banyak percobaan masuk. Coba lagi beberapa saat.';
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('load failed')) {
    return 'Tidak dapat terhubung ke Supabase. Periksa koneksi internet.';
  }
  return error?.message || 'Gagal masuk. Periksa email dan kata sandi.';
};

const applyAuthSession = (session, options = {}) => {
  const alreadySignedIn = Boolean(syncState.session && session && syncState.user?.id === session.user?.id);
  if (alreadySignedIn && options.quiet) {
    // Refresh token atau event ulang: perbarui sesi saja, tanpa render ulang dan tarik data berulang.
    syncState.session = session;
    syncState.user = session.user || null;
    return;
  }
  syncState.session = session || null;
  syncState.user = session?.user || null;
  syncState.lastEmail = session?.user?.email || syncState.lastEmail || '';
  syncState.lastError = '';
  hideAuthScreen();
  render({ keepForm: true });
  renderSyncStatus();
  window.setTimeout(() => requestSync({ pull: true }), 60);
};

const initSupabaseAuth = async () => {
  if (!SUPABASE_CONFIGURED) {
    syncState.initialized = true;
    renderSyncStatus();
    return;
  }

  showAuthLoading();
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    syncState.initialized = true;
    syncState.authFatal = 'Pustaka Supabase belum termuat. Periksa koneksi lalu muat ulang aplikasi.';
    showAuthScreen('', 'error');
    renderSyncStatus();
    return;
  }

  try {
    syncState.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    syncState.authFatal = '';
  } catch (error) {
    syncState.initialized = true;
    syncState.authFatal = `Konfigurasi Supabase tidak valid: ${error?.message || 'periksa config.js'}`;
    showAuthScreen('', 'error');
    renderSyncStatus();
    return;
  }

  syncState.client.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      if (session) {
        applyAuthSession(session, { quiet: event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED' });
      } else if (event === 'SIGNED_OUT') {
        syncState.session = null;
        syncState.user = null;
        showAuthScreen(
          syncState.authMessage || 'Kamu telah keluar. Masuk kembali untuk melanjutkan sinkronisasi.',
          syncState.authMessageType || 'info'
        );
        renderSyncStatus();
        render();
      }
    }, 0);
  });

  try {
    const { data, error } = await syncState.client.auth.getSession();
    syncState.initialized = true;
    if (error) {
      showAuthScreen(`Gagal memeriksa sesi: ${friendlyAuthError(error)}`, 'error');
    } else if (data?.session) {
      applyAuthSession(data.session);
    } else {
      showAuthScreen();
    }
    renderSyncStatus();
  } catch (error) {
    syncState.initialized = true;
    showAuthScreen(`Gagal memeriksa sesi: ${friendlyAuthError(error)}`, 'error');
    renderSyncStatus();
  }
};

const loginWithPassword = async () => {
  if (syncState.authBusy || !syncState.client) return;
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const button = document.getElementById('login-submit');
  if (!emailInput || !passwordInput || !button) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    showLoginError('Masukkan alamat email yang valid.');
    emailInput.focus();
    return;
  }
  if (!password) {
    showLoginError('Masukkan kata sandi.');
    passwordInput.focus();
    return;
  }
  if (!syncState.online) {
    showLoginError('Perangkat sedang offline. Sambungkan internet untuk masuk.');
    return;
  }

  syncState.authBusy = true;
  button.disabled = true;
  button.textContent = 'Memproses...';
  showLoginError('');
  const errorBox = document.getElementById('login-error');
  if (errorBox) errorBox.hidden = true;

  try {
    const { data, error } = await syncState.client.auth.signInWithPassword({ email, password });
    if (error) {
      showLoginError(friendlyAuthError(error));
      return;
    }
    if (data?.session) {
      syncState.lastEmail = email;
      applyAuthSession(data.session);
      toast('Berhasil masuk. Data akan disinkronkan.');
    } else {
      showLoginError('Masuk berhasil, tetapi sesi belum tersedia. Coba lagi.');
    }
  } catch (error) {
    showLoginError(friendlyAuthError(error));
  } finally {
    syncState.authBusy = false;
    if (button instanceof HTMLButtonElement && button.isConnected) {
      button.disabled = false;
      button.textContent = 'Masuk';
    }
  }
};

const performLogout = async () => {
  const email = syncState.user?.email || syncState.lastEmail || '';
  try {
    await syncState.client?.auth.signOut({ scope: 'local' });
  } catch (error) {
    // Sesi lokal tetap dibersihkan di bawah.
  }
  syncState.session = null;
  syncState.user = null;
  syncState.lastEmail = email;
  syncState.lastError = '';
  clearSyncTimer();
  hideAuthScreen();
  showAuthScreen('Kamu telah keluar. Data lokal dan antrean sinkron tetap tersimpan.', 'info');
  renderSyncStatus();
  toast('Berhasil keluar.');
};

const isAuthError = (error) => {
  if (!error) return false;
  if (Number(error.status) === 401) return true;
  const code = String(error.code || '').toUpperCase();
  if (code === 'PGRST301' || code === 'PGRST303') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('jwt')
    || message.includes('refresh token')
    || message.includes('session expired')
    || message.includes('invalid claim');
};

const tryRefreshSession = async () => {
  try {
    const { data, error } = await syncState.client.auth.refreshSession();
    if (!error && data?.session) {
      syncState.session = data.session;
      syncState.user = data.session.user;
      syncState.lastEmail = data.session.user?.email || syncState.lastEmail;
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

const handleSessionExpired = async () => {
  const email = syncState.user?.email || syncState.lastEmail || '';
  syncState.session = null;
  syncState.user = null;
  syncState.lastEmail = email;
  syncState.lastError = 'Sesi berakhir. Masuk kembali untuk melanjutkan sinkronisasi.';
  clearSyncTimer();
  renderSyncStatus();
  showAuthScreen('Sesi berakhir. Silakan masuk kembali. Data lokal dan antrean tetap tersimpan.', 'error');
  try {
    await syncState.client?.auth.signOut({ scope: 'local' });
  } catch (error) {
    // Tidak ada yang perlu ditangani; sesi lokal sudah dianggap berakhir.
  }
};

const authAwareRequest = async (factory) => {
  let result = await factory();
  if (!result?.error) return result?.data;

  if (isAuthError(result.error)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      result = await factory();
      if (!result?.error) return result?.data;
    }
    if (!result?.error || isAuthError(result.error)) {
      await handleSessionExpired();
      const error = new Error('Sesi berakhir. Masuk kembali untuk melanjutkan sinkronisasi.');
      error.isAuthExpired = true;
      throw error;
    }
  }

  throw result.error;
};

const clearSyncTimer = () => {
  if (syncState.retryTimer) {
    window.clearTimeout(syncState.retryTimer);
    syncState.retryTimer = null;
  }
  if (syncState.kickTimer) {
    window.clearTimeout(syncState.kickTimer);
    syncState.kickTimer = null;
  }
};

const canSync = () => Boolean(
  SUPABASE_CONFIGURED
  && syncState.client
  && syncState.session
  && syncState.online
);

const syncErrorMessage = (error) => {
  if (error?.isAuthExpired) return 'Sesi berakhir. Masuk kembali untuk melanjutkan sinkronisasi.';
  const code = String(error?.code || '');
  const message = String(error?.message || '').trim();
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'Akses ditolak Supabase. Periksa policy RLS.';
  }
  if (/invalid api key/i.test(message)) return 'Kunci Supabase tidak valid.';
  if (/failed to fetch|network|load failed|fetch/i.test(message)) {
    return 'Tidak dapat terhubung ke server.';
  }
  return message || 'Gagal sinkron dengan Supabase.';
};

const scheduleRetry = () => {
  if (!canSync() || syncState.retryTimer) return;
  const index = Math.min(syncState.retryIndex, SYNC_RETRY_DELAYS.length - 1);
  const delay = SYNC_RETRY_DELAYS[index];
  syncState.retryIndex += 1;
  syncState.retryTimer = window.setTimeout(() => {
    syncState.retryTimer = null;
    runSync({ pull: true });
  }, delay);
};

const isPermanentError = (error) => {
  if (!error || error.isAuthExpired) return false;
  const code = String(error.code || '');
  if (code === '42501') return false;
  if (/^(22|23|42)/.test(code)) return true;
  return Number(error.status) === 400 || Number(error.status) === 422;
};

const rejectOutboxItem = (item, error) => {
  db.outbox = db.outbox.filter((entry) => entry.id !== item.id);
  db.rejected = [...db.rejected, { ...item, error: String(error?.message || error?.code || 'Ditolak server').slice(0, 200) }]
    .slice(-MAX_REJECTED);
};

const upsertBatch = (table, rows) => authAwareRequest(() => syncState.client
  .from(table)
  .upsert(rows, { onConflict: 'id' }));

const flushOutbox = async () => {
  while (db.outbox.length) {
    const table = db.outbox[0].table;
    const batch = [];
    for (const entry of db.outbox) {
      if (entry.table !== table || batch.length >= 200) break;
      batch.push(entry);
    }
    // Satu id hanya boleh muncul sekali per upsert; ambil versi terbaru.
    const latest = new Map();
    batch.forEach((entry) => latest.set(String(entry.payload.id), entry.payload));
    const doneIds = new Set(batch.map((entry) => entry.id));

    try {
      await upsertBatch(table, Array.from(latest.values()));
      db.outbox = db.outbox.filter((entry) => !doneIds.has(entry.id));
    } catch (error) {
      if (!isPermanentError(error)) throw error;
      if (batch.length === 1) {
        rejectOutboxItem(batch[0], error);
      } else {
        // Cari item yang ditolak dengan mengirim satu per satu; yang lain tetap lanjut.
        for (const entry of batch) {
          try {
            await upsertBatch(table, [entry.payload]);
            db.outbox = db.outbox.filter((row) => row.id !== entry.id);
          } catch (single) {
            if (!isPermanentError(single)) throw single;
            rejectOutboxItem(entry, single);
          }
        }
      }
    }
    persist(true);
    renderSyncStatus();
  }
};

const hasPendingOutbox = (table, id) => db.outbox.some((item) => (
  item.table === table && String(item.payload?.id || '') === String(id)
));

const fetchUpdatedRows = async (table, since) => {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  while (true) {
    const page = await authAwareRequest(() => syncState.client
      .from(table)
      .select('*')
      .gt('synced_at', since)
      .order('synced_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1));
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
};

const reconcileCartWithProducts = () => {
  const before = JSON.stringify(state.cart);
  state.cart = state.cart.reduce((list, item) => {
    const product = db.products.find((row) => row.id === item.id);
    if (!product || product.deleted_at || !product.active) return list;
    list.push({ ...item, name: product.name, price: product.price, cost: product.cost || 0 });
    return list;
  }, []);
  const changed = before !== JSON.stringify(state.cart);
  if (changed) {
    if (document.getElementById('payment-sheet')) {
      if (!state.cart.length) closeModal();
      else refreshPaymentSheet();
    }
    render({ keepForm: true });
  }
  return changed;
};

const PULL_OVERLAP_MS = 2 * 60 * 1000;

const sameRecord = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mergeRemote = (list, normalized, table) => {
  const index = list.findIndex((item) => item.id === normalized.id);
  if (index < 0) {
    list.push(normalized);
    return true;
  }
  if (hasPendingOutbox(table, normalized.id)) return false;
  if (!isNewerOrEqual(normalized.updated_at, list[index].updated_at)) return false;
  if (sameRecord(list[index], normalized)) return false;
  list[index] = normalized;
  return true;
};

const maxSynced = (rows, current) => rows.reduce((max, row) => {
  const value = validIso(row.synced_at);
  return value && (!max || value > max) ? value : max;
}, current);

const pullRemote = async () => {
  const firstSync = !db.lastSyncAt;
  const since = db.pullCursor
    ? new Date(new Date(db.pullCursor).getTime() - PULL_OVERLAP_MS).toISOString()
    : '1970-01-01T00:00:00.000Z';
  const syncStartedAt = nowIso();
  syncState.pulling = true;
  renderSyncStatus();

  try {
    const products = await fetchUpdatedRows('products', since);
    const transactions = await fetchUpdatedRows('transactions', since);
    const expenses = await fetchUpdatedRows('expenses', since);

    const productRows = Array.isArray(products) ? products : [];
    const transactionRows = Array.isArray(transactions) ? transactions : [];
    const expenseRows = Array.isArray(expenses) ? expenses : [];
    let changed = false;
    const fallbackNow = nowIso();

    productRows.forEach((row) => {
      const normalized = normalizeProduct(row, fallbackNow);
      if (normalized && mergeRemote(db.products, normalized, 'products')) changed = true;
    });
    transactionRows.forEach((row) => {
      const normalized = normalizeTransaction(row, fallbackNow);
      if (normalized && mergeRemote(db.trx, normalized, 'transactions')) changed = true;
    });
    expenseRows.forEach((row) => {
      const normalized = normalizeExpense(row, fallbackNow);
      if (normalized && mergeRemote(db.expenses, normalized, 'expenses')) changed = true;
    });

    let cursor = db.pullCursor;
    cursor = maxSynced(productRows, cursor);
    cursor = maxSynced(transactionRows, cursor);
    cursor = maxSynced(expenseRows, cursor);
    db.pullCursor = cursor;
    db.lastSyncAt = syncStartedAt;
    persist(true);
    reconcileCartWithProducts();
    if (changed) render({ keepForm: true });
    return {
      firstSync,
      remoteEmpty: productRows.length === 0 && transactionRows.length === 0 && expenseRows.length === 0,
      changed
    };
  } finally {
    syncState.pulling = false;
    renderSyncStatus();
  }
};

const prepareInitialUpload = () => {
  const hasData = db.products.length > 0 || db.trx.length > 0 || db.expenses.length > 0;
  if (!hasData) {
    db.products = createSeedProducts();
  }
  let queued = 0;
  const queue = (table, payload) => {
    db.outbox.push({
      id: uid(),
      table,
      op: 'upsert',
      payload,
      createdAt: nowIso()
    });
    queued += 1;
  };
  db.products.forEach((product) => queue('products', productToRow(product)));
  db.trx.forEach((trx) => queue('transactions', transactionToRow(trx)));
  db.expenses.forEach((expense) => queue('expenses', expenseToRow(expense)));
  if (queued) {
    persist(true);
    renderSyncStatus();
    render({ keepForm: true });
  }
  return queued;
};

const runSync = async (options = {}) => {
  const { pull = true, manual = false } = options;
  if (!SUPABASE_CONFIGURED) {
    if (manual) toast('Supabase belum dikonfigurasi. Isi config.js terlebih dahulu.', 'error');
    return;
  }
  if (!syncState.online) {
    if (manual) toast('Tidak ada koneksi internet. Perubahan tetap tersimpan di perangkat.', 'error');
    renderSyncStatus();
    return;
  }
  if (!syncState.session) {
    if (manual) showAuthScreen('Masuk untuk menyinkronkan data.');
    renderSyncStatus();
    return;
  }
  if (!syncState.client) {
    if (manual) toast('Pustaka Supabase belum termuat.', 'error');
    return;
  }
  if (syncState.flushing) {
    syncState.queued = true;
    syncState.queuedPull = syncState.queuedPull || pull;
    return;
  }

  clearSyncTimer();
  syncState.flushing = true;
  syncState.queued = false;
  syncState.queuedPull = false;
  syncState.lastError = '';
  renderSyncStatus();
  let success = false;

  try {
    await flushOutbox();
    let pullResult = null;
    if (pull) pullResult = await pullRemote();
    if (pullResult?.firstSync && pullResult.remoteEmpty) {
      const queued = prepareInitialUpload();
      if (queued) await flushOutbox();
    }
    syncState.retryIndex = 0;
    syncState.lastError = '';
    success = true;
  } catch (error) {
    if (error?.isAuthExpired) {
      syncState.lastError = syncErrorMessage(error);
    } else {
      syncState.lastError = syncErrorMessage(error);
      scheduleRetry();
    }
  } finally {
    syncState.flushing = false;
    syncState.pulling = false;
    renderSyncStatus();
    if (manual) {
      if (success) toast('Sinkronisasi selesai.');
      else toast(syncState.lastError || 'Sinkronisasi gagal.', 'error');
    }
    if (syncState.queued) {
      const nextPull = syncState.queuedPull;
      syncState.queued = false;
      syncState.queuedPull = false;
      window.setTimeout(() => runSync({ pull: nextPull }), 0);
    }
  }
};

const requestSync = (options = {}) => {
  if (!canSync()) {
    renderSyncStatus();
    return;
  }
  if (syncState.flushing) {
    syncState.queued = true;
    syncState.queuedPull = syncState.queuedPull || Boolean(options.pull);
    return;
  }
  if (syncState.retryTimer) {
    window.clearTimeout(syncState.retryTimer);
    syncState.retryTimer = null;
    syncState.retryIndex = 0;
  }
  if (syncState.kickTimer) window.clearTimeout(syncState.kickTimer);
  syncState.kickTimer = window.setTimeout(() => {
    syncState.kickTimer = null;
    runSync(options);
  }, 40);
};

const handleSyncStatusClick = () => {
  if (supabaseConfigIssue) {
    toast(supabaseConfigIssue, 'error');
    return;
  }
  if (!SUPABASE_CONFIGURED) {
    toast('Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di config.js.', 'error');
    return;
  }
  if (!syncState.online) {
    toast('Tidak ada koneksi internet. Perubahan menunggu untuk disinkronkan.', 'error');
    return;
  }
  if (!syncState.session) {
    showAuthScreen('Masuk untuk menyinkronkan data.');
    return;
  }
  syncState.lastError = '';
  syncState.retryIndex = 0;
  clearSyncTimer();
  runSync({ pull: true, manual: true });
};

const getSettingsAccount = () => syncState.user?.email || syncState.lastEmail || '-';

const openSettingsModal = () => {
  const status = getSyncStatus();
  const products = db.products.filter((product) => !product.deleted_at).length;
  const trx = db.trx.length;
  const expenses = db.expenses.filter((expense) => !expense.deleted_at).length;
  const sessionEmail = getSettingsAccount();
  const lastSync = db.lastSyncAt ? formatDateTime(db.lastSyncAt) : 'Belum pernah';
  const pending = db.outbox.length;
  const accountSection = syncState.session
    ? `
      <div class="settings-account">
        <span class="settings-account-label">Akun pemilik</span>
        <strong class="settings-account-email">${esc(sessionEmail)}</strong>
        <span class="settings-account-hint">Sesi tersimpan di perangkat ini dan diperbarui otomatis.</span>
      </div>
    `
    : `
      <div class="settings-account">
        <span class="settings-account-label">Akun pemilik</span>
        <strong class="settings-account-email">${esc(sessionEmail)}</strong>
        <span class="settings-account-hint">${SUPABASE_CONFIGURED ? 'Belum masuk ke Supabase.' : 'Mode lokal tanpa sinkronisasi.'}</span>
      </div>
    `;

  const syncButton = syncState.session
    ? `<button class="btn btn-primary" type="button" data-act="settings-sync">${ICONS.sync}<span>Sinkronkan sekarang<small>Kirim antrean dan tarik data terbaru</small></span></button>`
    : '';
  const logoutButton = syncState.session
    ? `<button class="btn settings-logout" type="button" data-act="settings-logout">${ICONS.logout}<span>Keluar dari akun<small>Data lokal tetap tersimpan</small></span></button>`
    : '';

  const content = `
    ${sheetHeader('settings-title', 'Data dan pengaturan', 'Penyimpanan lokal dan Supabase')}
    <div class="sheet-body">
      <div class="settings-status is-${status.kind}">
        <span class="sync-dot" aria-hidden="true"></span>
        <div class="settings-status-copy">
          <strong>${esc(status.text)}</strong>
          <span title="${esc(status.hint)}">${esc(status.hint)}</span>
        </div>
      </div>
      ${accountSection}
      <div class="settings-grid">
        <div class="settings-stat"><span>Produk</span><strong>${products}</strong></div>
        <div class="settings-stat"><span>Transaksi</span><strong>${trx}</strong></div>
        <div class="settings-stat"><span>Pengeluaran</span><strong>${expenses}</strong></div>
        <div class="settings-stat"><span>Sinkron terakhir</span><strong>${esc(lastSync)}</strong></div>
      </div>
      ${pending ? `<div class="settings-stat"><span>Antrean sinkron</span><strong>${pending} item</strong></div>` : ''}
      ${db.rejected.length ? `<div class="settings-error">${db.rejected.length} perubahan ditolak server dan tidak dikirim ulang. Contoh: ${esc(db.rejected[db.rejected.length - 1].error)}. Data tetap ada di perangkat dan di cadangan JSON.</div>` : ''}
      ${syncState.lastError ? `<div class="settings-error">${esc(syncState.lastError)}</div>` : ''}
      ${supabaseConfigIssue ? `<div class="settings-setup"><strong>Konfigurasi bermasalah:</strong> ${esc(supabaseConfigIssue)}</div>` : ''}
      ${!SUPABASE_CONFIGURED && !supabaseConfigIssue ? `
        <div class="settings-setup"><strong>Mode lokal.</strong> Isi SUPABASE_URL dan SUPABASE_ANON_KEY di config.js, lalu muat ulang aplikasi untuk mengaktifkan sinkronisasi.</div>
      ` : ''}

      <div class="settings-section">
        <h3>Sinkronisasi</h3>
        <p>Setiap perubahan langsung masuk antrean lokal. Antrean dikirim otomatis dan diulang dengan jeda 5 detik, 15 detik, lalu 60 detik.</p>
        <div class="settings-actions">
          ${syncButton}
        </div>
      </div>

      <div class="settings-section">
        <h3>Cadangan tambahan</h3>
        <p>Ekspor seluruh cache lokal, termasuk antrean dan waktu sinkron terakhir. Ini cadangan tambahan, bukan pengganti sinkronisasi.</p>
        <div class="settings-actions">
          <button class="btn btn-ghost" type="button" data-act="backup-download">
            ${ICONS.download}
            <span>Ekspor JSON<small>Mengunduh seluruh cache ke satu berkas</small></span>
          </button>
          <button class="btn btn-ghost" type="button" data-act="backup-import">
            ${ICONS.upload}
            <span>Pulihkan dari cadangan<small>Mengganti seluruh data saat ini</small></span>
          </button>
        </div>
        <input type="file" id="backup-file" accept="application/json,.json" hidden>
      </div>

      <div class="settings-section">
        <h3>Akun dan aplikasi</h3>
        <p>Versi ${APP_VERSION}. Hanya satu akun pemilik yang dibuat manual dari dasbor Supabase.</p>
        <div class="settings-actions">
          ${logoutButton}
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" type="button" data-act="close-modal">Batal</button>
      </div>
    </div>
  `;
  openModal(content, { labelledBy: 'settings-title' });
};

const ensureLibraries = (kind) => {
  try {
    if (kind === 'pdf') {
      if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
        toast('Pustaka PDF belum termuat. Periksa koneksi lalu coba lagi.', 'error');
        return false;
      }
      const probe = new window.jspdf.jsPDF();
      if (typeof probe.autoTable !== 'function') {
        toast('Pustaka tabel PDF belum termuat. Periksa koneksi lalu coba lagi.', 'error');
        return false;
      }
      return true;
    }
    if (!window.XLSX || typeof window.XLSX.utils?.book_new !== 'function') {
      toast('Pustaka Excel belum termuat. Periksa koneksi lalu coba lagi.', 'error');
      return false;
    }
    return true;
  } catch (error) {
    toast('Pustaka laporan belum siap. Muat ulang aplikasi lalu coba lagi.', 'error');
    return false;
  }
};

const exportPDF = () => {
  const data = getLogData();
  if (!data.trx.length && !data.expenses.length) {
    toast('Tidak ada data pada periode ini', 'error');
    return;
  }
  if (!ensureLibraries('pdf')) return;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const bottomLimit = pageHeight - 18;
    let y = 34;

    doc.setProperties({
      title: 'Logbook Warkop',
      subject: `Laporan ${state.logFrom} sampai ${state.logTo}`,
      creator: 'Warkop POS'
    });

    doc.setFillColor(43, 30, 21);
    doc.rect(0, 0, pageWidth, 27, 'F');
    doc.setTextColor(246, 238, 229);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Logbook Warkop', margin, 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(214, 195, 173);
    doc.text(`Periode: ${formatShortDate(state.logFrom)} sampai ${formatShortDate(state.logTo)}`, margin, 18.5);
    doc.text(`Tanggal cetak: ${formatPrintDate(new Date())}`, pageWidth - margin, 18.5, { align: 'right' });

    const tableBase = {
      theme: 'grid',
      margin: { left: margin, right: margin, bottom: 16 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.3,
        textColor: [45, 32, 22],
        lineColor: [224, 214, 203],
        lineWidth: 0.1,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [201, 121, 58],
        textColor: [255, 248, 239],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [250, 246, 241]
      },
      footStyles: {
        fillColor: [241, 232, 222],
        textColor: [45, 32, 22],
        fontStyle: 'bold'
      }
    };

    const addTable = (title, options) => {
      if (y + 22 > bottomLimit) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(58, 39, 25);
      doc.text(title, margin, y);
      doc.autoTable({
        ...tableBase,
        ...options,
        startY: y + 3
      });
      y = (doc.lastAutoTable?.finalY || y) + 10;
    };

    addTable('Ringkasan', {
      head: [['Keterangan', 'Nilai', 'Keterangan', 'Nilai']],
      body: [
        ['Omzet', rp(data.summary.omzet), 'Jumlah transaksi', String(data.summary.count)],
        ['Tunai', rp(data.summary.tunai), 'QRIS', rp(data.summary.qris)],
        ['Modal (HPP)', rp(data.summary.modal), 'Laba kotor', signedRp(data.summary.labaKotor)],
        ['Pengeluaran', rp(data.summary.pengeluaran), 'Laba bersih', signedRp(data.summary.laba)]
      ]
    });

    addTable('Rekap per hari', {
      head: [['Tanggal', 'Jumlah Trx', 'Omzet', 'Tunai', 'QRIS', 'Modal', 'Pengeluaran', 'Laba']],
      body: data.days.map((day) => [
        formatShortDate(day.day),
        String(day.trxCount),
        rp(day.omzet),
        rp(day.tunai),
        rp(day.qris),
        rp(day.modal),
        rp(day.pengeluaran),
        signedRp(day.laba)
      ]),
      foot: [[
        'Total',
        String(data.summary.count),
        rp(data.summary.omzet),
        rp(data.summary.tunai),
        rp(data.summary.qris),
        rp(data.summary.modal),
        rp(data.summary.pengeluaran),
        signedRp(data.summary.laba)
      ]]
    });

    addTable('Detail transaksi', {
      head: [['Tanggal', 'Jam', 'Item', 'Bayar', 'Total', 'Modal']],
      body: data.trx.length
        ? data.trx.map((trx) => [
          formatShortDate(trx.day),
          formatTime(trx.created_at),
          trx.items.map((item) => `${item.name} x${item.qty}`).join(', '),
          trx.pay === 'tunai' ? 'Tunai' : 'QRIS',
          rp(trx.total),
          rp(trxCost(trx))
        ])
        : [[{ content: 'Tidak ada transaksi pada periode ini.', colSpan: 6 }]],
      columnStyles: {
        2: { cellWidth: 100 },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    addTable('Pengeluaran', {
      head: [['Tanggal', 'Kategori', 'Catatan', 'Nominal']],
      body: data.expenses.length
        ? data.expenses.map((expense) => [
          formatShortDate(expense.date),
          expense.category,
          expense.note || '-',
          rp(expense.amount)
        ])
        : [[{ content: 'Tidak ada pengeluaran pada periode ini.', colSpan: 4 }]],
      foot: data.expenses.length
        ? [['Total', '', '', rp(data.summary.pengeluaran)]]
        : undefined,
      columnStyles: {
        2: { cellWidth: 120 },
        3: { halign: 'right' }
      }
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 106, 94);
      doc.text('Warkop POS', margin, pageHeight - 7);
      doc.text(`Halaman ${page} dari ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    doc.save(`logbook_${state.logFrom}_${state.logTo}.pdf`);
    toast('Berkas PDF sedang diunduh.');
  } catch (error) {
    toast('Gagal membuat PDF. Coba muat ulang aplikasi.', 'error');
  }
};

const exportXLSX = () => {
  const data = getLogData();
  if (!data.trx.length && !data.expenses.length) {
    toast('Tidak ada data pada periode ini', 'error');
    return;
  }
  if (!ensureLibraries('xlsx')) return;

  try {
    const XLSX = window.XLSX;
    const workbook = XLSX.utils.book_new();

    const perDayRows = [
      ['Tanggal', 'Jumlah Trx', 'Omzet', 'Tunai', 'QRIS', 'Modal (HPP)', 'Pengeluaran', 'Laba Bersih'],
      ...data.days.map((day) => [
        formatShortDate(day.day),
        day.trxCount,
        day.omzet,
        day.tunai,
        day.qris,
        day.modal,
        day.pengeluaran,
        day.laba
      ])
    ];
    const perDaySheet = XLSX.utils.aoa_to_sheet(perDayRows);
    perDaySheet['!cols'] = [{ wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, perDaySheet, 'Per Hari');

    const trxRows = [
      ['Tanggal', 'Jam', 'Metode', 'Item', 'Total', 'Modal', 'Laba Kotor'],
      ...data.trx.map((trx) => [
        formatShortDate(trx.day),
        formatTime(trx.created_at),
        trx.pay === 'tunai' ? 'Tunai' : 'QRIS',
        trx.items.map((item) => `${item.name} x${item.qty}`).join(', '),
        trx.total,
        trxCost(trx),
        trx.total - trxCost(trx)
      ])
    ];
    const trxSheet = XLSX.utils.aoa_to_sheet(trxRows);
    trxSheet['!cols'] = [{ wch: 13 }, { wch: 8 }, { wch: 11 }, { wch: 48 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, trxSheet, 'Transaksi');

    const detailRows = [['Tanggal', 'Jam', 'Produk', 'Qty', 'Harga Jual', 'Modal', 'Subtotal', 'Laba', 'Bayar']];
    data.trx.forEach((trx) => {
      trx.items.forEach((item) => {
        detailRows.push([
          formatShortDate(trx.day),
          formatTime(trx.created_at),
          item.name,
          item.qty,
          item.price,
          item.cost || 0,
          item.price * item.qty,
          (item.price - (item.cost || 0)) * item.qty,
          trx.pay === 'tunai' ? 'TUNAI' : 'QRIS'
        ]);
      });
    });
    const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
    detailSheet['!cols'] = [{ wch: 13 }, { wch: 8 }, { wch: 28 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detail Item');

    const expenseRows = [
      ['Tanggal', 'Kategori', 'Catatan', 'Nominal'],
      ...data.expenses.map((expense) => [
        formatShortDate(expense.date),
        expense.category,
        expense.note,
        expense.amount
      ])
    ];
    const expenseSheet = XLSX.utils.aoa_to_sheet(expenseRows);
    expenseSheet['!cols'] = [{ wch: 13 }, { wch: 16 }, { wch: 38 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Pengeluaran');

    XLSX.writeFile(workbook, `logbook_${state.logFrom}_${state.logTo}.xlsx`, { compression: true });
    toast('Berkas Excel sedang diunduh.');
  } catch (error) {
    toast('Gagal membuat berkas Excel. Coba muat ulang aplikasi.', 'error');
  }
};

const downloadBlob = (content, type, filename) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
};

const downloadBackup = () => {
  const content = JSON.stringify(db, null, 2);
  downloadBlob(content, 'application/json;charset=utf-8', `backup_warkop_${dkey()}.json`);
  toast('Cadangan JSON sedang diunduh.');
};

const handleBackupFile = (file) => {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('Berkas cadangan terlalu besar.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ''));
      const isV2 = Array.isArray(parsed?.outbox) || Object.prototype.hasOwnProperty.call(parsed || {}, 'lastSyncAt');
      const normalized = isV2 ? normalizeDB(parsed) : migrateLegacyDB(parsed);
      if (!normalized) throw new Error('Struktur cadangan tidak valid');
      const counts = `${normalized.products.length} produk, ${normalized.trx.length} transaksi, ${normalized.expenses.length} pengeluaran`;
      openConfirm({
        title: 'Pulihkan cadangan?',
        message: `Cadangan berisi ${counts}. Seluruh data saat ini akan diganti.`,
        confirmLabel: 'Pulihkan',
        danger: true,
        onConfirm: () => {
          db = normalized;
          // Semua baris cadangan dikirim ulang; updated_at asli dipertahankan sehingga last-write-wins tetap adil.
          const queued = new Set(db.outbox.map((item) => `${item.table}:${item.payload?.id}`));
          const enqueueRestored = (table, payload) => {
            if (queued.has(`${table}:${payload.id}`)) return;
            db.outbox.push({ id: uid(), table, op: 'upsert', payload, createdAt: nowIso() });
          };
          db.products.forEach((row) => enqueueRestored('products', productToRow(row)));
          db.trx.forEach((row) => enqueueRestored('transactions', transactionToRow(row)));
          db.expenses.forEach((row) => enqueueRestored('expenses', expenseToRow(row)));
          db.pullCursor = null;
          state.cart = [];
          state.category = 'Semua';
          syncState.lastError = '';
          const saved = persist(true);
          closeModal();
          render();
          renderSyncStatus();
          if (saved && syncState.session) requestSync({ pull: true });
          toast(
            saved ? 'Cadangan berhasil dipulihkan.' : 'Cadangan dimuat di sesi ini, tetapi gagal disimpan permanen.',
            saved ? 'success' : 'error'
          );
        }
      });
    } catch (error) {
      toast('Berkas cadangan tidak valid.', 'error');
    }
  };
  reader.onerror = () => toast('Berkas cadangan tidak dapat dibaca.', 'error');
  reader.readAsText(file);
};

const openBackupModal = () => openSettingsModal();

const switchTab = (tab) => {
  if (!TAB_META[tab]) return;
  closeModal();
  state.tab = tab;
  render();
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
};

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Versi baru aplikasi aktif: muat ulang sekali agar tampilan langsung terbaru.
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('./sw.js').then((registration) => registration.update()).catch(() => {
      // Aplikasi tetap bisa dipakai tanpa dukungan offline.
    });
  });
};

const handleOnline = () => {
  syncState.online = true;
  syncState.lastError = '';
  syncState.retryIndex = 0;
  clearSyncTimer();
  renderSyncStatus();
  if (syncState.session) requestSync({ pull: true });
};

const handleOffline = () => {
  syncState.online = false;
  syncState.lastError = '';
  clearSyncTimer();
  renderSyncStatus();
};

const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return;
  if (!syncState.online || !syncState.session) return;
  requestSync({ pull: true });
};

window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);
document.addEventListener('visibilitychange', handleVisibilityChange);

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;

  if (act === 'backdrop') {
    if (event.target === target) closeModal();
    return;
  }
  if (act === 'confirm-backdrop') {
    if (event.target === target) closeConfirm();
    return;
  }

  event.preventDefault();

  switch (act) {
    case 'tab':
      switchTab(target.dataset.tab);
      break;
    case 'category':
      state.category = target.dataset.category || 'Semua';
      render();
      break;
    case 'add-cart':
      addToCart(target.dataset.id);
      break;
    case 'menu-dec':
      decFromMenu(target.dataset.id);
      break;
    case 'open-cart':
      openCartSheet();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'inc-item':
      changeCartQty(target.dataset.id, 1);
      break;
    case 'dec-item':
      changeCartQty(target.dataset.id, -1);
      break;
    case 'clear-cart':
      openConfirm({
        title: 'Kosongkan keranjang?',
        message: 'Semua item di keranjang akan dibuang.',
        confirmLabel: 'Kosongkan',
        danger: true,
        onConfirm: () => {
          state.cart = [];
          closeModal();
          render();
          toast('Keranjang dikosongkan.');
        }
      });
      break;
    case 'open-cash':
      openCashModal();
      break;
    case 'open-qris':
      openQrisModal();
      break;
    case 'cash-quick':
      setCashAmount(Number(target.dataset.amount));
      break;
    case 'save-cash':
      saveCash();
      break;
    case 'save-qris':
      completeSale('qris', cartTotalValue());
      break;
    case 'new-product':
      openProductModal();
      break;
    case 'edit-product':
      openProductModal(target.dataset.id);
      break;
    case 'save-product':
      saveProduct();
      break;
    case 'delete-product':
      deleteProduct(target.dataset.id);
      break;
    case 'save-expense':
      saveExpense();
      break;
    case 'delete-expense':
      deleteExpense(target.dataset.id);
      break;
    case 'log-preset':
      setLogPreset(target.dataset.preset);
      break;
    case 'export-pdf':
      exportPDF();
      break;
    case 'export-xlsx':
      exportXLSX();
      break;
    case 'backup-open':
      openSettingsModal();
      break;
    case 'settings-open':
      openSettingsModal();
      break;
    case 'settings-sync':
      closeModal();
      syncState.lastError = '';
      syncState.retryIndex = 0;
      clearSyncTimer();
      runSync({ pull: true, manual: true });
      break;
    case 'settings-logout':
      openConfirm({
        title: 'Keluar dari akun?',
        message: 'Data lokal dan antrean sinkron tetap tersimpan di perangkat ini. Kamu dapat masuk kembali kapan saja.',
        confirmLabel: 'Keluar',
        danger: true,
        onConfirm: () => {
          void performLogout();
        }
      });
      break;
    case 'backup-download':
      downloadBackup();
      break;
    case 'settings-export':
      downloadBackup();
      break;
    case 'backup-import':
    case 'settings-import':
      document.getElementById('backup-file')?.click();
      break;
    case 'sync-status':
      handleSyncStatusClick();
      break;
    case 'reload-app':
      window.location.reload();
      break;
    case 'confirm-accept':
      acceptConfirm();
      break;
    case 'confirm-cancel':
      closeConfirm();
      break;
    default:
      break;
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'login-form') {
    event.preventDefault();
    loginWithPassword();
  } else if (event.target.id === 'product-form') {
    event.preventDefault();
    saveProduct();
  } else if (event.target.id === 'expense-form') {
    event.preventDefault();
    saveExpense();
  } else if (event.target.id === 'cash-form') {
    event.preventDefault();
    saveCash();
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.matches('[data-money-input]')) {
    const digits = target.value.replace(/\D/g, '').slice(0, 12);
    target.value = digits ? formatMoneyField(Number(digits)) : '';
  }
  if (target.type === 'date') {
    const display = document.querySelector(`[data-date-for="${target.id}"]`);
    if (display) display.textContent = dateText(target.value);
  }
  if (target.id === 'cash-received') updateCashState();
  if (target.id === 'p-price' || target.id === 'p-cost') updateMarginHint();
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.matches('[data-log-date]')) {
    const key = target.dataset.logDate;
    let from = state.logFrom;
    let to = state.logTo;
    if (key === 'from') {
      from = target.value || state.logFrom;
    } else {
      to = target.value || state.logTo;
    }
    if (from > to) {
      const temporary = from;
      from = to;
      to = temporary;
    }
    state.logFrom = from;
    state.logTo = to;
    render();
    return;
  }
  if (target instanceof HTMLInputElement && target.id === 'backup-file') {
    const file = target.files?.[0];
    target.value = '';
    handleBackupFile(file);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && modalRoot.childElementCount) {
    const layer = modalRoot.querySelector('.confirm-overlay') || modalRoot.querySelector('.overlay');
    if (!layer) return;
    const focusable = Array.from(layer.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      layer.querySelector('.sheet, .confirm-card')?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }

  if (event.key !== 'Escape') return;
  if (confirmState) {
    closeConfirm();
  } else if (modalRoot.childElementCount) {
    closeModal();
  }
});

const init = () => {
  loadInitialData();
  if (SUPABASE_CONFIGURED) showAuthLoading();
  render();
  registerServiceWorker();
  if (startupNotice) {
    window.setTimeout(() => toast(startupNotice, startupNoticeType), 250);
  }
  renderSyncStatus();
  void initSupabaseAuth();
};

init();
