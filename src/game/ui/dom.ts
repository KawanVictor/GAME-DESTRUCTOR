/** Busca um elemento obrigatório do index.html. */
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

export function show(node: HTMLElement, visible: boolean): void {
  node.classList.toggle('hidden', !visible);
}

/**
 * Registra um clique que não "vaza" para o jogo: tira o foco do botão
 * (senão Espaço/Enter o acionariam de novo durante a partida).
 */
export function onClick(node: HTMLElement, signal: AbortSignal, handler: () => void): void {
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).blur();
    handler();
  }, { signal });
}
