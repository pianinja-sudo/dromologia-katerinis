// Εξαγωγή μήνα σε Excel (.xlsx) και σε PDF (μέσω εκτύπωσης του browser).
// month = { label, y, m, weeks: [[null | {d, items:[string], note}]x7], rows: [{name, month, year}] }

const DAYS = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];

export async function exportMonthXlsx(month, filename) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${month.label} ${month.y}`);
  ws.columns = DAYS.map(() => ({ width: 22 }));

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
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10233F" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });

  let r = 4;
  month.weeks.forEach((week) => {
    const row = ws.getRow(r);
    const maxLines = Math.max(2, ...week.map((c) => (c ? c.items.length + 1 + (c.note ? 1 : 0) : 0)));
    row.height = Math.max(48, maxLines * 16);
    week.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { wrapText: true, vertical: "top" };
      if (c) {
        cell.value = [String(c.d), c.note ? `(${c.note})` : null, ...c.items].filter(Boolean).join("\n");
        if (i >= 5) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F2E8" } };
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
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E5FB" } };
    c.border = { bottom: { style: "thin" } };
  });
  month.rows.forEach((x) => {
    r += 1;
    const row = ws.getRow(r);
    row.getCell(1).value = x.name;
    row.getCell(2).value = x.month;
    row.getCell(3).value = x.year;
  });

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

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Ανοίγει το παράθυρο εκτύπωσης — από εκεί "Αποθήκευση ως PDF".
export function printMonth(month) {
  const head = DAYS.map((d) => `<th>${d}</th>`).join("");
  const body = month.weeks
    .map(
      (week) =>
        "<tr>" +
        week
          .map((c, i) =>
            c
              ? `<td class="${i >= 5 ? "we" : ""}"><div class="d">${c.d}${c.note ? ` <span class="n">${esc(c.note)}</span>` : ""}</div>${c.items.map((t) => `<div class="t">${esc(t)}</div>`).join("")}</td>`
              : "<td class=\"empty\"></td>"
          )
          .join("") +
        "</tr>"
    )
    .join("");
  const totals = month.rows
    .map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.month}</td><td class="num">${x.year}</td></tr>`)
    .join("");

  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>Δρομολόγια ${esc(month.label)} ${month.y}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #23262B; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 8px; text-align: center; }
  table.cal { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.cal th { background: #10233F; color: #fff; font-size: 11px; padding: 5px 2px; border: 1px solid #10233F; }
  table.cal td { border: 1px solid #999; vertical-align: top; height: 22mm; padding: 3px 4px; font-size: 10.5px; }
  td.we { background: #F5F2E8; } td.empty { background: #fafafa; }
  .d { font-weight: 700; font-size: 11px; margin-bottom: 2px; } .n { font-weight: 400; color: #9C3B2E; font-size: 9px; }
  .t { line-height: 1.35; }
  table.sum { margin-top: 10px; border-collapse: collapse; font-size: 11px; }
  table.sum th, table.sum td { border: 1px solid #999; padding: 3px 10px; text-align: left; }
  table.sum th { background: #E2E5FB; } td.num { text-align: center; }
</style></head><body>
<h1>Δρομολόγια Μετακινήσεων Κατερίνης — ${esc(month.label)} ${month.y}</h1>
<table class="cal"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<table class="sum"><thead><tr><th>Οδηγός</th><th>Δρομολόγια μήνα</th><th>Σύνολο έτους</th></tr></thead><tbody>${totals}</tbody></table>
</body></html>`;

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
