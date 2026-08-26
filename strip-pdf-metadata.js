import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node strip-pdf-metadata.js <input.pdf> <output.pdf>");
  process.exit(1);
}

const source = fs.readFileSync(inputPath).toString("latin1");
const headerMatch = source.match(/^%PDF-[^\r\n]+(?:\r?\n%[^\r\n]*)?\r?\n/);

if (!headerMatch) {
  throw new Error("Input does not look like a PDF file.");
}

const header = headerMatch[0];
const rootMatch = source.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
const infoMatch = source.match(/\/Info\s+(\d+)\s+(\d+)\s+R/);

if (!rootMatch) {
  throw new Error("Could not find PDF root object.");
}

const infoObjectNumber = infoMatch ? Number(infoMatch[1]) : null;
const objectHeaders = [];
const objectHeaderRe = /(?:^|\r?\n)(\d+)\s+(\d+)\s+obj\b/g;
let match;

while ((match = objectHeaderRe.exec(source))) {
  objectHeaders.push({
    index: match.index,
    headerEnd: match.index + match[0].length,
    number: Number(match[1]),
    generation: Number(match[2]),
  });
}

if (objectHeaders.length === 0) {
  throw new Error("No PDF objects found.");
}

const xrefStart = source.indexOf("xref", objectHeaders[objectHeaders.length - 1].headerEnd);
const objects = objectHeaders.map((objectHeader, index) => {
  const nextStart = index + 1 < objectHeaders.length
    ? objectHeaders[index + 1].index
    : xrefStart > -1
      ? xrefStart
      : source.length;
  const endObject = source.lastIndexOf("endobj", nextStart);

  if (endObject < objectHeader.headerEnd) {
    throw new Error(`Could not find endobj for object ${objectHeader.number}.`);
  }

  const body = objectHeader.number === infoObjectNumber
    ? "\n<<>>\n"
    : source.slice(objectHeader.headerEnd, endObject);

  return {
    ...objectHeader,
    body,
  };
});

let output = header;
const offsets = new Map();

for (const object of objects) {
  offsets.set(object.number, Buffer.byteLength(output, "latin1"));
  output += `${object.number} ${object.generation} obj`;
  output += object.body.startsWith("\n") || object.body.startsWith("\r") ? object.body : `\n${object.body}`;
  output += output.endsWith("\n") || output.endsWith("\r") ? "endobj\n" : "\nendobj\n";
}

const maxObjectNumber = Math.max(...objects.map((object) => object.number));
const startXref = Buffer.byteLength(output, "latin1");

output += "xref\n";
output += `0 ${maxObjectNumber + 1}\n`;
output += "0000000000 65535 f \n";

for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
  const offset = offsets.get(objectNumber);
  if (offset === undefined) {
    output += "0000000000 00000 f \n";
  } else {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
}

output += "trailer\n";
output += `<< /Size ${maxObjectNumber + 1} /Root ${rootMatch[1]} ${rootMatch[2]} R >>\n`;
output += "startxref\n";
output += `${startXref}\n`;
output += "%%EOF\n";

fs.writeFileSync(outputPath, Buffer.from(output, "latin1"));
