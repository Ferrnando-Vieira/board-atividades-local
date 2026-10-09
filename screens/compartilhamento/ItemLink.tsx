'use client';

import { useActionState, useState } from 'react';
import IconeAnimal from '@/components/animais/IconeAnimal';
import SeletorAnimal from '@/components/animais/SeletorAnimal';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { obterAnimal } from '@/config/animais';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import { textosCompartilhamento as textos } from '@/screens/compartilhamento/textosCompartilhamento';
import type { LinkExibido } from '@/screens/compartilhamento/tiposCompartilhamento';
import type { SituacaoCredencial } from '@/servidor/seguranca/tokens';
import {
  definirAnimalLinkFormulario,
  revogarLinkCompartilhamentoFormulario,
} from '@/servidor/web/acoes/acoesCompartilhamento';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { combinarClasses } from '@/util/ClassesUtils';

const CLASSES_SITUACAO: Record<SituacaoCredencial, string> = {
  ativo: 'bg-sucesso-fundo text-sucesso',
  expirado: 'bg-aviso-fundo text-aviso',
  revogado: 'bg-erro-fundo text-erro',
};

function descreverEscopo(link: LinkExibido): string {
  if (link.padrao) {
    return textos.descricaoEscopoPadrao;
  }
  if (link.modalidade === 'completo') {
    return textos.boardInteiro;
  }
  const partes = [
    link.tags.length > 0 ? textos.descreverTags(link.tags) : null,
    link.solicitantes.length > 0
      ? textos.descreverSolicitantes(link.solicitantes)
      : null,
    link.incluirArquivadas
      ? textos.arquivadasIncluidas
      : textos.arquivadasExcluidas,
  ];
  return partes.filter((parte) => parte !== null).join(' · ');
}

function descreverDatas(link: LinkExibido): string {
  const partes = [
    textos.descreverCriacao(link.criadoEm),
    link.expiraEm
      ? textos.descreverExpiracao(link.expiraEm)
      : textos.semExpiracaoCurto,
    link.ultimoAcessoEm
      ? textos.descreverUltimoAcesso(link.ultimoAcessoEm)
      : textos.nuncaAcessado,
    link.revogadoEm ? textos.descreverRevogacao(link.revogadoEm) : null,
  ];
  return partes.filter((parte) => parte !== null).join(' · ');
}

type PropriedadesItemLink = {
  link: LinkExibido;
};

// Só links nomeados e ativos: o padrão é o acesso anônimo e segue sorteando.
function AnimalDoLink({ link }: PropriedadesItemLink) {
  const [estado, acao, salvando] = useActionState(
    definirAnimalLinkFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  return (
    <details className="rounded-lg border border-borda">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-xs hover:bg-fundo focus-visible:outline-2 focus-visible:outline-primaria [&::-webkit-details-marker]:hidden">
        {link.animal ? (
          <IconeAnimal chave={link.animal} className="size-6" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-6 place-items-center rounded-full border border-dashed border-borda text-texto-suave"
          >
            ?
          </span>
        )}
        <span className="min-w-0 flex-1">
          {link.animal
            ? textos.resumoAnimal(obterAnimal(link.animal).nome)
            : textos.resumoAnimalSorteado}
        </span>
        <span className="font-medium text-primaria">
          {textos.alterarAnimal}
        </span>
      </summary>
      <form
        action={acao}
        className="flex flex-col gap-3 border-t border-borda p-3"
      >
        <input
          type="hidden"
          name={CAMPOS_COMPARTILHAMENTO.LINK_ID}
          value={link.id}
        />
        <SeletorAnimal
          key={link.animal ?? ''}
          nome={CAMPOS_COMPARTILHAMENTO.ANIMAL}
          legenda={textos.legendaAnimal}
          dica={textos.dicaAnimal}
          rotuloSorteado={textos.animalSorteado}
          valorInicial={link.animal}
        />
        <div>
          <Botao type="submit" disabled={salvando}>
            {salvando ? textos.botaoSalvandoAnimal : textos.botaoSalvarAnimal}
          </Botao>
        </div>
        {estado.mensagemErro && (
          <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
        )}
        {estado.mensagemSucesso && (
          <MensagemAlerta tipo="sucesso">
            {estado.mensagemSucesso}
          </MensagemAlerta>
        )}
      </form>
    </details>
  );
}

export default function ItemLink({ link }: PropriedadesItemLink) {
  const [estado, acao, revogando] = useActionState(
    revogarLinkCompartilhamentoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoAbertoNaTentativa, setDialogoAbertoNaTentativa] = useState<
    number | null
  >(null);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-2 font-medium break-words">
          {link.nome}
          {link.padrao && (
            <span className="rounded border border-primaria/40 px-1.5 text-xs font-semibold text-primaria">
              {textos.linkPadraoRotulo}
            </span>
          )}
        </span>
        <span
          className={combinarClasses(
            'rounded px-1.5 text-xs font-medium',
            CLASSES_SITUACAO[link.situacao],
          )}
        >
          {textos.situacoes[link.situacao]}
        </span>
      </div>
      <p className="text-xs break-words">
        {!link.padrao && (
          <>
            <span className="font-medium">
              {textos.modalidades[link.modalidade].rotulo}
            </span>
            {' · '}
          </>
        )}
        {descreverEscopo(link)}
      </p>
      <p className="text-xs text-texto-suave">{descreverDatas(link)}</p>
      {!link.padrao && link.situacao === 'ativo' && (
        <AnimalDoLink link={link} />
      )}
      {link.situacao !== 'revogado' && (
        <form action={acao}>
          <input
            type="hidden"
            name={CAMPOS_COMPARTILHAMENTO.LINK_ID}
            value={link.id}
          />
          <Botao
            variante="perigo"
            onClick={() => setDialogoAbertoNaTentativa(estado.tentativa)}
            disabled={revogando}
          >
            {textos.botaoRevogar}
          </Botao>
          <DialogoConfirmacao
            aberto={dialogoAbertoNaTentativa === estado.tentativa}
            titulo={textos.tituloRevogacao(link.nome)}
            rotuloConfirmar={textos.botaoRevogar}
            rotuloConfirmando={textos.botaoRevogando}
            rotuloCancelar={textos.botaoCancelar}
            pendente={revogando}
            aoCancelar={() => setDialogoAbertoNaTentativa(null)}
          >
            <p>{textos.descricaoRevogacao}</p>
          </DialogoConfirmacao>
        </form>
      )}
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
    </li>
  );
}
