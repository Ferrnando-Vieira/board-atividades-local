import { CATALOGO_API, ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import { esquemaBoardApi, esquemaIndiceApi } from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  respostaApi,
} from '@/servidor/api/manipuladorApi';
import { listarStatusApi } from '@/servidor/api/mapeadoresApi';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';

export const rotaIndice = criarRotaDoEndpoint(
  ENDPOINTS_API.indice,
  ({ token }) =>
    respostaApi(esquemaIndiceApi, {
      versao: 'v1',
      token: {
        nome: token.nome,
        prefixo: token.prefixo,
        permissoes: token.permissoes,
      },
      endpoints: CATALOGO_API.map((endpoint) => ({
        ...endpoint,
        permissoes: [...endpoint.permissoes],
      })),
    }),
);

export const rotaLerBoard = criarRotaDoEndpoint(
  ENDPOINTS_API.lerBoard,
  ({ banco }) => {
    const board = exigirBoardPadrao(banco);
    const status = listarStatusApi(banco, board.id);
    return respostaApi(esquemaBoardApi, {
      nome: board.nome,
      fusoHorario: board.fusoHorario,
      status,
      totais: {
        ativas: status.reduce(
          (total, item) => total + item.quantidadeAtivas,
          0,
        ),
        arquivadas: status.reduce(
          (total, item) => total + item.quantidadeArquivadas,
          0,
        ),
      },
    });
  },
);
