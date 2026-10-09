import type { CampoHistorico } from '@/config/constantes';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type { EventoHistorico } from '@/servidor/historico/consultasHistorico';
import { formatarDataComHoraOpcional } from '@/util/DataUtils';

const SEPARADOR_DATA_HORA = ' ';
const FORMATO_DATA_HORA = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;

// O nome do link ou do token só aparece para o administrador: quem entra
// por um link vê apenas de onde veio a alteração.
export function descreverAutorEvento(
  evento: Pick<EventoHistorico, 'origem' | 'autor'>,
  exibirAutor: boolean,
): string {
  if (!exibirAutor || evento.autor === null) {
    return textosAtividades.origensHistorico[evento.origem];
  }
  return textosAtividades.autoresHistorico[evento.origem](evento.autor);
}

// Valores gravados como a tela os mostrava; prazo e conclusão ("aaaa-mm-dd"
// com hora opcional) voltam ao formato de data do board.
export function formatarValorHistorico(
  campo: CampoHistorico,
  valor: string | null,
): string {
  if (valor === null || valor === '') {
    return textosAtividades.valorVazioHistorico;
  }
  if (
    (campo === 'prazo' || campo === 'conclusao') &&
    FORMATO_DATA_HORA.test(valor)
  ) {
    const [data = valor, hora = null] = valor.split(SEPARADOR_DATA_HORA);
    return formatarDataComHoraOpcional(data, hora);
  }
  if (campo === 'prioridade' && /^\d$/.test(valor)) {
    return textosAtividades.opcaoPrioridade(Number(valor));
  }
  return valor;
}

// "anexou relatorio.pdf", "removeu o anexo print.png" ou só o verbo.
export function descreverAcaoEvento(
  evento: Pick<EventoHistorico, 'tipo' | 'alteracoes'>,
): string {
  const verbo = textosAtividades.eventosHistorico[evento.tipo];
  const arquivo = evento.alteracoes.find(
    (alteracao) => alteracao.campo === 'anexo',
  );
  const nome = arquivo?.depois ?? arquivo?.antes ?? null;
  return nome === null ? verbo : `${verbo} ${nome}`;
}
