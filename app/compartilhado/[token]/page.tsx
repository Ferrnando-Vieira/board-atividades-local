import { Suspense } from 'react';
import Carregando from '@/components/ui/Carregando';
import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaQuadro from '@/screens/board/TelaQuadro';
import { exigirAcessoCompartilhado } from '@/servidor/web/acessoPainel';

// O token é conferido a cada requisição, antes do Suspense: link revogado ou
// expirado responde 307 para a página de indisponível sem enviar o quadro.
export default async function PaginaQuadroCompartilhado({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]'>) {
  const acesso = await exigirAcessoCompartilhado((await params).token);
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="quadro" layout="tela-cheia">
      <Suspense fallback={<Carregando />}>
        <TelaQuadro acesso={acesso} aviso={lerAviso(aviso)} />
      </Suspense>
    </EstruturaPainel>
  );
}
