# DESTRUCTOR

Ação e plataforma 2D em que construir o cenário faz parte do combate: você ergue paredes, instala armadilhas e torretas, e usa tudo isso para sobreviver a ondas de inimigos.

Um jogador, no navegador, feito com **Phaser 3 + TypeScript + Vite**. Não usa servidor, conta nem API externa. Toda a arte e todos os sons são gerados por código, então não há nenhum arquivo de imagem ou áudio no jogo.

![Combate: torretas e paredes defendendo a colina durante a primeira onda](docs/screenshots/combate.png)

| Menu inicial | Construção, com a prévia da peça |
|---|---|
| ![Menu inicial](docs/screenshots/menu.png) | ![Menu de construção aberto, com defesas montadas e a prévia de uma plataforma de impulso](docs/screenshots/construcao.png) |

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
| `npm run test:e2e` | Testes de navegador (Playwright) |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run screenshots` | Regenera as imagens deste README |

## Como se joga

Você tem 10 ondas para sobreviver. Entre uma onda e outra há um intervalo para construir, comprar melhorias e se curar. Depois da décima, dá para continuar no modo infinito.

### Controles

| Ação | Tecla |
|---|---|
| Mover | A / D ou setas |
| Pular (segure para ir mais alto) | Espaço |
| Descer de uma plataforma de madeira | S (ou ↓) + Espaço |
| Golpe corpo a corpo | J |
| Disparo | K |
| Abrir/fechar o menu de construção | B |
| Escolher peça | 1–7, ou clique no menu |
| Confirmar construção ou demolição | Botão esquerdo no cenário |
| Cancelar a prévia | Botão direito |
| Ferramenta de demolição | R |
| Começar a onda antes do tempo | Enter |
| Pausar, ou fechar o menu de construção | Esc |

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

### Regras de construção

Uma peça só pode ser colocada:

- dentro do alcance do herói;
- encostada em algo que já existe (armadilhas precisam de base sólida embaixo);
- onde não há ninguém;
- fora da área dos portais inimigos;
- sem emparedar o herói.

A prévia fica verde ou vermelha e mostra o custo ou o motivo da recusa. Demolir uma peça sua devolve metade do custo, proporcional à resistência restante. Peças destruídas não devolvem nada.

### Inimigos

| Inimigo | Comportamento |
|---|---|
| Rastejador | Básico: patrulha e persegue quando percebe o herói |
| Corredor | Rápido e frágil; salta obstáculos |
| Colosso | Lento e resistente; derruba estruturas |

Diante de uma barreira, eles pulam o que conseguem e demolem o resto.

### Melhorias

Durante o preparo, materiais também compram +25 de vida máxima (60), +20% de dano (70) ou uma cura de 40 (30).

## Publicação

`npm run build` gera a pasta `dist/` com arquivos estáticos. Os caminhos são relativos, então ela funciona na raiz ou em uma subpasta.

- **Netlify, Vercel ou Cloudflare Pages**: comando de build `npm run build`, pasta de saída `dist`.
- **GitHub Pages**: publique o conteúdo de `dist/`.
- **Qualquer servidor estático**: copie `dist/` para o servidor.

Abrir `dist/index.html` direto do disco não funciona, porque o navegador bloqueia módulos em `file://`. Use `npm run preview` ou um servidor.

## Estrutura

```
index.html                 marcação da interface (menu, HUD, pausa, fim de partida)
src/main.ts                cria o jogo Phaser
src/styles/main.css        interface em HTML/CSS sobre o canvas
src/game/
  config.ts                mundo, física do herói, construção, ondas, melhorias
  services.ts              salvamento e áudio (vivem além de uma partida)
  debug.ts                 API de inspeção para testes (só com ?test=1)
  data/                    blocks.ts, enemies.ts, weapons.ts — balanceamento
  types/game.ts            tipos compartilhados
  systems/                 regras sem Phaser:
    BuildingSystem.ts        grade, validação, custo, resistência, explosões
    ResourceSystem.ts        materiais
    WaveSystem.ts            máquina de estados das ondas
    CombatSystem.ts          vida, invulnerabilidade, recargas, golpes
    SaveSystem.ts            serialização para localStorage
    MatchState.ts            estado de uma partida, criado do zero a cada início
                           e a ligação com o Phaser:
    CollisionSystem.ts       quem colide com quem (Arcade Physics)
    Effects.ts               partículas, clarões, números de dano
    AudioSystem.ts           efeitos sonoros sintetizados
  world/                   LevelBuilder (arena), TileRegistry, TileView (tilemap
                           e colisão), Trap (lógica), TurretManager
  entities/                Player, Enemy, Projectile
  scenes/                  Boot, Preload (gera texturas), Menu, Game, GameOver
  ui/                      HUD, BuildMenu, PauseMenu
  art/draw.ts              arte provisória desenhada por código
tests/                     testes unitários (Vitest)
e2e/                       testes de navegador (Playwright)
scripts/screenshots.mjs    gera docs/screenshots/
```

### Decisões de projeto

- **Regras separadas do motor.** Construção, recursos, ondas, dano e salvamento são classes TypeScript puras; a `GameScene` só as liga ao Phaser. É isso que permite testá-las sem navegador.
- **Reinício é uma cena nova.** Todo o estado da partida nasce em `createMatch()` e todos os ouvintes são removidos no `shutdown` da cena.
- **Colisão dos tiles calculada à mão**, em `TileView`. Plataformas atravessáveis e paredes que só barram inimigos quebram o recálculo automático de faces do Phaser.
- **Balanceamento em dados.** Custos, resistências, inimigos, armas e ondas ficam em `src/game/data/` e `config.ts`. Uma peça nova é uma entrada em `blocks.ts` mais o desenho dela.

### Personalizar

- **Arte**: carregue imagens com as mesmas chaves e tamanhos de quadro em `PreloadScene.preload()`. Texturas que já existem não são geradas por código.
- **Áudio**: registre um tocador por nome em `audio.samples`. Sem isso, o som é sintetizado.
- **Teclas**: vêm de `settings.bindings` no salvamento, então já são remapeáveis por dados. Ainda não há tela para isso.

## Testes

```bash
npm test             # Vitest
npm run test:e2e     # Playwright: faz o build e usa o Chrome instalado
```

Resultados da última execução, nesta máquina:

- **Vitest: 53 de 53 passaram.** Cobrem desconto de recursos, recusa de construções inválidas, demolição e reembolso, destruição e explosões em cadeia, dano e morte, golpe que não repete dano, avanço e contagem das ondas, reinício de partida e salvamento (inclusive dados corrompidos).
- **Playwright: 10 de 10 passaram**, contra o build de produção, com teclado e mouse reais:
  1. menu exibido e partida iniciada;
  2. movimento, parada, pulo e pulo de altura variável;
  3. construção com prévia, custo, recusas, armadilhas e demolição;
  4. golpe, disparo, coleta de materiais, parede barrando inimigo e espinhos ferindo;
  5. torreta ferindo um inimigo sozinha;
  6. plataforma de impulso e bloco explosivo;
  7. tela de vitória e modo infinito;
  8. onda 1 vencida lutando de verdade, preparo, melhoria e início da onda 2;
  9. pausa congelando a simulação e reinício zerando tudo;
  10. derrota, reinício sem recarregar e dados persistidos após recarregar a página.

Com `?test=1` na URL, o jogo expõe `window.__destructor`, que os testes usam para ler o estado. Alguns testes também o usam para criar inimigos avulsos, ajustar materiais ou adiar a contagem da onda, e o teste 7 usa um atalho que encerra a partida como vitória.

## Limitações conhecidas

- **As 10 ondas nunca foram jogadas até o fim.** No navegador foram jogadas a onda 1 inteira e o começo da 2. A sequência até a vitória só está coberta nos testes unitários do `WaveSystem`, e o equilíbrio das ondas finais não foi experimentado.
- **Os sons não foram ouvidos.** O áudio é sintetizado e o código roda sem erro, mas ninguém avaliou como soa. Não há música.
- **Tiros são horizontais.** Do alto da colina eles passam por cima de inimigos que estão mais abaixo.
- **Recuperação de inimigo preso e salto alto contra herói inalcançável** estão implementados, mas sem teste automatizado.
- **Sem toque.** Só teclado e mouse; não há controles para celular.
- **Não há reparo de peças.** Para restaurar uma peça danificada é preciso demolir e reconstruir.
- **Uma arena só**, e sem salvamento no meio da partida. Ficam salvos configurações, recorde e estatísticas.
- **Pacote de produção de cerca de 1,3 MB** (343 KB comprimido), quase todo do Phaser.
- **Testado apenas no Chrome.**
