import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaLerAnexo,
  rotaRemoverAnexo,
} from '@/servidor/api/rotas/rotasAnexos';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaLerAnexo,
  DELETE: rotaRemoverAnexo,
});
