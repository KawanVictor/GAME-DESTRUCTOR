# Arte e áudio finais

O jogo gera toda a arte e todos os sons por código. Para trocar qualquer um por um arquivo, coloque o arquivo nesta pasta e registre-o em `manifest.json`. O que não estiver no manifesto continua sendo gerado.

```json
{
  "images": {
    "player": { "file": "player.png", "frameWidth": 48, "frameHeight": 48 },
    "bg-sky": { "file": "ceu.png" }
  },
  "audio": {
    "jump": "pulo.ogg",
    "explode": "explosao.ogg"
  }
}
```

## Imagens

A chave é o nome da textura; o arquivo precisa ter o mesmo tamanho de quadro e a mesma ordem de quadros da arte gerada. Tiras de quadros ficam em uma linha só.

| Chave | Quadro | Quadros (em ordem) |
|---|---|---|
| `player` | 48×48 | 4 parado, 8 correndo, 1 pulo, 1 queda, 4 ataque, 1 dano (19 no total) |
| `enemy-basic` | 44×40 | 4 andando, 1 atacando |
| `enemy-fast` | 48×32 | 4 andando, 1 atacando |
| `enemy-tank` | 68×64 | 4 andando, 1 atacando |
| `enemy-flyer` | 48×34 | 4 voando, 1 atacando |
| `enemy-spitter` | 46×44 | 4 andando, 1 atacando |
| `enemy-boss` | 100×92 | 4 andando, 1 atacando |
| `tiles` | 32×32 | vazio, terreno, rocha-mãe, caixote, plataforma, pedra, parede, explosivo, impulso, espinhos, torreta, terreno com topo |
| `cracks` | 32×32 | rachadura leve, rachadura forte |

Imagens de um quadro só (sem `frameWidth`): `bullet` 18×8, `turret-bullet` 10×10, `enemy-bullet` 12×12, `spark` 8×8, `glow` 64×64, `pickup` 16×16, `turret-head` 34×16, `portal` 56×80, `bg-sky` 960×540, `bg-far` 1024×360, `bg-near` 1024×320.

Todos os personagens são desenhados virados para a direita.

## Sons

Nomes aceitos: `jump`, `land`, `slash`, `shoot`, `hit`, `hurt`, `enemyDie`, `place`, `remove`, `deny`, `break`, `explode`, `pickup`, `turret`, `pad`, `waveStart`, `waveClear`, `victory`, `defeat`, `click`, `upgrade`, `dash`, `spit`.

A música não é substituível por aqui: ela é gerada pelo sequenciador em `src/game/systems/AudioSystem.ts`.
