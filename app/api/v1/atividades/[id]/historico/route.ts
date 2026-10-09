import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaLerHistoricoAtividade } from '@/servidor/api/rotas/rotasAtividades';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaLerHistoricoAtividade,
});
