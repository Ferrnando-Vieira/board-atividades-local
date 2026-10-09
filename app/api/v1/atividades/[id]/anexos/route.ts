import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaEnviarAnexos,
  rotaListarAnexos,
} from '@/servidor/api/rotas/rotasAnexos';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaListarAnexos,
  POST: rotaEnviarAnexos,
});
