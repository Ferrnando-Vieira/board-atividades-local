-- Histórico de alterações das atividades: tabela nova, sem tocar nas
-- existentes. Atividades já gravadas ficam sem eventos anteriores (o
-- histórico começa a partir desta versão). Lembretes não entram: são avisos
-- pessoais do administrador, e o histórico também é visto pelos links.
CREATE TABLE `historico_atividades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`atividade_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`origem` text NOT NULL,
	`autor` text,
	`alteracoes` text DEFAULT '[]' NOT NULL,
	`ocorrido_em` text NOT NULL,
	FOREIGN KEY (`atividade_id`) REFERENCES `atividades`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "historico_atividades_tipo_valido" CHECK("historico_atividades"."tipo" IN ('criacao', 'edicao', 'movimento', 'tags', 'arquivamento', 'restauracao', 'anexo-adicionado', 'anexo-removido')),
	CONSTRAINT "historico_atividades_origem_valida" CHECK("historico_atividades"."origem" IN ('painel', 'link', 'api', 'sistema')),
	CONSTRAINT "historico_atividades_autor_tamanho" CHECK("historico_atividades"."autor" IS NULL OR (length(trim("historico_atividades"."autor")) > 0 AND length("historico_atividades"."autor") <= 120)),
	CONSTRAINT "historico_atividades_alteracoes_lista" CHECK(json_valid("historico_atividades"."alteracoes") AND json_type("historico_atividades"."alteracoes") = 'array'),
	CONSTRAINT "historico_atividades_ocorrido_em_formato" CHECK("historico_atividades"."ocorrido_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z')
);
--> statement-breakpoint
CREATE INDEX `historico_atividades_atividade` ON `historico_atividades` (`atividade_id`,`ocorrido_em`);