-- Animal fixo por link de compartilhamento: coluna nova e anulável, sem
-- mexer nas linhas existentes (todas seguem com o animal sorteado).
ALTER TABLE `links_compartilhamento` ADD `animal` text;
