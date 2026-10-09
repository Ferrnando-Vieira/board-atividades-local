import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaLerBoard } from '@/servidor/api/rotas/rotasBoard';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaLerBoard,
});
