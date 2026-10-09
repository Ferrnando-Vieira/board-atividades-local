import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaAtualizarAtividade,
  rotaLerAtividade,
} from '@/servidor/api/rotas/rotasAtividades';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaLerAtividade,
  PATCH: rotaAtualizarAtividade,
});
