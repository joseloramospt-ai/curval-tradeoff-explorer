# Curval — Tradeoff Explorer

SPA React estatica para exploracao interactiva da estrutura optima de capital da **Curval** (PME industrial portuguesa), construida no ambito do modulo de **Corporate Finance** do EMBA 25/26 da Porto Business School (Term 3).

Dados financeiros historicos 2020-2024 hardcoded; toda a computacao (WACC, custo da alavancagem, distress costs, coverage, cenarios de stress) e client-side. Sem backend, sem chamadas externas.

**URL publico:** https://joseloramospt-ai.github.io/curval-tradeoff-explorer/

## Stack

| Camada | Escolha |
|---|---|
| Build | Vite 5 |
| UI | React 18 (JSX, sem TypeScript) |
| Charts | recharts 2 |
| Styling | inline styles + `<style>` tag embebido (sem Tailwind/CSS files) |
| Deploy | GitHub Pages via GitHub Actions (`actions/deploy-pages`) |

## Desenvolvimento local

```bash
npm install
npm run dev          # http://localhost:5173
```

## Build e preview

```bash
npm run build        # output -> dist/
npm run preview      # serve dist/ em http://localhost:4173
```

O `preview` e o teste mais fiavel para apanhar problemas de `base` path antes do deploy.

## Deploy

Push para `main` dispara o workflow `.github/workflows/deploy.yml`, que faz build e publica em GitHub Pages. **Settings -> Pages -> Source deve estar em "GitHub Actions"** (nao branch).

Fluxo tipico de update:

```bash
# alterar src/App.jsx
git add src/App.jsx
git commit -m "update: <descricao>"
git push origin main
# workflow arranca automaticamente; 1-3 min depois o URL ja serve a nova versao
```

Verificar estado do deploy:

```bash
gh run list --limit 3
gh run watch           # streams logs do run mais recente
```

## Debug

**Build falha localmente:**
- `rm -rf node_modules dist && npm install && npm run build`
- Ver output de `vite build` — erros de JSX aparecem com numero de linha de `src/App.jsx`.

**Deploy passa mas pagina da 404 em assets (JS/CSS nao carregam):**
- Quase sempre e `base` errado no `vite.config.js`. Deve ser `'/curval-tradeoff-explorer/'` (com barras nas duas pontas).

**Deploy passa mas pagina branca sem erro:**
- Abrir devtools -> Console. Erros de React render aparecem aqui.
- Confirmar que `src/App.jsx` tem `export default` de um componente funcional.

**Workflow falha no step de build:**
- `gh run view --log-failed` — mostra o stderr do job.

## Estrutura

```
.
|- .github/workflows/deploy.yml   # CI + Pages deploy
|- src/
|  |- App.jsx                     # componente unico (copia do .jsx fonte)
|  \- main.jsx                    # entry point React
|- index.html                     # template Vite
|- vite.config.js                 # base path Pages
|- package.json
\- .gitignore
```

## Fonte original

O ficheiro master do trabalho academico esta em `C:\My Drive\Enterprise\EMBA\Term-03\Corporate-Finance\GithubPage\curval_tradeoff_explorer.jsx`. **Este repo contem uma copia** — quando o master e actualizado, e necessario copiar manualmente para `src/App.jsx` e fazer novo commit. As duas versoes podem divergir; o master e canonico.
