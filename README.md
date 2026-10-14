# DESTRUCTOR

Um jogo de ação e plataforma 2D em que você constrói o cenário enquanto luta. Levante paredes, espalhe armadilhas, instale torretas e segure as ondas de inimigos do jeito que der.

Roda direto no navegador, para um jogador. Feito com Phaser 3, TypeScript e Vite.

![O Titã, chefe da onda 5, chega com uma Vespa e um Cuspidor enquanto as torretas defendem a colina](docs/screenshots/chefe.png)

| Escolha a arena | Monte suas defesas |
|---|---|
| ![Menu inicial](docs/screenshots/menu.png) | ![Menu de construção aberto, com a prévia de uma peça](docs/screenshots/construcao.png) |

| Segure a onda | Jogue no celular |
|---|---|
| ![Torretas e paredes defendendo a colina](docs/screenshots/combate.png) | ![Botões de toque sobre o jogo](docs/screenshots/toque.png) |

## Bora jogar

Você só precisa do [Node.js](https://nodejs.org) (versão 20.19 ou mais nova).

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

## Licença

[MIT](LICENSE) © 2026 Kawan Victor Cavalcante
