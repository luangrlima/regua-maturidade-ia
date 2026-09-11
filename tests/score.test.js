/* Teste de paridade: a implementação do site contra a fórmula em produção. */
const fs = require('fs'), vm = require('vm'), path = require('path');

const sandbox = {
  document:{ addEventListener(){}, createElement:()=>({ setAttribute(){}, appendChild(){},
    style:{}, classList:{add(){},remove(){}} }), getElementById:()=>null, querySelectorAll:()=>[] },
  window:{}, console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'), sandbox);
const { score, QUESTIONS, BLOQ_TEXT } = sandbox.window.__regua;

/* réplica literal das fórmulas da planilha, para comparar contra */
const sheetSum = a => a.rot*2 + a.ver*2 + a.pic + a.pro + a.ctx + a.jul;
const sheetLevel = a => {
  const s = sheetSum(a);
  if (a.rot === 0 && a.pic === 0) return 0;
  const banda = s>=43?6 : s>=36?5 : s>=28?4 : s>=20?3 : s>=12?2 : 1;
  return Math.min(banda, a.rot+1, a.ver<=2?3:6, a.pro<=3?4:(a.pro===4?5:6), a.rot===6?6:5);
};

let pass = 0, fail = 0;
const fails = [];

/* 1 — registros reais da planilha, se o fixture local existir.
   O arquivo não vai para o repositório: são respostas internas. */
const fixture = path.join(__dirname, 'casos-reais.json');
if (fs.existsSync(fixture)){
  const reais = JSON.parse(fs.readFileSync(fixture,'utf8'));
  for (const c of reais){
    const r = score(c);
    if (r.sum === c.soma && r.level === c.nivel) pass++;
    else { fail++; fails.push(`real rot=${c.rot} soma esperada=${c.soma} obtida=${r.sum} | nível esperado=${c.nivel} obtido=${r.level}`); }
  }
  console.log(`[1] ${reais.length} registros reais da planilha: ${pass} ok, ${fail} falhas`);
} else {
  console.log('[1] fixture de registros reais ausente — etapa pulada (esperado fora da máquina de origem)');
}

/* 2 — varredura exaustiva do espaço de respostas: 7*7*5*5*5*5 = 30.625 combinações */
let ex = 0, exFail = 0;
for (let rot=0; rot<=6; rot++)
 for (let pic=0; pic<=6; pic++)
  for (let pro=1; pro<=5; pro++)
   for (let ver=1; ver<=5; ver++)
    for (let ctx=1; ctx<=5; ctx++)
     for (let jul=1; jul<=5; jul++){
       const a = {rot,pic,pro,ver,ctx,jul,seg:3};
       const r = score(a);
       ex++;
       if (r.sum !== sheetSum(a) || r.level !== sheetLevel(a)){
         exFail++;
         if (exFail<=5) fails.push(`exaustivo ${JSON.stringify(a)} → nível ${r.level}, esperado ${sheetLevel(a)}`);
       }
     }
console.log(`[2] varredura exaustiva (${ex} combinações): ${ex-exFail} ok, ${exFail} falhas`);

/* 3 — invariantes que o instrumento promete */
const inv = [];
const check = (nome, cond) => { inv.push([nome, cond]); };

let viola = 0;
for (let rot=0; rot<=6; rot++)
 for (let pic=0; pic<=6; pic++)
  for (let pro=1; pro<=5; pro++)
   for (let ver=1; ver<=5; ver++){
     const a = {rot,pic,pro,ver,ctx:5,jul:5,seg:3};
     const r = score(a);
     if (r.level > rot+1 && !(rot===0&&pic===0)) { viola++; }
     if (ver<=2 && r.level>3) viola++;
     if (pro<=3 && r.level>4) viola++;
     if (rot!==6 && r.level>5) viola++;
     if (r.level<0 || r.level>6) viola++;
   }
check('nenhum limite violado em toda a varredura', viola===0);

/* casos nomeados */
check('não uso (rot=0,pic=0) → N0',
  score({rot:0,pic:0,pro:1,ver:1,ctx:1,jul:1,seg:1}).level === 0);
check('rot=0 mas pic=3 não cai em N0',
  score({rot:0,pic:3,pro:2,ver:3,ctx:2,jul:3,seg:3}).level !== 0);
check('tudo no máximo com rot=6 → N6',
  score({rot:6,pic:6,pro:5,ver:5,ctx:5,jul:5,seg:5}).level === 6);
check('tudo no máximo mas rot=5 → N5 (teto do N6)',
  score({rot:5,pic:6,pro:5,ver:5,ctx:5,jul:5,seg:5}).level === 5);
check('soma máxima é 43',
  score({rot:6,pic:6,pro:5,ver:5,ctx:5,jul:5,seg:5}).sum === 43);
check('soma mínima é 5',
  score({rot:0,pic:0,pro:1,ver:1,ctx:1,jul:1,seg:1}).sum === 5);

/* caso do artefato: rot N5, pic N5, pro 4, ver 2, ctx 4, jul 2 → soma 29, cortado pela verificação */
const doc = score({rot:5,pic:5,pro:4,ver:2,ctx:4,jul:2,seg:3});
check('caso documentado: soma 29', doc.sum === 29);
check('caso documentado: verificação corta em N3', doc.level === 3);
check('caso documentado: trava identificada = verificação', doc.capped.includes('ver'));
check('caso documentado: flag de uso acrítico acesa', doc.flags.uncritical === true);

/* flags */
check('flag risco de dado com seg=2',
  score({rot:3,pic:3,pro:4,ver:3,ctx:3,jul:3,seg:2}).flags.data === true);
check('sem flag de dado com seg=3',
  score({rot:3,pic:3,pro:4,ver:3,ctx:3,jul:3,seg:3}).flags.data === false);
check('flag potencial parado com pico 2 acima da rotina',
  score({rot:1,pic:3,pro:2,ver:3,ctx:2,jul:3,seg:3}).flags.idle === true);
check('sem flag de uso acrítico abaixo de N3',
  score({rot:1,pic:1,pro:1,ver:1,ctx:1,jul:1,seg:3}).flags.uncritical === false);

/* pontos para a próxima faixa */
const p = score({rot:3,pic:3,pro:4,ver:3,ctx:3,jul:4,seg:5});
check('soma 26 → faltam 2 pts para a faixa N4 (28)', p.toNextBand === 2 && p.nextBandLevel === 4);
check('no topo, toNextBand é nulo',
  score({rot:6,pic:6,pro:5,ver:5,ctx:5,jul:5,seg:5}).toNextBand === null);

/* --- garantias de redação, que a aritmética não cobre --- */

/* as alternativas aparecem embaralhadas: nenhuma pode depender da anterior */
const ANAFORA = /^(Além disso|Esse |Essa |Ficariam também|Tenho,)|essa fronteira|esse crivo|esse contexto/i;
const quebradas = [];
for (const q of QUESTIONS)
  for (const o of q.options)
    if (ANAFORA.test(o.main)) quebradas.push(`${q.id}: "${o.main.slice(0,50)}…"`);
check('nenhuma alternativa se refere à alternativa anterior', quebradas.length === 0);
if (quebradas.length) fails.push('anáforas: ' + quebradas.join(' | '));

/* quem não usa IA precisa de saída em toda pergunta pontuada */
const semSaida = QUESTIONS
  .filter(q => q.id !== 'bloq')
  .filter(q => !q.options.some(o => /não us(o|ei) IA/i.test(o.main)))
  .map(q => q.id);
check('toda pergunta pontuada tem alternativa de "não uso IA"', semSaida.length === 0);
if (semSaida.length) fails.push('sem saída de não-uso: ' + semSaida.join(', '));

/* quem declarou não usar IA não pode ser acusado de expor dado por meio dela */
check('perfil N0 não acende a flag de risco de dado',
  score({rot:0,pic:0,pro:1,ver:1,ctx:1,jul:1,seg:1}).flags.data === false);
check('quem usa IA e responde seg=1 continua acendendo a flag',
  score({rot:3,pic:3,pro:4,ver:3,ctx:3,jul:3,seg:1}).flags.data === true);

/* todo bloqueio precisa de texto, senão o resultado imprime undefined */
const bloq = QUESTIONS.find(q => q.id === 'bloq');
const semTexto = bloq.options.filter(o => !BLOQ_TEXT[o.v]).map(o => o.v);
check('BLOQ_TEXT cobre todas as alternativas de bloqueio', semTexto.length === 0);
if (semTexto.length) fails.push('bloqueios sem texto: ' + semTexto.join(', '));
const sobrando = Object.keys(BLOQ_TEXT).filter(k => !bloq.options.some(o => o.v === k));
check('BLOQ_TEXT não tem texto órfão', sobrando.length === 0);

let iOk=0, iBad=0;
for (const [nome, cond] of inv){
  if (cond) iOk++; else { iBad++; fails.push(`invariante falhou: ${nome}`); }
}
console.log(`[3] invariantes e casos nomeados: ${iOk} ok, ${iBad} falhas`);

console.log('');
if (fails.length){
  console.log('FALHAS:'); fails.slice(0,20).forEach(f=>console.log('  - '+f));
  process.exit(1);
}
console.log(`TUDO PASSOU — ${pass + (ex-exFail) + iOk} verificações.`);
