import type { ModalidadeCompartilhamento } from '@/config/constantes';
import type { SituacaoValidade } from '@/servidor/seguranca/tokens';

export const textosCompartilhamento = {
  botaoAbrir: 'Compartilhar board',
  titulo: 'Compartilhar board',
  fechar: 'Fechar',
  rotuloEndereco: 'Endereço na rede:',
  descricao:
    'Os links usam o endereço desta máquina na rede local, para abrir nos outros computadores. Quem tiver o link acessa sem senha: envie só para quem deve ver e revogue quando não precisar mais.',
  avisoSomenteLocal:
    'Nenhuma rede local foi detectada (ou o servidor escuta só em 127.0.0.1): os links só abrem neste computador. Para a rede, use HOST=0.0.0.0 no .env.local e reinicie o servidor (README, seção "Acesso pela rede local").',
  tituloNovo: 'Gerar novo link',
  rotuloNome: 'Nome do link',
  dicaNome: 'Para lembrar quem recebeu, por exemplo "Financeiro".',
  legendaModalidade: 'Modalidade',
  modalidades: {
    completo: {
      rotulo: 'Board completo',
      descricao:
        'Vê todas as atividades, inclusive as sem tags e as arquivadas, e pode criar, editar, mover e arquivar atividades e gerenciar status, tags e solicitantes. Não administra links, tokens de API nem a conta.',
    },
    restrito: {
      rotulo: 'Restrito, somente leitura',
      descricao:
        'Vê só as atividades com qualquer uma das tags escolhidas e de qualquer um dos solicitantes escolhidos; um grupo sem escolha não filtra. Não altera nada.',
    },
  } satisfies Record<
    ModalidadeCompartilhamento,
    { rotulo: string; descricao: string }
  >,
  legendaTags: 'Tags (vale qualquer uma)',
  legendaSolicitantes: 'Solicitantes (vale qualquer um)',
  semTags: 'Nenhuma tag cadastrada.',
  semSolicitantes: 'Nenhum solicitante cadastrado.',
  rotuloIncluirArquivadas: 'Incluir as atividades arquivadas do escopo',
  rotuloValidade: 'Validade',
  legendaAnimal: 'Animal de quem abrir o link',
  dicaAnimal:
    'Quem abrir este link aparece para os outros com o nome do link e este animal. Em "Sortear", o animal muda a cada pessoa.',
  animalSorteado: 'Sortear',
  resumoAnimalSorteado: 'Animal sorteado a cada visita',
  resumoAnimal: (nome: string) => `Animal: ${nome}`,
  alterarAnimal: 'Alterar animal',
  botaoSalvarAnimal: 'Salvar animal',
  botaoSalvandoAnimal: 'Salvando…',
  semExpiracao: 'Sem expiração',
  botaoGerar: 'Gerar link',
  botaoGerando: 'Gerando…',
  rotuloLinkGerado: 'Link gerado',
  botaoCopiar: 'Copiar link',
  avisoCopiado: 'Link copiado para a área de transferência.',
  avisoSelecionado:
    'O link está selecionado: copie com Ctrl+C (no celular, toque e segure).',
  tituloLista: 'Links criados',
  rotuloEnderecoLink: 'Endereço do link',
  editarLink: 'Editar link',
  botaoSalvarLink: 'Salvar alterações',
  botaoSalvandoLink: 'Salvando…',
  manterValidade: (expiraEm: string | null) =>
    expiraEm ? `Manter (expira em ${expiraEm})` : 'Manter (não expira)',
  enderecoIndisponivel:
    'Este link foi criado antes de os endereços poderem ser copiados de novo (ou a chave dos links foi trocada): o endereço atual não pode ser exibido.',
  botaoEnderecoCopiavel: 'Gerar endereço copiável',
  gerandoEnderecoCopiavel: 'Gerando…',
  tituloEnderecoCopiavel: 'Gerar um endereço copiável?',
  descricaoEnderecoCopiavel:
    'O link continua com o mesmo nome e a mesma configuração, mas o endereço atual para de funcionar na mesma hora; envie o novo a quem usa o link.',
  listaVazia: 'Nenhum link criado ainda.',
  situacoes: {
    ativo: 'Ativo',
    expirado: 'Expirado',
  } satisfies Record<SituacaoValidade, string>,
  boardInteiro: 'Board inteiro',
  arquivadasIncluidas: 'com arquivadas',
  arquivadasExcluidas: 'sem arquivadas',
  nuncaAcessado: 'nunca acessado',
  semExpiracaoCurto: 'não expira',
  botaoRevogar: 'Revogar',
  botaoRevogando: 'Revogando…',
  botaoCancelar: 'Cancelar',
  descricaoRevogacao:
    'Quem tiver o endereço perde o acesso na próxima recarga ou ação, e o link sai da lista. Não dá para desfazer: para compartilhar de novo, gere outro link.',
  tituloRevogacao: (nome: string) => `Revogar o link "${nome}"?`,
  descreverTags: (nomes: readonly string[]) => `Tags: ${nomes.join(', ')}`,
  descreverSolicitantes: (nomes: readonly string[]) =>
    `Solicitantes: ${nomes.join(', ')}`,
  descreverCriacao: (momento: string) => `Criado em ${momento}`,
  descreverExpiracao: (momento: string) => `expira em ${momento}`,
  descreverUltimoAcesso: (momento: string) => `último acesso em ${momento}`,
  descreverOpcao: (nome: string, quantidade: number) =>
    `${nome} (${quantidade})`,
  indisponivelTitulo: 'Link indisponível',
  indisponivelDescricao:
    'Este link de compartilhamento não existe, expirou ou foi revogado. Peça um novo link a quem compartilhou o board.',
  tituloLinkPadrao: 'Link de visualização (sem login)',
  descricaoLinkPadrao:
    'Mostra todas as atividades ativas, só para leitura: quem abrir não cria, não edita e não move nada. Funciona em outros dispositivos da mesma rede local enquanto este computador estiver ligado. Ao iniciar o servidor, ele é criado de novo se tiver sido revogado.',
  rotuloLinkPadrao: 'Endereço do link de visualização',
  linkPadraoAusente:
    'O link de visualização não está ativo (foi revogado ou a chave dele foi trocada).',
  botaoAtivarLinkPadrao: 'Ativar link de visualização',
  ativandoLinkPadrao: 'Ativando…',
  botaoRenovarLinkPadrao: 'Gerar novo endereço',
  renovandoLinkPadrao: 'Gerando…',
  tituloRenovacao: 'Gerar um novo endereço?',
  descricaoRenovacao:
    'O endereço atual para de funcionar na mesma hora; quem o tem precisará do novo.',
  linkPadraoRotulo: 'Padrão',
  descricaoEscopoPadrao: 'Board inteiro, somente leitura, sem arquivadas',
} as const;

export function descreverValidade(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
