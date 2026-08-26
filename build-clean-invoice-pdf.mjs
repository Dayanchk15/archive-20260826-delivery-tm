import { writeFile } from "node:fs/promises";

const outPath = new URL("./invoice-sm-mir-cleaned.pdf", import.meta.url);

const page = {
  width: 595,
  height: 842,
  margin: 52,
};

const rows = [
  {
    section: "Services",
    description: "Product Card Design",
    rate: "1.80 EUR",
    tax: "+Tax",
    qty: "50",
    amount: "90.00 EUR",
  },
  {
    section: "Services",
    description: "New Web Site Design",
    rate: "90.00 EUR",
    tax: "+Tax",
    qty: "2",
    amount: "180.00 EUR",
  },
  {
    section: "Services",
    description: "Email Newsteller",
    rate: "18.00 EUR",
    tax: "+Tax",
    qty: "5",
    amount: "90.00 EUR",
  },
];

const totals = [
  ["Subtotal", "+360.00 EUR"],
  ["Discount", "0.00 EUR"],
  ["Tax", "+36.00 EUR"],
  ["Total", "396.00 EUR"],
  ["Deposit Requested", "0.00 EUR"],
  ["Deposit Due", "0,00 EUR"],
];

const escapePdfText = (value) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const estimateWidth = (text, size) => text.length * size * 0.5;

const lines = [];

const push = (line) => lines.push(line);

const setFill = (r, g, b) => push(`${r} ${g} ${b} rg`);
const setStroke = (r, g, b) => push(`${r} ${g} ${b} RG`);
const setLineWidth = (w) => push(`${w} w`);

const drawLine = (x1, y1, x2, y2) => {
  push(`${x1} ${y1} m`);
  push(`${x2} ${y2} l S`);
};

const drawRect = (x, y, w, h) => {
  push(`${x} ${y} ${w} ${h} re S`);
};

const text = (x, y, value, size = 12, font = "F1") => {
  push("BT");
  push(`/${font} ${size} Tf`);
  push(`1 0 0 1 ${x} ${y} Tm`);
  push(`(${escapePdfText(value)}) Tj`);
  push("ET");
};

const textRight = (rightX, y, value, size = 12, font = "F1") => {
  const x = rightX - estimateWidth(value, size);
  text(x, y, value, size, font);
};

setStroke(0.72, 0.72, 0.72);
setFill(0.08, 0.1, 0.13);
setLineWidth(1);

// Header
text(page.margin, 770, "INVOICE", 38, "F2");
textRight(545, 788, "Salam TM", 18, "F2");
textRight(545, 760, "Danatarov Danatar", 14, "F2");
textRight(545, 736, "Mollanepes 15", 14);
textRight(545, 714, "745400", 14);
textRight(545, 692, "Turkmenistan", 14);
textRight(545, 670, "+993 63 51 53 74", 14);

// Billed to / invoice meta
setFill(0.35, 0.38, 0.42);
text(page.margin, 610, "Billed To", 15, "F2");
text(265, 610, "Date Issued", 14, "F2");
text(380, 610, "Invoice Number", 14, "F2");
text(510, 610, "Amount Due", 14, "F2");
text(265, 526, "Due Date", 14, "F2");

setFill(0.08, 0.1, 0.13);
text(page.margin, 580, "SM-MIR GMBh", 16, "F2");
text(page.margin, 556, "Muehlenstr. 8a", 14);
text(page.margin, 532, "Berlin", 14);
text(page.margin, 508, "14167", 14);
text(page.margin, 484, "Germany", 14);
text(page.margin, 460, "+49 1516 8135631", 14);

text(265, 580, "01/04/2026", 14);
text(380, 580, "INV-10001", 14);
text(510, 580, "396 EUR", 14);
text(265, 496, "01/05/2026", 14);

// Table
const tableLeft = page.margin;
const tableRight = 545;
const tableTop = 408;
const rowHeight = 56;
const headerHeight = 28;
const tableBottom = tableTop - headerHeight - rows.length * rowHeight;
const colDesc = tableLeft;
const colRate = 292;
const colQty = 392;
const colAmount = 456;

drawRect(tableLeft, tableBottom, tableRight - tableLeft, tableTop - tableBottom);
drawLine(tableLeft, tableTop - headerHeight, tableRight, tableTop - headerHeight);
drawLine(colRate, tableBottom, colRate, tableTop);
drawLine(colQty, tableBottom, colQty, tableTop);
drawLine(colAmount, tableBottom, colAmount, tableTop);

for (let i = 1; i < rows.length; i += 1) {
  const yLine = tableTop - headerHeight - i * rowHeight;
  drawLine(tableLeft, yLine, tableRight, yLine);
}

setFill(0.35, 0.38, 0.42);
text(colDesc + 8, tableTop - 18, "Description", 14, "F2");
text(colRate + 8, tableTop - 18, "Rate", 14, "F2");
text(colQty + 8, tableTop - 18, "QTY", 14, "F2");
text(colAmount + 8, tableTop - 18, "Amount", 14, "F2");
setFill(0.08, 0.1, 0.13);

let y = tableTop - headerHeight - 22;
for (const row of rows) {
  text(colDesc + 8, y, row.section, 12, "F2");
  text(colDesc + 8, y - 20, row.description, 13);
  text(colRate + 8, y, row.rate, 13);
  text(colRate + 8, y - 20, row.tax, 13);
  text(colQty + 18, y - 10, row.qty, 13);
  textRight(tableRight - 10, y - 10, row.amount, 13);
  y -= rowHeight;
}

// Totals
let totalsY = 176;
for (const [label, value] of totals) {
  text(360, totalsY, label, 14, label === "Total" ? "F2" : "F1");
  textRight(545, totalsY, value, 14, label === "Total" ? "F2" : "F1");
  totalsY -= 24;
}

const content = lines.join("\n");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
  `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [0];

for (let i = 0; i < objects.length; i += 1) {
  offsets.push(Buffer.byteLength(pdf, "utf8"));
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}

const xrefStart = Buffer.byteLength(pdf, "utf8");
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";
for (let i = 1; i < offsets.length; i += 1) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

await writeFile(outPath, pdf, "binary");
