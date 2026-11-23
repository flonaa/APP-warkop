'use strict';

/*
 * Pembuat laporan PDF Warkop POS.
 * Dipisah dari app.js supaya mudah diuji. Dipakai lewat WarkopPDF.build({...}).
 */
(function (root) {
  const AMBER = [180, 96, 15];
  const AMBER_SOFT = [253, 243, 228];
  const INK = [35, 26, 19];
  const MUTED = [110, 97, 85];
  const LINE = [226, 219, 211];
  const ZEBRA = [251, 248, 244];
  const HEAD = [58, 40, 27];
  const GREEN = [31, 122, 69];
  const GREEN_SOFT = [231, 244, 236];
  const RED = [196, 56, 45];
  const RED_SOFT = [252, 236, 233];

  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 14;
  const CONTENT_W = PAGE_W - M * 2;
  const FOOTER_H = 14;

  const sum = (list) => list.reduce((total, value) => total + (Number(value) || 0), 0);

  function build(options) {
    const { jsPDF, data, fmt, brand, logo, printedAt } = options;
    const { rp, signedRp, shortDate, time, longDate } = fmt;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    let y = 0;

    doc.setProperties({
      title: `Laporan ${brand}`,
      subject: `Laporan ${data.from} sampai ${data.to}`,
      creator: 'Warkop POS'
    });

    const color = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    const fill = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    const stroke = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    const text = (value, x, yy, opts) => doc.text(String(value), x, yy, opts);

    const ensureSpace = (needed) => {
      if (y + needed > PAGE_H - FOOTER_H - 4) {
        doc.addPage();
        y = M;
      }
    };

    // ---------- Kop ----------
    fill(AMBER);
    doc.rect(0, 0, PAGE_W, 3.2, 'F');
    const logoSize = 20;
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', M, 9, logoSize, logoSize);
      } catch (error) {
        // Logo gagal dimuat: laporan tetap dibuat tanpa logo.
      }
    }
    const textX = logo ? M + logoSize + 5 : M;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    color(INK);
    text(brand, textX, 17.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    color(AMBER);
    text('Laporan Penjualan dan Laba', textX, 23.5);

    doc.setFontSize(8);
    color(MUTED);
    text('PERIODE', PAGE_W - M, 13, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    color(INK);
    const period = data.from === data.to ? shortDate(data.from) : `${shortDate(data.from)} - ${shortDate(data.to)}`;
    text(period, PAGE_W - M, 18.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    color(MUTED);
    text(`Dicetak ${printedAt}`, PAGE_W - M, 23.5, { align: 'right' });

    stroke(LINE);
    doc.setLineWidth(0.3);
    doc.line(M, 33, PAGE_W - M, 33);
    y = 40;

    // ---------- Kartu ringkasan ----------
    const s = data.summary;
    const gap = 4;
    const cardW = (CONTENT_W - gap * 2) / 3;
    const cardH = 19;
    const cards = [
      { label: 'Omzet', value: rp(s.omzet) },
      { label: 'Modal (HPP)', value: rp(s.modal) },
      { label: 'Laba kotor', value: signedRp(s.labaKotor), tone: s.labaKotor >= 0 ? 'pos' : 'neg' },
      { label: 'Pengeluaran', value: rp(s.pengeluaran) },
      { label: 'LABA BERSIH', value: signedRp(s.laba), tone: s.laba >= 0 ? 'hero-pos' : 'hero-neg' },
      { label: 'Jumlah transaksi', value: String(s.count) }
    ];
    cards.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = M + col * (cardW + gap);
      const top = y + row * (cardH + gap);
      const hero = card.tone === 'hero-pos' || card.tone === 'hero-neg';
      if (hero) fill(card.tone === 'hero-pos' ? GREEN_SOFT : RED_SOFT);
      else fill(ZEBRA);
      stroke(hero ? (card.tone === 'hero-pos' ? GREEN : RED) : LINE);
      doc.setLineWidth(hero ? 0.5 : 0.25);
      doc.roundedRect(x, top, cardW, cardH, 2.2, 2.2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      color(MUTED);
      text(card.label.toUpperCase(), x + 4, top + 6.2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(hero ? 14 : 12.5);
      if (card.tone === 'pos' || card.tone === 'hero-pos') color(GREEN);
      else if (card.tone === 'neg' || card.tone === 'hero-neg') color(RED);
      else color(INK);
      text(card.value, x + 4, top + 14.2);
    });
    y += cardH * 2 + gap + 6;

    const cashCount = data.trx.filter((t) => t.pay === 'tunai').length;
    const qrisCount = data.trx.filter((t) => t.pay === 'qris').length;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    color(MUTED);
    text(`Tunai ${rp(s.tunai)} (${cashCount} transaksi)   |   QRIS ${rp(s.qris)} (${qrisCount} transaksi)`, M, y);
    y += 4;
    doc.setFontSize(7.5);
    text('Laba bersih = omzet - modal (HPP) - pengeluaran.', M, y + 1.5);
    y += 9;

    // ---------- Tabel ----------
    const tableBase = {
      theme: 'plain',
      margin: { left: M, right: M, bottom: FOOTER_H + 4 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: { top: 2, right: 2.2, bottom: 2, left: 2.2 },
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: { fillColor: HEAD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
      alternateRowStyles: { fillColor: ZEBRA },
      footStyles: { fillColor: AMBER_SOFT, textColor: INK, fontStyle: 'bold' },
      showHead: 'everyPage',
      showFoot: 'lastPage',
      didDrawCell: (cell) => {
        if (cell.section === 'body') {
          stroke(LINE);
          doc.setLineWidth(0.15);
          doc.line(cell.cell.x, cell.cell.y + cell.cell.height, cell.cell.x + cell.cell.width, cell.cell.y + cell.cell.height);
        }
      }
    };

    const section = (title, note, minHeight = 30) => {
      ensureSpace(minHeight);
      fill(AMBER);
      doc.rect(M, y - 4, 1.6, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      color(INK);
      text(title, M + 4, y);
      if (note) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        color(MUTED);
        text(note, PAGE_W - M, y, { align: 'right' });
      }
      y += 4;
    };

    const table = (options2) => {
      const aligns = options2.aligns || [];
      doc.autoTable({
        ...tableBase,
        ...options2,
        startY: y,
        didParseCell: (hook) => {
          const align = aligns[hook.column.index];
          if (align) hook.cell.styles.halign = align;
        }
      });
      y = (doc.lastAutoTable?.finalY || y) + 11;
    };

    const right = { halign: 'right' };
    const center = { halign: 'center' };
    const toneStyle = (value) => ({ halign: 'right', textColor: value < 0 ? RED : INK });

    // Rekap per hari
    section('Rekap per hari', `${data.days.length} hari`);
    table({
      head: [['Tanggal', 'Trx', 'Omzet', 'Tunai', 'QRIS', 'Modal', 'Pengeluaran', 'Laba bersih']],
      body: data.days.map((day) => [
        shortDate(day.day),
        { content: String(day.trxCount), styles: center },
        { content: rp(day.omzet), styles: right },
        { content: rp(day.tunai), styles: right },
        { content: rp(day.qris), styles: right },
        { content: rp(day.modal), styles: right },
        { content: rp(day.pengeluaran), styles: right },
        { content: signedRp(day.laba), styles: toneStyle(day.laba) }
      ]),
      foot: [[
        'Total',
        { content: String(s.count), styles: center },
        { content: rp(s.omzet), styles: right },
        { content: rp(s.tunai), styles: right },
        { content: rp(s.qris), styles: right },
        { content: rp(s.modal), styles: right },
        { content: rp(s.pengeluaran), styles: right },
        { content: signedRp(s.laba), styles: toneStyle(s.laba) }
      ]],
      aligns: ['left', 'center', 'right', 'right', 'right', 'right', 'right', 'right'],
      columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 10 } }
    });

    // Produk terjual
    const products = new Map();
    data.trx.forEach((trx) => {
      trx.items.forEach((item) => {
        const key = item.product_id || item.name;
        const row = products.get(key) || { name: item.name, qty: 0, omzet: 0, modal: 0 };
        row.name = item.name;
        row.qty += item.qty;
        row.omzet += item.price * item.qty;
        row.modal += (Number(item.cost) || 0) * item.qty;
        products.set(key, row);
      });
    });
    const productRows = Array.from(products.values()).sort((a, b) => b.qty - a.qty || b.omzet - a.omzet);
    if (productRows.length) {
      section('Produk terjual', `${productRows.length} produk`, Math.min(14 + (productRows.length + 2) * 7.2, 110));
      table({
        head: [['Produk', 'Terjual', 'Omzet', 'Modal', 'Laba kotor']],
        body: productRows.map((row) => [
          row.name,
          { content: String(row.qty), styles: center },
          { content: rp(row.omzet), styles: right },
          { content: rp(row.modal), styles: right },
          { content: signedRp(row.omzet - row.modal), styles: toneStyle(row.omzet - row.modal) }
        ]),
        foot: [[
          'Total',
          { content: String(sum(productRows.map((row) => row.qty))), styles: center },
          { content: rp(sum(productRows.map((row) => row.omzet))), styles: right },
          { content: rp(sum(productRows.map((row) => row.modal))), styles: right },
          { content: signedRp(sum(productRows.map((row) => row.omzet - row.modal))), styles: right }
        ]],
        aligns: ['left', 'center', 'right', 'right', 'right'],
        columnStyles: { 1: { cellWidth: 18 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 } }
      });
    }

    // Detail transaksi
    section('Detail transaksi', `${data.trx.length} transaksi`);
    table({
      head: [['Waktu', 'Item', 'Bayar', 'Total', 'Modal', 'Laba']],
      body: data.trx.length
        ? data.trx.map((trx) => {
          const cost = sum(trx.items.map((item) => (Number(item.cost) || 0) * item.qty));
          return [
            `${shortDate(trx.day)} ${time(trx.created_at)}`,
            trx.items.map((item) => `${item.name} x${item.qty}`).join(', '),
            { content: trx.pay === 'tunai' ? 'Tunai' : 'QRIS', styles: center },
            { content: rp(trx.total), styles: right },
            { content: rp(cost), styles: right },
            { content: signedRp(trx.total - cost), styles: toneStyle(trx.total - cost) }
          ];
        })
        : [[{ content: 'Tidak ada transaksi pada periode ini.', colSpan: 6, styles: { halign: 'center', textColor: MUTED } }]],
      aligns: ['left', 'left', 'center', 'right', 'right', 'right'],
      columnStyles: { 0: { cellWidth: 27 }, 2: { cellWidth: 14 }, 3: { cellWidth: 25 }, 4: { cellWidth: 23 }, 5: { cellWidth: 23 } }
    });

    // Pengeluaran
    section('Pengeluaran', `${data.expenses.length} catatan`, Math.min(14 + (data.expenses.length + 2) * 7.2, 80));
    const byCategory = new Map();
    data.expenses.forEach((expense) => {
      byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount);
    });
    table({
      head: [['Tanggal', 'Kategori', 'Catatan', 'Nominal']],
      body: data.expenses.length
        ? data.expenses.map((expense) => [
          shortDate(expense.date),
          expense.category,
          expense.note || '-',
          { content: rp(expense.amount), styles: right }
        ])
        : [[{ content: 'Tidak ada pengeluaran pada periode ini.', colSpan: 4, styles: { halign: 'center', textColor: MUTED } }]],
      foot: data.expenses.length
        ? [[{ content: 'Total', colSpan: 3 }, { content: rp(s.pengeluaran), styles: right }]]
        : undefined,
      aligns: ['left', 'left', 'left', 'right'],
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 30 }, 3: { cellWidth: 32 } }
    });

    if (byCategory.size > 1) {
      ensureSpace(10 + byCategory.size * 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      color(INK);
      text('Per kategori', M, y - 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      color(MUTED);
      const parts = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).map(([name, amount]) => `${name} ${rp(amount)}`);
      const lines = doc.splitTextToSize(parts.join('   |   '), CONTENT_W);
      text(lines, M, y + 1.5);
      y += lines.length * 4 + 4;
    }

    // ---------- Footer semua halaman ----------
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      stroke(LINE);
      doc.setLineWidth(0.25);
      doc.line(M, PAGE_H - 11, PAGE_W - M, PAGE_H - 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      color(MUTED);
      text(`${brand}  |  Warkop POS`, M, PAGE_H - 6.5);
      text(`Halaman ${page} dari ${pages}`, PAGE_W - M, PAGE_H - 6.5, { align: 'right' });
    }

    return doc;
  }

  const api = { build };
  root.WarkopPDF = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
