// Gera o relatório de medição (linha de base ou "depois") em HTML acessível e imprimível.
// Uso: node cli/relatorio.mjs <pasta-com-pdfs> <documentos.json> <saida.html> [--titulo "..."] [--data dd/mm/aaaa]
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as PDFLib from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { checkPdf, CHECKS } from "../docs/checker.js";

const [dir, metaPath, outPath] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TITULO = opt("--titulo", "Linha de base: acessibilidade dos documentos publicados pela SIA/UFRN");
const DATA = opt("--data", new Date().toLocaleDateString("pt-BR"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const meta = JSON.parse(await readFile(metaPath, "utf-8"));
const docs = [];
for (const m of meta) {
  const r = await checkPdf(new Uint8Array(await readFile(join(dir, m.arquivo))), { PDFLib, pdfjsLib });
  docs.push({ ...m, ...r, by: Object.fromEntries(r.results.map((c) => [c.id, c])) });
}

const n = docs.length;
const media = Math.round(docs.reduce((a, d) => a + d.score, 0) / n);
const count = (lvl) => docs.filter((d) => d.nivel === lvl).length;
const NIVEL = { acessivel: "Acessível", parcial: "Parcial", inacessivel: "Inacessível" };
const ST = { ok: "Aprovado", falha: "Problema", alerta: "Atenção", na: "Não se aplica" };
const ids = ["texto", "marcado", "idioma", "tituloDoc", "figuras", "tabelas", "titulos", "protecao"];

const criterioRows = ids.map((id) => {
  const c = (s) => docs.filter((d) => d.by[id].status === s).length;
  const avaliados = n - c("na");
  return `<tr><th scope="row">${esc(CHECKS[id].titulo)}</th><td>${c("ok")}</td><td>${c("alerta")}</td><td>${c("falha")}</td><td>${avaliados}</td></tr>`;
}).join("");

const docRows = [...docs].sort((a, b) => a.score - b.score).map((d) => {
  const probs = d.results.filter((c) => c.status === "falha" || c.status === "alerta").map((c) => esc(c.detalhe));
  return `<tr><th scope="row">${esc(d.nome)}<br><small>${esc(d.secao)} · ${d.pages} p.</small></th>
    <td>${d.score}</td><td>${NIVEL[d.nivel]}</td><td>${probs.length ? "<ul>" + probs.map((p) => `<li>${p}</li>`).join("") + "</ul>" : "Nenhum problema detectado"}</td></tr>`;
}).join("");

const semIdioma = docs.filter((d) => d.by.idioma.status !== "ok").length;
const semTitulo = docs.filter((d) => d.by.tituloDoc.status !== "ok").length;
const semTags = docs.filter((d) => d.by.marcado.status !== "ok").length;
const imgsSemAlt = docs.reduce((a, d) => a + (Number((d.by.figuras.detalhe.match(/^(\d+) de/) || [])[1]) || 0), 0);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITULO)}</title>
<style>
  body { font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #10201f; margin: 0; background: #fff; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 24px 48px; }
  h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 6px; color: #0b4f4a; }
  h2 { font-size: 1.15rem; margin: 28px 0 8px; color: #0b4f4a; border-bottom: 2px solid #d5e4e3; padding-bottom: 4px; }
  .meta { color: #475a59; margin: 0 0 18px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
  .kpi { border: 1px solid #d5e4e3; border-radius: 10px; padding: 10px 12px; }
  .kpi b { display: block; font-size: 1.6rem; color: #0b4f4a; line-height: 1.1; }
  .kpi span { font-size: .85rem; color: #475a59; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: .9rem; }
  caption { text-align: left; font-weight: 700; margin-bottom: 6px; }
  th, td { border: 1px solid #d5e4e3; padding: 6px 8px; text-align: left; vertical-align: top; }
  thead th { background: #eef6f5; }
  td ul { margin: 0; padding-left: 16px; }
  small { color: #475a59; font-weight: 400; }
  .note { background: #f4f8f8; border-left: 4px solid #0f766e; padding: 10px 14px; border-radius: 6px; }
  @media print { main { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } .kpis { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 600px) { .kpis { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<main>
<h1>${esc(TITULO)}</h1>
<p class="meta">Medição de ${esc(DATA)} · Projeto de extensão "Edital Acessível" · Giovanni R. M. de Oliveira, Ciência da Computação (UNP)</p>

<h2>Resumo</h2>
<div class="kpis">
  <div class="kpi"><b>${n}</b><span>documentos analisados</span></div>
  <div class="kpi"><b>${media}/100</b><span>pontuação média</span></div>
  <div class="kpi"><b>${count("acessivel")}</b><span>acessíveis</span></div>
  <div class="kpi"><b>${count("inacessivel")}</b><span>inacessíveis (${count("parcial")} parciais)</span></div>
</div>
<p>Os problemas mais frequentes são também os mais simples de corrigir:</p>
<ul>
  <li><strong>${semIdioma} de ${n}</strong> sem idioma válido: resolve-se com uma configuração no Word (Revisão &gt; Idioma).</li>
  <li><strong>${semTitulo} de ${n}</strong> sem título adequado: um campo em Arquivo &gt; Informações.</li>
  <li><strong>${semTags} de ${n}</strong> sem estrutura para leitor de tela: uma opção na hora de exportar o PDF.</li>
  ${imgsSemAlt ? `<li><strong>${imgsSemAlt} imagens</strong> sem descrição (texto alternativo).</li>` : ""}
</ul>
<p class="note">A Instrução Normativa nº 1/2023 da SIA/UFRN regulamenta a produção de documentos acessíveis. Esta medição mostra onde o fluxo de publicação ainda não alcança a norma e serve de ponto de partida para comparar com os documentos corrigidos.</p>

<h2>Resultado por critério</h2>
<table>
  <caption>Quantidade de documentos por situação em cada critério verificado</caption>
  <thead><tr><th scope="col">Critério</th><th scope="col">Aprovado</th><th scope="col">Atenção</th><th scope="col">Problema</th><th scope="col">Avaliados</th></tr></thead>
  <tbody>${criterioRows}</tbody>
</table>

<h2>Resultado por documento</h2>
<table>
  <caption>Documentos da página Documentos do portal da SIA, do menor para o maior escore</caption>
  <thead><tr><th scope="col">Documento</th><th scope="col">Pontos</th><th scope="col">Nível</th><th scope="col">Problemas encontrados</th></tr></thead>
  <tbody>${docRows}</tbody>
</table>

<h2>Método e limites</h2>
<p>Amostra: os ${n} documentos PDF listados na página Documentos de sia.ufrn.br, baixados manualmente em ${esc(DATA)}. Verificação automática com o Verificador de PDF Acessível (giovanni-oliveira75.github.io/edital-acessivel), que aplica requisitos mensuráveis da ISO 14289 (PDF/UA), da WCAG 2.1 e do eMAG 3.1. Pontuação: proporção de critérios aplicáveis aprovados (atenção vale metade).</p>
<p>A verificação automática não avalia a qualidade das descrições de imagem nem a ordem de leitura, e não substitui o teste com leitor de tela e com pessoas usuárias.</p>

<h2>Para decidirmos juntos</h2>
<ol>
  <li>Quais documentos são prioridade para corrigir primeiro (os mais acessados pelos estudantes)?</li>
  <li>Quem produz e publica os documentos da SIA, e em que programa são feitos?</li>
  <li>Em que momento do fluxo a verificação antes de publicar se encaixa melhor?</li>
</ol>
</main>
</body>
</html>`;
await writeFile(outPath, html, "utf-8");
console.log(`Relatório gerado: ${outPath} (${n} documentos, média ${media})`);
