// Tes keuangan Warkop HCR (86 pemeriksaan: kasir, modal, laba, rentang tanggal, ekspor, sinkron tiruan).
// Cara pakai: buka app dalam mode lokal (config.js kosong) lalu di console browser:
//   (0,eval)(<isi berkas ini>); await window.__runFinanceTests()
// Hasil: { total, passed, failed: [] }. Data asli di perangkat dikembalikan setelah tes.
// Tes keuangan Warkop HCR. Dijalankan di halaman app (mode lokal). Mengembalikan ringkasan lulus/gagal.
window.__runFinanceTests = async () => {
  const results = [];
  const check = (name, actual, expected) => {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ name, pass, ...(pass ? {} : { actual, expected }) });
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sumOf = (list) => list.reduce((t, v) => t + v, 0);

  // ---------- setup bersih ----------
  const savedDb = JSON.parse(JSON.stringify(db));
  const savedSync = { client: syncState.client, session: syncState.session, user: syncState.user, online: syncState.online };
  db = createEmptyDB();
  state.cart = [];
  state.category = 'Semua';
  state.tab = 'produk';
  closeModal();
  const ledger = []; // { day, pay, total, cost }
  const ledgerExp = []; // { day, amount }

  const addProduct = async (name, price, cost, category = 'Minuman') => {
    openProductModal();
    document.getElementById('p-name').value = name;
    document.getElementById('p-price').value = String(price);
    document.getElementById('p-cost').value = String(cost);
    document.getElementById('p-category').value = category;
    await saveProduct();
    return db.products.find((p) => p.name === name);
  };
  const A = await addProduct('Kopi', 8000, 3000);
  const B = await addProduct('Susu', 12000, 5500);
  const C = await addProduct('Teh', 5000, 1500);
  check('produk tersimpan dengan modal', [A.cost, B.cost, C.cost, A.price, B.price, C.price], [3000, 5500, 1500, 8000, 12000, 5000]);

  const dayN = (n) => addDaysKey(dkey(), -n);
  const localDate = (daysAgo, hour, minute) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const pushTrx = (date, lines, pay, received) => {
    const items = lines.map(([p, qty]) => ({ product_id: p.id, name: p.name, price: p.price, cost: p.cost, qty }));
    const total = sumOf(items.map((i) => i.price * i.qty));
    const iso = date.toISOString();
    const trx = normalizeTransaction({ id: uid(), day: dkey(date), created_at: iso, items, total, pay, received: received ?? total, change: 0, updated_at: iso }, iso);
    db.trx.push(trx);
    enqueueChange('transactions', transactionToRow(trx));
    ledger.push({ day: dkey(date), pay, total, cost: sumOf(items.map((i) => i.cost * i.qty)) });
    return trx;
  };

  // ---------- 1. alur kasir nyata ----------
  addToCart(A.id); addToCart(A.id); addToCart(B.id);
  check('total keranjang 2xA + 1xB', cartTotalValue(), 28000);
  decFromMenu(B.id); addToCart(B.id); addToCart(B.id); decFromMenu(B.id);
  check('qty B setelah +1 +1 -1 -1 dari awal', cartQty(B.id), 1);
  openCashModal();
  const quick = [...document.querySelectorAll('[data-act="cash-quick"]')].map((b) => Number(b.dataset.amount));
  check('tombol uang cepat >= total dan unik', quick.every((v) => v >= 28000) && new Set(quick).size === quick.length, true);
  document.getElementById('cash-received').value = '50.000';
  document.getElementById('cash-received').dispatchEvent(new Event('input', { bubbles: true }));
  check('status kembalian', document.getElementById('cash-status').textContent, 'Kembalian Rp 22.000');
  document.getElementById('cash-received').value = '20.000';
  document.getElementById('cash-received').dispatchEvent(new Event('input', { bubbles: true }));
  check('status kurang bayar', document.getElementById('cash-status').textContent, 'Kurang Rp 8.000');
  check('tombol simpan nonaktif saat kurang', document.getElementById('cash-save').disabled, true);
  document.getElementById('cash-received').value = '50.000';
  document.getElementById('cash-received').dispatchEvent(new Event('input', { bubbles: true }));
  saveCash();
  const t1 = db.trx[db.trx.length - 1];
  check('transaksi tunai: total, diterima, kembalian, metode', [t1.total, t1.received, t1.change, t1.pay], [28000, 50000, 22000, 'tunai']);
  check('transaksi tunai: snapshot modal item', t1.items.map((i) => [i.name, i.qty, i.price, i.cost]), [['Kopi', 2, 8000, 3000], ['Susu', 1, 12000, 5500]]);
  check('keranjang kosong setelah bayar', state.cart.length, 0);
  ledger.push({ day: dkey(), pay: 'tunai', total: 28000, cost: 11500 });

  addToCart(C.id); addToCart(C.id); addToCart(C.id);
  completeSale('qris', cartTotalValue());
  const t2 = db.trx[db.trx.length - 1];
  check('transaksi QRIS: total, diterima = total, kembalian 0', [t2.total, t2.received, t2.change, t2.pay], [15000, 15000, 0, 'qris']);
  ledger.push({ day: dkey(), pay: 'qris', total: 15000, cost: 4500 });

  // ---------- 2. snapshot: ubah modal produk setelah penjualan ----------
  openProductModal(A.id);
  document.getElementById('p-cost').value = '4000';
  await saveProduct();
  check('modal transaksi lama tidak berubah', db.trx[0].items[0].cost, 3000);
  addToCart(A.id);
  completeSale('tunai', 8000);
  const t3 = db.trx[db.trx.length - 1];
  check('penjualan baru memakai modal baru', [t3.items[0].cost, t3.total], [4000, 8000]);
  ledger.push({ day: dkey(), pay: 'tunai', total: 8000, cost: 4000 });

  // ---------- 3. hapus produk: histori utuh ----------
  deleteProduct(C.id); acceptConfirm();
  check('produk terhapus soft delete', db.products.find((p) => p.id === C.id).deleted_at !== null, true);
  check('histori transaksi tetap menyimpan nama dan harga', db.trx[1].items[0].name + db.trx[1].items[0].price, 'Teh5000');
  state.tab = 'kasir'; render();
  check('kasir tidak menampilkan produk terhapus', [...document.querySelectorAll('.menu-name')].map((e) => e.textContent).includes('Teh'), false);

  // ---------- 4. data multi-hari untuk batas rentang ----------
  const first = startOfMonthKey();
  const lastPrev = addDaysKey(first, -1);
  const atKey = (key, hour, minute) => { const d = parseDayKey(key); d.setHours(hour, minute, 0, 0); return d; };
  pushTrx(localDate(0, 0, 1), [[A, 1]], 'tunai');        // awal hari ini
  pushTrx(localDate(0, 23, 59), [[B, 1]], 'qris');       // akhir hari ini
  pushTrx(localDate(1, 12, 0), [[A, 2]], 'tunai');       // kemarin
  pushTrx(localDate(6, 10, 0), [[B, 2]], 'qris');        // batas 7 hari (masuk)
  pushTrx(localDate(7, 10, 0), [[A, 3]], 'tunai');       // di luar 7 hari
  pushTrx(atKey(first, 0, 5), [[B, 1]], 'tunai');        // awal bulan
  pushTrx(atKey(lastPrev, 23, 55), [[A, 4]], 'qris');    // akhir bulan lalu (di luar bulan ini)
  pushTrx(localDate(40, 9, 0), [[B, 3]], 'tunai');       // 40 hari lalu

  // pengeluaran lewat form nyata
  state.tab = 'pengeluaran'; render();
  const addExpense = (date, category, amount, note) => {
    document.getElementById('e-date').value = date;
    document.getElementById('e-category').value = category;
    document.getElementById('e-amount').value = String(amount);
    document.getElementById('e-note').value = note;
    saveExpense();
  };
  addExpense(dkey(), 'Gas', 10000, 'tabung');
  ledgerExp.push({ day: dkey(), amount: 10000 });
  addExpense(dayN(3), 'Listrik', 5000, '');
  ledgerExp.push({ day: dayN(3), amount: 5000 });
  addExpense(dayN(20), 'Lainnya', 7000, 'lama');
  ledgerExp.push({ day: dayN(20), amount: 7000 });
  addExpense(lastPrev, 'Gaji', 9000, 'bulan lalu');
  ledgerExp.push({ day: lastPrev, amount: 9000 });
  addExpense(dkey(), 'Gas', 3333, 'dihapus');
  const delId = db.expenses[db.expenses.length - 1].id;
  deleteExpense(delId); acceptConfirm();
  check('pengeluaran terhapus tidak masuk hitungan', db.expenses.filter((e) => !e.deleted_at).length, 4);
  check('pengeluaran: nominal dan kategori tersimpan', db.expenses[0].amount + db.expenses[0].category, '10000Gas');

  // tab Pengeluaran: total bulan berjalan
  const monthPrefix = dkey().slice(0, 7);
  const expectedMonthExp = sumOf(ledgerExp.filter((e) => e.day.slice(0, 7) === monthPrefix).map((e) => e.amount));
  render();
  check('total pengeluaran bulan berjalan di tab Pengeluaran', document.querySelector('.expense-summary strong').textContent, rp(expectedMonthExp));

  // ---------- 5. rentang waktu vs buku besar independen ----------
  const expectedFor = (from, to) => {
    const t = ledger.filter((r) => r.day >= from && r.day <= to);
    const e = ledgerExp.filter((r) => r.day >= from && r.day <= to);
    const omzet = sumOf(t.map((r) => r.total));
    const modal = sumOf(t.map((r) => r.cost));
    const pengeluaran = sumOf(e.map((r) => r.amount));
    return {
      omzet, modal, pengeluaran,
      tunai: sumOf(t.filter((r) => r.pay === 'tunai').map((r) => r.total)),
      qris: sumOf(t.filter((r) => r.pay === 'qris').map((r) => r.total)),
      count: t.length, labaKotor: omzet - modal, laba: omzet - modal - pengeluaran
    };
  };
  const pick = (s) => ({ omzet: s.omzet, modal: s.modal, pengeluaran: s.pengeluaran, tunai: s.tunai, qris: s.qris, count: s.count, labaKotor: s.labaKotor, laba: s.laba });
  const today = dkey();
  const ranges = {
    today: [today, today],
    seven: [dayN(6), today],
    month: [first, today]
  };
  state.tab = 'logbook';
  for (const [preset, [from, to]] of Object.entries(ranges)) {
    setLogPreset(preset);
    const data = getLogData();
    check(`rentang ${preset}: from/to`, [state.logFrom, state.logTo], [from, to]);
    check(`rentang ${preset}: ringkasan = buku besar`, pick(data.summary), expectedFor(from, to));
    check(`rentang ${preset}: tunai + qris = omzet`, data.summary.tunai + data.summary.qris, data.summary.omzet);
    check(`rentang ${preset}: jumlah per hari = total`, [sumOf(data.days.map((d) => d.omzet)), sumOf(data.days.map((d) => d.modal)), sumOf(data.days.map((d) => d.pengeluaran)), sumOf(data.days.map((d) => d.laba)), sumOf(data.days.map((d) => d.trxCount))], [data.summary.omzet, data.summary.modal, data.summary.pengeluaran, data.summary.laba, data.summary.count]);
    check(`rentang ${preset}: hari terurut terbaru dulu`, data.days.map((d) => d.day), [...data.days.map((d) => d.day)].sort().reverse());
    check(`rentang ${preset}: transaksi terurut terbaru dulu`, data.trx.map((t) => t.created_at), [...data.trx.map((t) => t.created_at)].sort().reverse());
    check(`rentang ${preset}: semua data dalam rentang`, data.trx.every((t) => t.day >= from && t.day <= to) && data.expenses.every((e) => e.date >= from && e.date <= to), true);

    // tampilan
    render();
    const cards = [...document.querySelectorAll('.summary-hero .summary-value, .summary-card .summary-value')].map((e) => e.textContent);
    const exp = expectedFor(from, to);
    check(`rentang ${preset}: kartu di layar`, cards, [rp(exp.omzet), rp(exp.tunai), rp(exp.qris), rp(exp.modal), rp(exp.pengeluaran), signedRp(exp.laba)]);
    check(`rentang ${preset}: judul rincian`, document.querySelector('.section-head h2').textContent, { today: 'Rincian hari ini', seven: 'Rincian 7 hari terakhir', month: 'Rincian bulan ini' }[preset]);
    check(`rentang ${preset}: chip aktif`, [...document.querySelectorAll('.quick-chip.is-active')].map((e) => e.dataset.preset), [preset]);
    const domDays = [...document.querySelectorAll('.day-card')].map((c) => c.querySelector('.day-total').textContent);
    check(`rentang ${preset}: total per hari di layar`, domDays, data.days.map((d) => rp(d.omzet)));
    check(`rentang ${preset}: input tanggal sesuai`, [document.getElementById('log-from').value, document.getElementById('log-to').value], [from, to]);
  }
  check('transaksi akhir bulan lalu tidak masuk "bulan ini"', getLogData().trx.some((t) => t.day === lastPrev), false);
  check('batas 7 hari: hari ke-7 masuk, hari ke-8 tidak', (setLogPreset('seven'), getLogData().trx.map((t) => t.day).filter((d) => d === dayN(6) || d === dayN(7))), [dayN(6)]);

  // rentang manual dan terbalik
  const f = document.getElementById('log-from');
  setLogPreset('month'); render();
  const setDates = (from, to) => {
    document.getElementById('log-from').value = from;
    document.getElementById('log-from').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('log-to').value = to;
    document.getElementById('log-to').dispatchEvent(new Event('change', { bubbles: true }));
  };
  setDates(dayN(45), dayN(30));
  check('rentang manual: ringkasan', pick(getLogData().summary), expectedFor(dayN(45), dayN(30)));
  check('rentang manual: judul', document.querySelector('.section-head h2').textContent, 'Rincian periode');
  setDates(dayN(5), today);
  check('rentang manual 5 hari: ringkasan', pick(getLogData().summary), expectedFor(dayN(5), today));
  document.getElementById('log-to').value = dayN(8);
  document.getElementById('log-to').dispatchEvent(new Event('change', { bubbles: true }));
  check('"sampai" sebelum "dari": "dari" ikut turun', [state.logFrom, state.logTo], [dayN(8), dayN(8)]);
  check('rentang satu hari: ringkasan', pick(getLogData().summary), expectedFor(dayN(8), dayN(8)));
  document.getElementById('log-from').value = today;
  document.getElementById('log-from').dispatchEvent(new Event('change', { bubbles: true }));
  check('"dari" setelah "sampai": "sampai" ikut naik', [state.logFrom, state.logTo], [today, today]);

  // ---------- 6. ekspor sama dengan ringkasan ----------
  setLogPreset('month');
  let pdfData = null;
  const realBuild = window.WarkopPDF.build;
  window.WarkopPDF.build = (opts) => { pdfData = opts.data; const doc = realBuild(opts); doc.save = () => doc; return doc; };
  await exportPDF();
  window.WarkopPDF.build = realBuild;
  check('PDF menerima ringkasan yang sama', pdfData && pick(pdfData.summary), expectedFor(first, today));
  check('PDF menerima jumlah transaksi dan pengeluaran yang sama', pdfData && [pdfData.trx.length, pdfData.expenses.length], [expectedFor(first, today).count, ledgerExp.filter((e) => e.day >= first && e.day <= today).length]);

  let book = null;
  const realWrite = XLSX.writeFile;
  XLSX.writeFile = (wb) => { book = wb; };
  exportXLSX();
  XLSX.writeFile = realWrite;
  check('Excel punya 4 sheet', book && book.SheetNames, ['Per Hari', 'Transaksi', 'Detail Item', 'Pengeluaran']);
  const rows = (name) => XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1 }).slice(1);
  const exp2 = expectedFor(first, today);
  const perHari = rows('Per Hari');
  check('Excel Per Hari: omzet, modal, pengeluaran, laba = ringkasan', [sumOf(perHari.map((r) => r[2])), sumOf(perHari.map((r) => r[5])), sumOf(perHari.map((r) => r[6])), sumOf(perHari.map((r) => r[7]))], [exp2.omzet, exp2.modal, exp2.pengeluaran, exp2.laba]);
  check('Excel Transaksi: total, modal, laba kotor', [sumOf(rows('Transaksi').map((r) => r[4])), sumOf(rows('Transaksi').map((r) => r[5])), sumOf(rows('Transaksi').map((r) => r[6]))], [exp2.omzet, exp2.modal, exp2.labaKotor]);
  check('Excel Detail Item: subtotal, laba = omzet, laba kotor', [sumOf(rows('Detail Item').map((r) => r[6])), sumOf(rows('Detail Item').map((r) => r[7]))], [exp2.omzet, exp2.labaKotor]);
  check('Excel Pengeluaran: total', sumOf(rows('Pengeluaran').map((r) => r[3])), exp2.pengeluaran);

  // ---------- 7. cadangan JSON ----------
  const backup = normalizeDB(JSON.parse(JSON.stringify(db)));
  check('cadangan JSON utuh (jumlah dan total)', [backup.products.length, backup.trx.length, backup.expenses.length, sumOf(backup.trx.map((t) => t.total)), sumOf(backup.trx.map((t) => sumOf(t.items.map((i) => i.cost * i.qty))))], [db.products.length, db.trx.length, db.expenses.length, sumOf(db.trx.map((t) => t.total)), sumOf(db.trx.map((t) => sumOf(t.items.map((i) => i.cost * i.qty))))]);

  // ---------- 8. input uang ----------
  check('parseMoney: titik ribuan', parseMoney('1.234.567'), 1234567);
  check('parseMoney: kosong dan teks', [parseMoney(''), parseMoney('abc'), parseMoney('0')], [null, null, 0]);
  check('parseMoney: dibatasi 12 digit', parseMoney('9'.repeat(20)), 999999999999);

  // ---------- 9. sinkronisasi dengan server tiruan ----------
  const mock = { tables: { products: [], transactions: [], expenses: [] }, calls: [], failIds: new Set(), tick: 0 };
  mock.from = (table) => ({
    upsert: async (rows) => {
      const list = Array.isArray(rows) ? rows : [rows];
      mock.calls.push({ table, n: list.length });
      for (const row of list) {
        if (mock.failIds.has(row.id)) return { data: null, error: { code: '23514', message: 'check violation' } };
        const index = mock.tables[table].findIndex((r) => r.id === row.id);
        mock.tick += 1;
        const synced = new Date(Date.now() + mock.tick * 1000).toISOString();
        if (index < 0) mock.tables[table].push({ ...row, synced_at: synced });
        else if (new Date(row.updated_at) >= new Date(mock.tables[table][index].updated_at)) mock.tables[table][index] = { ...row, synced_at: synced };
      }
      return { data: null, error: null };
    },
    select: () => {
      const q = { since: null };
      const chain = {
        gt: (column, value) => { q.since = value; return chain; },
        order: () => chain,
        range: async (a, b) => ({ data: mock.tables[table].filter((r) => !q.since || r.synced_at > q.since).sort((x, y) => x.synced_at.localeCompare(y.synced_at)).slice(a, b + 1), error: null })
      };
      return chain;
    }
  });
  syncState.client = mock; syncState.session = { user: { id: 'u1' } }; syncState.user = { id: 'u1' }; syncState.online = true;

  const outboxBefore = db.outbox.length;
  await flushOutbox();
  check('antrean terkirim semua', [outboxBefore > 0, db.outbox.length], [true, 0]);
  check('server tiruan: jumlah baris sama dengan lokal', [mock.tables.products.length, mock.tables.transactions.length, mock.tables.expenses.length], [db.products.length, db.trx.length, db.expenses.length]);
  const srvTrx = mock.tables.transactions.find((r) => r.id === t1.id);
  check('server tiruan: transaksi membawa modal item dan total', [srvTrx.items[0].cost, srvTrx.total, srvTrx.change], [3000, 28000, 22000]);
  check('pengiriman dibatch (bukan satu per satu)', mock.calls.length < outboxBefore, true);

  // baris dengan updated_at lama tapi baru tiba di server -> harus terambil perangkat lain
  const oldIso = new Date(Date.now() - 3 * 3600e3).toISOString();
  mock.tables.expenses.push({ id: uid(), date: today, category: 'Gas', amount: 1234, note: 'dibuat offline', updated_at: oldIso, deleted_at: null, synced_at: new Date(Date.now() + 99000).toISOString() });
  const deviceB = createEmptyDB();
  const keepDb = db;
  db = deviceB;
  await pullRemote();
  check('perangkat baru menarik semua data termasuk yang updated_at lama', [db.products.length, db.trx.length, db.expenses.length], [keepDb.products.length, keepDb.trx.length, keepDb.expenses.length + 1]);
  const second = await pullRemote();
  check('tarik kedua tidak mengubah apa pun (idempoten)', second.changed, false);
  check('total sama persis setelah tarik di perangkat baru', [sumOf(db.trx.map((t) => t.total)), sumOf(db.trx.map((t) => sumOf(t.items.map((i) => i.cost * i.qty))))], [sumOf(keepDb.trx.map((t) => t.total)), sumOf(keepDb.trx.map((t) => sumOf(t.items.map((i) => i.cost * i.qty))))]);
  db = keepDb;

  // last-write-wins
  const prod = db.products.find((p) => p.name === 'Susu');
  const srvProd = mock.tables.products.find((p) => p.id === prod.id);
  srvProd.cost = 777; srvProd.updated_at = new Date(Date.now() + 5000).toISOString(); srvProd.synced_at = new Date(Date.now() + 120000).toISOString();
  await pullRemote();
  check('LWW: data server lebih baru menang', db.products.find((p) => p.id === prod.id).cost, 777);
  const prod2 = db.products.find((p) => p.name === 'Kopi');
  const srvProd2 = mock.tables.products.find((p) => p.id === prod2.id);
  srvProd2.cost = 111; srvProd2.updated_at = new Date(Date.now() - 86400e3).toISOString(); srvProd2.synced_at = new Date(Date.now() + 240000).toISOString();
  await pullRemote();
  check('LWW: data server lebih lama tidak menimpa lokal', db.products.find((p) => p.id === prod2.id).cost, 4000);
  openProductModal(prod2.id); document.getElementById('p-cost').value = '4500'; await saveProduct();
  srvProd2.updated_at = new Date(Date.now() + 9000).toISOString(); srvProd2.synced_at = new Date(Date.now() + 360000).toISOString();
  await pullRemote();
  check('edit lokal yang masih antre tidak ditimpa server', db.products.find((p) => p.id === prod2.id).cost, 4500);
  await flushOutbox();
  check('antrean kosong setelah edit terkirim', db.outbox.length, 0);

  // ditolak server tidak memblokir antrean
  openProductModal(prod.id); document.getElementById('p-cost').value = '6000'; await saveProduct();
  const badId = db.outbox[db.outbox.length - 1].payload.id;
  mock.failIds.add(badId);
  addToCart(prod2.id); completeSale('tunai', 10000);
  await flushOutbox();
  check('baris ditolak dipindah ke daftar ditolak dan antrean lanjut', [db.outbox.length, db.rejected.length], [0, 1]);
  mock.failIds.clear();

  // ---------- bersihkan ----------
  syncState.client = savedSync.client; syncState.session = savedSync.session; syncState.user = savedSync.user; syncState.online = savedSync.online;
  closeModal();
  db = savedDb ? normalizeDB(savedDb) || createEmptyDB() : createEmptyDB();
  state.tab = 'kasir'; setLogPreset('month'); persist(true); render();

  const failed = results.filter((r) => !r.pass);
  return { total: results.length, passed: results.length - failed.length, failed };
};
