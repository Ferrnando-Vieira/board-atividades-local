import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaReativarLembreteAtividade } from '@/servidor/api/rotas/rotasLembretesAtividade';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaReativarLembreteAtividade,
});
