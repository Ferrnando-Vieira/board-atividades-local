import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaArquivarAtividade } from '@/servidor/api/rotas/rotasAtividades';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaArquivarAtividade,
});
