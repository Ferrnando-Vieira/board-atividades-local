'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EXTENSAO_POR_TIPO_IMAGEM,
  ehExtensaoAnexo,
  LIMITES_ANEXO,
  TIPOS_CONTEUDO_IMAGEM_ANEXO,
} from '@/config/anexos';
import { CAMPOS_ATIVIDADE } from '@/config/camposFormulario';
import type { ImagensDescricao } from '@/screens/atividades/imagensDescricao';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { mensagensAnexos } from '@/servidor/anexos/mensagensAnexos';
import {
  montarReferenciaAnexoNovo,
  listarChavesAnexosNovos,
} from '@/util/DescricaoUtils';

// Arquivo guardado na tela até salvar. `chave` liga uma imagem colada à
// referência "anexo-novo:CHAVE" da descrição; anexo comum não tem chave.
export type ArquivoNaTela = {
  id: string;
  chave: string | null;
  arquivo: File;
  url: string | null;
};

export type ImagemAdicionada = {
  chave: string;
  nome: string;
};

export type ResultadoAdicao<T> =
  { ok: true; itens: T[] } | { ok: false; mensagem: string };

const BYTES_CHAVE = 8;
const BASE_HEXADECIMAL = 16;
const SEPARADOR_EXTENSAO = '.';

// getRandomValues existe também fora de contexto seguro (http://IP da rede
// local), ao contrário de crypto.randomUUID.
function gerarChave(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(BYTES_CHAVE)),
    (byte) => byte.toString(BASE_HEXADECIMAL).padStart(2, '0'),
  ).join('');
}

function extrairExtensao(nome: string): string {
  const indice = nome.lastIndexOf(SEPARADOR_EXTENSAO);
  return indice <= 0 ? '' : nome.slice(indice + 1).toLowerCase();
}

function ehTipoImagem(
  tipo: string,
): tipo is (typeof TIPOS_CONTEUDO_IMAGEM_ANEXO)[number] {
  return (TIPOS_CONTEUDO_IMAGEM_ANEXO as readonly string[]).includes(tipo);
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

// Imagem da área de transferência chega como "image.png" (ou sem nome):
// ganha um nome com data e hora, para ser reconhecida na lista de anexos.
function nomearImagemColada(arquivo: File, indice: number, agora: Date): File {
  const extensao =
    EXTENSAO_POR_TIPO_IMAGEM[
      arquivo.type as keyof typeof EXTENSAO_POR_TIPO_IMAGEM
    ];
  const carimbo = `${agora.getFullYear()}${doisDigitos(agora.getMonth() + 1)}${doisDigitos(agora.getDate())}-${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}${doisDigitos(agora.getSeconds())}`;
  const sufixo = indice === 0 ? '' : `-${indice + 1}`;
  return new File(
    [arquivo],
    `${textosAtividades.prefixoImagemColada}-${carimbo}${sufixo}.${extensao}`,
    { type: arquivo.type, lastModified: arquivo.lastModified },
  );
}

function ehNomeGenerico(arquivo: File): boolean {
  const base = arquivo.name.slice(
    0,
    arquivo.name.lastIndexOf(SEPARADOR_EXTENSAO),
  );
  return arquivo.name === '' || base === 'image' || base === 'imagem';
}

function removerExtensao(nome: string): string {
  const indice = nome.lastIndexOf(SEPARADOR_EXTENSAO);
  return indice <= 0 ? nome : nome.slice(0, indice);
}

// As mesmas conferências do servidor, para avisar antes de salvar; a
// validação que vale continua sendo a do servidor.
function conferirLimites(
  atuais: readonly ArquivoNaTela[],
  novos: readonly File[],
): string | null {
  if (atuais.length + novos.length > LIMITES_ANEXO.MAXIMO_POR_ENVIO) {
    return mensagensAnexos.arquivosDemais;
  }
  if (
    novos.some((arquivo) => arquivo.size > LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES)
  ) {
    return mensagensAnexos.arquivoGrande;
  }
  if (novos.some((arquivo) => arquivo.size === 0)) {
    return mensagensAnexos.arquivoVazio;
  }
  const total = [...atuais.map((item) => item.arquivo), ...novos].reduce(
    (soma, arquivo) => soma + arquivo.size,
    0,
  );
  return total > LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES
    ? mensagensAnexos.envioGrande
    : null;
}

export function useArquivosPendentes() {
  const [arquivos, setArquivos] = useState<ArquivoNaTela[]>([]);
  const urlsCriadas = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsCriadas.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // Mesmo `arquivos` do momento da chamada: as imagens coladas em sequência
  // rápida entram uma depois da outra pelo setState funcional.
  function adicionarImagens(
    recebidas: readonly File[],
  ): ResultadoAdicao<ImagemAdicionada> {
    if (recebidas.some((arquivo) => !ehTipoImagem(arquivo.type))) {
      return { ok: false, mensagem: textosAtividades.apenasImagensNaDescricao };
    }
    const erro = conferirLimites(arquivos, recebidas);
    if (erro) {
      return { ok: false, mensagem: erro };
    }
    const agora = new Date();
    const novos = recebidas.map((original, indice) => {
      const arquivo = ehNomeGenerico(original)
        ? nomearImagemColada(original, indice, agora)
        : original;
      const url = URL.createObjectURL(arquivo);
      urlsCriadas.current.push(url);
      return { id: gerarChave(), chave: gerarChave(), arquivo, url };
    });
    setArquivos((anteriores) => [...anteriores, ...novos]);
    return {
      ok: true,
      itens: novos.map((novo) => ({
        chave: novo.chave,
        nome: removerExtensao(novo.arquivo.name),
      })),
    };
  }

  function adicionarAnexos(
    recebidos: readonly File[],
  ): ResultadoAdicao<ArquivoNaTela> {
    if (
      recebidos.some(
        (arquivo) => !ehExtensaoAnexo(extrairExtensao(arquivo.name)),
      )
    ) {
      return { ok: false, mensagem: mensagensAnexos.tipoNaoPermitido };
    }
    const erro = conferirLimites(arquivos, recebidos);
    if (erro) {
      return { ok: false, mensagem: erro };
    }
    const novos = recebidos.map((arquivo) => ({
      id: gerarChave(),
      chave: null,
      arquivo,
      url: null,
    }));
    setArquivos((anteriores) => [...anteriores, ...novos]);
    return { ok: true, itens: novos };
  }

  function remover(id: string): void {
    setArquivos((anteriores) => anteriores.filter((item) => item.id !== id));
  }

  // Vai no FormData do envio: anexos comuns sempre; imagens só se a
  // referência ainda estiver na descrição.
  function incluirNoEnvio(dados: FormData): void {
    const descricao = dados.get(CAMPOS_ATIVIDADE.DESCRICAO);
    const referenciadas = new Set(
      listarChavesAnexosNovos(typeof descricao === 'string' ? descricao : ''),
    );
    for (const item of arquivos) {
      if (item.chave === null || referenciadas.has(item.chave)) {
        dados.append(CAMPOS_ATIVIDADE.ARQUIVOS, item.arquivo);
        dados.append(CAMPOS_ATIVIDADE.CHAVES_ARQUIVOS, item.chave ?? '');
      }
    }
  }

  const imagensPendentes = useMemo<ImagensDescricao>(
    () =>
      Object.fromEntries(
        arquivos.flatMap((item) =>
          item.chave !== null && item.url !== null
            ? [
                [
                  montarReferenciaAnexoNovo(item.chave),
                  { src: item.url, href: null },
                ],
              ]
            : [],
        ),
      ),
    [arquivos],
  );

  return {
    anexos: arquivos.filter((item) => item.chave === null),
    imagensPendentes,
    adicionarImagens,
    adicionarAnexos,
    remover,
    incluirNoEnvio,
  };
}
