import { CAMPOS_ACESSO } from '@/config/camposFormulario';

type PropriedadesCampoCredencial = {
  credencial: string | null;
};

// No painel do administrador não há credencial: a ação usa o cookie.
export default function CampoCredencial({
  credencial,
}: PropriedadesCampoCredencial) {
  if (!credencial) {
    return null;
  }
  return (
    <input
      type="hidden"
      name={CAMPOS_ACESSO.TOKEN_COMPARTILHAMENTO}
      value={credencial}
    />
  );
}
