'use client';

import { useActionState, useState, useTransition } from 'react';
import Botao from '@/components/ui/Botao';
import CampoFormulario from '@/components/ui/CampoFormulario';
import CampoMarcacao from '@/components/ui/CampoMarcacao';
import CampoSelecao from '@/components/ui/CampoSelecao';
import Cartao from '@/components/ui/Cartao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_STATUS } from '@/config/camposFormulario';
import { LIMITES_TEXTO, VALOR_CAMPO_MARCADO } from '@/config/constantes';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import CamposCoresColuna, {
  type AparenciaPadraoColunas,
} from '@/screens/status/CamposCoresColuna';
import { textosStatus } from '@/screens/status/textosStatus';
import type { StatusGerenciavel } from '@/servidor/board/consultaQuadro';
import {
  editarStatusFormulario,
  excluirStatusFormulario,
  reordenarStatusNoQuadro,
} from '@/servidor/web/acoes/acoesStatus';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { lerValorTexto } from '@/util/FormularioUtils';
import { moverParaPosicao } from '@/util/ListaUtils';

const PASSO_ANTES = -1;
const PASSO_DEPOIS = 1;

type DestinoExclusao = {
  id: number;
  nome: string;
};

type PropriedadesItemStatus = {
  status: StatusGerenciavel;
  indice: number;
  ordemAtual: readonly number[];
  destinos: readonly DestinoExclusao[];
  credencial: string | null;
  aparenciaPadrao: AparenciaPadraoColunas;
};

export default function ItemStatus({
  status,
  indice,
  ordemAtual,
  destinos,
  credencial,
  aparenciaPadrao,
}: PropriedadesItemStatus) {
  const [estadoEdicao, acaoEdicao, salvando] = useActionState(
    editarStatusFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [estadoExclusao, acaoExclusao, excluindo] = useActionState(
    excluirStatusFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  // Guarda em que resposta da exclusão o diálogo foi aberto: qualquer resposta
  // nova (por exemplo, um erro) fecha o diálogo e mostra o resultado na lista.
  const [dialogoAbertoNaTentativa, setDialogoAbertoNaTentativa] = useState<
    number | null
  >(null);
  const [reordenando, iniciarReordenacao] = useTransition();
  const [falhaReordenacao, setFalhaReordenacao] = useState<string | null>(null);
  const quantidadeAtividades =
    status.quantidadeAtivas + status.quantidadeArquivadas;
  const prefixo = `status-${status.id}`;
  const finalizaMarcado = estadoEdicao.valores
    ? lerValorTexto(estadoEdicao.valores, CAMPOS_STATUS.FINALIZA) ===
      VALOR_CAMPO_MARCADO
    : status.finalizaAtividade;

  function mover(passo: number): void {
    setFalhaReordenacao(null);
    iniciarReordenacao(async () => {
      const resultado = await reordenarStatusNoQuadro(
        {
          statusId: status.id,
          ordemNova: moverParaPosicao(ordemAtual, status.id, indice + passo),
        },
        credencial,
      );
      if (!resultado.ok) {
        setFalhaReordenacao(resultado.mensagem);
      }
    });
  }

  return (
    <li>
      <Cartao className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-base font-semibold break-words">{status.nome}</h2>
          <p className="text-xs text-texto-suave">
            {textosStatus.descreverConteudo(
              status.quantidadeAtivas,
              status.quantidadeArquivadas,
            )}
          </p>
        </div>
        <form action={acaoEdicao} noValidate className="flex flex-col gap-3">
          <CampoCredencial credencial={credencial} />
          <input
            type="hidden"
            name={CAMPOS_STATUS.STATUS_ID}
            value={status.id}
          />
          <input
            type="hidden"
            name={CAMPOS_STATUS.VERSAO}
            value={status.versao}
          />
          {estadoEdicao.mensagemErro && (
            <MensagemAlerta tipo="erro">
              {estadoEdicao.mensagemErro}
            </MensagemAlerta>
          )}
          {estadoEdicao.mensagemSucesso && (
            <MensagemAlerta tipo="sucesso">
              {estadoEdicao.mensagemSucesso}
            </MensagemAlerta>
          )}
          <div key={estadoEdicao.tentativa} className="flex flex-col gap-3">
            <CampoFormulario
              id={`${prefixo}-nome`}
              name={CAMPOS_STATUS.NOME}
              rotulo={textosStatus.rotuloNome}
              defaultValue={
                lerValorTexto(estadoEdicao.valores, CAMPOS_STATUS.NOME) ??
                status.nome
              }
              erros={estadoEdicao.errosCampos?.nome}
              maxLength={LIMITES_TEXTO.NOME_STATUS}
              autoComplete="off"
              required
            />
            <CampoMarcacao
              id={`${prefixo}-finaliza`}
              name={CAMPOS_STATUS.FINALIZA}
              value={VALOR_CAMPO_MARCADO}
              rotulo={textosStatus.rotuloFinaliza}
              defaultChecked={finalizaMarcado}
            />
            <CamposCoresColuna
              nomeColuna={status.nome}
              corTitulo={
                estadoEdicao.valores
                  ? lerValorTexto(
                      estadoEdicao.valores,
                      CAMPOS_STATUS.COR_TITULO,
                    ) || null
                  : status.corTitulo
              }
              corColuna={
                estadoEdicao.valores
                  ? lerValorTexto(
                      estadoEdicao.valores,
                      CAMPOS_STATUS.COR_COLUNA,
                    ) || null
                  : status.corColuna
              }
              aparenciaPadrao={aparenciaPadrao}
              erros={estadoEdicao.errosCampos}
            />
          </div>
          <div>
            <Botao type="submit" disabled={salvando}>
              {salvando ? textosStatus.botaoSalvando : textosStatus.botaoSalvar}
            </Botao>
          </div>
        </form>
        <div className="flex flex-col gap-2 border-t border-borda pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Botao
              variante="secundario"
              className="w-auto"
              onClick={() => mover(PASSO_ANTES)}
              disabled={indice === 0 || reordenando}
              aria-label={textosStatus.moverAntes(status.nome)}
            >
              <span aria-hidden="true">←</span>&nbsp;{textosStatus.botaoAntes}
            </Botao>
            <Botao
              variante="secundario"
              className="w-auto"
              onClick={() => mover(PASSO_DEPOIS)}
              disabled={indice === ordemAtual.length - 1 || reordenando}
              aria-label={textosStatus.moverDepois(status.nome)}
            >
              {textosStatus.botaoDepois}&nbsp;<span aria-hidden="true">→</span>
            </Botao>
          </div>
          <form action={acaoExclusao} className="flex flex-col gap-2">
            <CampoCredencial credencial={credencial} />
            <input
              type="hidden"
              name={CAMPOS_STATUS.STATUS_ID}
              value={status.id}
            />
            <input
              type="hidden"
              name={CAMPOS_STATUS.VERSAO}
              value={status.versao}
            />
            <Botao
              variante="perigo"
              onClick={() =>
                setDialogoAbertoNaTentativa(estadoExclusao.tentativa)
              }
              disabled={destinos.length === 0 || excluindo}
              title={destinos.length === 0 ? textosStatus.ultimoStatus : ''}
            >
              {textosStatus.botaoExcluir}
            </Botao>
            <DialogoConfirmacao
              aberto={dialogoAbertoNaTentativa === estadoExclusao.tentativa}
              titulo={textosStatus.tituloExclusao(status.nome)}
              rotuloConfirmar={textosStatus.botaoExcluir}
              rotuloConfirmando={textosStatus.botaoExcluindo}
              rotuloCancelar={textosStatus.botaoCancelar}
              pendente={excluindo}
              aoCancelar={() => setDialogoAbertoNaTentativa(null)}
            >
              {quantidadeAtividades > 0 ? (
                <>
                  <p>
                    {textosStatus.exclusaoComAtividades(quantidadeAtividades)}
                  </p>
                  <CampoSelecao
                    id={`${prefixo}-destino`}
                    name={CAMPOS_STATUS.DESTINO}
                    rotulo={textosStatus.rotuloDestino}
                    opcoes={destinos.map((destino) => ({
                      valor: String(destino.id),
                      rotulo: destino.nome,
                    }))}
                    required
                  />
                </>
              ) : (
                <p>{textosStatus.exclusaoSemAtividades}</p>
              )}
            </DialogoConfirmacao>
          </form>
        </div>
        {reordenando && (
          <p role="status" className="text-xs text-texto-suave">
            {textosStatus.reordenando}
          </p>
        )}
        {falhaReordenacao && (
          <MensagemAlerta tipo="erro">{falhaReordenacao}</MensagemAlerta>
        )}
        {estadoExclusao.mensagemErro && (
          <MensagemAlerta tipo="erro">
            {estadoExclusao.mensagemErro}
          </MensagemAlerta>
        )}
      </Cartao>
    </li>
  );
}
