import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type { TagResumo } from '@/servidor/classificacao/consultasClassificacao';
import { montarEstiloTag } from '@/util/AparenciaUtils';

type PropriedadesListaTags = {
  tags: readonly TagResumo[];
  exibirVazio?: boolean;
};

export default function ListaTags({
  tags,
  exibirVazio = false,
}: PropriedadesListaTags) {
  if (tags.length === 0) {
    return exibirVazio ? (
      <p className="text-sm text-texto-suave">{textosAtividades.semTags}</p>
    ) : null;
  }
  return (
    <ul
      aria-label={textosAtividades.rotuloTags}
      className="flex flex-wrap gap-1"
    >
      {tags.map((tag) => (
        <li
          key={tag.id}
          className="rounded-full border border-borda bg-fundo px-2 py-0.5 text-xs font-medium text-texto-suave"
          style={montarEstiloTag(tag.cor)}
        >
          {tag.nome}
        </li>
      ))}
    </ul>
  );
}
