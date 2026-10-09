import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaCriarLembrete,
  rotaListarLembretes,
} from '@/servidor/api/rotas/rotasLembretes';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaListarLembretes,
  POST: rotaCriarLembrete,
});
