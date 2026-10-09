'use client';

import {
  useActionState,
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_FUNDO } from '@/config/camposFormulario';
import { ACEITE_CAMPO_IMAGEM_FUNDO } from '@/config/fundosBoard';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import {
  enviarImagemFundoFormulario,
  removerImagemFundoFormulario,
} from '@/servidor/web/acoes/acoesFundo';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';
import { calcularCorMedia } from '@/util/CorUtils';

type PropriedadesFormularioImagemFundo = {
  // Link nomeado editando a própria aparência; nula no painel do proprietário.
  credencial: string | null;
  // Rota autenticada da imagem em uso (com a versão), ou nulo sem imagem.
  rotaImagemAtual: string | null;
  // Imagem em uso enviada antes de a cor média ser calculada no envio.
  imagemSemCor: boolean;
};

const LADO_AMOSTRA_PX = 32;

// Reduz a imagem a 32×32 num canvas e tira a média: basta para escolher a cor
// do texto sobre as colunas. Qualquer falha (formato, memória) só deixa o
// servidor usar o cálculo de pior caso.
function estimarCorMedia(endereco: string): Promise<string | null> {
  return new Promise((resolver) => {
    const imagem = new Image();
    imagem.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = LADO_AMOSTRA_PX;
        canvas.height = LADO_AMOSTRA_PX;
        const contexto = canvas.getContext('2d');
        if (!contexto) {
          resolver(null);
          return;
        }
        contexto.drawImage(imagem, 0, 0, LADO_AMOSTRA_PX, LADO_AMOSTRA_PX);
        resolver(
          calcularCorMedia(
            contexto.getImageData(0, 0, LADO_AMOSTRA_PX, LADO_AMOSTRA_PX).data,
          ),
        );
      } catch {
        resolver(null);
      }
    };
    imagem.onerror = () => resolver(null);
    imagem.src = endereco;
  });
}

// A prévia usa o mesmo enquadramento do board (cobre e centraliza); o
// endereço é um blob local criado pelo navegador para o arquivo escolhido.
function montarEstiloPrevia(endereco: string): CSSProperties {
  return {
    backgroundImage: `url("${endereco}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

function FormularioRemocaoImagem({
  credencial,
}: {
  credencial: string | null;
}) {
  const [estado, acao, removendo] = useActionState(
    removerImagemFundoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoNaTentativa, setDialogoNaTentativa] = useState<number | null>(
    null,
  );
  return (
    <form action={acao} className="flex flex-col gap-2">
      <CampoCredencial credencial={credencial} />
      <div>
        <Botao
          variante="secundario"
          onClick={() => setDialogoNaTentativa(estado.tentativa)}
          disabled={removendo}
        >
          {removendo ? textos.removendoImagem : textos.botaoRemoverImagem}
        </Botao>
      </div>
      <DialogoConfirmacao
        aberto={dialogoNaTentativa === estado.tentativa}
        titulo={textos.tituloRemocaoImagem}
        rotuloConfirmar={textos.botaoRemoverImagem}
        rotuloConfirmando={textos.removendoImagem}
        rotuloCancelar={textos.cancelar}
        pendente={removendo}
        aoCancelar={() => setDialogoNaTentativa(null)}
      >
        <p>{textos.confirmarRemocaoImagem}</p>
      </DialogoConfirmacao>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
    </form>
  );
}

export default function FormularioImagemFundo({
  credencial,
  rotaImagemAtual,
  imagemSemCor,
}: PropriedadesFormularioImagemFundo) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [corMedia, setCorMedia] = useState<string | null>(null);
  const [estado, acao, enviando] = useActionState(
    async (
      anterior: EstadoFormularioGestao,
      dados: FormData,
    ): Promise<EstadoFormularioGestao> => {
      const resultado = await enviarImagemFundoFormulario(anterior, dados);
      if (resultado.mensagemSucesso) {
        setPrevia(null);
      }
      return resultado;
    },
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const idArquivo = useId();
  const idDica = useId();

  // O blob da prévia anterior é liberado quando outro arquivo é escolhido ou
  // quando o formulário sai da tela.
  useEffect(() => {
    if (previa === null) {
      return;
    }
    return () => URL.revokeObjectURL(previa);
  }, [previa]);

  function escolherArquivo(evento: ChangeEvent<HTMLInputElement>): void {
    const arquivo = evento.target.files?.[0];
    const endereco = arquivo ? URL.createObjectURL(arquivo) : null;
    setPrevia(endereco);
    setCorMedia(null);
    if (endereco) {
      void estimarCorMedia(endereco).then(setCorMedia);
    }
  }

  const enderecoExibido = previa ?? rotaImagemAtual;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_14rem]">
        <form action={acao} className="flex flex-col gap-3">
          <CampoCredencial credencial={credencial} />
          <div className="flex flex-col gap-1">
            <label htmlFor={idArquivo} className="text-sm font-medium">
              {textos.rotuloArquivoImagem}
            </label>
            <input
              id={idArquivo}
              type="file"
              name={CAMPOS_FUNDO.IMAGEM}
              accept={ACEITE_CAMPO_IMAGEM_FUNDO}
              required
              onChange={escolherArquivo}
              disabled={enviando}
              aria-describedby={idDica}
              className="min-h-11 rounded-xl border border-borda bg-superficie p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primaria-suave file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primaria-escura focus-visible:outline-2 focus-visible:outline-primaria"
            />
            <p id={idDica} className="text-xs text-texto-suave">
              {textos.descricaoImagem}
            </p>
            <input
              type="hidden"
              name={CAMPOS_FUNDO.COR_MEDIA_IMAGEM}
              value={corMedia ?? ''}
            />
          </div>
          {imagemSemCor && previa === null && (
            <MensagemAlerta tipo="aviso">
              {textos.avisoImagemSemCor}
            </MensagemAlerta>
          )}
          {estado.mensagemErro && (
            <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
          )}
          {estado.mensagemSucesso && (
            <MensagemAlerta tipo="sucesso">
              {estado.mensagemSucesso}
            </MensagemAlerta>
          )}
          <div>
            <Botao type="submit" disabled={enviando || previa === null}>
              {enviando ? textos.enviandoImagem : textos.botaoEnviarImagem}
            </Botao>
          </div>
        </form>
        {enderecoExibido && (
          <div
            role="img"
            aria-label={
              previa ? textos.rotuloPreviaImagem : textos.rotuloImagemAtual
            }
            className="h-40 rounded-2xl border border-borda bg-fundo shadow-inner"
            style={montarEstiloPrevia(enderecoExibido)}
          />
        )}
      </div>
      {rotaImagemAtual && <FormularioRemocaoImagem credencial={credencial} />}
    </div>
  );
}
