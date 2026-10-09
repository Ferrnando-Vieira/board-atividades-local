import Link from 'next/link';
import type { ComponentProps } from 'react';
import { obterClassesBotao, type VarianteBotao } from '@/components/ui/Botao';

type PropriedadesLinkBotao = ComponentProps<typeof Link> & {
  variante?: VarianteBotao;
};

export default function LinkBotao({
  variante = 'secundario',
  className,
  ...propriedades
}: PropriedadesLinkBotao) {
  return (
    <Link
      className={obterClassesBotao(variante, className)}
      {...propriedades}
    />
  );
}
