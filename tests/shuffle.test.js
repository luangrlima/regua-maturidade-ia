/* A ordem das alternativas precisa variar entre carregamentos e nunca
   corresponder à ordem crescente de maturidade. */
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  let fail = 0;
  const check = (nome, cond, extra) => {
    if (cond) console.log('  ok   ' + nome);
    else { console.log('  FALHA ' + nome + (extra ? '\n         ' + extra : '')); fail++; }
  };

  const ordens = [];
  for (let i = 0; i < 12; i++){
    const page = await browser.newPage();
    await page.goto(URL);
    ordens.push(await page.evaluate(() => {
      const o = {};
      document.querySelectorAll('.q').forEach(q => {
        o[q.id.replace(/^q-/,'')] = Array.from(q.querySelectorAll('.opt')).map(l => l.getAttribute('data-v'));
      });
      return o;
    }));
    await page.close();
  }

  const ids = Object.keys(ordens[0]);
  check('todas as 8 perguntas renderizam alternativas', ids.length === 8, 'ids: ' + ids.join(','));

  for (const id of ids){
    const distintas = new Set(ordens.map(o => o[id].join(',')));
    check(`${id}: a ordem varia entre carregamentos (${distintas.size} ordens distintas em 12)`,
      distintas.size >= 3, 'ordem possivelmente fixa');
  }

  /* nenhuma pergunta pontuada deve sair na ordem crescente com frequência anormal */
  for (const id of ['rot','pic','pro','ver','ctx','jul','seg']){
    const crescentes = ordens.filter(o => {
      const v = o[id].map(Number);
      return v.every((x, i) => i === 0 || v[i-1] <= x);
    }).length;
    check(`${id}: não sai ordenado por maturidade em todos os carregamentos (${crescentes}/12)`,
      crescentes < 12);
  }

  /* nenhuma alternativa pode sumir ou duplicar no embaralhamento */
  const esperado = {rot:7, pic:7, pro:5, ver:5, ctx:5, jul:5, seg:5, bloq:8};
  for (const [id, n] of Object.entries(esperado)){
    const todas = ordens.every(o => o[id].length === n && new Set(o[id]).size === n);
    check(`${id}: mantém as ${n} alternativas, sem perda nem duplicata`, todas);
  }

  await browser.close();
  console.log(fail ? `\n${fail} falha(s)` : '\nEmbaralhamento validado.');
  process.exit(fail ? 1 : 0);
})();
