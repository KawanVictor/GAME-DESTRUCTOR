export interface AchievementDef {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_win', name: 'Sobrevivente', description: 'Vencer as 10 ondas em qualquer modo.' },
  { id: 'titan_slayer', name: 'Derrubador de gigantes', description: 'Derrotar o Titã.' },
  { id: 'flawless_titan', name: 'Intocável', description: 'Vencer uma onda de chefe sem tomar dano.' },
  { id: 'core_keeper', name: 'Guardião', description: 'Vencer no modo Defender o núcleo.' },
  { id: 'builder_win', name: 'Engenheiro', description: 'Vencer no modo Só construtor.' },
  { id: 'no_turrets', name: 'Na raça', description: 'Vencer sem construir torretas nem canhões.' },
  { id: 'architect', name: 'Arquiteto', description: 'Construir 40 peças em uma partida.' },
  { id: 'chain_reaction', name: 'Reação em cadeia', description: 'Derrotar 4 inimigos com uma única explosão.' },
  { id: 'into_the_abyss', name: 'Lá embaixo', description: 'Derrubar 8 inimigos no abismo da Ponte.' },
  { id: 'night_owl', name: 'Coruja', description: 'Vencer na arena Noite.' },
  { id: 'daily_5', name: 'Desafiante', description: 'Chegar à onda 5 em um desafio diário.' },
  { id: 'saboteur_hunter', name: 'Contrassabotagem', description: 'Derrotar 10 Sabotadores em uma partida.' },
];
