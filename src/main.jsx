import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import salamLogo from "./assets/salam-tm-logo.svg";
import salamLogoRaw from "./assets/salam-tm-logo.svg?raw";
import { calculateTotals, formatDate, money } from "./pdfExport.js";
import "./styles.css";

const initialInvoice = {
  logoDataUrl: null,
  invoiceNumber: "16723",
  titleNote: "",
  invoiceNumberNote: "",
  issueDate: "2026-04-01",
  dueDate: "2026-04-01",
  currency: "USD",
  vatRate: "0",
  seller: {
    brand: "salam",
    company: "Salam TM",
    person: "Danatarov Danatar",
    address: ["Mollanepes 15"],
    email: "danatarovdany@gmail.com",
    phone: "+993 63 51 53 74",
  },
  client: {
    name: "SM MIR GmbH",
    address: ["Mühlenstr. 8a", "Berlin 14167", "Germany"],
    phone: "+49 1516 8135631",
  },
  payment: {
    beneficiary: "Danatarov Danatar / Salam TM",
    bank: "To be provided",
    iban: "To be provided",
    swift: "To be provided",
    reference: "INV-16723",
  },
  items: [
    {
      id: "item-1",
      description: "Design Services",
      quantity: "1",
      unitPrice: "396",
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Product card design",
      description:
        "Created conversion-focused product cards for elfbarpods.de, flerbarshop.de, and glimp.de, including ELFX Mini new-arrival layouts, optimized product-image areas, clear price blocks, improved product-detail hierarchy, and consistent brand styling.",
    },
    {
      id: "task-2",
      title: "New site design",
      description:
        "Refreshed the vaalpod.de homepage and product-page layouts with cleaner spacing, updated content blocks, stronger visual hierarchy, improved section structure, and more polished UI elements.",
    },
    {
      id: "task-3",
      title: "Email newsletter",
      description:
        "Designed branded newsletter templates for elfbarpods.de, flerbarshop.de, and glimp.de, including ELFX Mini New Arrival and Mega Sale campaigns with product highlights, promotional sections, and clear call-to-action areas.",
    },
  ],
};

const INVOICE_TEMPLATE_STORAGE_KEY = "salam-invoice-template";

function loadStoredInvoice() {
  try {
    const saved = window.localStorage.getItem(INVOICE_TEMPLATE_STORAGE_KEY);
    if (!saved) {
      return initialInvoice;
    }

    const parsed = JSON.parse(saved);
    return {
      ...initialInvoice,
      ...parsed,
      seller: { ...initialInvoice.seller, ...parsed.seller },
      client: { ...initialInvoice.client, ...parsed.client },
      payment: { ...initialInvoice.payment, ...parsed.payment },
      items: Array.isArray(parsed.items) && parsed.items.length ? parsed.items : initialInvoice.items,
      tasks: Array.isArray(parsed.tasks) && parsed.tasks.length ? parsed.tasks : initialInvoice.tasks,
    };
  } catch (err) {
    console.error("Could not load saved invoice template:", err);
    return initialInvoice;
  }
}

function buildSplitInvoices(invoice, splitRatio = 0.5) {
  const part1Items = invoice.items.map((item) => {
    const unitPrice = Number(item.unitPrice) || 0;
    const part1Unit = Number((unitPrice * splitRatio).toFixed(2));
    return { ...item, unitPrice: String(part1Unit) };
  });
  const part2Items = invoice.items.map((item, index) => {
    const unitPrice = Number(item.unitPrice) || 0;
    const part1Unit = Number(part1Items[index].unitPrice) || 0;
    const part2Unit = Number((unitPrice - part1Unit).toFixed(2));
    return { ...item, unitPrice: String(part2Unit) };
  });

  return [
    {
      ...invoice,
      invoiceNumber: `${invoice.invoiceNumber}-P1`,
      items: part1Items,
      tasks: [
        { id: "split-note-1", title: "Partial Invoice 1/2", description: "First payment part: 50% of the total invoice amount." },
        ...invoice.tasks,
      ],
    },
    {
      ...invoice,
      invoiceNumber: `${invoice.invoiceNumber}-P2`,
      items: part2Items,
      tasks: [
        { id: "split-note-2", title: "Partial Invoice 2/2", description: "Final payment part: remaining 50% of the total invoice amount." },
        ...invoice.tasks,
      ],
    },
  ];
}

function svgStringToPng(svgString, width, height) {
  return new Promise((resolve) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function App() {
  const [invoice, setInvoice] = useState(loadStoredInvoice);
  const [splitInvoices, setSplitInvoices] = useState(() => buildSplitInvoices(loadStoredInvoice()));
  const [status, setStatus] = useState("");
  const [currentPath, setCurrentPath] = useState(window.location.pathname || "/");
  const [logoPngDataUrl, setLogoPngDataUrl] = useState(null);
  const totals = useMemo(() => calculateTotals(invoice), [invoice]);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    svgStringToPng(salamLogoRaw, 360, 144).then((png) => {
      if (png) setLogoPngDataUrl(png);
    });
  }, []);

  useEffect(() => {
    setSplitInvoices(buildSplitInvoices(invoice));
  }, [invoice]);

  function updateRoot(field, value) {
    setInvoice((current) => {
      const next = { ...current, [field]: value };
      if (field === "invoiceNumber") {
        next.payment = {
          ...next.payment,
          reference: `INV-${value}`,
        };
      }
      return next;
    });
  }

  function updateNested(section, field, value) {
    setInvoice((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function updateAddress(section, index, value) {
    setInvoice((current) => ({
      ...current,
      [section]: {
        ...current[section],
        address: current[section].address.map((line, lineIndex) => (lineIndex === index ? value : line)),
      },
    }));
  }

  function addAddressLine(section) {
    setInvoice((current) => ({
      ...current,
      [section]: {
        ...current[section],
        address: [...current[section].address, ""],
      },
    }));
  }

  function removeAddressLine(section, index) {
    setInvoice((current) => ({
      ...current,
      [section]: {
        ...current[section],
        address: current[section].address.filter((_, lineIndex) => lineIndex !== index),
      },
    }));
  }

  function updateItem(id, field, value) {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }

  function addItem() {
    setInvoice((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: `item-${Date.now()}`,
          description: "New Service",
          quantity: "1",
          unitPrice: "0",
        },
      ],
    }));
  }

  function removeItem(id) {
    setInvoice((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));
  }

  function updateTask(id, field, value) {
    setInvoice((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, [field]: value } : task)),
    }));
  }

  function addTask() {
    setInvoice((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: `task-${Date.now()}`,
          title: "New task",
          description: "",
        },
      ],
    }));
  }

  function removeTask(id) {
    setInvoice((current) => ({
      ...current,
      tasks: current.tasks.length > 1 ? current.tasks.filter((task) => task.id !== id) : current.tasks,
    }));
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Выберите файл изображения (PNG, JPG, …)");
      window.setTimeout(() => setStatus(""), 2600);
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatus("Файл не больше 2 МБ");
      window.setTimeout(() => setStatus(""), 2600);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setInvoice((current) => ({ ...current, logoDataUrl: reader.result }));
      setStatus("Логотип обновлён");
      window.setTimeout(() => setStatus(""), 2200);
    };
    reader.onerror = () => {
      setStatus("Не удалось прочитать файл");
      window.setTimeout(() => setStatus(""), 2600);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function resetLogo() {
    setInvoice((current) => ({ ...current, logoDataUrl: null }));
    setStatus("Стандартный логотип");
    window.setTimeout(() => setStatus(""), 2000);
  }

  function applyTemplate() {
    try {
      window.localStorage.setItem(INVOICE_TEMPLATE_STORAGE_KEY, JSON.stringify(invoice));
      setStatus("Шаблон сохранён");
    } catch (err) {
      console.error("Could not save invoice template:", err);
      setStatus("Не удалось сохранить шаблон");
    } finally {
      window.setTimeout(() => setStatus(""), 2400);
    }
  }

  async function savePreviewAsPdf(preview, invoiceData, filenameSuffix = "styled") {
    if (!preview) {
      setStatus("Preview not found");
      window.setTimeout(() => setStatus(""), 2200);
      return;
    }
    setStatus("Сохраняю PDF...");

    // Ensure all images in the preview are fully loaded (especially PNG data URLs)
    const imgs = Array.from(preview.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = res;
                img.onerror = res;
              })
      )
    );

    try {
      const canvas = await html2canvas(preview, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 8000,
        onclone: (clonedDoc) => {
          // In the clone, swap any remaining SVG src to the already-computed PNG
          if (logoPngDataUrl) {
            const clonedImgs = clonedDoc.querySelectorAll("img");
            clonedImgs.forEach((img) => {
              if (img.src.includes(".svg") || img.src.startsWith("data:image/svg")) {
                img.src = logoPngDataUrl;
              }
            });
          }
        },
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const ratio = Math.min(
        (pageWidth * 3.7795) / canvas.width,
        (pageHeight * 3.7795) / canvas.height
      );
      const renderW = (canvas.width * ratio) / 3.7795;
      const renderH = (canvas.height * ratio) / 3.7795;
      const offsetX = (pageWidth - renderW) / 2;
      const offsetY = 0;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.97),
        "JPEG",
        offsetX,
        offsetY,
        renderW,
        renderH
      );
      pdf.save(`invoice-${safeFilePart(invoiceData.invoiceNumber)}-${filenameSuffix}.pdf`);
      setStatus("PDF saved");
    } catch (err) {
      console.error("html2canvas error:", err);
      setStatus("Ошибка сохранения PDF");
    } finally {
      window.setTimeout(() => setStatus(""), 2400);
    }
  }

  async function downloadCleanPdf() {
    await savePreviewAsPdf(document.getElementById("invoice-preview"), invoice, "styled");
  }

  function navigateTo(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
  }

  async function downloadSplitInvoices() {
    const [part1Invoice, part2Invoice] = splitInvoices;
    const previews = document.querySelectorAll(".split-preview-grid .invoice-preview");

    if (previews.length < 2) {
      setStatus("Split preview not found");
      window.setTimeout(() => setStatus(""), 2200);
      return;
    }

    await savePreviewAsPdf(previews[0], part1Invoice, "styled");
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    await savePreviewAsPdf(previews[1], part2Invoice, "styled");
    setStatus("Split previews saved: Part 1 and Part 2");
    window.setTimeout(() => setStatus(""), 2600);
  }

  function updateSplitRoot(partIndex, field, value) {
    setSplitInvoices((current) =>
      current.map((part, index) => (index === partIndex ? { ...part, [field]: value } : part))
    );
  }

  function updateSplitItem(partIndex, id, field, value) {
    setSplitInvoices((current) =>
      current.map((part, index) =>
        index === partIndex
          ? {
              ...part,
              items: part.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
            }
          : part
      )
    );
  }

  function updateSplitTask(partIndex, id, field, value) {
    setSplitInvoices((current) =>
      current.map((part, index) =>
        index === partIndex
          ? {
              ...part,
              tasks: part.tasks.map((task) => (task.id === id ? { ...task, [field]: value } : task)),
            }
          : part
      )
    );
  }

  function addSplitItem(partIndex) {
    setSplitInvoices((current) =>
      current.map((part, index) =>
        index === partIndex
          ? {
              ...part,
              items: [
                ...part.items,
                {
                  id: `split-item-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                  description: "New Service",
                  quantity: "1",
                  unitPrice: "0",
                },
              ],
            }
          : part
      )
    );
  }

  function removeSplitItem(partIndex, id) {
    setSplitInvoices((current) =>
      current.map((part, index) =>
        index === partIndex
          ? {
              ...part,
              items: part.items.length > 1 ? part.items.filter((item) => item.id !== id) : part.items,
            }
          : part
      )
    );
  }

  const logoSrc = invoice.logoDataUrl || logoPngDataUrl || salamLogo;
  const [splitPart1, splitPart2] = splitInvoices;
  const splitTotals1 = calculateTotals(splitPart1);
  const splitTotals2 = calculateTotals(splitPart2);

  if (currentPath === "/split-invoice") {
    return (
      <main className="split-page">
        <header className="split-page-header">
          <h1>Split Invoice (2-Part)</h1>
          <div className="app-actions">
            <button className="secondary-action" type="button" onClick={() => navigateTo("/")}>
              Back To Builder
            </button>
            <button className="primary-action" type="button" onClick={downloadSplitInvoices}>
              Save Part 1 + Part 2
            </button>
          </div>
        </header>
        <section className="split-editor-grid">
          {[splitPart1, splitPart2].map((part, index) => (
            <article className="split-editor-card" key={part.invoiceNumber}>
              <div className="panel-title">
                <h2>{index === 0 ? "Part 1" : "Part 2"}</h2>
                <span>{money(calculateTotals(part).total, part.currency)}</span>
              </div>
              <div className="field-grid">
                <Field
                  label="Invoice Number"
                  value={part.invoiceNumber}
                  onChange={(value) => updateSplitRoot(index, "invoiceNumber", value)}
                />
                <Field
                  label="Issue Date"
                  type="date"
                  value={part.issueDate}
                  onChange={(value) => updateSplitRoot(index, "issueDate", value)}
                />
                <Field
                  label="Due Date"
                  type="date"
                  value={part.dueDate}
                  onChange={(value) => updateSplitRoot(index, "dueDate", value)}
                />
                <Field
                  label="VAT Rate %"
                  type="number"
                  value={part.vatRate}
                  onChange={(value) => updateSplitRoot(index, "vatRate", value)}
                />
              </div>
              <div className="split-lines-head">
                <h3>Line Items</h3>
                <button className="small-action" type="button" onClick={() => addSplitItem(index)}>
                  Add Item
                </button>
              </div>
              <div className="editable-table">
                {part.items.map((item) => (
                  <div className="editable-row line-row" key={item.id}>
                    <input
                      value={item.description}
                      onChange={(event) => updateSplitItem(index, item.id, "description", event.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(event) => updateSplitItem(index, item.id, "quantity", event.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => updateSplitItem(index, item.id, "unitPrice", event.target.value)}
                    />
                    <strong>{money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), part.currency)}</strong>
                    <button type="button" onClick={() => removeSplitItem(index, item.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="split-lines-head">
                <h3>Tasks</h3>
              </div>
              <div className="task-editor compact-task-editor">
                {part.tasks.map((task) => (
                  <article className="task-card" key={task.id}>
                    <Field
                      label="Title"
                      value={task.title}
                      onChange={(value) => updateSplitTask(index, task.id, "title", value)}
                    />
                    <Field
                      label="Description"
                      as="textarea"
                      value={task.description}
                      onChange={(value) => updateSplitTask(index, task.id, "description", value)}
                    />
                  </article>
                ))}
              </div>
            </article>
          ))}
        </section>
        <section className="split-preview-grid">
          <InvoicePreview invoice={splitPart1} totals={splitTotals1} logoSrc={logoSrc} previewId="split-preview-1" />
          <InvoicePreview invoice={splitPart2} totals={splitTotals2} logoSrc={logoSrc} previewId="split-preview-2" />
        </section>
      </main>
    );
  }

  return (
    <main className="invoice-app">
      <section className="editor-shell" aria-label="Invoice editor">
        <header className="app-bar">
          <div className="brand-lockup">
            <img src={logoSrc} alt="" />
            <div>
              <h1>Invoice Builder</h1>
              <span>INV-{invoice.invoiceNumber}</span>
            </div>
          </div>
          <div className="app-actions">
            <button className="secondary-action" type="button" onClick={applyTemplate}>
              Apply
            </button>
            <button className="secondary-action" type="button" onClick={() => navigateTo("/split-invoice")}>
              Open Split Invoice Page
            </button>
            <button className="secondary-action" type="button" onClick={downloadSplitInvoices}>
              Save Split 2-Part
            </button>
            <button className="primary-action" type="button" onClick={downloadCleanPdf}>
              Save Styled PDF
            </button>
          </div>
        </header>

        {status ? <div className="save-status">{status}</div> : null}

        <div className="editor-scroll">
          <Panel title="Логотип">
            <div className="logo-upload-row">
              <label className="small-action logo-file-label">
                Загрузить картинку
                <input type="file" accept="image/*" onChange={handleLogoChange} />
              </label>
              <button className="small-action" type="button" onClick={resetLogo}>
                Как по умолчанию
              </button>
            </div>
            <p className="logo-upload-hint">PNG, JPG, WebP и др., до 2 МБ — только в шапке редактора и в превью. В PDF — круги и название бренда; загруженная картинка в PDF не подставляется.</p>
          </Panel>

          <Panel title="Invoice">
            <div className="field-grid">
              <Field label="Invoice Number" value={invoice.invoiceNumber} onChange={(value) => updateRoot("invoiceNumber", value)} />
              <Field label="Small Text Above Invoice" value={invoice.titleNote} onChange={(value) => updateRoot("titleNote", value)} />
              <Field label="Small Text Under Invoice Number" value={invoice.invoiceNumberNote} onChange={(value) => updateRoot("invoiceNumberNote", value)} />
              <Field label="Issue Date" type="date" value={invoice.issueDate} onChange={(value) => updateRoot("issueDate", value)} />
              <Field label="Due Date" type="date" value={invoice.dueDate} onChange={(value) => updateRoot("dueDate", value)} />
              <Field label="Currency" value={invoice.currency} onChange={(value) => updateRoot("currency", value.toUpperCase())} />
              <Field label="VAT Rate %" type="number" value={invoice.vatRate} onChange={(value) => updateRoot("vatRate", value)} />
            </div>
          </Panel>

          <Panel title="Billed To">
            <div className="field-grid">
              <Field label="Company" value={invoice.client.name} onChange={(value) => updateNested("client", "name", value)} />
              <Field label="Phone" value={invoice.client.phone} onChange={(value) => updateNested("client", "phone", value)} />
            </div>
            <AddressEditor
              lines={invoice.client.address}
              onChange={(index, value) => updateAddress("client", index, value)}
              onAdd={() => addAddressLine("client")}
              onRemove={(index) => removeAddressLine("client", index)}
            />
          </Panel>

          <Panel title="From">
            <div className="field-grid">
              <Field label="Brand" value={invoice.seller.brand} onChange={(value) => updateNested("seller", "brand", value)} />
              <Field label="Company" value={invoice.seller.company} onChange={(value) => updateNested("seller", "company", value)} />
              <Field label="Person" value={invoice.seller.person} onChange={(value) => updateNested("seller", "person", value)} />
              <Field label="Phone" value={invoice.seller.phone} onChange={(value) => updateNested("seller", "phone", value)} />
            </div>
            <AddressEditor
              lines={invoice.seller.address}
              onChange={(index, value) => updateAddress("seller", index, value)}
              onAdd={() => addAddressLine("seller")}
              onRemove={(index) => removeAddressLine("seller", index)}
            />
          </Panel>

          <Panel
            title="Line Items"
            action={<button className="small-action" type="button" onClick={addItem}>Add Item</button>}
          >
            <div className="editable-table">
              <div className="editable-table-head line-head">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span>Amount</span>
                <span />
              </div>
              {invoice.items.map((item) => (
                <div className="editable-row line-row" key={item.id}>
                  <input value={item.description} onChange={(event) => updateItem(item.id, "description", event.target.value)} />
                  <input type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", event.target.value)} />
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, "unitPrice", event.target.value)} />
                  <strong>{money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), invoice.currency)}</strong>
                  <button type="button" onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Tasks"
            action={<button className="small-action" type="button" onClick={addTask}>Add Task</button>}
          >
            <div className="task-editor">
              {invoice.tasks.map((task, index) => (
                <article className="task-card" key={task.id}>
                  <div className="task-card-head">
                    <strong>{index + 1}</strong>
                    <button type="button" onClick={() => removeTask(task.id)}>Remove</button>
                  </div>
                  <Field label="Title" value={task.title} onChange={(value) => updateTask(task.id, "title", value)} />
                  <Field label="Description" as="textarea" value={task.description} onChange={(value) => updateTask(task.id, "description", value)} />
                </article>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <section className="preview-shell" aria-label="Invoice preview">
        <InvoicePreview invoice={invoice} totals={totals} logoSrc={logoSrc} previewId="invoice-preview" />
      </section>
    </main>
  );
}

function Panel({ title, action = null, children }) {
  return (
    <section className="editor-panel">
      <div className="panel-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, type = "text", as = "input", className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {as === "textarea" ? (
        <textarea value={value} rows="4" onChange={(event) => onChange(event.target.value)} spellCheck={false} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
      )}
    </label>
  );
}

function AddressEditor({ lines, onChange, onAdd, onRemove }) {
  return (
    <div className="address-editor">
      <div className="address-title">
        <span>Address</span>
        <button className="small-action" type="button" onClick={onAdd}>Add Line</button>
      </div>
      {lines.map((line, index) => (
        <div className="address-row" key={`${index}-${lines.length}`}>
          <input value={line} onChange={(event) => onChange(index, event.target.value)} spellCheck={false} />
          <button type="button" onClick={() => onRemove(index)} disabled={lines.length <= 1}>Remove</button>
        </div>
      ))}
    </div>
  );
}

function InvoicePreview({ invoice, totals, logoSrc, previewId }) {
  return (
    <article className="invoice-preview" id={previewId}>
      <header className="invoice-header">
        <img className="invoice-logo" src={logoSrc} alt="" />
        <div className="issue-box">
          <span>Issue Date</span>
          <strong>{formatDate(invoice.issueDate)}</strong>
        </div>
      </header>

      <section className="invoice-title">
        <div>
          {invoice.titleNote ? <p className="invoice-title-note">{invoice.titleNote}</p> : null}
          <h2>Invoice</h2>
        </div>
        <div className="invoice-number-box">
          <span>Invoice</span>
          <strong>{invoice.invoiceNumber}</strong>
          {invoice.invoiceNumberNote ? <p>{invoice.invoiceNumberNote}</p> : null}
        </div>
      </section>

      <section className="party-grid">
        <Party title="Billed To" name={invoice.client.name} lines={[...invoice.client.address, invoice.client.phone]} />
        <Party
          title="From"
          name={invoice.seller.company}
          lines={[
            invoice.seller.person,
            ...invoice.seller.address,
            invoice.seller.phone,
          ]}
        />
      </section>

      <section className="invoice-table-section">
        <h3>Line Items</h3>
        <table className="line-table">
          <thead>
            <tr>
              <th className="description-cell">Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="description-cell">{item.description}</td>
                <td>{item.quantity}</td>
                <td>{money(Number(item.unitPrice) || 0, invoice.currency)}</td>
                <td>{money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals-only">
          <h3>Totals</h3>
          <table className="totals-table">
            <tbody>
              <PreviewRow label="Subtotal" value={money(totals.subtotal, invoice.currency)} />
              <PreviewRow label={`VAT ${Number(invoice.vatRate) || 0}%`} value={money(totals.vatAmount, invoice.currency)} />
              <PreviewRow label="Total Due" value={money(totals.total, invoice.currency)} strong />
            </tbody>
          </table>
        </div>
      </section>

      <section className="tasks-preview">
        <h3>Tasks</h3>
        <div>
          {invoice.tasks.map((task, index) => (
            <p key={task.id}>
              <strong>{index + 1}. {task.title}:</strong> {task.description}
            </p>
          ))}
        </div>
      </section>

      <footer className="invoice-footer">
        <span>{invoice.seller.email}</span>
        <span>{invoice.seller.phone}</span>
      </footer>
    </article>
  );
}

function Party({ title, name, lines }) {
  return (
    <div className="party-block">
      <span>{title}</span>
      <strong>{name}</strong>
      {lines.filter(Boolean).map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

function PreviewRow({ label, value, strong = false }) {
  return (
    <tr className={strong ? "strong-row" : ""}>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  );
}

function safeFilePart(value) {
  return String(value || "invoice")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "invoice";
}

createRoot(document.getElementById("root")).render(<App />);
