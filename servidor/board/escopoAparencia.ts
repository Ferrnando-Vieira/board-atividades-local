// Onde a aparência é lida e gravada: a do board (vista pelo proprietário e
// pelo link padrão) ou a própria de um link nomeado, que vale só para quem
// entra por ele.
export type EscopoAparencia =
  { tipo: 'board' } | { tipo: 'link'; linkId: number };

export const ESCOPO_BOARD: EscopoAparencia = { tipo: 'board' };

export function escopoDoLink(linkId: number): EscopoAparencia {
  return { tipo: 'link', linkId };
}
