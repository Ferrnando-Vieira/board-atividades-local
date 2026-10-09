import { useId } from 'react';
import FormularioAcaoLembrete from '@/screens/atividades/FormularioAcaoLembrete';
import FormularioLembrete from '@/screens/atividades/FormularioLembrete';
import { listarOperacoesLembrete } from '@/screens/atividades/descricaoLembrete';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type { DetalheAtividade } from '@/servidor/atividades/consultasAtividades';
import { obterMomentoLocal, type MomentoLocal } from '@/util/DataUtils';

type PropriedadesSecaoLembrete = {
  atividade: DetalheAtividade;
  fusoHorario: string;
  momentoLocal: MomentoLocal;
  agora: Date;
};

// Exibida só ao proprietário e com a atividade ativa; as Server Actions
// conferem a sessão administrativa, a versão e o horário de novo.
export default function SecaoLembrete({
  atividade,
  fusoHorario,
  momentoLocal,
  agora,
}: PropriedadesSecaoLembrete) {
  const idTitulo = useId();
  const lembreteLocal = atividade.lembreteEm
    ? obterMomentoLocal(new Date(atividade.lembreteEm), fusoHorario)
    : null;
  const operacoes = listarOperacoesLembrete(atividade, agora);
  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-3 border-t border-borda pt-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={idTitulo} className="text-sm font-semibold">
          {textosAtividades.tituloSecaoLembrete}
        </h2>
        <p className="text-xs text-texto-suave">
          {textosAtividades.descricaoSecaoLembrete}
        </p>
      </div>
      <FormularioLembrete
        atividadeId={atividade.id}
        versao={atividade.versao}
        lembreteLocal={lembreteLocal}
        dataMinima={momentoLocal.data}
        fusoHorario={fusoHorario}
      />
      {operacoes.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {operacoes.map((operacao) => (
            <FormularioAcaoLembrete
              key={operacao}
              operacao={operacao}
              atividadeId={atividade.id}
              versao={atividade.versao}
            />
          ))}
        </div>
      )}
    </section>
  );
}
