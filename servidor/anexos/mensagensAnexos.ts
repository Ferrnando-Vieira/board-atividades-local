import { LIMITES_ANEXO } from '@/config/anexos';
import { LIMITES_TEXTO } from '@/config/constantes';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';

export const mensagensAnexos = {
  arquivoAusente: 'Escolha um arquivo para anexar.',
  arquivoVazio: 'O arquivo está vazio.',
  arquivoGrande: `O arquivo pode ter no máximo ${formatarTamanhoArquivo(LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES)}.`,
  nomeInvalido:
    'O nome do arquivo é inválido. Renomeie o arquivo e tente novamente.',
  nomeLongo: `O nome do arquivo pode ter no máximo ${LIMITES_TEXTO.NOME_ARQUIVO_ANEXO} caracteres.`,
  tipoNaoPermitido:
    'Tipo de arquivo não permitido. Envie PDF, imagem (PNG, JPG, GIF ou WebP), texto (TXT, CSV ou MD), documento do Office ou LibreOffice, ou ZIP.',
  conteudoIncompativel:
    'O conteúdo do arquivo não corresponde à extensão do nome. Confira se o arquivo não está corrompido ou renomeado.',
  limiteAnexos: `Uma atividade pode ter no máximo ${LIMITES_ANEXO.MAXIMO_POR_ATIVIDADE} anexos, contando as imagens da descrição. Remova algum antes de enviar outro.`,
  arquivosDemais: `Envie no máximo ${LIMITES_ANEXO.MAXIMO_POR_ENVIO} arquivos de cada vez.`,
  envioGrande: `Os arquivos de um envio podem somar no máximo ${formatarTamanhoArquivo(LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES)}. Envie em partes.`,
  imagemNaoPermitida:
    'Só imagens PNG, JPG, GIF ou WebP podem ser coladas na descrição. Anexe os demais arquivos na seção de anexos.',
  anexoInexistente: 'Anexo não encontrado.',
  anexoEnviado: 'Anexo enviado.',
  anexosEnviados: (quantidade: number) => `${quantidade} anexos enviados.`,
  anexoRemovido: 'Anexo removido.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
} as const;
