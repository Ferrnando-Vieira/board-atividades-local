import type { SelectHTMLAttributes } from 'react';
import EstruturaCampo, {
  classesControle,
  descreverCampo,
} from '@/components/ui/EstruturaCampo';

export type OpcaoSelecao = {
  valor: string;
  rotulo: string;
};

type PropriedadesCampoSelecao = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  rotulo: string;
  opcoes: readonly OpcaoSelecao[];
  dica?: string;
  erros?: string[];
};

export default function CampoSelecao({
  id,
  rotulo,
  opcoes,
  dica,
  erros,
  className,
  ...propriedades
}: PropriedadesCampoSelecao) {
  const descricao = descreverCampo(id, dica, erros);
  return (
    <EstruturaCampo id={id} rotulo={rotulo} dica={dica} erros={erros}>
      <select
        id={id}
        aria-invalid={descricao.possuiErro}
        aria-describedby={descricao.idsDescricao}
        className={classesControle(
          descricao.possuiErro,
          className ?? 'min-h-11',
        )}
        {...propriedades}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </EstruturaCampo>
  );
}
