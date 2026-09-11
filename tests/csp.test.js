/* Sobe a página com exatamente os headers do arquivo _headers e confere
   que nenhuma diretiva bloqueia o funcionamento real. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');

/* lê a CSP do _headers, para o teste falhar se alguém apertar a política sem ajustar a página */
const headersFile = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8');
const headers = {};
headersFile.split('\n').forEach(l => {
  const m = l.match(/^\s{2}([A-Za-z-]+):\s*(.+)$/);
  if (m) headers[m[1]] = m[2].trim();
});
if (!headers['Content-Security-Policy']) { console.error('CSP não encontrada em _headers'); process.exit(1); }
console.log('CSP aplicada:', headers['Content-Security-Policy'].slice(0, 60) + '…');

const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8'};

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const full = path.join(ROOT, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(ROOT) || !fs.existsSync(full)) { res.writeHead(404); return res.end(); }
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', TYPES[path.extname(full)] || 'application/octet-stream');
  res.writeHead(200); res.end(fs.readFileSync(full));
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({channel:'chrome'});
  const page = await browser.newPage();

  const violacoes = [], erros = [];
  page.on('console', m => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) violacoes.push(t);
    else if (m.type() === 'error') erros.push(t);
  });
  page.on('pageerror', e => erros.push(e.message));

  await page.goto(url);
  const pick = (q, v) => page.locator(`#q-${q} .opt[data-v="${v}"]`).click();
  for (const [q, v] of [['rot',4],['pic',4],['pro',3],['ver',3],['ctx',3],['jul',3],['seg',3],['bloq','h']]) await pick(q, v);
  await page.click('#submit');
  await page.waitForSelector('#result.on', {timeout:5000});

  let fail = 0;
  const check = (nome, cond, extra) => {
    if (cond) console.log('  ok   ' + nome);
    else { console.log('  FALHA ' + nome + (extra ? '\n         ' + extra : '')); fail++; }
  };

  check('nenhuma violação de CSP', violacoes.length === 0, violacoes.join('\n         '));
  check('nenhum erro de JS sob a CSP', erros.length === 0, erros.join('\n         '));
  check('o resultado renderiza sob a CSP', (await page.locator('.res-level').textContent()).startsWith('N'));
  check('as barras preenchem sob a CSP (style inline permitido)',
    await page.evaluate(() => {
      const f = document.querySelector('.dim .fill');
      return f && f.getBoundingClientRect().width > 4;
    }));
  check('nenhum handler de evento inline no documento',
    await page.evaluate(() => {
      const attrs = ['onclick','onchange','onsubmit','onload','oninput'];
      return !Array.from(document.querySelectorAll('*')).some(n => attrs.some(a => n.hasAttribute(a)));
    }));
  check('o crédito aponta para o LinkedIn do autor',
    await page.evaluate(() => {
      const a = document.querySelector('footer .credit a');
      return !!a && a.href === 'https://www.linkedin.com/in/luanlima' && a.rel.includes('noopener');
    }));

  await browser.close();
  server.close();
  console.log(fail ? `\n${fail} falha(s) sob a CSP` : '\nCSP validada.');
  process.exit(fail ? 1 : 0);
})();
