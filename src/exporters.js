// Εξαγωγές σε Excel (.xlsx) και PDF (μέσω εκτύπωσης του browser), για έναν μήνα ή για όλη τη χρονιά.
// month = { label, y, m, weeks: [[null | {d, items:[string], note}]x7], rows: [{name, month, year}] }
// Για τη χρονιά: months = [month...], totals = { head: [...], rows: [[όνομα, ...μήνες, σύνολο]] }

const DAYS = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];
const NAVY = "FF1F2430";
const thin = { style: "thin" };
const box = { top: thin, left: thin, bottom: thin, right: thin };

function addMonthSheet(wb, month) {
  const ws = wb.addWorksheet(`${month.label} ${month.y}`);
  ws.columns = DAYS.map(() => ({ width: 24 }));
  ws.mergeCells(1, 1, 1, 7);
  const title = ws.getCell(1, 1);
  title.value = `Δρομολόγια Μετακινήσεων Κατερίνης — ${month.label} ${month.y}`;
  title.font = { bold: true, size: 15 };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  const head = ws.getRow(3);
  DAYS.forEach((d, i) => {
    const c = head.getCell(i + 1);
    c.value = d;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  let r = 4;
  month.weeks.forEach((week) => {
    const row = ws.getRow(r);
    const maxLines = Math.max(2, ...week.map((c) => (c ? c.items.length + 1 + (c.note ? 1 : 0) : 0)));
    row.height = Math.max(48, maxLines * 16);
    week.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.border = box;
      cell.alignment = { wrapText: true, vertical: "top" };
      if (c) {
        cell.value = [String(c.d), c.note ? `(${c.note})` : null, ...c.items].filter(Boolean).join("\n");
        if (i >= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF1F5" } };
      }
    });
    r += 1;
  });

  r += 1;
  const hdr = ws.getRow(r);
  ["Οδηγός", "Δρομολόγια μήνα", "Σύνολο έτους"].forEach((t, i) => {
    const c = hdr.getCell(i + 1);
    c.value = t;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4ECFB" } };
    c.border = { bottom: thin };
  });
  month.rows.forEach((x) => {
    r += 1;
    const row = ws.getRow(r);
    row.getCell(1).value = x.name;
    row.getCell(2).value = x.month;
    row.getCell(3).value = x.year;
  });
}

function addTotalsSheet(wb, totals) {
  const ws = wb.addWorksheet("Σύνολα οδηγών");
  ws.columns = totals.head.map((_, i) => ({ width: i === 0 ? 22 : 13 }));
  const hdr = ws.getRow(1);
  totals.head.forEach((t, i) => {
    const c = hdr.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
  });
  hdr.height = 30;
  totals.rows.forEach((vals, ri) => {
    const row = ws.getRow(ri + 2);
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v;
      c.border = { bottom: thin };
      if (i > 0) c.alignment = { horizontal: "center" };
      if (i === vals.length - 1) c.font = { bold: true };
    });
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
}

function addTripsSheet(wb, trips) {
  const ws = wb.addWorksheet("Λίστα δρομολογίων");
  ws.columns = [{ width: 14 }, { width: 24 }, { width: 18 }];
  const hdr = ws.getRow(1);
  ["Ημερομηνία", "Οδηγός", "Αρ. δρομολογίου"].forEach((t, i) => {
    const c = hdr.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  });
  trips.forEach((t, i) => {
    const row = ws.getRow(i + 2);
    row.getCell(1).value = t[0];
    row.getCell(2).value = t[1];
    row.getCell(3).value = t[2];
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

async function saveWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportMonthXlsx(month, filename) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  addMonthSheet(wb, month);
  await saveWorkbook(wb, filename);
}

// Όλη η χρονιά: ένα φύλλο ανά μήνα + σύνολα οδηγών + λίστα όλων των δρομολογίων
export async function exportYearXlsx(months, totals, trips, filename) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  addTotalsSheet(wb, totals);
  months.forEach((mo) => addMonthSheet(wb, mo));
  addTripsSheet(wb, trips);
  await saveWorkbook(wb, filename);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function monthHtml(month, withBreak) {
  const head = DAYS.map((d) => `<th>${d}</th>`).join("");
  const body = month.weeks
    .map(
      (week) =>
        "<tr>" +
        week
          .map((c, i) =>
            c
              ? `<td class="${i >= 5 ? "we" : ""}"><div class="d">${c.d}${c.note ? ` <span class="n">${esc(c.note)}</span>` : ""}</div>${c.items.map((t) => `<div class="t">${esc(t)}</div>`).join("")}</td>`
              : '<td class="empty"></td>'
          )
          .join("") +
        "</tr>"
    )
    .join("");
  const totals = month.rows
    .map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.month}</td><td class="num">${x.year}</td></tr>`)
    .join("");
  return `<section class="${withBreak ? "brk" : ""}">
<h1>Δρομολόγια Μετακινήσεων Κατερίνης — ${esc(month.label)} ${month.y}</h1>
<table class="cal"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<table class="sum"><thead><tr><th>Οδηγός</th><th>Δρομολόγια μήνα</th><th>Σύνολο έτους</th></tr></thead><tbody>${totals}</tbody></table>
</section>`;
}

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1F2430; margin: 0; }
  section.brk { page-break-after: always; }
  h1 { font-size: 16px; margin: 0 0 8px; text-align: center; }
  table.cal { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.cal th { background: #1F2430; color: #fff; font-size: 11px; padding: 5px 2px; border: 1px solid #1F2430; }
  table.cal td { border: 1px solid #999; vertical-align: top; height: 22mm; padding: 3px 4px; font-size: 10.5px; }
  td.we { background: #EFF1F5; } td.empty { background: #fafafa; }
  .d { font-weight: 700; font-size: 11px; margin-bottom: 2px; } .n { font-weight: 400; color: #9C3B2E; font-size: 9px; }
  .t { line-height: 1.35; }
  table.sum, table.tot { margin-top: 10px; border-collapse: collapse; font-size: 11px; }
  table.sum th, table.sum td, table.tot th, table.tot td { border: 1px solid #999; padding: 3px 10px; text-align: left; }
  table.sum th, table.tot th { background: #E4ECFB; } td.num { text-align: center; }
`;

function printHtml(title, inner) {
  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${inner}</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => document.body.removeChild(frame), 2000);
  }, 300);
}

// Ανοίγει το παράθυρο εκτύπωσης — από εκεί "Αποθήκευση ως PDF".
export function printMonth(month) {
  printHtml(`Δρομολόγια ${month.label} ${month.y}`, monthHtml(month, false));
}

// Όλη η χρονιά: μία σελίδα ανά μήνα και στο τέλος ο πίνακας συνόλων
export function printYear(months, totals) {
  const head = totals.head.map((t) => `<th>${esc(t)}</th>`).join("");
  const rows = totals.rows
    .map((r) => `<tr>${r.map((v, i) => (i === 0 ? `<td>${esc(v)}</td>` : `<td class="num">${v}</td>`)).join("")}</tr>`)
    .join("");
  const tot = `<section><h1>Σύνολα οδηγών — σχολικό έτος 2026–2027</h1><table class="tot"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></section>`;
  printHtml("Δρομολόγια 2026–2027", months.map((mo) => monthHtml(mo, true)).join("") + tot);
}
