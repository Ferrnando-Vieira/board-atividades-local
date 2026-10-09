import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaCriarTag,
  rotaListarTags,
} from '@/servidor/api/rotas/rotasClassificacao';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaListarTags,
  POST: rotaCriarTag,
});
