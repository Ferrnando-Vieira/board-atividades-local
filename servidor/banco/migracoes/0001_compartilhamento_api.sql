-- Ajustada à mão a partir do drizzle-kit generate. O migrador aplica tudo
-- numa única transação com foreign_keys ativo (PRAGMA não muda dentro de
-- transação): recriar links_compartilhamento faria o DROP apagar em cascata o
-- escopo dos links. Por isso a modalidade entra com ADD COLUMN e CHECK de
-- coluna. Só tokens_api_permissoes é recriada, e nenhuma tabela a referencia.
-- O CHECK recriado usa a coluna sem qualificar pelo nome temporário da tabela.
ALTER TABLE `links_compartilhamento` ADD `modalidade` text DEFAULT 'restrito' NOT NULL CONSTRAINT "links_compartilhamento_modalidade_valida" CHECK("modalidade" IN ('completo', 'restrito'));--> statement-breakpoint
CREATE TABLE `__new_tokens_api_permissoes` (
	`token_id` integer NOT NULL,
	`permissao` text NOT NULL,
	PRIMARY KEY(`token_id`, `permissao`),
	FOREIGN KEY (`token_id`) REFERENCES `tokens_api`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tokens_api_permissoes_catalogo" CHECK("permissao" IN ('board:ler', 'board:escrever', 'atividades:ler', 'atividades:escrever', 'anexos:ler', 'anexos:escrever'))
);
--> statement-breakpoint
INSERT INTO `__new_tokens_api_permissoes`("token_id", "permissao") SELECT "token_id", "permissao" FROM `tokens_api_permissoes`;--> statement-breakpoint
DROP TABLE `tokens_api_permissoes`;--> statement-breakpoint
ALTER TABLE `__new_tokens_api_permissoes` RENAME TO `tokens_api_permissoes`;
