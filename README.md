# Régua de maturidade em IA

**→ https://regua-maturidade-ia.pages.dev**

Diagnóstico de maturidade no uso de IA no trabalho. Oito perguntas de escolha, escala única
N0–N6, sem bifurcação por papel. O resultado sai na hora, no navegador de quem responde.

As alternativas são embaralhadas a cada carregamento e não exibem o código do nível a que
correspondem. Ordem crescente de maturidade induz a resposta, e um rótulo `N4 —` ao lado da
alternativa transforma a pergunta numa escolha de nota. Também não há pergunta de cargo nem
coleta de e-mail: a página não identifica ninguém.

**Nada é enviado, nada é salvo.** Sem back-end, sem banco, sem cookie, sem analytics, sem
`localStorage`. A página é HTML e um arquivo JavaScript — o cálculo roda no cliente e o
resultado desaparece quando a aba fecha. Há teste automatizado verificando exatamente isso.

## Como o nível é calculado

Seis das oito perguntas viram pontos. Duas contam dobrado. A soma cai numa faixa, e cinco
limites podem baixá-la — nunca subi-la.

```
soma  = rotina×2 + verificação×2 + pico + durabilidade + contexto + julgamento     (5 a 43)

faixa = 43+ → N6 · 36+ → N5 · 28+ → N4 · 20+ → N3 · 12+ → N2 · resto → N1

nível = se rotina = 0 e pico = 0 → N0
        senão min(faixa,
                  rotina + 1,                              a âncora manda
                  verificação ≤ 2 ? 3 : 6,                 delegar sem conferir para em N3
                  durabilidade ≤ 3 ? 4 : (= 4 ? 5 : 6),    fecha o topo para quem só declara
                  rotina = 6 ? 6 : 5)                      N6 exige o topo também na rotina
```

Fora do nível, três sinais que não mudam o número e servem para conversa:

| Sinal | Condição |
|---|---|
| Risco de dado | segurança ≤ 2 |
| Uso acrítico | julgamento ≤ 2 e nível ≥ N3 |
| Potencial parado | pico − rotina ≥ 2 |

A pergunta de segurança fica fora da soma de propósito: resposta boa em outra pergunta não
compensa dado sensível em ferramenta não homologada.

## Os sete níveis

| Nível | O que define |
|---|---|
| N0 · Fora | Não usa IA no trabalho. |
| N1 · Consulta | Pergunta em janela separada e faz o trabalho sozinho. O material real não passa pela IA. |
| N2 · Aplicado | A IA trabalha no material de verdade; a pessoa aprova pedaço por pedaço. |
| N3 · Padronizado | Tarefa inteira delegada, com contexto preparado antes. Revisa só o resultado. |
| N4 · Sistematizado | Existe um crivo que confere antes de chegar na pessoa, e/ou a IA produz sem ela presente. |
| N5 · Orquestrado | Vários agentes com papéis distintos em loop com critério de parada. |
| N6 · Fronteira | Produz o que os outros usam, com material público adotado fora do time. |

N5 é o teto prático. N6 é marca de referência — como o nível 5 da SAE J3016, existe sem que
se espere alguém alcançá-lo. Sem ele, o topo da régua seria "orquestro agentes", e quem
chegasse lá concluiria que acabou.

## Testes

```bash
npm install          # só playwright, para o E2E
npm test
```

**`tests/score.test.js`** — 30.707 verificações. Compara a implementação com uma réplica
literal da fórmula em produção na planilha de respostas, varrendo exaustivamente as 30.625
combinações possíveis de resposta, mais invariantes (nenhum limite pode ser violado em
nenhuma combinação) e casos nomeados.

**`tests/e2e.test.js`** — 39 verificações no navegador: renderização das oito perguntas,
validação de campos faltantes, teto de duas marcações na múltipla escolha, sete perfis
calculados na tela, conteúdo do resultado, geometria e cor das barras, ausência total de
requisição de rede / storage / cookie, ausência de rolagem horizontal em três larguras,
navegação por teclado, e as garantias de neutralidade — nenhum código de nível visível,
nenhum peso exibido, nenhuma pergunta de cargo, nenhum campo de texto ou e-mail.

**`tests/shuffle.test.js`** — 24 verificações em 12 carregamentos: a ordem das alternativas
varia, nunca sai crescente em todos eles, e nenhuma alternativa se perde ou duplica no
embaralhamento.

**`tests/csp.test.js`** — sobe um servidor local com exatamente os headers do arquivo
`_headers` e confere que a política não bloqueia nada: sem violação de CSP, sem handler de
evento inline, resultado e barras renderizando.

O fixture `tests/casos-reais.json` (respostas internas anonimizadas) não é versionado. Quando
presente, o teste de score também confere a paridade contra os registros reais; quando ausente,
essa etapa é pulada.

## Publicar

Site estático, sem build. Só três arquivos vão ao ar: `index.html`, `app.js` e `_headers`.

```bash
npx wrangler login
mkdir -p dist && cp index.html app.js _headers dist/
npx wrangler pages deploy dist --project-name regua-maturidade-ia --branch main
```

O `dist/` existe para que `tests/`, `node_modules/` e o fixture de respostas reais nunca
subam junto — o wrangler publica o diretório inteiro que recebe.

O arquivo `_headers` aplica a CSP em produção. Como a página não carrega absolutamente
nada de fora — nem fonte, nem ícone, nem analytics — a política pode ser restritiva ao
extremo: `default-src 'none'`.

Para republicar a cada push, conecte o repositório em **Workers & Pages → o projeto →
Settings → Builds → Connect to Git**, com build command vazio e output directory `/`.

## Limites do instrumento

Mede comportamento declarado, não capacidade demonstrada, e não tem validade psicométrica:
o que herda das fontes é a arquitetura, não a validação. O resultado confiável é a
distribuição de um grupo; o nível individual é hipótese para conversar.

Serve para desenhar trilha de capacitação, montar time misto e achar gargalo. Não serve para
comparar pessoas nem para justificar decisão sobre alguém.

## Fontes

Parasuraman, Sheridan & Wickens (2000), *IEEE Trans. SMC-A* 30(3) · Sheridan & Verplank (1978),
MIT · SAE J3016 · Liu & Levy (2026), arXiv:2606.00038 · Eledath (2026), *8 Levels of Agentic
Engineering* · Google Cloud/DORA (2025), *AI Capabilities Model* · MITRE (2023), *AI Maturity
Model* · CMU SEI & Accenture (2025) · UNESCO, *AI Maturity Framework* · Carolus et al. (2023),
MAILS, arXiv:2302.09319 · Smith & Kendall (1963) e a literatura de BARS · King & Wand;
von Davier et al. (2018) · Kruger & Dunning (1999) · Sackett, Zedeck & Fogli (1988).

Só o MAILS é instrumento psicometricamente validado.
