import { spawn } from 'node:child_process';
import type { AvisoSistema } from '@/servidor/lembretes/avisosSistema';

const EXECUTAVEL_POWERSHELL = 'powershell.exe';
const CODIFICACAO_SCRIPT = 'utf16le';
const TEMPO_LIMITE_MS = 15_000;

// Os textos chegam por variáveis de ambiente, nunca dentro do script: título
// e observação são digitados pelo usuário e não podem virar código nem XML.
const VARIAVEIS = {
  TITULO: 'BOARD_TOAST_TITULO',
  CORPO: 'BOARD_TOAST_CORPO',
  URL: 'BOARD_TOAST_URL',
} as const;

// Toast nativo pela API do Windows (WinRT), que o Windows PowerShell 5.1
// carrega sem módulo extra. O AppId é o do próprio PowerShell, já registrado
// no sistema; um AppId inexistente faria o Windows descartar o aviso.
// activationType="protocol" abre o endereço no navegador padrão ao clicar.
const SCRIPT_TOAST = `
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast activationType="protocol"><visual><binding template="ToastGeneric"><text/><text/></binding></visual></toast>')
$textos = $xml.GetElementsByTagName('text')
$textos.Item(0).AppendChild($xml.CreateTextNode($env:${VARIAVEIS.TITULO})) | Out-Null
$textos.Item(1).AppendChild($xml.CreateTextNode($env:${VARIAVEIS.CORPO})) | Out-Null
$xml.DocumentElement.SetAttribute('launch', $env:${VARIAVEIS.URL})
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
`;

export function codificarScriptToast(script: string = SCRIPT_TOAST): string {
  return Buffer.from(script, CODIFICACAO_SCRIPT).toString('base64');
}

export function montarVariaveisToast(
  aviso: AvisoSistema,
): Record<string, string> {
  return {
    [VARIAVEIS.TITULO]: aviso.titulo,
    [VARIAVEIS.CORPO]: aviso.corpo,
    [VARIAVEIS.URL]: aviso.url,
  };
}

// Resolve verdadeiro quando o PowerShell conclui sem erro. Falhas (PowerShell
// ausente, notificações desligadas no Windows) viram falso: o aviso continua
// na central do board, e o vigia não deve parar por causa de um toast.
export function exibirToastWindows(aviso: AvisoSistema): Promise<boolean> {
  return new Promise((resolver) => {
    const processo = spawn(
      EXECUTAVEL_POWERSHELL,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        codificarScriptToast(),
      ],
      {
        env: { ...process.env, ...montarVariaveisToast(aviso) },
        stdio: 'ignore',
        windowsHide: true,
        timeout: TEMPO_LIMITE_MS,
      },
    );
    processo.on('error', () => resolver(false));
    processo.on('exit', (codigo) => resolver(codigo === 0));
  });
}
