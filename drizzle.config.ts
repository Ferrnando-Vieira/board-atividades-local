import { defineConfig } from 'drizzle-kit';

// Só gera migrações a partir do esquema; quem aplica é `npm run db:migrar`,
// para que o banco nunca seja alterado por `drizzle-kit push` fora do histórico.
export default defineConfig({
  dialect: 'sqlite',
  schema: './servidor/banco/esquema/index.ts',
  out: './servidor/banco/migracoes',
  strict: true,
  verbose: true,
});
