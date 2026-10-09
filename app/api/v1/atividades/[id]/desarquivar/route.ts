import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaDesarquivarAtividade } from '@/servidor/api/rotas/rotasAtividades';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaDesarquivarAtividade,
});
