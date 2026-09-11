/* Régua de maturidade em IA — cálculo local, sem envio e sem persistência. */
'use strict';

/* As sete alternativas de rotina/pico. Iguais nas duas perguntas, por desenho. */
var ANCHOR = [
  {v:0, code:'N0', main:'Não usei IA no meu trabalho nesse período.'},
  {v:1, code:'N1', main:'Perguntei numa janela separada e fiz o trabalho eu mesmo.',
   eg:'tirar uma dúvida, revisar um texto, entender um termo que apareceu na reunião'},
  {v:2, code:'N2', main:'Entreguei o meu material de verdade e a IA trabalhou em cima dele; eu aprovei pedaço por pedaço.',
   eg:'autocomplete na IDE editando os meus arquivos; subir a planilha e pedir o cruzamento; jogar as transcrições da pesquisa e pedir a categorização'},
  {v:3, code:'N3', main:'Deleguei uma tarefa inteira, com contexto que eu preparei antes, e revisei só o resultado final.',
   eg:'agente que planeja, implementa e testa a task; “monte o discovery a partir destas entrevistas e do nosso template”'},
  {v:4, code:'N4', main:'Montei um crivo que confere o trabalho antes de chegar em mim, e/ou deixei a IA produzindo sem eu estar presente.',
   eg:'testes que o agente roda até passar; rubrica que a IA aplica no próprio resultado; automação que abre o ticket sozinha quando chega o e-mail'},
  {v:5, code:'N5', main:'Vários agentes com papéis diferentes rodando até fechar o critério; eu li o resultado e o registro.',
   eg:'um implementa, outro revisa, repete até passar; um pesquisa, outro redige, outro critica contra a rubrica'},
  {v:6, code:'N6', main:'Construo o que os outros usam: crio o mecanismo, meço com avaliação reproduzível, e ele virou material público adotado por gente de fora do meu time.'}
];

var QUESTIONS = [
  {id:'rot', tag:'Âncora · rotina', weight:'Peso ×2', title:'O seu dia comum',
   hint:'Nas últimas 4 semanas, o que descreve a maioria dos seus dias de trabalho? Não o melhor dia — o dia comum.',
   options:ANCHOR},

  {id:'pic', tag:'Âncora · pico', weight:'Peso ×1', title:'O mais fundo que você chegou',
   hint:'Ainda nas últimas 4 semanas: qual foi a forma mais avançada como você usou IA? Marque o mais alto que você realmente fez — não o que sabe que existe, nem o que viu alguém fazer.',
   note:'Você não está em N6 se usa Claude Code, Cursor ou Codex com subagentes, mesmo muito bem e todos os dias — isso é N5. Nem se montou testes, eval ou automação para o seu próprio projeto — isso é N4 ou N5. Nem se acompanha os lançamentos e testa modelo novo no dia — isso é insumo, não nível. Nem se é a pessoa que mais entende de IA no time — isso é posição relativa ao grupo, e esta escala não é relativa ao grupo. N6 é o degrau de quem faz da fronteira da área o objeto do trabalho e tem material público adotado fora do próprio time. Ele existe para dar escala aos degraus abaixo; o esperado é ninguém marcar.',
   options:ANCHOR},

  {id:'pro', tag:'Prova', weight:'Peso ×1', title:'O que sobreviveria a você',
   hint:'Se você saísse de férias amanhã, o que sobraria do seu jeito de trabalhar com IA?',
   options:[
    {v:1, main:'Nada, ou não uso IA no trabalho.'},
    {v:2, main:'Ficaria o que eu já entreguei, mas ninguém saberia como eu cheguei lá.', eg:'o código, o documento, a análise — e mais nada'},
    {v:3, main:'Ficariam também os meus prompts e instruções salvos; alguém acharia, mas precisaria de mim para entender.', eg:'uma pasta de prompts, um projeto customizado meu, um doc de anotações'},
    {v:4, main:'Ficaria o mecanismo montado e funcionando — outra pessoa conseguiria usar sem eu explicar.', eg:'as regras no repositório, os testes rodando, a rubrica de aceite, a automação ligada'},
    {v:5, main:'Além disso, tem coisa minha rodando fora do meu time, usada por gente que eu não conheço.', eg:'repositório público, ferramenta que outro time adotou, material que circula fora daqui'}
   ]},

  {id:'ver', tag:'Verificação', weight:'Peso ×2', title:'Como você confere',
   hint:'Como você confere o que a IA produziu antes de aceitar?',
   options:[
    {v:1, main:'Geralmente aceito e sigo — ou não uso IA no trabalho.'},
    {v:2, main:'Leio com atenção e uso o meu julgamento, sem executar nem conferir contra nada.'},
    {v:3, main:'Confiro contra a realidade antes de usar.', eg:'rodo e testo; confiro o número na fonte; confirmo se a citação existe; valido a regra com quem é dono dela'},
    {v:4, main:'Tenho um crivo definido que aplico sempre, cobrindo o que costuma quebrar.', eg:'teste automatizado com casos de borda; rubrica de aceite; revisão cruzada combinada com alguém'},
    {v:5, main:'Esse crivo roda antes de chegar em mim: a própria IA o executa e só me chama quando passa.'}
   ]},

  {id:'ctx', tag:'Contexto', weight:'Peso ×1', title:'O que a IA sabe do seu mundo',
   hint:'Como a IA que você usa fica sabendo das convenções, do histórico e das restrições do que você faz?',
   options:[
    {v:1, main:'Não fica sabendo — explico do zero a cada conversa, ou não uso IA no trabalho.'},
    {v:2, main:'Colo o contexto à mão em cada tarefa.', eg:'trechos de código, exemplos do padrão esperado, o documento de referência'},
    {v:3, main:'Tenho um contexto escrito e reutilizável que ela lê ou recebe sempre.', eg:'CLAUDE.md ou AGENTS.md no repositório; um doc de padrões; um projeto customizado no ChatGPT ou Claude'},
    {v:4, main:'Tenho, mexi nele neste mês, e criei peças próprias que eu reuso.', eg:'templates de prompt, comandos, skills, rubricas'},
    {v:5, main:'Esse contexto é do time: fica num lugar comum, mais de uma pessoa mantém, e evolui a cada entrega.'}
   ]},

  {id:'jul', tag:'Julgamento crítico', weight:'Peso ×1', title:'Quando ela erra bem escrito',
   hint:'A IA erra com confiança — a resposta errada vem bem escrita. Como você lida com isso?',
   options:[
    {v:1, main:'Na prática, se veio bem escrito e coerente, eu sigo — ou não uso IA no trabalho.'},
    {v:2, main:'Já me queimei e agora desconfio, mas não tenho um jeito de saber onde ela erra.'},
    {v:3, main:'Sei onde ela costuma errar no meu domínio e olho ali primeiro.', eg:'número inventado, citação que não existe, regra de negócio ignorada, viés na amostra, código que roda e faz a coisa errada'},
    {v:4, main:'Escolho conscientemente o que não delego, e sei explicar o critério.', eg:'decisão de consequência alta, comunicação que precisa da minha voz, o julgamento que é a minha parte do trabalho'},
    {v:5, main:'Ajudo o time a enxergar essa fronteira, com exemplos do nosso contexto de onde delegar compensa e onde não.'}
   ]},

  {id:'seg', tag:'Segurança e LGPD', weight:'Fora da soma', title:'Dado e ferramenta',
   hint:'Como você trata dado e ferramenta ao usar IA no trabalho?',
   options:[
    {v:1, main:'Não tenho critério definido — uso a ferramenta que está à mão com o dado que eu preciso.'},
    {v:2, main:'Evito o obviamente sensível, mas não verifico se a ferramenta é homologada.'},
    {v:3, main:'Uso ferramenta homologada e não coloco dado sensível em ferramenta que não é.', eg:'sensível = dado de aluno ou cliente, credencial, contrato, base de leads, código proprietário'},
    {v:4, main:'Além disso, penso em permissão e escopo antes de dar acesso a um agente.', eg:'o que ele pode ler, o que pode alterar, o que pode executar sozinho'},
    {v:5, main:'Ajudo a definir critério de homologação, escopo de acesso de agentes e política de uso para o time.'}
   ]},

  {id:'papel', tag:'Papel', weight:'Não pontua', title:'O seu trabalho',
   hint:'O que descreve melhor o seu trabalho no dia a dia?',
   options:[
    {v:'a', main:'Engenharia, dados ou infra', eg:'dev, SRE, engenheiro de dados, QA'},
    {v:'b', main:'Produto ou negócio', eg:'PO, PM, analista de negócio, growth'},
    {v:'c', main:'Design, UX, pesquisa ou conteúdo', eg:'designer, UX writer, pesquisador'},
    {v:'d', main:'Suporte, operações ou sistemas', eg:'suporte técnico, sysadmin, ops'},
    {v:'e', main:'Liderança ou gestão', eg:'tech lead, coordenação, gerência'}
   ]},

  {id:'bloq', tag:'Bloqueio', weight:'Até 2 · não pontua', title:'O que te segura hoje', multi:2,
   hint:'O que mais te impede de usar IA mais ou melhor hoje? Marque até duas.',
   options:[
    {v:'a', main:'Falta de tempo para experimentar', eg:'a demanda não abre espaço para tentar de um jeito novo'},
    {v:'b', main:'Não sei o que é possível fazer', eg:'uso para o básico e desconfio que dá para muito mais'},
    {v:'c', main:'Não confio no resultado', eg:'reviso tanto que às vezes sai mais caro que fazer sozinho'},
    {v:'d', main:'Falta acesso ou ferramenta homologada', eg:'não tenho licença, ou não sei o que posso usar'},
    {v:'e', main:'A IA não conhece o nosso contexto', eg:'nossos sistemas, nossas regras, nosso histórico'},
    {v:'f', main:'Medo de errar publicamente', eg:'entregar algo gerado por IA com erro e isso pesar no meu nome'},
    {v:'g', main:'Nada me bloqueia hoje'}
   ]}
];

var LEVELS = [
  {n:0, name:'Fora',          def:'Não usa IA no trabalho.', share:'0–10%'},
  {n:1, name:'Consulta',      def:'Pergunta em janela separada e faz o trabalho sozinho. O material real não passa pela IA.', share:'15–30%'},
  {n:2, name:'Aplicado',      def:'A IA trabalha no material de verdade; a pessoa aprova pedaço por pedaço.', share:'30–45%'},
  {n:3, name:'Padronizado',   def:'Tarefa inteira delegada, com contexto preparado antes. Revisa só o resultado.', share:'10–25%'},
  {n:4, name:'Sistematizado', def:'Existe um crivo que confere antes de chegar na pessoa, e/ou a IA produz sem ela presente.', share:'3–10%'},
  {n:5, name:'Orquestrado',   def:'Vários agentes com papéis distintos em loop com critério de parada. A pessoa lê resultado e log.', share:'0–3%'},
  {n:6, name:'Fronteira',     def:'Produz o que os outros usam: cria o mecanismo, mede com avaliação reproduzível, e tem material público adotado fora do time.', share:'≈ 0'}
];

/* Faixas conforme a fórmula em produção na planilha de respostas.
   Validadas contra os 65 registros reais: reproduzem 65/65 os níveis. */
var BANDS = [
  {min:43, level:6}, {min:36, level:5}, {min:28, level:4},
  {min:20, level:3}, {min:12, level:2}, {min:0,  level:1}
];

/* ---------------- núcleo do cálculo ---------------- */

function band(sum){
  for (var i=0;i<BANDS.length;i++){ if (sum>=BANDS[i].min) return BANDS[i].level; }
  return 1;
}

function score(a){
  var rot=a.rot, pic=a.pic, pro=a.pro, ver=a.ver, ctx=a.ctx, jul=a.jul, seg=a.seg;
  var sum = rot*2 + ver*2 + pic + pro + ctx + jul;
  var raw = band(sum);

  var capAnchor = rot + 1;
  var capVer    = (ver<=2) ? 3 : 6;
  var capPro    = (pro<=3) ? 4 : (pro===4 ? 5 : 6);
  var capTop    = (rot===6) ? 6 : 5;

  var level, capped;
  if (rot===0 && pic===0){
    level = 0; capped = [];
  } else {
    level = Math.min(raw, capAnchor, capVer, capPro, capTop);
    capped = [];
    if (capAnchor < raw) capped.push('anchor');
    if (capVer    < raw) capped.push('ver');
    if (capPro    < raw) capped.push('pro');
    if (capTop    < raw) capped.push('top');
    /* só conta como trava o limite que efetivamente definiu o nível */
    capped = capped.filter(function(k){
      return ({anchor:capAnchor, ver:capVer, pro:capPro, top:capTop})[k] === level;
    });
  }

  var next = null;
  for (var i=BANDS.length-1;i>=0;i--){
    if (BANDS[i].min > sum){ next = BANDS[i]; break; }
  }

  return {
    sum:sum, raw:raw, level:level, capped:capped,
    caps:{anchor:capAnchor, ver:capVer, pro:capPro, top:capTop},
    toNextBand: next ? (next.min - sum) : null,
    nextBandLevel: next ? next.level : null,
    flags:{
      data:      seg<=2,
      uncritical:jul<=2 && level>=3,
      idle:      (pic-rot)>=2
    }
  };
}

/* ---------------- montagem do formulário ---------------- */

var answers = {};
var TOTAL = QUESTIONS.length;

function el(tag, cls, html){
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s){
  return String(s).replace(/[&<>"]/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];
  });
}

function buildForm(){
  var form = document.getElementById('form');
  QUESTIONS.forEach(function(q, i){
    var sec = el('section','q');
    sec.id = 'q-' + q.id;
    sec.setAttribute('role','group');
    sec.setAttribute('aria-labelledby','h-'+q.id);

    var tag = el('div','q-tag');
    tag.appendChild(el('span','n', String(i+1).padStart(2,'0')));
    tag.appendChild(el('span','', esc(q.tag)));
    tag.appendChild(el('span','w', esc(q.weight)));
    sec.appendChild(tag);

    var h = el('h2', null, esc(q.title));
    h.id = 'h-'+q.id;
    sec.appendChild(h);
    sec.appendChild(el('p','hint', esc(q.hint)));
    if (q.note) sec.appendChild(el('p','notice', esc(q.note)));

    var box = el('div','opts');
    q.options.forEach(function(o, j){
      var lab = el('label', 'opt' + (q.multi ? ' box' : ''));
      lab.setAttribute('data-on','0');
      var input = document.createElement('input');
      input.type = q.multi ? 'checkbox' : 'radio';
      input.name = q.id;
      input.value = String(o.v);
      input.id = q.id + '-' + j;
      lab.appendChild(input);
      lab.appendChild(el('span','dot'));
      var txt = el('span','txt');
      if (o.code) txt.appendChild(el('span','code', o.code));
      txt.appendChild(el('span','main', esc(o.main)));
      if (o.eg) txt.appendChild(el('span','eg', 'ex.: ' + esc(o.eg)));
      lab.appendChild(txt);
      box.appendChild(lab);
    });
    sec.appendChild(box);
    sec.appendChild(el('p','q-warn','Escolha uma opção para continuar.'));
    form.appendChild(sec);
  });

  form.addEventListener('change', onChange);
}

function onChange(e){
  var input = e.target;
  if (!input || !input.name) return;
  var q = QUESTIONS.filter(function(x){ return x.id === input.name; })[0];
  if (!q) return;

  if (q.multi){
    var checked = Array.prototype.slice.call(
      document.querySelectorAll('input[name="'+q.id+'"]:checked'));
    if (checked.length > q.multi){
      input.checked = false;
      checked = checked.filter(function(c){ return c !== input; });
    }
    answers[q.id] = checked.map(function(c){ return c.value; });
    if (!answers[q.id].length) delete answers[q.id];
  } else {
    answers[q.id] = isNaN(Number(input.value)) ? input.value : Number(input.value);
  }

  document.querySelectorAll('input[name="'+q.id+'"]').forEach(function(c){
    c.closest('.opt').setAttribute('data-on', c.checked ? '1' : '0');
  });
  document.getElementById('q-'+q.id).classList.remove('missing');
  updateProgress();
}

function updateProgress(){
  var done = QUESTIONS.filter(function(q){ return answers[q.id] !== undefined; }).length;
  var bar = document.getElementById('bar');
  if (done > 0) bar.hidden = false;
  document.getElementById('count').textContent = done + ' de ' + TOTAL;
  document.getElementById('fill').style.width = (done/TOTAL*100) + '%';
}

/* ---------------- resultado ---------------- */

var DIMS = [
  {k:'rot', label:'Rotina',      sub:'o dia comum',        max:6, collective:true},
  {k:'pic', label:'Pico',        sub:'o melhor dia',       max:6, collective:false},
  {k:'pro', label:'Durabilidade',sub:'o que sobra sem você', max:5, collective:true},
  {k:'ver', label:'Verificação', sub:'como você confere',  max:5, collective:false},
  {k:'ctx', label:'Contexto',    sub:'o que a IA sabe',    max:5, collective:true},
  {k:'jul', label:'Julgamento',  sub:'onde ela erra',      max:5, collective:false},
  {k:'seg', label:'Segurança',   sub:'fora da soma',       max:5, collective:false}
];

var CAP_TEXT = {
  anchor: {
    h:'A trava foi a sua rotina',
    p:'O nível nunca passa de rotina + 1. A sua prática mais avançada é real, mas ela acontece no melhor dia, não no dia comum — e o instrumento segue o dia comum de propósito. Prática madura levanta uma faixa acima da rotina, não três.',
    do:'O caminho mais curto não é aprender nada novo: é escolher uma tarefa que você já faz toda semana e passar a fazê-la sempre no seu melhor modo, até virar o padrão.'
  },
  ver: {
    h:'A trava foi a verificação',
    p:'Com a verificação em 1 ou 2, o nível não passa de N3, qualquer que seja a soma. Autonomia sem crivo não é maturidade — é risco com aparência de velocidade.',
    do:'Escreva o crivo antes da próxima entrega: as três coisas que costumam quebrar no seu trabalho e como conferir cada uma. Depois faça a IA aplicá-lo no próprio resultado antes de te chamar.'
  },
  top: {
    h:'A trava foi o teto do N6',
    p:'N6 só é alcançável por quem tem o degrau mais alto também na rotina — o dia comum, não o melhor dia. É o mesmo desenho do nível 5 de condução autônoma da SAE: um ponto de referência definido por critério externo, que existe sem que se espere alguém alcançá-lo.',
    do:'Aqui não há o que destravar, e isso é de propósito. N5 é o teto prático da régua; quem chega lá é referência para o grupo, não alguém a quem falta um degrau.'
  },
  pro: {
    h:'A trava foi a durabilidade',
    p:'Enquanto o seu jeito de trabalhar existe só na sua cabeça, o teto é N4 — e o N6 exige que algo seu rode fora do seu time. Não é sobre o que você entrega; é sobre o que sobreviveria à sua ausência.',
    do:'Pegue o que você já faz bem e tire da sua cabeça: as regras num arquivo do repositório, o crivo escrito, a automação ligada. O teste é simples — alguém do lado conseguiria usar sem você explicar?'
  }
};

var BLOQ_TEXT = {
  a:'Falta de tempo é o bloqueio que menos se resolve com treinamento e mais com prioridade. Escolha uma tarefa recorrente e proteja uma hora por semana para refazê-la de outro jeito — o retorno aparece na terceira repetição.',
  b:'“Não sei o que é possível” é o bloqueio mais barato de remover e o de maior retorno: não é treinamento, é exposição. Ver um colega trabalhar por trinta minutos costuma valer mais que um curso.',
  c:'Desconfiança do resultado não se resolve confiando mais — se resolve com crivo. Quando existe algo que confere por você, a revisão para de ser leitura integral e vira exceção.',
  d:'Falta de acesso é bloqueio de organização, não de pessoa. Vale escalar: é o único da lista que a sua própria dedicação não resolve.',
  e:'“A IA não conhece o nosso contexto” é exatamente o que um contexto escrito e reutilizável resolve — e é o degrau que separa uso individual de uso de time.',
  f:'Medo de errar publicamente é sinal de ambiente, não de pessoa. Onde o erro assistido por IA é tratado como erro comum, o uso avança; onde ele vira caso, todo mundo recua para o que é seguro.',
  g:'Você respondeu que nada te bloqueia. Vale cruzar isso com o seu nível: quando não há obstáculo externo e o nível ainda não é o que poderia ser, o que falta costuma ser repertório — ninguém sobe um degrau que nunca viu.'
};

function render(a){
  var r = score(a);
  var L = LEVELS[r.level];
  var out = document.getElementById('result');
  var h = '';

  h += '<div class="res-hero">';
  h += '<p class="overline">O seu nível hoje</p>';
  h += '<p class="res-level">N' + r.level + '</p>';
  h += '<p class="res-name">' + esc(L.name) + '</p>';
  h += '<p class="res-def">' + esc(L.def) + '</p>';
  h += '</div>';

  /* escala */
  h += '<div class="scale"><div class="scale-row">';
  for (var i=0;i<=6;i++){
    var cls = i < r.level ? 'past' : (i === r.level ? 'now' : 'future');
    h += '<span class="scale-cell ' + cls + '">N' + i + '</span>';
  }
  h += '</div><div class="scale-cap"><span>Fora</span><span>Fronteira</span></div></div>';

  /* dimensões */
  h += '<h3 class="sec">As suas dimensões</h3><div class="dims">';
  DIMS.forEach(function(d){
    var v = a[d.k];
    var pct = (v / d.max) * 100;
    var low = v <= (d.max === 6 ? 3 : 3);
    h += '<div class="dim' + (low ? ' low' : '') + '">';
    h += '<span class="lbl">' + esc(d.label) + '<small>' + esc(d.sub) + '</small></span>';
    h += '<span class="track"><span class="fill" style="width:' + pct.toFixed(1) + '%"></span></span>';
    h += '<span class="val">' + v + '<span style="color:var(--ink-48);font-weight:400">/' + d.max + '</span></span>';
    h += '</div>';
  });
  h += '<div class="sum">';
  h += '<div><div class="k">Soma</div><div class="v">' + r.sum + '</div></div>';
  h += '<div><div class="k">Faixa da soma</div><div class="v">N' + r.raw + '</div></div>';
  h += '<div><div class="k">Nível final</div><div class="v">N' + r.level + '</div></div>';
  if (r.toNextBand !== null){
    h += '<div><div class="k">Para a próxima faixa</div><div class="v">' + r.toNextBand + ' pt' + (r.toNextBand>1?'s':'') + '</div></div>';
  }
  h += '</div></div>';

  /* leitura */
  h += '<h3 class="sec">Como ler isso</h3>';

  if (r.level === 0){
    h += card('', 'Você não usa IA no trabalho hoje — e isso é uma resposta legítima',
      '<p>N0 não é o fundo de uma escala de mérito. É o ponto de partida de quem ainda não incorporou a ferramenta ao trabalho, e nesta régua ele vem por regra, não por soma: quando rotina e pico são zero, a conta nem entra.</p>' +
      '<p>O degrau seguinte não é “usar IA”. É bem menor que isso: uma vez, numa tarefa que você já domina, pedir uma segunda opinião numa janela separada — sem entregar material real e sem depender do resultado. É o N1 inteiro.</p>');
  } else if (r.capped.length === 0){
    h += card('good', 'Nenhum limite segurou o seu resultado',
      '<p>A sua soma virou nível direto: os limites do instrumento — rotina + 1, verificação, durabilidade, o teto do N6 e a regra de não uso — passaram sem cortar nada. Isso quer dizer que o seu perfil é consistente, sem um eixo muito atrás dos outros.</p>' +
      (r.toNextBand !== null
        ? '<p>Faltam <strong>' + r.toNextBand + ' ponto' + (r.toNextBand>1?'s':'') + '</strong> de soma para a faixa N' + r.nextBandLevel + '. Como rotina e verificação pesam dobrado, é nelas que cada degrau rende o dobro.</p>'
        : '<p>Você está no topo da régua. A partir daqui a pergunta deixa de ser o seu nível e passa a ser o do grupo em volta.</p>'));
  } else {
    r.capped.forEach(function(k){
      var t = CAP_TEXT[k];
      h += card('note', t.h, '<p>' + t.p + '</p><p><strong>O que destrava:</strong> ' + t.do + '</p>' +
        '<p style="font-size:15px;color:var(--muted)">A sua soma de ' + r.sum + ' pontos daria N' + r.raw + '. O limite trouxe para N' + r.level + '.</p>');
    });
  }

  /* flags */
  var hasFlag = r.flags.data || r.flags.uncritical || r.flags.idle;
  if (hasFlag){
    h += '<h3 class="sec">Sinais para conversar</h3>';
    if (r.flags.data){
      h += card('alert', 'Risco de dado',
        '<p>A sua resposta sobre dado e ferramenta ficou em 1 ou 2. Este é o único resultado da régua que pede ação antes de qualquer trilha de capacitação, e ele fica fora da soma de propósito: nenhuma resposta boa em outra pergunta compensa dado sensível numa ferramenta não homologada.</p>' +
        '<p>Sensível quer dizer dado de aluno ou cliente, credencial, contrato, base de leads, código proprietário. Vale descobrir hoje o que a sua organização homologou — e, se a resposta for “nada”, essa é a conversa a puxar.</p>');
    }
    if (r.flags.uncritical){
      h += card('alert', 'Uso acrítico',
        '<p>Você delega em N' + r.level + ', mas o julgamento crítico ficou em 1 ou 2: entrega bastante para a IA sem ter um jeito de saber onde ela erra. É a combinação de maior consequência da régua, porque o erro chega bem escrito e passa.</p>' +
        '<p>O antídoto não é desconfiar de tudo. É mapear os dois ou três modos de falha do seu domínio — número inventado, citação inexistente, regra de negócio ignorada, código que roda e faz a coisa errada — e olhar sempre ali primeiro.</p>');
    }
    if (r.flags.idle){
      h += card('note', 'Potencial parado',
        '<p>O seu pico está ' + (a.pic - a.rot) + ' degraus acima da sua rotina. Você já sabe fazer mais do que faz no dia comum — e o instrumento pontua o dia comum.</p>' +
        '<p>Esta é a situação de maior retorno por hora investida do grupo inteiro, porque não é treinamento: é remoção de obstáculo. Vale perguntar o que impede o seu melhor dia de virar terça-feira comum.</p>');
    }
  }

  /* bloqueios */
  if (a.bloq && a.bloq.length){
    h += '<h3 class="sec">Sobre o que você marcou como bloqueio</h3>';
    a.bloq.forEach(function(k){
      var opt = QUESTIONS[8].options.filter(function(o){ return o.v === k; })[0];
      h += card('', opt.main, '<p>' + BLOQ_TEXT[k] + '</p>');
    });
  }

  /* o degrau seguinte */
  if (r.level < 6){
    var nxt = LEVELS[r.level + 1];
    h += '<h3 class="sec">O degrau seguinte</h3>';
    h += card('good', 'N' + nxt.n + ' · ' + nxt.name,
      '<p>' + esc(nxt.def) + '</p>' +
      '<p>Mire um degrau, não três. A régua foi calibrada contra perfis reais, e as faixas altas exigem quase tudo no máximo — não uma soma alta com um eixo fraco. Subir um nível de forma sustentada vale mais que tocar um nível alto uma vez.</p>');
  }

  h += '<h3 class="sec">O que este número não é</h3>';
  h += card('', 'Uma hipótese para conversar, não um veredito',
    '<p>A régua mede comportamento declarado, não capacidade demonstrada, e não tem validade psicométrica — o que ela herda das fontes é a arquitetura, não a validação. O resultado confiável é a distribuição de um grupo; o nível individual é ponto de partida de conversa.</p>' +
    '<p>Use para desenhar trilha, montar time misto e achar gargalo. Não use para comparar pessoas nem para justificar decisão sobre alguém.</p>');

  h += '<div class="actions print-hide">';
  h += '<button class="btn" type="button" id="pdf">Salvar em PDF</button> ';
  h += '<button class="btn ghost" type="button" id="again">Refazer</button>';
  h += '<p class="sub">Nada foi enviado nem salvo. Para guardar, use o PDF.</p>';
  h += '</div>';

  out.innerHTML = h;
  out.classList.add('on');
  document.getElementById('form-view').style.display = 'none';
  document.getElementById('bar').hidden = true;
  window.scrollTo(0,0);
  document.getElementById('again').addEventListener('click', function(){
    location.reload();
  });
  document.getElementById('pdf').addEventListener('click', function(){
    window.print();
  });
}

function card(cls, title, body){
  return '<div class="card' + (cls ? ' ' + cls : '') + '"><h4>' + esc(title) + '</h4>' + body + '</div>';
}

function submit(){
  var missing = QUESTIONS.filter(function(q){ return answers[q.id] === undefined; });
  document.querySelectorAll('.q').forEach(function(n){ n.classList.remove('missing'); });
  if (missing.length){
    missing.forEach(function(q){ document.getElementById('q-'+q.id).classList.add('missing'); });
    var first = document.getElementById('q-'+missing[0].id);
    first.scrollIntoView({behavior:'smooth', block:'center'});
    document.getElementById('submit-sub').textContent =
      'Falta' + (missing.length>1 ? 'm ' + missing.length + ' perguntas' : ' 1 pergunta') + '.';
    return;
  }
  render(answers);
}

document.addEventListener('DOMContentLoaded', function(){
  buildForm();
  document.getElementById('submit').addEventListener('click', submit);
});

/* exposto para os testes automatizados */
window.__regua = {score:score, band:band, QUESTIONS:QUESTIONS, LEVELS:LEVELS};
