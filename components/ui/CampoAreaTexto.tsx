import type { TextareaHTMLAttributes } from 'react';
import EstruturaCampo, {
  classesControle,
  descreverCampo,
} from '@/components/ui/EstruturaCampo';

type PropriedadesCampoAreaTexto =
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    id: string;
    rotulo: string;
    dica?: string;
    erros?: string[];
  };

export default function CampoAreaTexto({
  id,
  rotulo,
  dica,
  erros,
  className,
  ...propriedades
}: PropriedadesCampoAreaTexto) {
  const descricao = descreverCampo(id, dica, erros);
  return (
    <EstruturaCampo id={id} rotulo={rotulo} dica={dica} erros={erros}>
      <textarea
        id={id}
        aria-invalid={descricao.possuiErro}
        aria-describedby={descricao.idsDescricao}
        className={classesControle(descricao.possuiErro, className ?? 'py-2')}
        {...propriedades}
      />
    </EstruturaCampo>
  );
}
