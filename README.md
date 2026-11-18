# Verificador de PDF Acessível

Ferramenta gratuita para conferir se um PDF (edital, resultado, normativa) é acessível a pessoas com
deficiência **antes de publicar**. Cada problema vem com o passo a passo para corrigir no Word.

Desenvolvida no projeto de extensão "Edital Acessível" (Ciência da Computação, UNP), a partir do
diagnóstico de acessibilidade digital feito com a Secretaria de Inclusão e Acessibilidade (SIA/UFRN).

- **Privacidade:** a análise roda inteira no navegador. O arquivo não é enviado para nenhum servidor.
- **Sem robô:** não faz varredura em sites de terceiros. Quem verifica é a própria equipe, no momento de publicar.

## O que é verificado

| Item | Referência |
|---|---|
| Texto selecionável (não é imagem escaneada) | WCAG 1.1.1 · PDF/UA |
| Estrutura marcada (tags) | WCAG 1.3.1 · PDF/UA |
| Idioma válido (`pt-BR`, não `pt_BR`) | WCAG 3.1.1 · PDF/UA |
| Título real (não "Microsoft Word - ..." nem endereço de site) | WCAG 2.4.2 · PDF/UA |
| Imagens com texto alternativo | WCAG 1.1.1 · PDF/UA |
| Tabelas com célula de cabeçalho | WCAG 1.3.1 · PDF/UA |
| Títulos de seção marcados | WCAG 1.3.1 e 2.4.6 · PDF/UA |
| Proteção que bloqueia leitor de tela | PDF/UA |

Verificação automática não substitui revisão humana nem teste com leitor de tela.

## Hipótese do projeto

> Se a equipe tiver uma ferramenta simples para verificar o PDF antes de publicar, com instruções de
> correção em linguagem clara, a proporção de documentos acessíveis publicados aumenta e estudantes com
> deficiência passam a acessar editais sem ajuda de terceiros.

**Linha de base (18/11/2026, 10 documentos públicos da página Documentos da SIA):** pontuação média 70/100;
0 acessíveis, 7 parcialmente acessíveis, 3 inacessíveis. 6 de 10 com idioma ausente ou inválido, 7 de 10 sem
título adequado, 3 de 10 sem estrutura marcada, 149 imagens sem descrição em um único documento.

## Usar

- **Navegador:** abra `docs/index.html` por um servidor (ex.: `python3 -m http.server -d docs`) ou pelo GitHub Pages.
- **Linha de comando (medições antes e depois):**

```bash
npm install
node cli/verificar.mjs pasta/*.pdf --csv resultado.csv
```

A página e a linha de comando usam o mesmo arquivo de regras: `docs/checker.js`.
