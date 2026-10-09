import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';

export default function Carregando() {
  return (
    <p
      role="status"
      aria-live="polite"
      className="p-6 text-center text-sm texto-superficie-suave"
    >
      {textosAplicacao.carregando}
    </p>
  );
}
