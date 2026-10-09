import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaMoverAtividade } from '@/servidor/api/rotas/rotasAtividades';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaMoverAtividade,
});
