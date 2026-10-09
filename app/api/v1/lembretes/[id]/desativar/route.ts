import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaDesativarLembrete } from '@/servidor/api/rotas/rotasLembretes';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaDesativarLembrete,
});
