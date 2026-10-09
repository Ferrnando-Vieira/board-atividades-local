import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaAtualizarLembrete,
  rotaExcluirLembrete,
  rotaLerLembrete,
} from '@/servidor/api/rotas/rotasLembretes';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaLerLembrete,
  PATCH: rotaAtualizarLembrete,
  DELETE: rotaExcluirLembrete,
});
