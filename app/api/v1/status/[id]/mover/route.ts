import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaMoverStatus } from '@/servidor/api/rotas/rotasStatus';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  POST: rotaMoverStatus,
});
