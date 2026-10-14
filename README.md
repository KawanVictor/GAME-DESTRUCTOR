# DESTRUCTOR

Um jogo de ação e plataforma 2D em que você constrói o cenário enquanto luta. Levante paredes, espalhe armadilhas, instale torretas e segure as ondas de inimigos do jeito que der.

Roda direto no navegador, para um jogador. Feito com Phaser 3, TypeScript e Vite.

**▶ [Jogar agora](https://game-destructor.vercel.app)**

[![CI](https://github.com/KawanVictor/GAME-DESTRUCTOR/actions/workflows/ci.yml/badge.svg)](https://github.com/KawanVictor/GAME-DESTRUCTOR/actions/workflows/ci.yml)

![O Titã, o chefe do jogo, chega com uma Vespa e um Cuspidor enquanto as torretas defendem a colina](docs/screenshots/chefe.png)

| Escolha a arena | Monte suas defesas |
|---|---|
| ![Menu inicial](docs/screenshots/menu.png) | ![Menu de construção aberto, com a prévia de uma peça](docs/screenshots/construcao.png) |

| Segure a onda | Jogue no celular |
|---|---|
| ![Torretas e paredes defendendo a colina](docs/screenshots/combate.png) | ![Botões de toque sobre o jogo](docs/screenshots/toque.png) |

## Bora jogar

O jeito mais rápido é abrir **[game-destructor.vercel.app](https://game-destructor.vercel.app)**.

Para rodar na sua máquina, você só precisa do [Node.js](https://nodejs.org) (versão 20.19 ou mais nova).

```bash
npm install
npm run dev
```

Abra http://localhost:5173, escolha uma arena e clique em **Jogar**.

## Como funciona

São 10 ondas de inimigos. Entre uma e outra você ganha um tempinho para construir, consertar o que quebrou e comprar melhorias. A cada 5 ondas aparece um chefe. Passou da décima? Dá para continuar no modo infinito e ver até onde aguenta.

### Controles

| Para | Aperte |
|---|---|
| Andar | A / D ou as setas |
| Pular (segure para ir mais alto) | Espaço |
| Descer de uma plataforma de madeira | S + Espaço |
| Golpear | J |
| Atirar | K |
| Investida | L ou Shift |
| Abrir o menu de construção | B |
| Escolher a peça | 1 a 7, ou clique nela |
| Construir, consertar ou demolir | Clique esquerdo no cenário |
| Cancelar | Clique direito |
| Ferramenta de conserto | T |
| Ferramenta de demolição | R |
| Começar a onda logo | Enter |
| Pausar | Esc |

Não curtiu alguma tecla? Troque em **Opções**, no menu ou na pausa.

No celular ou tablet aparecem botões na tela para andar, pular e atacar, e é só tocar no cenário para construir.

### Dicas de combate

- **O tiro mira sozinho** no inimigo mais próximo à sua frente, mesmo que ele esteja acima ou abaixo de você.
- **A investida deixa você invulnerável** por um instante. Ótima para atravessar um grupo ou fugir do golpe do chefe.
- **O golpe bate mais forte** que o tiro, quebra caixotes e detona seus explosivos.

### Peças

| Peça | Custo | Para que serve |
|---|---|---|
| Plataforma de madeira | 10 | Dá para subir por baixo dela |
| Bloco de pedra | 20 | Aguenta muito e bloqueia todo mundo |
| Parede defensiva | 15 | Barra os inimigos, mas você e seus tiros passam |
| Bloco explosivo | 25 | Explode quando é destruído; um golpe ou tiro seu detona na hora |
| Plataforma de impulso | 20 | Joga você lá no alto, até as plataformas elevadas |
| Armadilha de espinhos | 30 | Machuca quem pisa; vai gastando com o uso |
| Torreta | 50 | Atira sozinha em quem chega perto |

Você começa com 150 materiais e ganha mais derrotando inimigos, quebrando os caixotes da arena e vencendo ondas.

Algumas regrinhas na hora de construir:

- A peça precisa estar perto de você e encostada em algo que já existe.
- Armadilhas e torretas precisam de chão firme embaixo.
- Não dá para construir em cima de alguém, nem colado nos portais dos inimigos.
- O jogo não deixa você se emparedar sem saída.

A prévia fica verde quando pode e vermelha quando não pode, e já diz o motivo.

Consertar uma peça sai mais barato do que refazer. Demolir devolve metade do que ela custou. Se um inimigo destruir, aí não volta nada.

### Inimigos

| Inimigo | Aparece na | O que ele faz | Como lidar |
|---|---|---|---|
| Rastejador | Onda 1 | Vem andando e ataca suas paredes | Qualquer defesa segura |
| Corredor | Onda 2 | Rápido, frágil e pula paredes | Golpe e espinhos |
| Vespa | Onda 3 | Voa por cima de tudo e mergulha em você | Torretas ou tiro |
| Colosso | Onda 4 | Lento, resistente e derruba estruturas | Explosivos, e conserte depois |
| Cuspidor | Onda 5 | Fica de longe atirando | Esconda-se atrás de paredes e blocos |
| Titã (chefe) | Ondas 5, 10, 15… | Arrebenta tudo e pula em você com um golpe de área | Pule ou use a investida na hora do golpe |

### Melhorias

A cada intervalo ficam à venda a **cura** (sempre) e **três melhorias sorteadas**: mais vida, mais dano, tiro mais rápido, mais velocidade, torretas mais fortes ou investida que recarrega mais depressa. Vencer uma onda também devolve um pouco de vida.

### Arenas

| Arena | Como é |
|---|---|
| Colina | Um morro no meio, fácil de fortificar. Boa para começar |
| Vale | Você fica embaixo e os inimigos descem dos dois lados |
| Planalto | Bem aberta e larga, com um platô comprido |

## Quer colocar no ar?

```bash
npm run build
```

Isso cria a pasta `dist/` com o jogo pronto. É só subir essa pasta em qualquer hospedagem de site estático, como Netlify, Vercel, Cloudflare Pages ou GitHub Pages. Para conferir antes, rode `npm run preview`.

## Para desenvolvedores

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm run typecheck` | Só a checagem de tipos |
| `npm test` | 74 testes unitários (Vitest) |
| `npm run test:e2e` | 17 testes de navegador (Playwright, no Chrome) |
| `BROWSERS=all npm run test:e2e` | Os mesmos testes em Chrome, Firefox e WebKit |
| `npm run playthrough` | Um robô joga a partida inteira e relata cada onda |
| `npm run screenshots` | Regenera as imagens deste README |

A cada push, o GitHub Actions roda a checagem de tipos, os testes unitários, o build e os testes de navegador.

### Como o código está organizado

```
src/game/
  systems/    regras do jogo, sem Phaser: construção, recursos, ondas,
              combate, salvamento (é o que os testes unitários cobrem)
  data/       balanceamento em tabelas: peças, inimigos, ondas, armas
  entities/   herói, inimigos e projéteis
  world/      arenas, tilemap e torretas
  scenes/     cenas do Phaser, que ligam as regras ao motor
    game/     controladores da partida: entrada, combate, construção, coletáveis
  ui/         HUD, menus, opções e controles de toque (HTML sobre o canvas)
  art/        arte desenhada por código
tests/        testes unitários
e2e/          testes de navegador
scripts/      robô de balanceamento e gerador de capturas
```

Algumas escolhas que valem contar:

- **As regras não conhecem o motor.** Construção, ondas, dano e salvamento são TypeScript puro; as cenas só os conectam ao Phaser. Por isso dá para testá-los sem abrir um navegador.
- **Balanceamento é dado, não código.** Um inimigo novo é uma linha em uma tabela.
- **Reiniciar é criar uma partida nova.** Todo o estado nasce do zero, então nada vaza de uma partida para a outra.
- **Os testes de navegador rodam sob a mesma política de segurança da produção** (Content-Security-Policy, definida em `vercel.json`), e falham se ela bloquear qualquer coisa.
- **A API usada pelos testes não vai para produção.** Ela só existe em um build separado, e o CI confere que o pacote publicado não a contém.

### Balanceamento com um robô

As ondas foram ajustadas com `npm run playthrough`: um robô joga a partida inteira pelo teclado e mouse, em tempo real. Ele monta um forte simples, luta parado, coleta materiais, conserta e compra melhorias. Não desvia de nada, então funciona como piso: quem joga com atenção se sai melhor. Depois dos ajustes, o jogo também foi conferido à mão: as 10 ondas, as três arenas, todos os controles e todas as peças.

Última partida dele na Colina, vencendo as 10 ondas:

| Onda | Duração | Abates | Vida antes → depois |
|---|---|---|---|
| 1 | 30 s | 3 | 100 → 100 |
| 2 | 39 s | 6 | 100 → 100 |
| 3 | 41 s | 9 | 100 → 100 |
| 4 | 55 s | 13 | 100 → 95 |
| 5 (chefe) | 56 s | 10 | 95 → 68 |
| 6 | 61 s | 20 | 68 → 56 |
| 7 | 69 s | 25 | 96 → 41 |
| 8 | 63 s | 28 | 106 → 45 |
| 9 | 69 s | 33 | 110 → 109 |
| 10 (chefe) | 60 s | 19 | 109 → 54 |

O que essas partidas mudaram no jogo:

- **O bug da Vespa.** Na primeira partida, o robô travou na onda 3: a Vespa ficava parada no portal e a onda nunca acabava. O arrasto da física, pensado para inimigos que andam, anulava a aceleração do voo. Nenhum teste tinha pegado isso.
- **Cura sempre à venda.** Ela dependia de sorteio, e o robô chegou a entrar em uma onda com 6 de vida sem ter como se curar.
- **Começo mais exigente.** As quatro primeiras ondas não causavam dano nenhum.
- **Menos materiais por onda.** Sobrava tanto que o robô acumulou 655 sem ter onde gastar.
- **Chefe menos punitivo.** Em uma versão intermediária, ele derrubava o robô com a vida cheia.

### O que ainda falta

- A dificuldade foi calibrada pelo robô e conferida em partidas manuais do autor; falta o retorno de outras pessoas jogando.
- Vale e Planalto foram jogadas à mão, mas ainda não têm teste automatizado de partida completa.
- O golpe de área do chefe ainda não tem teste automatizado.
- Os controles de toque foram testados com eventos simulados, não em aparelhos.
- No WebKit, 7 dos 17 testes ficam de fora: a versão que o Playwright oferece no Windows roda o jogo devagar demais para testes que dependem de tempo de resposta.

## Licença

[MIT](LICENSE) © 2026 Kawan Victor Cavalcante
