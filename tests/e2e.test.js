const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

let pass = 0, fail = 0;
const t = async (nome, fn) => {
  try { await fn(); console.log('  ok   ' + nome); pass++; }
  catch (e) { console.log('  FALHA ' + nome + '\n         ' + e.message); fail++; }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'condição falsa'); };

/* marca uma resposta pelo índice da opção (0-based) */
async function pick(page, qid, idx){
  await page.locator(`#q-${qid} .opt`).nth(idx).click();
}
async function fill(page, a){
  await pick(page, 'rot', a.rot);          // índice = valor (0..6)
  await pick(page, 'pic', a.pic);
  await pick(page, 'pro', a.pro - 1);      // valores 1..5 → índices 0..4
  await pick(page, 'ver', a.ver - 1);
  await pick(page, 'ctx', a.ctx - 1);
  await pick(page, 'jul', a.jul - 1);
  await pick(page, 'seg', a.seg - 1);
  await pick(page, 'papel', a.papel != null ? a.papel : 0);
  for (const b of (a.bloq || [0])) await pick(page, 'bloq', b);
}

(async () => {
  const browser = await chromium.launch({channel:'chrome'});

  console.log('\n— formulário —');
  {
    const page = await browser.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await page.goto(URL);

    await t('as 9 perguntas renderizam', async () => {
      eq(await page.locator('.q').count(), 9);
    });
    await t('todas as alternativas renderizam (7+7+5+5+5+5+5+5+7 = 51)', async () => {
      eq(await page.locator('.opt').count(), 51);
    });
    await t('a barra de progresso só aparece após a primeira resposta', async () => {
      ok(await page.locator('#bar').isHidden(), 'barra visível antes de responder');
      await pick(page, 'rot', 3);
      ok(await page.locator('#bar').isVisible(), 'barra não apareceu');
      eq((await page.locator('#count').textContent()).trim(), '1 de 9');
    });
    await t('submeter incompleto não mostra resultado e marca o que falta', async () => {
      await page.click('#submit');
      ok(await page.locator('#result').isHidden(), 'resultado apareceu incompleto');
      ok(await page.locator('.q.missing').count() > 0, 'nada foi marcado como faltante');
      ok((await page.locator('#submit-sub').textContent()).includes('Falta'), 'sem aviso de faltantes');
    });
    await t('a múltipla escolha respeita o teto de 2', async () => {
      for (const i of [0,1,2]) await pick(page, 'bloq', i);
      eq(await page.locator('#q-bloq input:checked').count(), 2);
    });
    await t('nenhum erro de JS no console', async () => {
      eq(erros.length, 0, erros.join(' | '));
    });
    await page.close();
  }

  console.log('\n— cálculo na tela —');
  const casos = [
    {nome:'perfil N0 (não usa)',            a:{rot:0,pic:0,pro:1,ver:1,ctx:1,jul:1,seg:3}, nivel:0},
    {nome:'perfil N2 típico',               a:{rot:2,pic:2,pro:2,ver:3,ctx:2,jul:3,seg:3}, nivel:2},
    {nome:'perfil N3 (o mais comum)',       a:{rot:3,pic:3,pro:4,ver:3,ctx:3,jul:4,seg:5}, nivel:3},
    {nome:'perfil N4',                      a:{rot:4,pic:4,pro:4,ver:4,ctx:4,jul:4,seg:4}, nivel:4},
    {nome:'caso documentado: verificação corta em N3', a:{rot:5,pic:5,pro:4,ver:2,ctx:4,jul:2,seg:3}, nivel:3},
    {nome:'tudo no máximo → N6',            a:{rot:6,pic:6,pro:5,ver:5,ctx:5,jul:5,seg:5}, nivel:6},
    {nome:'máximo com rotina 5 → N5',       a:{rot:5,pic:6,pro:5,ver:5,ctx:5,jul:5,seg:5}, nivel:5}
  ];
  for (const c of casos){
    await t(c.nome + ' → N' + c.nivel, async () => {
      const page = await browser.newPage();
      await page.goto(URL);
      await fill(page, c.a);
      await page.click('#submit');
      await page.waitForSelector('#result.on', {timeout:5000});
      eq((await page.locator('.res-level').textContent()).trim(), 'N' + c.nivel);
      ok(await page.locator('#form-view').isHidden(), 'formulário continuou visível');
      await page.close();
    });
  }

  console.log('\n— conteúdo do resultado —');
  {
    const page = await browser.newPage();
    await page.goto(URL);
    await fill(page, {rot:5,pic:5,pro:4,ver:2,ctx:4,jul:2,seg:2, bloq:[1,5]});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    const txt = await page.locator('#result').textContent();

    await t('mostra a soma correta (29)', async () => ok(txt.includes('29'), 'soma 29 ausente'));
    await t('nomeia a trava da verificação', async () => ok(txt.includes('A trava foi a verificação')));
    await t('acende a flag de risco de dado', async () => ok(txt.includes('Risco de dado')));
    await t('acende a flag de uso acrítico', async () => ok(txt.includes('Uso acrítico')));
    await t('devolve texto dos 2 bloqueios marcados', async () => {
      ok(txt.includes('Não sei o que é possível fazer'), 'bloqueio b ausente');
      ok(txt.includes('Medo de errar publicamente'), 'bloqueio f ausente');
    });
    await t('mostra o degrau seguinte', async () => ok(txt.includes('O degrau seguinte')));
    await t('mostra a escala N0–N6 com o nível atual destacado', async () => {
      eq(await page.locator('.scale-cell').count(), 7);
      eq((await page.locator('.scale-cell.now').textContent()).trim(), 'N3');
    });
    await t('traz a ressalva de que não é veredito', async () =>
      ok(txt.includes('não é um veredito') || txt.includes('hipótese para conversar')));
    await t('o botão refazer volta ao formulário', async () => {
      await page.click('#again');
      await page.waitForSelector('#form-view', {state:'visible'});
      eq(await page.locator('#q-rot input:checked').count(), 0, 'respostas persistiram após refazer');
    });
    await page.close();
  }

  console.log('\n— geometria das barras —');
  {
    const page = await browser.newPage({viewport:{width:1000,height:1200}});
    await page.goto(URL);
    await t('a barra de progresso preenche conforme as respostas', async () => {
      for (const [q,i] of [['rot',3],['pic',3],['pro',3]]) await pick(page,q,i);
      await page.waitForTimeout(450);
      const w = await page.evaluate(() => {
        const f = document.getElementById('fill');
        return f.getBoundingClientRect().width / f.parentElement.getBoundingClientRect().width;
      });
      ok(w > 0.28 && w < 0.39, `preenchimento de 3/9 fora do esperado: ${(w*100).toFixed(1)}%`);
    });
    await page.close();
  }
  {
    const page = await browser.newPage({viewport:{width:1000,height:1200}});
    await page.goto(URL);
    /* rotina 5/6, pico 5/6, prova 4/5, verificação 2/5, contexto 4/5, julgamento 2/5, segurança 2/5 */
    await fill(page, {rot:5,pic:5,pro:4,ver:2,ctx:4,jul:2,seg:2});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    await page.waitForTimeout(700);
    const geo = await page.evaluate(() => Array.from(document.querySelectorAll('.dim')).map(d => ({
      label: d.querySelector('.lbl').childNodes[0].textContent.trim(),
      ratio: d.querySelector('.fill').getBoundingClientRect().width / d.querySelector('.track').getBoundingClientRect().width
    })));
    await t('todas as 7 barras têm preenchimento visível', async () => {
      eq(geo.length, 7);
      const vazias = geo.filter(g => g.ratio < 0.02).map(g => g.label);
      ok(vazias.length === 0, 'barras vazias: ' + vazias.join(', '));
    });
    await t('cada barra é proporcional ao valor respondido', async () => {
      const esperado = {'Rotina':5/6,'Pico':5/6,'Durabilidade':4/5,'Verificação':2/5,'Contexto':4/5,'Julgamento':2/5,'Segurança':2/5};
      for (const g of geo){
        const alvo = esperado[g.label];
        ok(Math.abs(g.ratio - alvo) < 0.02, `${g.label}: ${(g.ratio*100).toFixed(1)}%, esperado ${(alvo*100).toFixed(1)}%`);
      }
    });
    await t('a barra baixa recebe a cor de ação e a alta não', async () => {
      const cores = await page.evaluate(() => Array.from(document.querySelectorAll('.dim')).map(d => ({
        label: d.querySelector('.lbl').childNodes[0].textContent.trim(),
        bg: getComputedStyle(d.querySelector('.fill')).backgroundColor
      })));
      const azul = 'rgb(0, 102, 204)';
      eq(cores.find(c => c.label==='Verificação').bg, azul, 'verificação (2/5) deveria estar em azul:');
      ok(cores.find(c => c.label==='Rotina').bg !== azul, 'rotina (5/6) não deveria estar em azul');
    });
    await page.close();
  }

  console.log('\n— privacidade —');
  {
    const page = await browser.newPage();
    const rede = [];
    page.on('request', r => { if (!r.url().startsWith('file://')) rede.push(r.url()); });
    await page.goto(URL);
    await fill(page, {rot:3,pic:3,pro:4,ver:3,ctx:3,jul:4,seg:5});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    await t('nenhuma requisição de rede sai da página', async () => eq(rede.length, 0, rede.join(' | ')));
    await t('nada é gravado em localStorage nem sessionStorage', async () => {
      const n = await page.evaluate(() => localStorage.length + sessionStorage.length);
      eq(n, 0);
    });
    await t('nenhum cookie é criado', async () => {
      eq((await page.context().cookies()).length, 0);
    });
    await page.close();
  }

  console.log('\n— responsivo e acessibilidade —');
  for (const vp of [{width:390,height:844,nome:'iPhone 390px'},{width:768,height:1024,nome:'tablet 768px'},{width:1440,height:900,nome:'desktop 1440px'}]){
    await t('sem rolagem horizontal em ' + vp.nome, async () => {
      const page = await browser.newPage({viewport:{width:vp.width, height:vp.height}});
      await page.goto(URL);
      await fill(page, {rot:4,pic:4,pro:4,ver:4,ctx:4,jul:4,seg:4});
      await page.click('#submit');
      await page.waitForSelector('#result.on');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(over <= 1, `transbordou ${over}px`);
      await page.close();
    });
  }
  {
    const page = await browser.newPage();
    await page.goto(URL);
    await t('o formulário é navegável e marcável por teclado', async () => {
      await page.locator('#q-rot input').nth(3).focus();
      await page.keyboard.press('Space');
      eq(await page.locator('#q-rot input:checked').count(), 1);
    });
    await t('cada grupo de pergunta tem rótulo acessível', async () => {
      eq(await page.locator('[role="group"][aria-labelledby]').count(), 9);
    });
    await t('a página declara o idioma', async () => {
      eq(await page.getAttribute('html', 'lang'), 'pt-BR');
    });
    await page.close();
  }

  await browser.close();
  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})();
