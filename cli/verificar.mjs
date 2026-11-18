// Uso: node cli/verificar.mjs arquivo1.pdf [arquivo2.pdf ...] [--csv saida.csv]
// Mede a linha de base e o "depois" com exatamente as mesmas regras da página web.
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import * as PDFLib from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { checkPdf } from "../docs/checker.js";

const args = process.argv.slice(2);
const csvIdx = args.indexOf("--csv");
const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;
const files = args.filter((a, i) => a.toLowerCase().endsWith(".pdf") && !(csvIdx >= 0 && i === csvIdx + 1));

const ICON = { ok: "✓", falha: "✗", alerta: "!", na: "·" };
const ids = ["texto", "marcado", "idioma", "tituloDoc", "figuras", "tabelas", "titulos", "protecao"];
const rows = [["arquivo", "paginas", "pontuacao", "nivel", ...ids, "detalhes"]];

for (const file of files) {
  const bytes = new Uint8Array(await readFile(file));
  try {
    const r = await checkPdf(bytes, { PDFLib, pdfjsLib });
    console.log(`\n${basename(file)}  (${r.pages} p.)  ${r.score}/100  ${r.nivel.toUpperCase()}`);
    for (const c of r.results) console.log(`  ${ICON[c.status]} ${c.titulo}: ${c.detalhe}`);
    const byId = Object.fromEntries(r.results.map((c) => [c.id, c.status]));
    rows.push([basename(file), r.pages, r.score, r.nivel, ...ids.map((i) => byId[i]),
      r.results.filter((c) => c.status === "falha").map((c) => c.detalhe).join(" | ")]);
  } catch (e) {
    console.log(`\n${basename(file)}  ERRO: ${e.message}`);
    rows.push([basename(file), "", "", "erro", ...ids.map(() => ""), e.message]);
  }
}

if (csvPath) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  await writeFile(csvPath, csv + "\n", "utf-8");
  console.log(`\nCSV salvo em ${csvPath}`);
}
