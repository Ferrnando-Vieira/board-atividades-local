import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaIndice } from '@/servidor/api/rotas/rotasBoard';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaIndice,
});
