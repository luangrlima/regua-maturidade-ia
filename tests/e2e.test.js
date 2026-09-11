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

/* mede o contraste real de cada texto visível contra o fundo efetivo */
async function contrasteRuim(page){
  return page.evaluate(() => {
    const lum = rgb => {
      const c = rgb.map(v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
      return .2126*c[0] + .7152*c[1] + .0722*c[2];
    };
    const parse = s => (s.match(/[\d.]+/g) || []).slice(0,3).map(Number);
    const opaco = s => s && s !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(s);
    const fundoDe = n => {
      for (let e = n; e; e = e.parentElement){
        const bg = getComputedStyle(e).backgroundColor;
        if (opaco(bg)) return parse(bg);
      }
      return [255,255,255];
    };
    const ratio = (a,b) => { const [x,y] = [lum(a), lum(b)].sort((p,q)=>q-p); return (x+.05)/(y+.05); };
    const out = [];
    document.querySelectorAll('body *').forEach(n => {
      const txt = Array.from(n.childNodes).filter(c => c.nodeType === 3).map(c => c.textContent.trim()).join('');
      if (!txt) return;
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || !n.offsetParent) return;
      const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
      const min = (px >= 24 || (px >= 18.66 && peso >= 700)) ? 3 : 4.5;
      const r = ratio(parse(cs.color), fundoDe(n));
      if (r < min) out.push(`${n.className || n.tagName} "${txt.slice(0,26)}" ${cs.color} ${r.toFixed(2)}:1 (min ${min})`);
    });
    return out;
  });
}

/* marca uma resposta pelo VALOR — a ordem das alternativas é aleatória */
async function pick(page, qid, valor){
  await page.locator(`#q-${qid} .opt[data-v="${valor}"]`).click();
}
async function fill(page, a){
  for (const k of ['rot','pic','pro','ver','ctx','jul','seg']) await pick(page, k, a[k]);
  for (const b of (a.bloq || ['a'])) await pick(page, 'bloq', b);
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

    await t('as 8 perguntas renderizam', async () => {
      eq(await page.locator('.q').count(), 8);
    });
    await t('todas as alternativas renderizam (7+7+5+5+5+5+5+8 = 47)', async () => {
      eq(await page.locator('.opt').count(), 47);
    });
    await t('a barra de progresso só aparece após a primeira resposta', async () => {
      ok(await page.locator('#bar').isHidden(), 'barra visível antes de responder');
      await pick(page, 'rot', 3);
      ok(await page.locator('#bar').isVisible(), 'barra não apareceu');
      eq((await page.locator('#count').textContent()).trim(), '1 de 8');
    });
    await t('submeter incompleto não mostra resultado e marca o que falta', async () => {
      await page.click('#submit');
      ok(await page.locator('#result').isHidden(), 'resultado apareceu incompleto');
      ok(await page.locator('.q.missing').count() > 0, 'nada foi marcado como faltante');
      ok((await page.locator('#submit-sub').textContent()).includes('Falta'), 'sem aviso de faltantes');
    });
    await t('a múltipla escolha respeita o teto de 2', async () => {
      for (const v of ['a','b','c']) await pick(page, 'bloq', v);
      eq(await page.locator('#q-bloq input:checked').count(), 2);
    });
    await t('nenhum erro de JS no console', async () => {
      eq(erros.length, 0, erros.join(' | '));
    });
    await t('nenhuma alternativa exibe código de nível (N0–N6)', async () => {
      const txt = await page.locator('#form').textContent();
      const achados = txt.match(/\bN[0-6]\s*—/g) || [];
      eq(achados.length, 0, 'códigos encontrados: ' + achados.join(', '));
      eq(await page.locator('.opt .code').count(), 0);
    });
    await t('nenhum peso é exibido nas perguntas', async () => {
      const txt = (await page.locator('#form').textContent()).toLowerCase();
      ok(!txt.includes('peso ×') && !txt.includes('pesa dobrado') && !txt.includes('não pontua'),
        'menção a peso encontrada');
    });
    await t('não existe pergunta sobre papel ou cargo', async () => {
      eq(await page.locator('#q-papel').count(), 0);
      const txt = (await page.locator('#form').textContent()).toLowerCase();
      ok(!txt.includes('o que descreve melhor o seu trabalho'), 'pergunta de papel presente');
    });
    await t('não existe campo de e-mail nem qualquer entrada de texto', async () => {
      eq(await page.locator('input[type="email"], input[type="text"], textarea').count(), 0);
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
    await fill(page, {rot:5,pic:5,pro:4,ver:2,ctx:4,jul:2,seg:2, bloq:['b','f']});
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
      for (const [q,v] of [['rot',3],['pic',3],['pro',3]]) await pick(page,q,v);
      await page.waitForTimeout(450);
      const w = await page.evaluate(() => {
        const f = document.getElementById('fill');
        return f.getBoundingClientRect().width / f.parentElement.getBoundingClientRect().width;
      });
      ok(w > 0.32 && w < 0.44, `preenchimento de 3/8 fora do esperado: ${(w*100).toFixed(1)}%`);
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

  console.log('\n— o que o resultado não pode dizer —');
  {
    /* caso travado pela verificação: subir a soma não sobe o nível */
    const page = await browser.newPage();
    await page.goto(URL);
    await fill(page, {rot:5,pic:5,pro:4,ver:2,ctx:4,jul:2,seg:3});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    const txt = await page.locator('#result').textContent();
    await t('caso travado não promete pontos para a próxima faixa', async () => {
      ok(!txt.includes('Para a próxima faixa'),
        'o tile aparece mesmo com o nível travado — contradiz o card da trava');
    });
    await t('caso travado mostra o teto imposto pela trava', async () => {
      ok(txt.includes('Teto pela trava'));
    });
    await page.close();
  }
  {
    /* caso sem trava: aí o número serve */
    const page = await browser.newPage();
    await page.goto(URL);
    await fill(page, {rot:3,pic:3,pro:4,ver:3,ctx:3,jul:4,seg:5});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    await t('caso sem trava mostra os pontos para a próxima faixa', async () => {
      ok((await page.locator('#result').textContent()).includes('Para a próxima faixa'));
    });
    await page.close();
  }
  {
    /* quem não usa IA não pode sair acusado de expor dado */
    const page = await browser.newPage();
    await page.goto(URL);
    await fill(page, {rot:0,pic:0,pro:1,ver:1,ctx:1,jul:1,seg:1});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    const txt = await page.locator('#result').textContent();
    await t('perfil N0 não recebe alerta de risco de dado', async () => {
      ok(!txt.includes('Risco de dado'), 'quem declarou não usar IA foi acusado de expor dado');
    });
    await t('perfil N0 recebe a leitura própria do nível', async () => {
      ok(txt.includes('resposta legítima'));
    });
    await page.close();
  }

  console.log('\n— foco e anúncio —');
  {
    const page = await browser.newPage();
    await page.goto(URL);
    await t('submeter incompleto leva o foco à primeira pergunta faltante', async () => {
      await pick(page, 'pic', 3);
      await page.click('#submit');
      const id = await page.evaluate(() => document.activeElement.closest('.q')?.id);
      eq(id, 'q-rot');
    });
    await t('o aviso de faltantes é anunciável', async () => {
      eq(await page.getAttribute('#submit-sub', 'aria-live'), 'polite');
      ok((await page.locator('#q-rot').getAttribute('aria-describedby')) === 'warn-rot');
    });
    await t('responder limpa o vínculo com o aviso', async () => {
      await pick(page, 'rot', 3);
      eq(await page.locator('#q-rot').getAttribute('aria-describedby'), null);
    });
    await t('a terceira marcação avisa em vez de falhar em silêncio', async () => {
      for (const v of ['a','b','c']) await pick(page, 'bloq', v);
      ok(await page.locator('#q-bloq.limit').isVisible(), 'sem retorno visual no teto');
      ok((await page.locator('#q-bloq .q-warn').textContent()).includes('Máximo de 2'));
    });
    await page.close();
  }
  {
    const page = await browser.newPage();
    await page.goto(URL);
    await fill(page, {rot:4,pic:4,pro:4,ver:4,ctx:4,jul:4,seg:4});
    await page.click('#submit');
    await page.waitForSelector('#result.on');
    await t('o foco vai para o resultado', async () => {
      eq(await page.evaluate(() => document.activeElement.id), 'result');
    });
    await t('o título da aba passa a informar o nível', async () => {
      ok((await page.title()).startsWith('N4 ·'), await page.title());
    });
    await t('o resultado abre com um h2, sem pular nível de heading', async () => {
      eq(await page.evaluate(() => document.querySelector('#result h2, #result h3').tagName), 'H2');
    });
    await page.close();
  }

  console.log('\n— aparência —');
  {
    const page = await browser.newPage();
    await page.goto(URL);
    await t('todo texto do formulário passa em WCAG AA', async () => {
      const ruins = await contrasteRuim(page);
      ok(ruins.length === 0, ruins.slice(0,6).join('\n         '));
    });
    await t('as barras mantêm a cor na impressão', async () => {
      await fill(page, {rot:4,pic:4,pro:4,ver:4,ctx:4,jul:4,seg:4});
      await page.click('#submit');
      await page.waitForSelector('#result.on');
      await page.emulateMedia({media:'print'});
      const v = await page.evaluate(() => getComputedStyle(document.querySelector('.dim .fill')).printColorAdjust);
      eq(v, 'exact');
      await page.emulateMedia({media:'screen'});
    });
    await t('todo texto do resultado passa em WCAG AA', async () => {
      const ruins = await contrasteRuim(page);
      ok(ruins.length === 0, ruins.slice(0,6).join('\n         '));
    });
    await page.close();
  }
  {
    const page = await (await browser.newContext({javaScriptEnabled:false})).newPage();
    await page.goto(URL);
    await t('sem JavaScript, explica o motivo e esconde o botão inerte', async () => {
      ok(await page.locator('noscript').count() > 0);
      ok(!(await page.locator('#submit').isVisible()), 'botão inerte visível sem JS');
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
      await page.locator('#q-rot .opt[data-v="3"] input').focus();
      await page.keyboard.press('Space');
      eq(await page.locator('#q-rot input:checked').count(), 1);
    });
    await t('cada grupo de pergunta tem rótulo acessível', async () => {
      eq(await page.locator('[role="group"][aria-labelledby]').count(), 8);
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
