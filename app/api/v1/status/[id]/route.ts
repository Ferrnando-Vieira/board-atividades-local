import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaAtualizarStatus,
  rotaExcluirStatus,
} from '@/servidor/api/rotas/rotasStatus';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  PATCH: rotaAtualizarStatus,
  DELETE: rotaExcluirStatus,
});
