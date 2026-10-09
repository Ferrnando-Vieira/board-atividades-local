import { eq } from 'drizzle-orm';
import type { PermissaoApiOferecida } from '@/config/constantes';
import type { BancoDados } from '@/servidor/banco/conexao';
import {
  administrador,
  anexos,
  ID_REGISTRO_UNICO,
  solicitantes,
  tags,
} from '@/servidor/banco/esquema';
import {
  arquivarAtividade,
  criarAtividade,
} from '@/servidor/atividades/atividadesServico';
import type { DadosNovoLink } from '@/servidor/compartilhamento/esquemasCompartilhamento';
import {
  criarLinkCompartilhamento,
  type LinkCriado,
} from '@/servidor/compartilhamento/linksServico';
import { criarTokenApi } from '@/servidor/tokensApi/tokensApiServico';
import { gerarChaveNormalizada } from '@/util/NormalizacaoUtils';
import {
  AGORA_TESTE,
  exigirStatusPorChave,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';

export const USUARIO_ADMINISTRADOR_TESTE = 'proprietario';

export function cadastrarAdministrador(banco: BancoDados): void {
  banco
    .insert(administrador)
    .values({
      id: ID_REGISTRO_UNICO,
      usuario: USUARIO_ADMINISTRADOR_TESTE,
      hashSenha: 'scrypt$hash-de-teste',
      senhaAlteradaEm: AGORA_TESTE.toISOString(),
    })
    .run();
}

function exigirId(
  banco: BancoDados,
  tabela: typeof tags | typeof solicitantes,
  nome: string,
): number {
  const registro = banco
    .select({ id: tabela.id })
    .from(tabela)
    .where(eq(tabela.nomeNormalizado, gerarChaveNormalizada(nome)))
    .get();
  if (!registro) {
    throw new Error(`"${nome}" ausente no banco de teste.`);
  }
  return registro.id;
}

export function exigirIdTag(banco: BancoDados, nome: string): number {
  return exigirId(banco, tags, nome);
}

export function exigirIdSolicitante(banco: BancoDados, nome: string): number {
  return exigirId(banco, solicitantes, nome);
}

export function criarLinkDeTeste(
  banco: BancoDados,
  sobrescritas: Partial<DadosNovoLink> = {},
  agora: Date = AGORA_TESTE,
): LinkCriado {
  return criarLinkCompartilhamento(
    banco,
    {
      nome: 'Link de teste',
      modalidade: 'restrito',
      tagIds: [],
      solicitanteIds: [],
      incluirArquivadas: false,
      validadeDias: null,
      animal: null,
      ...sobrescritas,
    },
    agora,
  );
}

export function criarTokenApiDeTeste(
  banco: BancoDados,
  permissoes: readonly PermissaoApiOferecida[],
  agora: Date = AGORA_TESTE,
): string {
  return criarTokenApi(
    banco,
    {
      nome: 'Agente de teste',
      permissoes: [...permissoes],
      validadeDias: null,
    },
    agora,
  ).token;
}

// Cenário fixo para escopo: tags e solicitantes cruzados, uma atividade sem
// tags e uma arquivada dentro do escopo "Faturas + Financeiro".
export const TITULOS_CENARIO = {
  faturasFinanceiro: 'Conferir faturas do financeiro',
  faturasBugsEu: 'Corrigir bug de faturas',
  bugsFinanceiro: 'Bug no relatório financeiro',
  semTagsFinanceiro: 'Planilha sem etiqueta',
  outrosEu: 'Reunião sigilosa da diretoria',
  arquivadaFaturasFinanceiro: 'Fatura antiga arquivada',
} as const;

export type CenarioEscopo = Record<keyof typeof TITULOS_CENARIO, number>;

export function criarCenarioEscopo(banco: BancoDados): CenarioEscopo {
  const aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
  const criar = (
    titulo: string,
    solicitante: string,
    tagsAtividade: string[],
  ) =>
    criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, {
        titulo,
        solicitante,
        tags: tagsAtividade,
        descricao: `Descrição de ${titulo}`,
      }),
      AGORA_TESTE,
    ).atividadeId;
  const cenario: CenarioEscopo = {
    faturasFinanceiro: criar(TITULOS_CENARIO.faturasFinanceiro, 'Financeiro', [
      'Faturas',
    ]),
    faturasBugsEu: criar(TITULOS_CENARIO.faturasBugsEu, 'Eu', [
      'Faturas',
      'Bugs',
    ]),
    bugsFinanceiro: criar(TITULOS_CENARIO.bugsFinanceiro, 'Financeiro', [
      'Bugs',
    ]),
    semTagsFinanceiro: criar(
      TITULOS_CENARIO.semTagsFinanceiro,
      'Financeiro',
      [],
    ),
    outrosEu: criar(TITULOS_CENARIO.outrosEu, 'Eu', ['Diretoria']),
    arquivadaFaturasFinanceiro: criar(
      TITULOS_CENARIO.arquivadaFaturasFinanceiro,
      'Financeiro',
      ['Faturas'],
    ),
  };
  arquivarAtividade(
    banco,
    { atividadeId: cenario.arquivadaFaturasFinanceiro, versaoEsperada: 1 },
    AGORA_TESTE,
  );
  return cenario;
}

export function inserirAnexo(
  banco: BancoDados,
  atividadeId: number,
  identificadorArquivo: string,
  nomeOriginal = 'relatorio.pdf',
  tamanhoBytes = 4,
): number {
  return banco
    .insert(anexos)
    .values({
      atividadeId,
      identificadorArquivo,
      nomeOriginal,
      tipoConteudo: 'application/pdf',
      tamanhoBytes,
      hashSha256: 'a'.repeat(64),
    })
    .returning({ id: anexos.id })
    .get().id;
}
