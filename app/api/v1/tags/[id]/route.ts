import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaExcluirTag,
  rotaEditarTag,
} from '@/servidor/api/rotas/rotasClassificacao';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  PATCH: rotaEditarTag,
  DELETE: rotaExcluirTag,
});
