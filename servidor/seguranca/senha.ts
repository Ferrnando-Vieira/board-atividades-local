import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Parâmetros da recomendação OWASP para scrypt (N=2^16, r=8, p=2): ~64 MiB por
// cálculo, equivalente em custo a N=2^17/p=1 com metade da memória de pico.
const PARAMETROS_ATUAIS = { custo: 2 ** 16, tamanhoBloco: 8, paralelismo: 2 };
const TAMANHO_SAL_BYTES = 16;
const TAMANHO_CHAVE_BYTES = 32;
const FATOR_MEMORIA_SCRYPT = 128;
const MARGEM_MEMORIA = 2;
const PREFIXO_ALGORITMO = 'scrypt';
const FORMATO_HASH =
  /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

type ParametrosScrypt = typeof PARAMETROS_ATUAIS;

type HashDecomposto = {
  parametros: ParametrosScrypt;
  sal: Buffer;
  chave: Buffer;
};

// Cada derivação reserva ~64 MiB; sem limite, uma rajada de tentativas de
// login na rede esgotaria a memória do host.
const LIMITE_DERIVACOES_SIMULTANEAS = 2;
let derivacoesEmAndamento = 0;
const derivacoesAguardando: Array<() => void> = [];

async function executarComLimite<T>(tarefa: () => Promise<T>): Promise<T> {
  while (derivacoesEmAndamento >= LIMITE_DERIVACOES_SIMULTANEAS) {
    await new Promise<void>((liberar) => derivacoesAguardando.push(liberar));
  }
  derivacoesEmAndamento += 1;
  try {
    return await tarefa();
  } finally {
    derivacoesEmAndamento -= 1;
    derivacoesAguardando.shift()?.();
  }
}

function calcularMemoriaMaxima(parametros: ParametrosScrypt): number {
  return (
    FATOR_MEMORIA_SCRYPT *
    parametros.custo *
    parametros.tamanhoBloco *
    MARGEM_MEMORIA
  );
}

// NFKC evita que a mesma senha digitada em teclados diferentes (ex.: acento
// composto x pré-composto) produza bytes distintos.
function derivarChave(
  senha: string,
  sal: Buffer,
  parametros: ParametrosScrypt,
): Promise<Buffer> {
  return executarComLimite(
    () =>
      new Promise<Buffer>((resolver, rejeitar) => {
        scrypt(
          senha.normalize('NFKC'),
          sal,
          TAMANHO_CHAVE_BYTES,
          {
            N: parametros.custo,
            r: parametros.tamanhoBloco,
            p: parametros.paralelismo,
            maxmem: calcularMemoriaMaxima(parametros),
          },
          (erro, chave) => (erro ? rejeitar(erro) : resolver(chave)),
        );
      }),
  );
}

function decomporHash(hashArmazenado: string): HashDecomposto | null {
  const partes = FORMATO_HASH.exec(hashArmazenado);
  if (!partes) {
    return null;
  }
  const [, custo, tamanhoBloco, paralelismo, sal, chave] = partes;
  return {
    parametros: {
      custo: Number(custo),
      tamanhoBloco: Number(tamanhoBloco),
      paralelismo: Number(paralelismo),
    },
    sal: Buffer.from(sal ?? '', 'base64url'),
    chave: Buffer.from(chave ?? '', 'base64url'),
  };
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL_BYTES);
  const chave = await derivarChave(senha, sal, PARAMETROS_ATUAIS);
  const { custo, tamanhoBloco, paralelismo } = PARAMETROS_ATUAIS;
  return `${PREFIXO_ALGORITMO}$N=${custo},r=${tamanhoBloco},p=${paralelismo}$${sal.toString('base64url')}$${chave.toString('base64url')}`;
}

export async function verificarSenha(
  senha: string,
  hashArmazenado: string,
): Promise<boolean> {
  const decomposto = decomporHash(hashArmazenado);
  if (!decomposto || decomposto.chave.length !== TAMANHO_CHAVE_BYTES) {
    return false;
  }
  const chaveCalculada = await derivarChave(
    senha,
    decomposto.sal,
    decomposto.parametros,
  );
  return timingSafeEqual(chaveCalculada, decomposto.chave);
}

export function precisaRecalcularHash(hashArmazenado: string): boolean {
  const decomposto = decomporHash(hashArmazenado);
  if (!decomposto) {
    return true;
  }
  const { custo, tamanhoBloco, paralelismo } = decomposto.parametros;
  return (
    custo !== PARAMETROS_ATUAIS.custo ||
    tamanhoBloco !== PARAMETROS_ATUAIS.tamanhoBloco ||
    paralelismo !== PARAMETROS_ATUAIS.paralelismo
  );
}
