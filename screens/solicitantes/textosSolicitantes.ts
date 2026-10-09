export const textosSolicitantes = {
  titulo: 'Solicitantes',
  descricao:
    'O solicitante padrão preenche o campo Solicitante das atividades novas e é gravado quando o campo fica em branco, inclusive pela API e pelo MCP. Nomes que só diferem por acento, maiúsculas ou espaços são o mesmo solicitante.',
  tituloPadrao: 'Solicitante padrão',
  rotuloNome: 'Nome',
  dicaNome:
    'Escolha um nome já cadastrado ou digite um novo. O padrão anterior continua cadastrado.',
  botaoSalvar: 'Salvar',
  botaoSalvando: 'Salvando…',
  semPadrao:
    'Este board ainda não tem solicitante padrão: atividades sem solicitante são recusadas até que um seja definido.',
  tituloLista: 'Cadastrados',
  rotuloLista: 'Solicitantes cadastrados',
  vazio:
    'Nenhum solicitante cadastrado. Eles são cadastrados ao salvar uma atividade.',
  seloPadrao: 'Padrão',
  descreverUso: (quantidade: number) =>
    quantidade === 1 ? 'Em 1 atividade' : `Em ${quantidade} atividades`,
} as const;
