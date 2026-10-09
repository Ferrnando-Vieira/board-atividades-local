import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { combinarClasses } from '@/util/ClassesUtils';
import {
  obterNivelPrioridade,
  type NivelPrioridade,
} from '@/util/PrioridadeUtils';

// As cores de cada nível vêm do proprietário (Aparência) como variáveis CSS,
// com o texto já escolhido pelo contraste. Além da cor, cada nível tem ícone
// próprio e o número continua visível, então a prioridade não depende de
// enxergar cores.
const APARENCIA_NIVEL: Record<
  NivelPrioridade,
  { classes: string; icone: string | null }
> = {
  critica: {
    classes:
      'border-black/10 bg-(--cor-prioridade-critica) text-(--texto-prioridade-critica)',
    icone: '‼',
  },
  alta: {
    classes:
      'border-black/10 bg-(--cor-prioridade-alta) text-(--texto-prioridade-alta)',
    icone: '!',
  },
  media: {
    classes:
      'border-black/10 bg-(--cor-prioridade-media) text-(--texto-prioridade-media)',
    icone: null,
  },
  baixa: {
    classes:
      'border-dashed border-texto/30 bg-(--cor-prioridade-baixa) text-(--texto-prioridade-baixa)',
    icone: '↓',
  },
};

type PropriedadesIndicadorPrioridade = {
  prioridade: number;
  detalhado?: boolean;
};

export default function IndicadorPrioridade({
  prioridade,
  detalhado = false,
}: PropriedadesIndicadorPrioridade) {
  const nivel = obterNivelPrioridade(prioridade);
  const aparencia = APARENCIA_NIVEL[nivel];
  const descricao = textosAtividades.descreverPrioridade(prioridade);
  const descricaoCompleta = textosAtividades.descreverNivelPrioridade(
    descricao,
    textosAtividades.niveisPrioridade[nivel],
  );
  return (
    <span
      title={descricaoCompleta}
      className={combinarClasses(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
        aparencia.classes,
      )}
    >
      {aparencia.icone && <span aria-hidden="true">{aparencia.icone}</span>}
      {detalhado ? (
        descricao
      ) : (
        <>
          <span aria-hidden="true">
            {textosAtividades.rotuloPrioridadeCurto(prioridade)}
          </span>
          <span className="sr-only">{descricaoCompleta}</span>
        </>
      )}
    </span>
  );
}
