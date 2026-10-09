import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { historicoAtividades } from '@/servidor/banco/esquema';
import { anexarArquivo, removerAnexo } from '@/servidor/anexos/anexosServico';
import {
  arquivarAtividade,
  criarAtividade,
  desarquivarAtividade,
  desvincularTagAtividade,
  editarAtividade,
  moverAtividadeParaPosicao,
  vincularTagAtividade,
} from '@/servidor/atividades/atividadesServico';
import { consultarHistoricoAtividade } from '@/servidor/historico/consultasHistorico';
import {
  criarOrigemAlteracao,
  ORIGEM_SISTEMA,
} from '@/servidor/historico/origemAlteracao';
import { somarMinutos } from '@/util/DataUtils';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import {
  AGORA_TESTE,
  exigirStatusPorChave,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';
import { exigirIdTag } from '@/tests/suporte/fabricasCompartilhamento';

const ORIGEM_PAINEL = criarOrigemAlteracao('painel', 'proprietario');
const ORIGEM_API = criarOrigemAlteracao('api', 'Claude Code (MCP)');
const DEPOIS = somarMinutos(AGORA_TESTE, 5);

describe('histórico de alterações', () => {
  let banco: BancoDados;
  let diretorioAnexos: string;
  let aFazerId: number;
  let emAndamentoId: number;
  let concluidosId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    diretorioAnexos = fs.mkdtempSync(
      path.join(os.tmpdir(), 'board-historico-'),
    );
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;
    concluidosId = exigirStatusPorChave(banco, 'concluidos').id;
  });

  afterEach(() => {
    fecharBanco(banco);
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function criar(sobrescritas = {}) {
    return criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, {
        titulo: 'Conferir fretes',
        descricao: 'Texto inicial',
        tags: ['Faturas'],
        ...sobrescritas,
      }),
      AGORA_TESTE,
      ORIGEM_PAINEL,
    );
  }

  function eventos(atividadeId: number) {
    return consultarHistoricoAtividade(banco, atividadeId).eventos;
  }

  it('deve registrar a criação com a origem e o autor', () => {
    const { atividadeId } = criar();

    expect(eventos(atividadeId)).toEqual([
      expect.objectContaining({
        tipo: 'criacao',
        origem: 'painel',
        autor: 'proprietario',
        ocorridoEm: AGORA_TESTE.toISOString(),
        alteracoes: [],
      }),
    ]);
  });

  it('deve registrar na edição só os campos alterados, com antes e depois', () => {
    const { atividadeId } = criar();

    editarAtividade(
      banco,
      {
        ...montarDadosAtividade(emAndamentoId, {
          titulo: 'Conferir fretes de outubro',
          descricao: 'Texto novo',
          prioridade: 2,
          tags: ['Faturas', 'Bugs'],
          prazoData: '2026-10-20',
          prazoHora: '14:00',
        }),
        atividadeId,
        versaoEsperada: 1,
      },
      DEPOIS,
      ORIGEM_API,
    );

    const [edicao] = eventos(atividadeId);
    expect(edicao).toEqual(
      expect.objectContaining({
        tipo: 'edicao',
        origem: 'api',
        autor: 'Claude Code (MCP)',
        ocorridoEm: DEPOIS.toISOString(),
      }),
    );
    expect(edicao?.alteracoes).toEqual([
      {
        campo: 'titulo',
        antes: 'Conferir fretes',
        depois: 'Conferir fretes de outubro',
      },
      { campo: 'descricao', antes: 'Texto inicial', depois: 'Texto novo' },
      { campo: 'prioridade', antes: '5', depois: '2' },
      { campo: 'status', antes: 'A Fazer', depois: 'Em Andamento' },
      { campo: 'tags', antes: 'Faturas', depois: 'Bugs, Faturas' },
      { campo: 'prazo', antes: null, depois: '2026-10-20 14:00' },
    ]);
  });

  it('não deve registrar nada ao salvar sem alterar campos visíveis', () => {
    const { atividadeId } = criar();

    editarAtividade(
      banco,
      {
        ...montarDadosAtividade(aFazerId, {
          titulo: 'Conferir fretes',
          descricao: 'Texto inicial',
          tags: ['Faturas'],
        }),
        atividadeId,
        versaoEsperada: 1,
      },
      DEPOIS,
      ORIGEM_PAINEL,
    );

    expect(eventos(atividadeId).map((evento) => evento.tipo)).toEqual([
      'criacao',
    ]);
  });

  it('deve registrar o movimento para outro status com a conclusão', () => {
    const { atividadeId } = criar();

    moverAtividadeParaPosicao(
      banco,
      {
        atividadeId,
        versaoEsperada: 1,
        statusDestinoId: concluidosId,
        posicao: null,
      },
      DEPOIS,
      ORIGEM_PAINEL,
    );

    const [movimento] = eventos(atividadeId);
    expect(movimento?.tipo).toBe('movimento');
    expect(movimento?.alteracoes).toEqual([
      { campo: 'status', antes: 'A Fazer', depois: 'Concluídos' },
      { campo: 'conclusao', antes: null, depois: '2026-10-01 12:05' },
    ]);
  });

  it('não deve registrar reordenação dentro da mesma coluna', () => {
    const { atividadeId } = criar();
    criar({ titulo: 'Outra' });

    moverAtividadeParaPosicao(
      banco,
      { atividadeId, versaoEsperada: 1, statusDestinoId: aFazerId, posicao: 1 },
      DEPOIS,
    );

    expect(eventos(atividadeId)).toHaveLength(1);
  });

  it('deve registrar as tags rápidas do cartão e ignorar o que não muda', () => {
    const { atividadeId } = criar();

    vincularTagAtividade(
      banco,
      { atividadeId, nome: 'Urgente' },
      DEPOIS,
      ORIGEM_PAINEL,
    );
    vincularTagAtividade(
      banco,
      { atividadeId, nome: 'urgente' },
      DEPOIS,
      ORIGEM_PAINEL,
    );
    desvincularTagAtividade(
      banco,
      { atividadeId, tagId: exigirIdTag(banco, 'Faturas') },
      DEPOIS,
      ORIGEM_PAINEL,
    );

    const tags = eventos(atividadeId).filter(
      (evento) => evento.tipo === 'tags',
    );
    expect(tags.map((evento) => evento.alteracoes)).toEqual([
      [{ campo: 'tags', antes: 'Faturas, Urgente', depois: 'Urgente' }],
      [{ campo: 'tags', antes: 'Faturas', depois: 'Faturas, Urgente' }],
    ]);
  });

  it('deve registrar arquivamento e restauração', () => {
    const { atividadeId } = criar();

    arquivarAtividade(
      banco,
      { atividadeId, versaoEsperada: 1 },
      DEPOIS,
      ORIGEM_PAINEL,
    );
    desarquivarAtividade(
      banco,
      { atividadeId, versaoEsperada: 2 },
      somarMinutos(DEPOIS, 1),
      ORIGEM_PAINEL,
    );

    expect(eventos(atividadeId).map((evento) => evento.tipo)).toEqual([
      'restauracao',
      'arquivamento',
      'criacao',
    ]);
  });

  it('deve registrar anexos enviados e removidos com o nome do arquivo', () => {
    const { atividadeId } = criar();
    const anexo = anexarArquivo(
      banco,
      diretorioAnexos,
      {
        atividadeId,
        nomeArquivo: 'comprovante.pdf',
        conteudo: CONTEUDOS_ANEXO.pdf,
      },
      null,
      DEPOIS,
      ORIGEM_PAINEL,
    );

    removerAnexo(
      banco,
      diretorioAnexos,
      { atividadeId, anexoId: anexo.id },
      null,
      somarMinutos(DEPOIS, 1),
      ORIGEM_API,
    );

    const [remocao, envio] = eventos(atividadeId);
    expect(envio).toEqual(
      expect.objectContaining({
        tipo: 'anexo-adicionado',
        alteracoes: [
          { campo: 'anexo', antes: null, depois: 'comprovante.pdf' },
        ],
      }),
    );
    expect(remocao).toEqual(
      expect.objectContaining({
        tipo: 'anexo-removido',
        origem: 'api',
        alteracoes: [
          { campo: 'anexo', antes: 'comprovante.pdf', depois: null },
        ],
      }),
    );
  });

  it('deve desfazer o evento junto com a operação que falhou', () => {
    const { atividadeId } = criar();
    banco.$client.exec(
      "CREATE TRIGGER falhar_arquivamento BEFORE UPDATE OF arquivada_em ON atividades BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;",
    );

    expect(() =>
      arquivarAtividade(banco, { atividadeId, versaoEsperada: 1 }, DEPOIS),
    ).toThrow('falha simulada');
    expect(eventos(atividadeId)).toHaveLength(1);
  });

  it('deve limitar a consulta aos mais recentes e informar o total', () => {
    const { atividadeId } = criar();
    for (let versao = 1; versao <= 3; versao += 1) {
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, { titulo: `Título ${versao}` }),
          atividadeId,
          versaoEsperada: versao,
        },
        somarMinutos(AGORA_TESTE, versao),
      );
    }

    const consulta = consultarHistoricoAtividade(banco, atividadeId, 2);

    expect(consulta.total).toBe(4);
    expect(
      consulta.eventos.map((evento) => evento.alteracoes[0]?.depois),
    ).toEqual(['Título 3', 'Título 2']);
    expect(consulta.eventos[0]).toEqual(
      expect.objectContaining({ origem: 'sistema', autor: null }),
    );
  });

  it('não deve derrubar a consulta com alterações gravadas fora do formato', () => {
    const { atividadeId } = criar();
    banco
      .insert(historicoAtividades)
      .values({
        atividadeId,
        tipo: 'edicao',
        origem: ORIGEM_SISTEMA.tipo,
        alteracoes: '[{"campo":"desconhecido"}]',
        ocorridoEm: DEPOIS.toISOString(),
      })
      .run();

    expect(eventos(atividadeId)[0]).toEqual(
      expect.objectContaining({ tipo: 'edicao', alteracoes: [] }),
    );
  });

  it.each([
    ['tipo', { tipo: 'apagou' }],
    ['origem', { origem: 'desconhecida' }],
    ['alteracoes', { alteracoes: '{"campo":"titulo"}' }],
    ['ocorrido_em', { ocorridoEm: '01/10/2026' }],
    ['autor', { autor: '   ' }],
  ])('o banco deve recusar %s inválido', (_campo, invalido) => {
    const { atividadeId } = criar();

    expect(() =>
      banco
        .insert(historicoAtividades)
        .values({
          atividadeId,
          tipo: 'edicao',
          origem: 'painel',
          alteracoes: '[]',
          ocorridoEm: DEPOIS.toISOString(),
          ...invalido,
        } as typeof historicoAtividades.$inferInsert)
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });
});
