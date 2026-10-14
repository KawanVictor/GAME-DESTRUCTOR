# DESTRUCTOR

Ação e plataforma 2D em que construir o cenário faz parte do combate: você ergue paredes, instala armadilhas e torretas, e usa tudo isso para sobreviver a ondas de inimigos.

Um jogador, no navegador, feito com **Phaser 3 + TypeScript + Vite**. Não usa servidor, conta nem API externa. Toda a arte, os efeitos sonoros e a música são gerados por código, então não há nenhum arquivo de imagem ou áudio no jogo.

![O Titã, chefe da onda 5, chega com uma Vespa e um Cuspidor enquanto as torretas defendem a colina](docs/screenshots/chefe.png)

| Menu, com a escolha da arena | Construção, com a prévia da peça |
|---|---|
| ![Menu inicial](docs/screenshots/menu.png) | ![Menu de construção aberto, com defesas montadas e a prévia de uma plataforma de impulso](docs/screenshots/construcao.png) |

| Combate na primeira onda | Controles de toque (arena Vale) |
|---|---|
| ![Torretas e paredes defendendo a colina](docs/screenshots/combate.png) | ![Botões de toque sobre o jogo em tamanho de celular](docs/screenshots/toque.png) |

## Começar

Requer Node.js 20.19 ou mais recente (desenvolvido e testado no 22.15).

```bash
npm install
npm run dev
```

Abra http://localhost:5173 e clique em **Jogar**.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e versão de produção em `dist/` |
| `npm run preview` | Serve `dist/` localmente para conferir o build |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes de navegador (Playwright, no Chrome) |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run playthrough` | Um robô joga a partida inteira e relata cada onda (para balanceamento) |
| `npm run screenshots` | Regenera as imagens deste README |

## Como se joga

Você tem 10 ondas para sobreviver, em uma de três arenas. Entre uma onda e outra há um intervalo para construir, reparar, comprar melhorias e se curar. A cada 5 ondas vem um chefe. Depois da décima, dá para continuar no modo infinito.

### Controles

| Ação | Tecla padrão |
|---|---|
| Mover | A / D ou setas |
| Pular (segure para ir mais alto) | Espaço |
| Descer de uma plataforma de madeira | S (ou ↓) + Espaço |
| Golpe corpo a corpo | J |
| Disparo | K |
| Investida | L ou Shift |
| Abrir/fechar o menu de construção | B |
| Escolher peça | 1–7, ou clique no menu |
| Confirmar construção, reparo ou demolição | Botão esquerdo no cenário |
| Cancelar a prévia | Botão direito |
| Ferramenta de reparo | T |
| Ferramenta de demolição | R |
| Começar a onda antes do tempo | Enter |
| Pausar, ou fechar o menu de construção | Esc |

Todas as teclas da tabela, menos Esc e os números, podem ser trocadas em **Opções** (no menu ou na pausa). A troca vale na hora e fica salva.

**Toque**: em telas de toque aparecem botões para mover, pular, golpear, disparar e usar a investida; tocar no cenário constrói. Em Opções dá para forçar os botões sempre ou nunca.

### Combate

- **Disparo com mira assistida**: o tiro vai sozinho no inimigo visível mais próximo à frente do herói, inclusive os que estão acima ou abaixo. Sem alvo, sai reto.
- **Investida**: avanço curto e rápido, invulnerável, com recarga. Serve para atravessar um grupo ou escapar do golpe do chefe.
- **Golpe**: curto alcance, mais dano, e também quebra caixotes e detona seus explosivos.

### Peças

| Peça | Custo | O que faz |
|---|---|---|
| Plataforma de madeira | 10 | Atravessável por baixo |
| Bloco de pedra | 20 | Resistente; bloqueia todos |
| Parede defensiva | 15 | Barra inimigos; você e seus tiros atravessam |
| Bloco explosivo | 25 | Explode ao ser destruído; um golpe ou tiro seu detona na hora |
| Plataforma de impulso | 20 | Lança o herói para o alto, até as plataformas elevadas |
| Armadilha de espinhos | 30 | Fere inimigos que pisam; desgasta com o uso |
| Torreta | 50 | Atira sozinha em inimigos próximos; pode ser destruída |

Você começa com 150 materiais. Ganha mais ao derrotar inimigos, quebrar os caixotes da arena e concluir ondas.

Uma peça só pode ser colocada dentro do alcance do herói, encostada em algo que já existe (armadilhas precisam de base sólida embaixo), onde não há ninguém, fora da área dos portais inimigos e sem emparedar o herói. A prévia fica verde ou vermelha e mostra o custo ou o motivo da recusa.

- **Reparar** uma peça sua custa metade do valor dela, proporcional ao dano sofrido.
- **Demolir** devolve metade do custo, proporcional à resistência restante.
- Peças destruídas por inimigos não devolvem nada.

### Inimigos

| Inimigo | Estreia | Comportamento | O que pede de você |
|---|---|---|---|
| Rastejador | Onda 1 | Patrulha e persegue; ataca paredes | Qualquer defesa |
| Corredor | Onda 2 | Rápido e frágil; salta paredes | Golpe, espinhos |
| Vespa | Onda 3 | Voa por cima de tudo e mergulha | Torretas ou tiro |
| Colosso | Onda 4 | Lento e resistente; derruba estruturas | Reparo, explosivos |
| Cuspidor | Onda 5 | Mantém distância e atira | Cobertura (paredes e blocos param os tiros) |
| Titã (chefe) | Ondas 5, 10, 15… | Arrebenta estruturas e salta sobre você com um golpe de área | Pular ou usar a investida na hora do golpe |

### Melhorias

A cada preparo ficam à venda a **cura** (sempre) e **três melhorias sorteadas** entre: vida máxima, dano, cadência de disparo, velocidade, dano das torretas e recarga da investida. Concluir uma onda também recupera 15 de vida.

### Arenas

| Arena | Característica |
|---|---|
| Colina | Uma elevação central fácil de fortificar |
| Vale | Você começa embaixo; os inimigos descem dos dois lados |
| Planalto | Terreno aberto e largo, com um platô comprido |

## Publicação

`npm run build` gera a pasta `dist/` com arquivos estáticos. Os caminhos são relativos, então ela funciona na raiz ou em uma subpasta.

- **Netlify, Vercel ou Cloudflare Pages**: comando de build `npm run build`, pasta de saída `dist`.
- **GitHub Pages**: publique o conteúdo de `dist/`.
- **Qualquer servidor estático**: copie `dist/` para o servidor.

Abrir `dist/index.html` direto do disco não funciona, porque o navegador bloqueia módulos em `file://`. Use `npm run preview` ou um servidor.

## Estrutura

```
index.html                 marcação da interface (menu, HUD, toque, pausa, opções, fim de partida)
src/main.ts                cria o jogo Phaser
src/styles/main.css        interface em HTML/CSS sobre o canvas
src/game/
  config.ts                mundo, física do herói, construção, ondas, melhorias, chefe
  services.ts              salvamento e áudio (vivem além de uma partida)
  debug.ts                 API de inspeção para testes (só com ?test=1)
  data/                    blocks.ts, enemies.ts (inimigos e ondas), weapons.ts — balanceamento
  types/game.ts            tipos compartilhados
  systems/                 regras sem Phaser:
    BuildingSystem.ts        grade, validação, custo, resistência, reparo, explosões
    ResourceSystem.ts        materiais
    WaveSystem.ts            máquina de estados das ondas
    CombatSystem.ts          vida, invulnerabilidade, recargas, golpes, mira assistida
    SaveSystem.ts            configurações, teclas e recorde em localStorage
    MatchState.ts            estado de uma partida e melhorias
                           e a ligação com o Phaser:
    CollisionSystem.ts       quem colide com quem (Arcade Physics)
    Effects.ts               partículas, clarões, números de dano
    AudioSystem.ts           efeitos e música sintetizados
  world/                   LevelBuilder (arenas), TileRegistry, TileView (tilemap
                           e colisão), Trap (lógica), TurretManager
  entities/                Player, Enemy (quatro comportamentos), Projectile
  scenes/                  Boot, Preload (gera texturas), Menu, Game, GameOver
  ui/                      HUD, BuildMenu, PauseMenu, Options (som, toque, teclas),
                           TouchControls, keys
  art/draw.ts              arte provisória desenhada por código
public/assets/             manifesto para trocar arte e sons por arquivos
tests/                     testes unitários (Vitest)
e2e/                       testes de navegador (Playwright)
scripts/                   playthrough.mjs (robô de balanceamento), screenshots.mjs
```

### Decisões de projeto

- **Regras separadas do motor.** Construção, recursos, ondas, dano e salvamento são classes TypeScript puras; a `GameScene` só as liga ao Phaser. É isso que permite testá-las sem navegador.
- **Reinício é uma cena nova.** Todo o estado da partida nasce em `createMatch()` e todos os ouvintes são removidos no `shutdown` da cena.
- **Colisão dos tiles calculada à mão**, em `TileView`. Plataformas atravessáveis e paredes que só barram inimigos quebram o recálculo automático de faces do Phaser.
- **Balanceamento em dados.** Custos, resistências, inimigos, armas e ondas ficam em `src/game/data/` e `config.ts`. Uma peça nova é uma entrada em `blocks.ts` mais o desenho dela; um inimigo novo é uma entrada em `enemies.ts` com um dos comportamentos existentes.

### Trocar a arte e os sons

Coloque os arquivos em `public/assets/` e registre-os em `public/assets/manifest.json`. O que não estiver no manifesto continua sendo gerado por código. As chaves, os tamanhos de quadro e os nomes de som aceitos estão em [public/assets/README.md](public/assets/README.md).

Esse mecanismo foi implementado mas ainda não foi exercitado com arquivos reais: o projeto não tem arte nem áudio finais.

## Testes

```bash
npm test                              # Vitest
npm run test:e2e                      # Playwright, no Chrome instalado
npx playwright install firefox webkit # uma vez, para os outros navegadores
BROWSERS=all npm run test:e2e         # Chrome, Firefox e WebKit
```

Resultados da última execução, nesta máquina (Windows):

- **Vitest: 74 de 74 passaram.** Cobrem recursos, validação de construção, demolição, reparo, destruição e explosões em cadeia, dano e morte, mira assistida, ondas e composição com os seis inimigos, melhorias, as três arenas (inclusive se o chão é caminhável), remapeamento de teclas, reinício de partida e salvamento.
- **Playwright**, contra o build de produção, com teclado, mouse e toque:

  | Navegador | Passaram | Pulados | Falharam |
  |---|---|---|---|
  | Chrome | 17 | 0 | 0 |
  | Firefox | 17 | 0 | 0 |
  | WebKit | 10 | 7 | 0 |

Os 17 testes cobrem: menu, controles, construção, combate, torreta, peças especiais, vitória e modo infinito, mira assistida, investida, reparo, os três inimigos novos, escolha de arena, remapeamento de teclas, controles de toque, ondas, pausa e reinício, derrota e dados salvos.

**Sobre o WebKit**: o WebKit que o Playwright oferece no Windows roda o jogo a cerca de 11 quadros por segundo e entrega as teclas com atraso de centenas de milissegundos. Os 7 testes que medem deslocamento dentro de uma janela curta de tempo não são confiáveis nessas condições e ficam pulados nele. Isso não é um teste no Safari de verdade.

Com `?test=1` na URL, o jogo expõe `window.__destructor`, que os testes usam para ler o estado. Alguns testes também o usam para criar inimigos avulsos, ajustar materiais, danificar um bloco ou adiar a contagem da onda, e um deles usa um atalho que encerra a partida como vitória.

## Balanceamento

As ondas foram ajustadas com `npm run playthrough`: um robô joga a partida inteira pelo teclado e mouse, em tempo real. Ele monta um forte simples, luta parado nele, coleta materiais, reconstrói, repara e compra melhorias. Não desvia, não pula golpes e não muda de tática, então serve de piso: um jogador atento deve se sair melhor.

Última partida do robô, na Colina, com os números atuais (vitória nas 10 ondas):

| Onda | Duração | Abates | Vida antes → depois | Torretas ao fim |
|---|---|---|---|---|
| 1 | 30 s | 3 | 100 → 100 | 1 |
| 2 | 39 s | 6 | 100 → 100 | 1 |
| 3 | 41 s | 9 | 100 → 100 | 1 |
| 4 | 55 s | 13 | 100 → 95 | 1 |
| 5 (chefe) | 56 s | 10 | 95 → 68 | 0 |
| 6 | 61 s | 20 | 68 → 56 | 2 |
| 7 | 69 s | 25 | 96 → 41 | 2 |
| 8 | 63 s | 28 | 106 → 45 | 2 |
| 9 | 69 s | 33 | 110 → 109 | 1 |
| 10 (chefe) | 60 s | 19 | 109 → 54 | 1 |

O que essas partidas mudaram:

- A Vespa ficava parada no portal por um erro de física. Foi a primeira execução do robô que revelou isso.
- A cura passou a estar sempre à venda; antes dependia do sorteio, e o robô entrou em uma onda com 6 de vida sem poder se curar.
- Concluir uma onda recupera 15 de vida.
- As primeiras ondas ganharam mais inimigos, e Rastejador e Corredor ficaram um pouco mais perigosos, porque as ondas 1 a 4 não causavam dano nenhum.
- A recompensa por onda caiu, porque sobravam materiais (o robô chegou a acumular 655).
- O chefe ficou menos punitivo: dano de contato, dano do golpe e dano a blocos menores, e mais tempo entre golpes.

O resultado varia de partida para partida. Com um chefe um pouco mais forte, o mesmo robô morreu na onda 5.

## Limitações conhecidas

- **Nenhuma pessoa jogou as 10 ondas.** O equilíbrio vem de um robô que joga parado; a sensação de dificuldade para um jogador humano não foi avaliada.
- **Só a Colina foi jogada até o fim.** No Vale e no Planalto os testes conferem que a arena carrega e que o chão é caminhável, mas nenhuma onda foi jogada nelas.
- **O golpe de área do chefe não tem teste automatizado**; ele aconteceu nas partidas do robô, mas nada verifica o dano ou o raio.
- **Os sons e a música não foram ouvidos.** São sintetizados e o código roda sem erro, mas ninguém avaliou como soam.
- **Toque testado só com eventos simulados** em um navegador de computador, não em um celular.
- **Safari não foi testado**; o WebKit do Playwright no Windows é só uma aproximação, e lenta.
- **Recuperação de inimigo preso e salto alto contra herói inalcançável** estão implementados, mas sem teste automatizado.
- **Sem salvamento no meio da partida.** Ficam salvos configurações, teclas, arena escolhida, recorde e estatísticas.
- **Pacote de produção de cerca de 1,3 MB** (350 KB comprimido), quase todo do Phaser.

## Licença

[MIT](LICENSE) © 2026 Kawan Victor Cavalcante
