import BlocoCodigoCopiavel from '@/components/ui/BlocoCodigoCopiavel';
import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Cartao from '@/components/ui/Cartao';
import Icone from '@/components/ui/Icone';
import { obterUrlBaseLan } from '@/config/ambiente';
import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import { PREFIXO_API } from '@/config/rotas';
import FormularioNovoTokenApi from '@/screens/integracoes/FormularioNovoTokenApi';
import ItemTokenApi from '@/screens/integracoes/ItemTokenApi';
import {
  montarComandoClaudeMcpAdd,
  montarConfiguracaoMcpAbsoluta,
  montarMcpJsonDoProjeto,
} from '@/screens/integracoes/configuracaoMcp';
import { textosIntegracoes as textos } from '@/screens/integracoes/textosIntegracoes';
import type { TokenApiExibido } from '@/screens/integracoes/tiposIntegracoes';
import { CATALOGO_API } from '@/servidor/api/catalogoApi';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  listarTokensApi,
  type TokenApiResumo,
} from '@/servidor/tokensApi/tokensApiServico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  formatarInstanteOpcional,
  formatarInstanteParaExibicao,
} from '@/util/DataUtils';

function prepararParaExibicao(
  token: TokenApiResumo,
  fuso: string,
): TokenApiExibido {
  return {
    id: token.id,
    nome: token.nome,
    prefixo: token.prefixo,
    permissoes: token.permissoes,
    criadoEm: formatarInstanteParaExibicao(token.criadoEm, fuso),
    expiraEm: formatarInstanteOpcional(token.expiraEm, fuso),
    ultimoUsoEm: formatarInstanteOpcional(token.ultimoUsoEm, fuso),
    revogadoEm: formatarInstanteOpcional(token.revogadoEm, fuso),
    situacao: token.situacao,
  };
}

export default function TelaIntegracoes() {
  const banco = obterBancoAplicacao();
  const fuso = buscarBoardPadrao(banco)?.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const tokens = listarTokensApi(banco).map((token) =>
    prepararParaExibicao(token, fuso),
  );
  const urlApi = `${obterUrlBaseLan().replace(/\/+$/, '')}${PREFIXO_API}`;
  // O servidor Next roda na raiz do projeto (npm run dev / npm start).
  const raizProjeto = process.cwd();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <CabecalhoPagina titulo={textos.titulo} descricao={textos.descricao} />
      <Cartao className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{textos.tituloUso}</h2>
        <p className="font-mono text-sm break-all">
          {textos.descreverEnderecoBase(urlApi)}
        </p>
        <p className="text-sm">{textos.instrucaoCabecalho}</p>
        <p className="text-sm text-texto-suave">
          {textos.instrucaoDocumentacao}
        </p>
      </Cartao>
      <Cartao className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Icone nome="plugue" className="text-primaria" />
            {textos.tituloMcp}
          </h2>
          <p className="text-sm text-texto-suave">{textos.descricaoMcp}</p>
        </header>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          {textos.passosMcp.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
        <BlocoCodigoCopiavel
          rotulo={textos.rotuloMcpJson}
          codigo={montarMcpJsonDoProjeto()}
          rotuloCopiar={textos.botaoCopiarCodigo}
          avisoCopiado={textos.avisoCodigoCopiado}
          avisoSelecionado={textos.avisoCodigoSelecionado}
        />
        <BlocoCodigoCopiavel
          rotulo={textos.rotuloMcpOutros}
          codigo={montarConfiguracaoMcpAbsoluta(raizProjeto)}
          rotuloCopiar={textos.botaoCopiarCodigo}
          avisoCopiado={textos.avisoCodigoCopiado}
          avisoSelecionado={textos.avisoCodigoSelecionado}
        />
        <BlocoCodigoCopiavel
          rotulo={textos.rotuloMcpComando}
          codigo={montarComandoClaudeMcpAdd(raizProjeto)}
          rotuloCopiar={textos.botaoCopiarCodigo}
          avisoCopiado={textos.avisoCodigoCopiado}
          avisoSelecionado={textos.avisoCodigoSelecionado}
        />
      </Cartao>
      <Cartao>
        <FormularioNovoTokenApi />
      </Cartao>
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{textos.tituloLista}</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-texto-suave">{textos.listaVazia}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {tokens.map((token) => (
              <ItemTokenApi key={token.id} token={token} />
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{textos.tituloEndpoints}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-borda text-xs text-texto-suave">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {textos.colunaMetodo}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {textos.colunaCaminho}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {textos.colunaPermissao}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {textos.colunaDescricao}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {CATALOGO_API.map((endpoint) => (
                <tr key={`${endpoint.metodo} ${endpoint.caminho}`}>
                  <td className="py-2 pr-3 align-top font-mono text-xs">
                    {endpoint.metodo}
                  </td>
                  <td className="py-2 pr-3 align-top font-mono text-xs break-all">
                    {endpoint.caminho}
                  </td>
                  <td className="py-2 pr-3 align-top font-mono text-xs">
                    {endpoint.permissoes.length > 0
                      ? endpoint.permissoes.join(', ')
                      : textos.qualquerToken}
                  </td>
                  <td className="py-2 align-top text-xs">
                    {endpoint.descricao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}
