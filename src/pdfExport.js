const PAGE = {
  width: 595,
  height: 842,
  margin: 40,
};

const COLORS = {
  ink: [0.08, 0.1, 0.14],
  muted: [0.42, 0.46, 0.52],
  line: [0.72, 0.72, 0.72],
  blue: [0.07, 0.4, 1],
  black: [0.02, 0.02, 0.02],
};

export function formatDate(value) {
  if (!value) {
    return "";
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return String(value);
  }

  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function money(value, currency = "USD") {
  const amount = Number(value) || 0;
  return `${amount.toFixed(2)} ${currency}`;
}

export function calculateTotals(invoice) {
  const subtotal = invoice.items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  const vatAmount = subtotal * ((Number(invoice.vatRate) || 0) / 100);
  const total = subtotal + vatAmount;

  return { subtotal, vatAmount, total };
}

export function createCleanPdfBytes(invoice) {
  const totals = calculateTotals(invoice);
  const doc = new PdfDocument();
  doc.addPage();
  renderInvoice(doc, invoice, totals);
  return doc.finish();
}

class PdfDocument {
  constructor() {
    this.pages = [];
    this.current = null;
  }

  addPage() {
    this.current = [];
    this.pages.push(this.current);
  }

  ensureSpace(y, needed) {
    if (y + needed <= PAGE.height - PAGE.margin) {
      return y;
    }

    this.addPage();
    return PAGE.margin;
  }

  command(value) {
    this.current.push(value);
  }

  strokeColor(color) {
    this.command(`${color[0]} ${color[1]} ${color[2]} RG`);
  }

  fillColor(color) {
    this.command(`${color[0]} ${color[1]} ${color[2]} rg`);
  }

  lineWidth(width) {
    this.command(`${width} w`);
  }

  rect(x, y, width, height, mode = "S") {
    this.command(`${num(x)} ${num(PAGE.height - y - height)} ${num(width)} ${num(height)} re ${mode}`);
  }

  line(x1, y1, x2, y2) {
    this.command(`${num(x1)} ${num(PAGE.height - y1)} m`);
    this.command(`${num(x2)} ${num(PAGE.height - y2)} l S`);
  }

  circle(x, y, radius, color, width = 2) {
    const c = 0.5522847498 * radius;
    const cy = PAGE.height - y;
    this.strokeColor(color);
    this.lineWidth(width);
    this.command(`${num(x + radius)} ${num(cy)} m`);
    this.command(`${num(x + radius)} ${num(cy + c)} ${num(x + c)} ${num(cy + radius)} ${num(x)} ${num(cy + radius)} c`);
    this.command(`${num(x - c)} ${num(cy + radius)} ${num(x - radius)} ${num(cy + c)} ${num(x - radius)} ${num(cy)} c`);
    this.command(`${num(x - radius)} ${num(cy - c)} ${num(x - c)} ${num(cy - radius)} ${num(x)} ${num(cy - radius)} c`);
    this.command(`${num(x + c)} ${num(cy - radius)} ${num(x + radius)} ${num(cy - c)} ${num(x + radius)} ${num(cy)} c S`);
  }

  text(x, y, value, size = 10, font = "F1", color = COLORS.ink) {
    this.fillColor(color);
    this.command("BT");
    this.command(`/${font} ${num(size)} Tf`);
    this.command(`1 0 0 1 ${num(x)} ${num(PAGE.height - y)} Tm`);
    this.command(`(${escapePdfText(value)}) Tj`);
    this.command("ET");
  }

  textRight(rightX, y, value, size = 10, font = "F1", color = COLORS.ink) {
    this.text(rightX - estimateWidth(value, size), y, value, size, font, color);
  }

  textCenter(centerX, y, value, size = 10, font = "F1", color = COLORS.ink) {
    this.text(centerX - estimateWidth(value, size) / 2, y, value, size, font, color);
  }

  textBlock(x, y, value, width, size = 10, lineHeight = 13, font = "F1", color = COLORS.ink) {
    const lines = wrapText(value, width, size);
    lines.forEach((line, index) => {
      this.text(x, y + index * lineHeight, line, size, font, color);
    });
    return y + lines.length * lineHeight;
  }

  finish() {
    const pageCount = this.pages.length;
    const fontRegularId = 3 + pageCount * 2;
    const fontBoldId = fontRegularId + 1;
    const pageIds = this.pages.map((_, index) => 3 + index * 2);
    const objects = [
      { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
      { id: 2, body: `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>` },
    ];

    this.pages.forEach((commands, index) => {
      const pageId = 3 + index * 2;
      const contentId = pageId + 1;
      const content = commands.join("\n");
      objects.push({
        id: pageId,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
      });
      objects.push({
        id: contentId,
        body: `<< /Length ${latin1Length(content)} >>\nstream\n${content}\nendstream`,
      });
    });

    objects.push({ id: fontRegularId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" });
    objects.push({ id: fontBoldId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>" });

    objects.sort((a, b) => a.id - b.id);

    let pdf = "%PDF-1.4\n%\xD3\xEB\xE9\xE1\n";
    const offsets = new Map();

    for (const object of objects) {
      offsets.set(object.id, latin1Length(pdf));
      pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
    }

    const maxId = Math.max(...objects.map((object) => object.id));
    const xrefStart = latin1Length(pdf);
    pdf += `xref\n0 ${maxId + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let id = 1; id <= maxId; id += 1) {
      const offset = offsets.get(id);
      pdf += offset === undefined
        ? "0000000000 00000 f \n"
        : `${String(offset).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return latin1Bytes(pdf);
  }
}

function renderInvoice(doc, invoice, totals) {
  let y = PAGE.margin;
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const width = right - left;

  doc.lineWidth(1);
  doc.strokeColor(COLORS.line);
  doc.line(left, 36, right, 36);

  doc.circle(left + 12, y + 12, 11, COLORS.blue, 6);
  doc.circle(left + 34, y + 12, 11, COLORS.black, 6);
  const brandWord = invoice.seller.brand || "salam";
  doc.text(left + 56, y + 18, brandWord, 19, "F2", COLORS.black);
  doc.lineWidth(1);
  doc.strokeColor(COLORS.line);
  doc.textRight(right, y + 6, "ISSUE DATE", 9, "F2", COLORS.muted);
  doc.textRight(right, y + 23, formatDate(invoice.issueDate), 11, "F2");

  y += 72;
  doc.line(left, y - 18, right, y - 18);
  doc.text(left, y + 22, "Invoice", 36, "F2");
  doc.textRight(right, y + 16, "INVOICE", 10, "F2", COLORS.muted);
  doc.textRight(right, y + 38, invoice.invoiceNumber, 22, "F2");

  y += 82;
  doc.line(left, y - 20, right, y - 20);
  doc.text(left, y + 4, "BILLED TO", 10, "F2", COLORS.muted);
  doc.text(left, y + 28, invoice.client.name, 12, "F2");
  let billY = y + 46;
  [...invoice.client.address, invoice.client.phone].filter(Boolean).forEach((line) => {
    doc.text(left, billY, line, 10);
    billY += 14;
  });

  const fromX = left + width / 2;
  doc.text(fromX, y + 4, "FROM", 10, "F2", COLORS.muted);
  doc.text(fromX, y + 28, invoice.seller.company, 12, "F2");
  let fromY = y + 46;
  [invoice.seller.person, ...invoice.seller.address, invoice.seller.email, invoice.seller.phone].filter(Boolean).forEach((line) => {
    doc.text(fromX, fromY, line, 10);
    fromY += 14;
  });

  y = Math.max(billY, fromY) + 22;
  y = drawSectionTitle(doc, y, "Line Items");
  y = drawTable(doc, y, [
    { label: "Description", width: 250, align: "left" },
    { label: "Qty", width: 48, align: "center" },
    { label: "Unit Price", width: 105, align: "right" },
    { label: "Amount", width: 112, align: "right" },
  ], invoice.items.map((item) => [
    item.description,
    item.quantity,
    money(Number(item.unitPrice) || 0, invoice.currency),
    money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), invoice.currency),
  ]));

  y += 22;
  y = doc.ensureSpace(y, 88);
  const totalsX = right - 210;
  drawSectionTitle(doc, y, "Totals", totalsX);
  drawSmallTable(doc, totalsX, y + 18, 210, [
    ["Subtotal", money(totals.subtotal, invoice.currency)],
    [`VAT ${Number(invoice.vatRate) || 0}%`, money(totals.vatAmount, invoice.currency)],
    ["Total Due", money(totals.total, invoice.currency)],
  ], true);
  y += 88;

  y = drawSectionTitle(doc, y + 8, "Tasks");
  invoice.tasks.forEach((task, index) => {
    const text = `${index + 1}. ${task.title}: ${task.description}`;
    const lines = wrapText(text, width, 9.5);
    y = doc.ensureSpace(y, lines.length * 13 + 10);
    y = doc.textBlock(left, y, text, width, 9.5, 13) + 6;
  });
}

function drawSectionTitle(doc, y, label, x = PAGE.margin) {
  y = doc.ensureSpace(y, 24);
  doc.text(x, y, label, 12, "F2");
  return y + 18;
}

function drawTable(doc, startY, columns, rows) {
  const x = PAGE.margin;
  const headerHeight = 32;
  const padding = 10;
  const lineHeight = 13;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  let y = doc.ensureSpace(startY, headerHeight + 30);

  const drawHeader = () => {
    doc.strokeColor(COLORS.line);
    doc.lineWidth(1);
    doc.rect(x, y, tableWidth, headerHeight);
    let colX = x;
    columns.forEach((column, index) => {
      if (index > 0) {
        doc.line(colX, y, colX, y + headerHeight);
      }
      drawCellText(doc, colX + padding, y + 18, column.label, column.width - padding * 2, 8.5, "F2", COLORS.muted, column.align);
      colX += column.width;
    });
    y += headerHeight;
  };

  drawHeader();

  rows.forEach((row) => {
    const rowHeight = Math.max(
      34,
      ...row.map((cell, index) => wrapText(cell, columns[index].width - padding * 2, 9.5).length * lineHeight + padding * 2)
    );

    if (y + rowHeight > PAGE.height - PAGE.margin) {
      doc.addPage();
      y = PAGE.margin;
      drawHeader();
    }

    doc.strokeColor(COLORS.line);
    doc.lineWidth(1);
    doc.rect(x, y, tableWidth, rowHeight);
    let colX = x;
    columns.forEach((column, index) => {
      if (index > 0) {
        doc.line(colX, y, colX, y + rowHeight);
      }
      drawCellText(doc, colX + padding, y + padding + 9, row[index], column.width - padding * 2, 9.5, index === 3 ? "F2" : "F1", COLORS.ink, column.align);
      colX += column.width;
    });
    y += rowHeight;
  });

  return y;
}

function drawSmallTable(doc, x, y, width, rows, strongLast = false) {
  const rowHeight = 28;
  const cellPadding = 10;
  const tableHeight = rows.length * rowHeight;
  doc.strokeColor(COLORS.line);
  doc.lineWidth(1);
  doc.rect(x, y, width, tableHeight);
  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) {
      doc.line(x, rowY, x + width, rowY);
    }
    const isStrong = strongLast && index === rows.length - 1;
    doc.text(x + cellPadding, rowY + 17, row[0], 8.5, "F2", COLORS.muted);
    doc.textRight(x + width - cellPadding, rowY + 17, row[1], isStrong ? 10 : 9, isStrong ? "F2" : "F1");
  });
}

function drawCellText(doc, x, y, value, width, size, font, color, align) {
  const lines = wrapText(value, width, size);
  lines.forEach((line, index) => {
    const lineY = y + index * 13;
    if (align === "right") {
      doc.textRight(x + width, lineY, line, size, font, color);
    } else if (align === "center") {
      doc.textCenter(x + width / 2, lineY, line, size, font, color);
    } else {
      doc.text(x, lineY, line, size, font, color);
    }
  });
}

function wrapText(value, width, size) {
  const text = cleanText(value);
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (estimateWidth(next, size) <= width) {
      line = next;
      return;
    }

    if (line) {
      lines.push(line);
    }

    if (estimateWidth(word, size) <= width) {
      line = word;
      return;
    }

    let chunk = "";
    [...word].forEach((char) => {
      if (estimateWidth(`${chunk}${char}`, size) > width && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    });
    line = chunk;
  });

  if (line) {
    lines.push(line);
  }

  return lines;
}

function estimateWidth(value, size) {
  return cleanText(value).length * size * 0.48;
}

function escapePdfText(value) {
  return cleanText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?")
    .trim();
}

function num(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function latin1Length(value) {
  return value.length;
}

function latin1Bytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}
