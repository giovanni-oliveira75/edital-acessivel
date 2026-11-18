// Verificador de acessibilidade de PDF (núcleo compartilhado entre navegador e linha de comando).
// Baseado nos requisitos de PDF/UA (ISO 14289), WCAG 2.1 e eMAG 3.1 que podem ser verificados
// automaticamente. Não substitui teste com leitor de tela nem com pessoas usuárias.

const MAX_NODES = 100000;
const TEXT_SAMPLE_PAGES = 5;

export const CHECKS = {
  texto: {
    titulo: "Texto selecionável",
    norma: "WCAG 1.1.1 · PDF/UA 7.1",
    porque: "Se o PDF é uma imagem (documento escaneado), o leitor de tela não tem o que ler: para quem é cego, a página está em branco.",
    comoCorrigir: [
      "Gere o PDF a partir do arquivo original (Word, Google Docs), e não escaneando o papel.",
      "Se só existir a versão em papel, use OCR (Adobe Acrobat: Ferramentas > Digitalizar e OCR) e revise o texto reconhecido.",
    ],
  },
  marcado: {
    titulo: "Estrutura marcada (tags)",
    norma: "WCAG 1.3.1 · PDF/UA 7.1",
    porque: "Sem marcação, o leitor de tela não sabe o que é título, parágrafo, lista ou tabela, e lê tudo como um bloco único, às vezes fora de ordem.",
    comoCorrigir: [
      "No Word: Arquivo > Salvar como > PDF > Opções > marque \"Marcas de estrutura do documento para acessibilidade\".",
      "No Google Docs: Arquivo > Fazer download > PDF já gera marcação básica; prefira exportar pelo Word quando possível.",
      "Não use \"Imprimir > Salvar como PDF\": esse caminho descarta a estrutura.",
    ],
  },
  idioma: {
    titulo: "Idioma do documento",
    norma: "WCAG 3.1.1 · PDF/UA 7.2",
    porque: "Sem idioma declarado (ou com código inválido, como pt_BR), o leitor de tela pode ler o texto com pronúncia de outra língua.",
    comoCorrigir: [
      "No Word: Revisão > Idioma > Definir Idioma de Revisão > Português (Brasil), com todo o texto selecionado, antes de exportar.",
      "No Acrobat: Arquivo > Propriedades > Avançado > Idioma: Português.",
    ],
  },
  tituloDoc: {
    titulo: "Título do documento",
    norma: "WCAG 2.4.2 · PDF/UA 7.1",
    porque: "O título é a primeira coisa anunciada ao abrir o arquivo. Sem ele, a pessoa ouve só o nome do arquivo (ex.: \"downloadArquivo\").",
    comoCorrigir: [
      "No Word: Arquivo > Informações > Propriedades > Título. Preencha com o nome real do documento.",
      "Na exportação para PDF, em Opções, marque \"Propriedades do documento\".",
    ],
  },
  figuras: {
    titulo: "Imagens com texto alternativo",
    norma: "WCAG 1.1.1 · PDF/UA 7.3",
    porque: "Imagem sem descrição é invisível para quem usa leitor de tela: logotipos, gráficos e assinaturas simplesmente desaparecem, ou são anunciados só como \"imagem\".",
    comoCorrigir: [
      "No Word: clique com o botão direito na imagem > Exibir Texto Alt > descreva em uma frase o que a imagem informa.",
      "Imagem só decorativa: marque \"Marcar como decorativo\".",
      "Use Revisão > Verificar Acessibilidade para achar todas as imagens sem descrição.",
    ],
  },
  tabelas: {
    titulo: "Tabelas com cabeçalho",
    norma: "WCAG 1.3.1 · PDF/UA 7.5",
    porque: "Sem cabeçalho marcado, o leitor de tela lê célula por célula sem dizer a que coluna cada valor pertence. Em cronogramas e resultados, isso torna a tabela inutilizável.",
    comoCorrigir: [
      "No Word: clique na tabela > Design da Tabela > marque \"Linha de Cabeçalho\".",
      "Em Propriedades da Tabela > Linha, marque \"Repetir como linha de cabeçalho em todas as páginas\".",
      "Evite células mescladas e tabelas usadas só para alinhar texto.",
    ],
  },
  titulos: {
    titulo: "Títulos e seções marcados",
    norma: "WCAG 1.3.1 e 2.4.6 · PDF/UA 7.4",
    porque: "Títulos marcados permitem pular de seção em seção. Sem eles, a pessoa precisa ouvir o documento inteiro para achar o cronograma ou os requisitos.",
    comoCorrigir: [
      "No Word: aplique os estilos \"Título 1\", \"Título 2\" (guia Página Inicial > Estilos) nos títulos, em vez de só deixar o texto em negrito.",
    ],
  },
  protecao: {
    titulo: "Sem bloqueio para tecnologia assistiva",
    norma: "PDF/UA 7.16",
    porque: "Algumas proteções de PDF impedem que o leitor de tela extraia o texto.",
    comoCorrigir: [
      "Exporte sem senha ou restrição de cópia. Se precisar proteger, libere a opção \"Permitir acesso ao texto para leitores de tela\".",
    ],
  },
};

const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

function nameOf(obj) {
  if (!obj) return null;
  const s = obj.toString();
  return s.startsWith("/") ? decodeName(s.slice(1)) : null;
}

function decodeName(n) {
  return n.replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function textOf(PDFLib, obj) {
  if (!obj) return "";
  if (!(obj instanceof PDFLib.PDFString || obj instanceof PDFLib.PDFHexString)) return "";
  let t = obj.decodeText().trim();
  // Alguns geradores gravam a string com parênteses e escapes octais literais: "(RELAT\\323RIO)".
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1);
  t = t.replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
       .replace(/\\([()\\])/g, "$1");
  return t.trim();
}

/** Percorre a árvore de estrutura e conta elementos por tipo (resolvendo o RoleMap). */
function walkStructTree(PDFLib, doc, root) {
  const ctx = doc.context;
  const roleMap = ctx.lookup(root.get(PDFLib.PDFName.of("RoleMap")));
  const standard = (role) => {
    let r = role;
    for (let i = 0; i < 5 && roleMap instanceof PDFLib.PDFDict; i++) {
      const mapped = nameOf(roleMap.get(PDFLib.PDFName.of(r)));
      if (!mapped || mapped === r) break;
      r = mapped;
    }
    return r;
  };

  const stats = { nodes: 0, figures: 0, figuresSemAlt: 0, tables: 0, tablesSemTH: 0, headings: 0, truncated: false };
  const seen = new Set();

  const visit = (ref, inTable) => {
    if (stats.nodes > MAX_NODES) { stats.truncated = true; return { th: 0 }; }
    const key = ref instanceof PDFLib.PDFRef ? ref.toString() : null;
    if (key) { if (seen.has(key)) return { th: 0 }; seen.add(key); }
    const node = ctx.lookup(ref);
    let th = 0;
    if (node instanceof PDFLib.PDFArray) {
      for (let i = 0; i < node.size(); i++) th += visit(node.get(i), inTable).th;
      return { th };
    }
    if (!(node instanceof PDFLib.PDFDict)) return { th };
    const S = nameOf(node.get(PDFLib.PDFName.of("S")));
    if (!S) return { th }; // MCR/OBJR
    stats.nodes++;
    const role = standard(S);
    if (role === "Figure") {
      stats.figures++;
      const alt = textOf(PDFLib, ctx.lookup(node.get(PDFLib.PDFName.of("Alt"))))
        || textOf(PDFLib, ctx.lookup(node.get(PDFLib.PDFName.of("ActualText"))));
      if (!alt) stats.figuresSemAlt++;
    }
    if (/^H[1-6]?$/.test(role)) stats.headings++;
    if (role === "TH") th++;
    const kids = node.get(PDFLib.PDFName.of("K"));
    if (kids) th += visit(kids, inTable || role === "Table").th;
    if (role === "Table") {
      stats.tables++;
      if (th === 0) stats.tablesSemTH++;
    }
    return { th };
  };

  visit(root.get(PDFLib.PDFName.of("K")), false);
  return stats;
}

async function sampleText(pdfjsLib, bytes) {
  const task = pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  let chars = 0;
  const pages = pdf.numPages;
  for (let p = 1; p <= Math.min(pages, TEXT_SAMPLE_PAGES); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    chars += content.items.reduce((n, it) => n + (it.str ? it.str.trim().length : 0), 0);
  }
  await pdf.destroy();
  return { pages, chars };
}

/**
 * Verifica um PDF. `bytes` é Uint8Array. Retorna { pages, results: [{id, status, detalhe}], score, nivel }.
 * status: "ok" | "falha" | "alerta" | "na" (não se aplica).
 */
export async function checkPdf(bytes, { PDFLib, pdfjsLib }) {
  const results = [];
  const add = (id, status, detalhe) => results.push({ id, status, detalhe, ...CHECKS[id] });

  let text = { pages: 0, chars: 0 };
  try {
    text = await sampleText(pdfjsLib, bytes);
  } catch (e) {
    throw new Error("Não foi possível abrir o arquivo. Ele é mesmo um PDF? (" + e.message + ")");
  }

  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const catalog = doc.catalog;
  const ctx = doc.context;

  // 1. Texto selecionável
  if (text.chars > 20) add("texto", "ok", `${text.chars} caracteres de texto nas primeiras páginas.`);
  else add("texto", "falha", "Nenhum texto encontrado: o documento parece ser uma imagem escaneada.");

  // 2. Marcação
  const markInfo = ctx.lookup(catalog.get(PDFLib.PDFName.of("MarkInfo")));
  const marked = markInfo instanceof PDFLib.PDFDict && markInfo.get(PDFLib.PDFName.of("Marked"))?.toString() === "true";
  const structRoot = ctx.lookup(catalog.get(PDFLib.PDFName.of("StructTreeRoot")));
  let tree = null;
  if (structRoot instanceof PDFLib.PDFDict) tree = walkStructTree(PDFLib, doc, structRoot);
  if (tree && tree.nodes > 0) add("marcado", marked ? "ok" : "alerta",
    marked ? `${tree.nodes} elementos de estrutura.` : `Há estrutura (${tree.nodes} elementos), mas o arquivo não se declara marcado.`);
  else add("marcado", "falha", "O PDF não tem estrutura de acessibilidade (tags).");

  // 3. Idioma
  const lang = textOf(PDFLib, ctx.lookup(catalog.get(PDFLib.PDFName.of("Lang"))));
  if (!lang) add("idioma", "falha", "Nenhum idioma declarado.");
  else if (!LANG_RE.test(lang)) add("idioma", "falha", `Código de idioma inválido: "${lang}" (o correto é pt-BR).`);
  else add("idioma", "ok", `Idioma declarado: ${lang}.`);

  // 4. Título
  let title = "";
  const info = ctx.lookup(doc.context.trailerInfo.Info);
  if (info instanceof PDFLib.PDFDict) title = textOf(PDFLib, ctx.lookup(info.get(PDFLib.PDFName.of("Title"))));
  const prefs = ctx.lookup(catalog.get(PDFLib.PDFName.of("ViewerPreferences")));
  const displayTitle = prefs instanceof PDFLib.PDFDict && prefs.get(PDFLib.PDFName.of("DisplayDocTitle"))?.toString() === "true";
  if (!title) add("tituloDoc", "falha", "O documento não tem título nas propriedades.");
  else if (/^(microsoft word|documento\d*|untitled|sem t[ií]tulo)/i.test(title) || /\.(docx?|odt)$/i.test(title))
    add("tituloDoc", "alerta", `Título genérico, herdado do programa: "${title}".`);
  else if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+\/\S*$/.test(title))
    add("tituloDoc", "alerta", `O título é um endereço de site, não o nome do documento: "${title.slice(0, 60)}...".`);
  else add("tituloDoc", displayTitle ? "ok" : "alerta",
    displayTitle ? `Título: "${title}".` : `Título "${title}" existe, mas o leitor mostra o nome do arquivo no lugar dele.`);

  // 5 a 7. Itens que dependem da estrutura
  if (!tree || tree.nodes === 0) {
    for (const id of ["figuras", "tabelas", "titulos"]) add(id, "na", "Não dá para verificar: o PDF não tem estrutura marcada.");
  } else {
    if (tree.figures === 0) add("figuras", "na", "Nenhuma imagem marcada no documento.");
    else if (tree.figuresSemAlt === 0) add("figuras", "ok", `${tree.figures} imagem(ns), todas com descrição.`);
    else add("figuras", "falha", `${tree.figuresSemAlt} de ${tree.figures} imagem(ns) sem texto alternativo.`);

    if (tree.tables === 0) add("tabelas", "na", "Nenhuma tabela marcada no documento.");
    else if (tree.tablesSemTH === 0) add("tabelas", "ok", `${tree.tables} tabela(s), todas com cabeçalho.`);
    else add("tabelas", "falha", `${tree.tablesSemTH} de ${tree.tables} tabela(s) sem célula de cabeçalho.`);

    if (tree.headings > 0) add("titulos", "ok", `${tree.headings} título(s) marcados.`);
    else if (text.pages <= 2) add("titulos", "na", "Documento curto (até 2 páginas).");
    else add("titulos", "alerta", "Nenhum título marcado: não dá para navegar por seções.");
  }

  // 8. Proteção
  const encrypt = doc.context.trailerInfo.Encrypt;
  if (!encrypt) add("protecao", "ok", "Sem proteção.");
  else {
    const enc = ctx.lookup(encrypt);
    const P = enc instanceof PDFLib.PDFDict ? Number(enc.get(PDFLib.PDFName.of("P"))?.toString()) : NaN;
    const accessibilityAllowed = Number.isFinite(P) ? ((P >>> 0) & (1 << 9)) !== 0 : true;
    add("protecao", accessibilityAllowed ? "ok" : "falha",
      accessibilityAllowed ? "Protegido, mas libera leitores de tela." : "A proteção bloqueia leitores de tela.");
  }

  const scored = results.filter((r) => r.status !== "na");
  const points = scored.reduce((n, r) => n + (r.status === "ok" ? 1 : r.status === "alerta" ? 0.5 : 0), 0);
  const score = scored.length ? Math.round((100 * points) / scored.length) : 0;
  const falhas = results.filter((r) => r.status === "falha").length;
  const nivel = falhas === 0 && score >= 90 ? "acessivel" : score >= 60 ? "parcial" : "inacessivel";
  return { pages: text.pages, results, score, nivel };
}
