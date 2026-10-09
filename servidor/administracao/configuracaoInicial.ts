import { eq, sql } from 'drizzle-orm';
import { CODIGO_CONFIGURACAO_INICIAL } from '@/config/constantesSeguranca';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import {
  administrador,
  codigoConfiguracaoInicial,
  ID_REGISTRO_UNICO,
} from '@/servidor/banco/esquema';
import type { DadosConfiguracaoInicial } from '@/servidor/administracao/esquemasAdministracao';
import { mensagensAdministracao } from '@/servidor/administracao/mensagensAdministracao';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { definirSolicitantePadrao } from '@/servidor/classificacao/classificacaoRepositorio';
import { gerarHashSenha } from '@/servidor/seguranca/senha';
import {
  calcularHashToken,
  gerarCodigoLegivel,
  hashesIguais,
  normalizarCodigoLegivel,
} from '@/servidor/seguranca/tokens';
import { somarMinutos } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

export type CodigoEmitido = {
  codigo: string;
  expiraEm: string;
};

type FalhaCodigo =
  | 'configuracao-concluida'
  | 'codigo-ausente'
  | 'codigo-expirado'
  | 'codigo-bloqueado'
  | 'codigo-invalido';

type ResultadoVerificacaoCodigo =
  { valido: true } | { valido: false; falha: FalhaCodigo };

const DETALHES_FALHA: Record<
  FalhaCodigo,
  { mensagem: string; status: number }
> = {
  'configuracao-concluida': {
    mensagem: mensagensAdministracao.configuracaoJaConcluida,
    status: STATUS_ERRO.CONFLITO,
  },
  'codigo-ausente': {
    mensagem: mensagensAdministracao.codigoAusente,
    status: STATUS_ERRO.PROIBIDO,
  },
  'codigo-expirado': {
    mensagem: mensagensAdministracao.codigoExpirado,
    status: STATUS_ERRO.PROIBIDO,
  },
  'codigo-bloqueado': {
    mensagem: mensagensAdministracao.codigoBloqueado,
    status: STATUS_ERRO.PROIBIDO,
  },
  'codigo-invalido': {
    mensagem: mensagensAdministracao.codigoInvalido,
    status: STATUS_ERRO.PROIBIDO,
  },
};

export function existeAdministrador(executor: ExecutorBanco): boolean {
  return (
    executor
      .select({ id: administrador.id })
      .from(administrador)
      .where(eq(administrador.id, ID_REGISTRO_UNICO))
      .get() !== undefined
  );
}

// Emitir de novo substitui o código anterior, que deixa de valer.
export function emitirCodigoConfiguracao(
  banco: BancoDados,
  agora: Date = new Date(),
): CodigoEmitido {
  return banco.transaction(
    (transacao) => {
      if (existeAdministrador(transacao)) {
        throw criarErroFalha('configuracao-concluida');
      }
      const codigo = gerarCodigoLegivel();
      const valores = {
        hashCodigo: calcularHashToken(codigo),
        expiraEm: somarMinutos(
          agora,
          CODIGO_CONFIGURACAO_INICIAL.VALIDADE_MINUTOS,
        ).toISOString(),
        tentativasFalhas: 0,
        criadoEm: agora.toISOString(),
      };
      transacao
        .insert(codigoConfiguracaoInicial)
        .values({ id: ID_REGISTRO_UNICO, ...valores })
        .onConflictDoUpdate({
          target: codigoConfiguracaoInicial.id,
          set: valores,
        })
        .run();
      return { codigo, expiraEm: valores.expiraEm };
    },
    { behavior: 'immediate' },
  );
}

function descartarCodigo(executor: ExecutorBanco): void {
  executor
    .delete(codigoConfiguracaoInicial)
    .where(eq(codigoConfiguracaoInicial.id, ID_REGISTRO_UNICO))
    .run();
}

function registrarTentativaIncorreta(
  executor: ExecutorBanco,
): ResultadoVerificacaoCodigo {
  const atualizado = executor
    .update(codigoConfiguracaoInicial)
    .set({
      tentativasFalhas: sql`${codigoConfiguracaoInicial.tentativasFalhas} + 1`,
    })
    .where(eq(codigoConfiguracaoInicial.id, ID_REGISTRO_UNICO))
    .returning({ tentativas: codigoConfiguracaoInicial.tentativasFalhas })
    .get();
  if (
    atualizado &&
    atualizado.tentativas >= CODIGO_CONFIGURACAO_INICIAL.TENTATIVAS_MAXIMAS
  ) {
    descartarCodigo(executor);
    return { valido: false, falha: 'codigo-bloqueado' };
  }
  return { valido: false, falha: 'codigo-invalido' };
}

// Retorna o resultado em vez de lançar: lançar dentro da transação desfaria o
// incremento de tentativas incorretas, que precisa persistir.
function verificarCodigo(
  executor: ExecutorBanco,
  hashInformado: string,
  agora: Date,
): ResultadoVerificacaoCodigo {
  if (existeAdministrador(executor)) {
    return { valido: false, falha: 'configuracao-concluida' };
  }
  const registro = executor
    .select()
    .from(codigoConfiguracaoInicial)
    .where(eq(codigoConfiguracaoInicial.id, ID_REGISTRO_UNICO))
    .get();
  if (!registro) {
    return { valido: false, falha: 'codigo-ausente' };
  }
  if (registro.expiraEm <= agora.toISOString()) {
    descartarCodigo(executor);
    return { valido: false, falha: 'codigo-expirado' };
  }
  if (hashesIguais(registro.hashCodigo, hashInformado)) {
    return { valido: true };
  }
  return registrarTentativaIncorreta(executor);
}

function criarErroFalha(falha: FalhaCodigo): ErroApp {
  const { mensagem, status } = DETALHES_FALHA[falha];
  return new ErroApp(mensagem, { status, codigo: falha });
}

function exigirCodigoValido(
  banco: BancoDados,
  hashInformado: string,
  agora: Date,
): void {
  const verificacao = banco.transaction(
    (transacao) => verificarCodigo(transacao, hashInformado, agora),
    { behavior: 'immediate' },
  );
  if (!verificacao.valido) {
    throw criarErroFalha(verificacao.falha);
  }
}

// O código é conferido antes do scrypt (custo alto) e de novo na transação
// final, que cria o administrador, define o solicitante padrão do board e
// consome o código de forma atômica.
export async function concluirConfiguracaoInicial(
  banco: BancoDados,
  dados: DadosConfiguracaoInicial,
  agora: Date = new Date(),
): Promise<void> {
  const hashInformado = calcularHashToken(
    normalizarCodigoLegivel(dados.codigo),
  );
  exigirCodigoValido(banco, hashInformado, agora);
  const hashSenha = await gerarHashSenha(dados.senha);
  const resultado = banco.transaction(
    (transacao) => {
      const verificacao = verificarCodigo(transacao, hashInformado, agora);
      if (!verificacao.valido) {
        return verificacao;
      }
      transacao
        .insert(administrador)
        .values({
          id: ID_REGISTRO_UNICO,
          usuario: dados.usuario,
          hashSenha,
          senhaAlteradaEm: agora.toISOString(),
        })
        .run();
      definirSolicitantePadrao(
        transacao,
        exigirBoardPadrao(transacao).id,
        dados.solicitantePadrao,
      );
      descartarCodigo(transacao);
      return verificacao;
    },
    { behavior: 'immediate' },
  );
  if (!resultado.valido) {
    throw criarErroFalha(resultado.falha);
  }
}
