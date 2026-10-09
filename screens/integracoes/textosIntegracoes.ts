import type { PermissaoApiOferecida } from '@/config/constantes';
import type { SituacaoCredencial } from '@/servidor/seguranca/tokens';

export const textosIntegracoes = {
  titulo: 'Integrações (API para agentes)',
  descricao:
    'Tokens para Kiro, Claude Code, Cowork e outros agentes usarem a API HTTP local. Integre sempre pela API: editar o arquivo SQLite diretamente não é suportado e pode corromper o board.',
  tituloUso: 'Como usar',
  tituloMcp: 'Conectar agentes (MCP)',
  descricaoMcp:
    'O servidor MCP do board dá ao Claude Code, ao Kiro e a outros agentes ferramentas prontas (listar, criar, mover e arquivar atividades, gerenciar status, tags e lembretes avulsos), usando esta mesma API e um token daqui.',
  passosMcp: [
    'Gere abaixo um token com as permissões que o agente pode ter.',
    'No arquivo .env.local do projeto, acrescente a linha BOARD_API_TOKEN=bat_… com o token gerado (o arquivo não vai para o Git). Se o board estiver em outra porta ou máquina, informe também BOARD_API_URL.',
    'Abra o Claude Code na pasta do projeto: o .mcp.json já registra o servidor "board-atividades"; aprove-o quando for perguntado e confira com /mcp.',
  ],
  rotuloMcpJson: '.mcp.json (já incluído no projeto)',
  rotuloMcpOutros:
    'Outros clientes (Kiro, Claude Desktop): configuração com caminhos absolutos',
  rotuloMcpComando: 'Claude Code em qualquer pasta (escopo do usuário)',
  botaoCopiarCodigo: 'Copiar',
  avisoCodigoCopiado: 'Copiado para a área de transferência.',
  avisoCodigoSelecionado: 'Texto selecionado: copie com Ctrl+C.',
  descreverEnderecoBase: (url: string) => `Endereço base: ${url}`,
  instrucaoCabecalho:
    'Envie o token em todas as requisições, no cabeçalho Authorization: Bearer <token>. Comece por GET /api/v1, que mostra as permissões do token e os endpoints.',
  instrucaoDocumentacao:
    'A referência completa, com exemplos, está em docs/api-agentes.md no repositório.',
  tituloNovo: 'Gerar token',
  rotuloNome: 'Nome do token',
  dicaNome: 'Para lembrar quem usa, por exemplo "Kiro no notebook".',
  legendaPermissoes: 'Permissões',
  rotuloValidade: 'Validade',
  semExpiracao: 'Sem expiração',
  botaoGerar: 'Gerar token',
  botaoGerando: 'Gerando…',
  rotuloTokenGerado: 'Token gerado',
  botaoCopiar: 'Copiar token',
  avisoCopiado: 'Token copiado para a área de transferência.',
  avisoSelecionado:
    'O token está selecionado: copie com Ctrl+C (no celular, toque e segure).',
  tituloLista: 'Tokens emitidos',
  listaVazia: 'Nenhum token emitido ainda.',
  tituloEndpoints: 'Endpoints',
  colunaMetodo: 'Método',
  colunaCaminho: 'Caminho',
  colunaPermissao: 'Permissão',
  colunaDescricao: 'Descrição',
  qualquerToken: 'qualquer token válido',
  situacoes: {
    ativo: 'Ativo',
    expirado: 'Expirado',
    revogado: 'Revogado',
  } satisfies Record<SituacaoCredencial, string>,
  permissoes: {
    'board:ler': 'Ler o board: status, tags e solicitantes',
    'board:escrever': 'Gerenciar status, tags e solicitantes',
    'atividades:ler': 'Ler atividades (inclusive busca e arquivadas)',
    'atividades:escrever':
      'Criar, editar, mover, priorizar e arquivar atividades',
    'anexos:ler': 'Listar e ler os anexos das atividades',
    'anexos:escrever':
      'Enviar e remover anexos, inclusive imagens da descrição',
  } satisfies Record<PermissaoApiOferecida, string>,
  nuncaUsado: 'nunca usado',
  semExpiracaoCurto: 'não expira',
  botaoRevogar: 'Revogar',
  botaoRevogando: 'Revogando…',
  botaoCancelar: 'Cancelar',
  descricaoRevogacao:
    'Requisições com este token passam a ser recusadas imediatamente. Não dá para desfazer: gere outro token se precisar.',
  tituloRevogacao: (nome: string) => `Revogar o token "${nome}"?`,
  descreverCriacao: (momento: string) => `Criado em ${momento}`,
  descreverExpiracao: (momento: string) => `expira em ${momento}`,
  descreverUltimoUso: (momento: string) => `último uso em ${momento}`,
  descreverRevogacao: (momento: string) => `revogado em ${momento}`,
  descreverPrefixo: (prefixo: string) => `Começa com ${prefixo}…`,
} as const;
