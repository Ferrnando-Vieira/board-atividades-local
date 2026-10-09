import { Suspense } from 'react';
import Carregando from '@/components/ui/Carregando';
import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaQuadro from '@/screens/board/TelaQuadro';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

// A sessão é conferida antes de qualquer limite de Suspense: assim o
// redirecionamento sai como 307 no cabeçalho, e não como meta-refresh depois
// que o shell da página já foi enviado.
export default async function PaginaInicial({ searchParams }: PageProps<'/'>) {
  const acesso = await obterAcessoAdministrativo();
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="quadro" layout="tela-cheia">
      <Suspense fallback={<Carregando />}>
        <TelaQuadro acesso={acesso} aviso={lerAviso(aviso)} />
      </Suspense>
    </EstruturaPainel>
  );
}
