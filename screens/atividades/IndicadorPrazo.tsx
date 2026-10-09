import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { combinarClasses } from '@/util/ClassesUtils';
import {
  formatarDataComHoraOpcional,
  type MomentoLocal,
} from '@/util/DataUtils';
import { calcularSituacaoPrazo, type SituacaoPrazo } from '@/util/PrazoUtils';

const CLASSES_SITUACAO: Record<SituacaoPrazo, string> = {
  vencido: 'bg-erro text-white',
  hoje: 'bg-aviso-fundo text-aviso ring-1 ring-aviso/40',
  proximo: 'bg-aviso-fundo text-aviso',
  'no-prazo': 'bg-fundo text-texto-suave',
};

type PropriedadesIndicadorPrazo = {
  prazoData: string | null;
  prazoHora: string | null;
  momentoLocal: MomentoLocal;
  // Em status que conclui a atividade, o prazo deixa de ser cobrado.
  concluida: boolean;
  exibirRotulo?: boolean;
};

export default function IndicadorPrazo({
  prazoData,
  prazoHora,
  momentoLocal,
  concluida,
  exibirRotulo = true,
}: PropriedadesIndicadorPrazo) {
  if (!prazoData) {
    return null;
  }
  const situacao = concluida
    ? null
    : calcularSituacaoPrazo({ prazoData, prazoHora }, momentoLocal);
  const prazo = formatarDataComHoraOpcional(prazoData, prazoHora);
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-texto-suave">
      <span>
        {exibirRotulo ? textosAtividades.descreverPrazo(prazo) : prazo}
      </span>
      {situacao && situacao !== 'no-prazo' && (
        <span
          className={combinarClasses(
            'rounded px-1.5 py-0.5 font-semibold',
            CLASSES_SITUACAO[situacao],
          )}
        >
          {textosAtividades.situacoesPrazo[situacao]}
        </span>
      )}
    </span>
  );
}
