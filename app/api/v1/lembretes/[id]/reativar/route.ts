import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaReativarLembrete } from '@/servidor/api/rotas/rotasLembretes';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaReativarLembrete,
});
