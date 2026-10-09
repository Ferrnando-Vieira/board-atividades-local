import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaCriarStatus,
  rotaListarStatus,
} from '@/servidor/api/rotas/rotasStatus';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaListarStatus,
  POST: rotaCriarStatus,
});
