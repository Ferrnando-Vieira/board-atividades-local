// Fora da rota interceptada o slot do modal fica vazio. Sem isto, numa
// navegação no cliente o modal continuaria aberto ao trocar de página.
export default function SemModal() {
  return null;
}
