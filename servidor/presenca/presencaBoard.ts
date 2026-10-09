import { createHash } from 'node:crypto';
import { CHAVES_ANIMAIS, type ChaveAnimal } from '@/config/animais';

// Quem está com o board aberto agora. Vive só na memória do processo do
// servidor (o board roda num único processo): reiniciar o servidor zera a
// lista, o que não perde nada, porque cada aba manda sinal a cada poucos
// segundos.
export const PRESENCA = {
  // Sem sinal por mais que isso, o visitante sai da lista.
  VALIDADE_SINAL_MS: 40_000,
  // O mesmo navegador volta com o mesmo animal enquanto a atribuição durar.
  VALIDADE_ATRIBUICAO_MS: 12 * 60 * 60 * 1000,
  // Teto de memória contra sinais forjados em massa.
  MAXIMO_VISITANTES: 500,
  TAMANHO_ID_OPACO: 12,
} as const;

export type TipoPresenca = 'proprietario' | 'link';

export type PresencaExibida = {
  // Derivado do identificador do visitante, que nunca sai do servidor.
  id: string;
  tipo: TipoPresenca;
  animal: ChaveAnimal | null;
  // Nome do link nomeado; null para o proprietário e o link padrão
  // (anônimo, conhecido só pelo animal).
  nome: string | null;
};

export type ResultadoPresenca = {
  voce: PresencaExibida;
  presentes: PresencaExibida[];
};

type Visitante = {
  tipo: TipoPresenca;
  animal: ChaveAnimal;
  nome: string | null;
  ultimoSinal: number;
};

type Atribuicao = {
  animal: ChaveAnimal;
  atribuidaEm: number;
};

export type EstadoPresenca = {
  visitantes: Map<string, Visitante>;
  atribuicoes: Map<string, Atribuicao>;
};

export type IdentidadePresenca = {
  tipo: TipoPresenca;
  nome?: string | null;
  // Animal escolhido para o link: vale sempre, no lugar do sorteado.
  animalFixo?: ChaveAnimal | null;
};

export type Sinal = IdentidadePresenca & {
  visitanteId: string;
  agora: number;
  // Injetável nos testes; no servidor, Math.random.
  sortear?: () => number;
};

export function criarEstadoPresenca(): EstadoPresenca {
  return { visitantes: new Map(), atribuicoes: new Map() };
}

function gerarIdOpaco(visitanteId: string): string {
  return createHash('sha256')
    .update(visitanteId)
    .digest('hex')
    .slice(0, PRESENCA.TAMANHO_ID_OPACO);
}

function removerExpirados(estado: EstadoPresenca, agora: number): void {
  for (const [id, visitante] of estado.visitantes) {
    if (agora - visitante.ultimoSinal > PRESENCA.VALIDADE_SINAL_MS) {
      estado.visitantes.delete(id);
    }
  }
  for (const [id, atribuicao] of estado.atribuicoes) {
    if (agora - atribuicao.atribuidaEm > PRESENCA.VALIDADE_ATRIBUICAO_MS) {
      estado.atribuicoes.delete(id);
    }
  }
}

// Sorteia entre os animais que ninguém presente está usando; só repete um
// animal quando todos já estão em uso.
function escolherAnimal(
  estado: EstadoPresenca,
  sortear: () => number,
): ChaveAnimal {
  const emUso = new Set(
    [...estado.visitantes.values()].map((visitante) => visitante.animal),
  );
  const livres = CHAVES_ANIMAIS.filter((animal) => !emUso.has(animal));
  const candidatos = livres.length > 0 ? livres : CHAVES_ANIMAIS;
  const indice = Math.min(
    candidatos.length - 1,
    Math.floor(sortear() * candidatos.length),
  );
  return candidatos[indice] ?? CHAVES_ANIMAIS[0] ?? 'capivara';
}

// Mapas guardam a ordem de inserção: o mais antigo sai primeiro.
function limitarTamanho<T>(mapa: Map<string, T>): void {
  while (mapa.size > PRESENCA.MAXIMO_VISITANTES) {
    const primeiro = mapa.keys().next().value;
    if (primeiro === undefined) {
      return;
    }
    mapa.delete(primeiro);
  }
}

function exibir(visitanteId: string, visitante: Visitante): PresencaExibida {
  return {
    id: gerarIdOpaco(visitanteId),
    tipo: visitante.tipo,
    // O proprietário aparece como proprietário, não como animal anônimo.
    animal: visitante.tipo === 'proprietario' ? null : visitante.animal,
    nome: visitante.tipo === 'proprietario' ? null : visitante.nome,
  };
}

// O proprietário em várias abas ou aparelhos é uma pessoa só: aparece uma
// vez. Visitantes por link aparecem cada um com seu animal.
export function listarPresentes(
  estado: EstadoPresenca,
  agora: number,
): PresencaExibida[] {
  removerExpirados(estado, agora);
  const presentes: PresencaExibida[] = [];
  let proprietarioIncluido = false;
  for (const [id, visitante] of estado.visitantes) {
    if (visitante.tipo === 'proprietario') {
      if (proprietarioIncluido) {
        continue;
      }
      proprietarioIncluido = true;
    }
    presentes.push(exibir(id, visitante));
  }
  return presentes;
}

export function registrarSinal(
  estado: EstadoPresenca,
  sinal: Sinal,
): ResultadoPresenca {
  removerExpirados(estado, sinal.agora);
  const existente = estado.visitantes.get(sinal.visitanteId);
  const animal =
    sinal.animalFixo ??
    existente?.animal ??
    estado.atribuicoes.get(sinal.visitanteId)?.animal ??
    escolherAnimal(estado, sinal.sortear ?? Math.random);
  const visitante: Visitante = {
    tipo: sinal.tipo,
    animal,
    nome: sinal.nome ?? null,
    ultimoSinal: sinal.agora,
  };
  estado.visitantes.delete(sinal.visitanteId);
  estado.visitantes.set(sinal.visitanteId, visitante);
  estado.atribuicoes.set(sinal.visitanteId, {
    animal,
    atribuidaEm: existente
      ? (estado.atribuicoes.get(sinal.visitanteId)?.atribuidaEm ?? sinal.agora)
      : sinal.agora,
  });
  limitarTamanho(estado.visitantes);
  limitarTamanho(estado.atribuicoes);
  return {
    voce: exibir(sinal.visitanteId, visitante),
    presentes: listarPresentes(estado, sinal.agora),
  };
}

// Aba fechada: sai na hora, sem esperar a validade do sinal. A atribuição
// fica, para o mesmo navegador voltar com o mesmo animal.
export function removerVisitante(
  estado: EstadoPresenca,
  visitanteId: string,
): void {
  estado.visitantes.delete(visitanteId);
}

const CHAVE_GLOBAL_PRESENCA = '__boardAtividadesPresenca';

type GlobalComPresenca = typeof globalThis & {
  [CHAVE_GLOBAL_PRESENCA]?: EstadoPresenca;
};

// `next dev` reavalia módulos a cada edição; em globalThis a lista sobrevive
// às recargas, como a conexão do banco.
export function obterEstadoPresenca(): EstadoPresenca {
  const escopoGlobal = globalThis as GlobalComPresenca;
  escopoGlobal[CHAVE_GLOBAL_PRESENCA] ??= criarEstadoPresenca();
  return escopoGlobal[CHAVE_GLOBAL_PRESENCA];
}
