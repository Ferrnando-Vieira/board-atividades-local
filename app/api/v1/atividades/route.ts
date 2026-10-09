import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaCriarAtividade,
  rotaListarAtividades,
} from '@/servidor/api/rotas/rotasAtividades';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaListarAtividades,
  POST: rotaCriarAtividade,
});
