const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const RULE_NAME = 'IPSecWizardRule';
const FW_NAME = 'IPSecWizardFirewall';
const AUTH_NAME = 'IPSecWizardPSK';
const QM_NAME = 'IPSecWizardQM';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const encoded = encodePowerShell(script);

    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', encoded
    ], {
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, output: stdout.trim() });
      } else {
        reject(new Error((stderr || stdout || `PowerShell exit code: ${code}`).trim()));
      }
    });
  });
}

function escPsSingle(str = '') {
  return String(str).replace(/'/g, "''");
}

function buildApplyScript(config) {
  const psk = escPsSingle(config.psk || '');

  const lines = [];
  lines.push(`$ErrorActionPreference = 'Stop'`);
  lines.push(`$ProgressPreference = 'SilentlyContinue'`);
  lines.push(`$ruleName = '${RULE_NAME}'`);
  lines.push(`$fwName = '${FW_NAME}'`);
  lines.push(`$authName = '${AUTH_NAME}'`);
  lines.push(`$qmName = '${QM_NAME}'`);

  lines.push(`Remove-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecRule -DisplayName $ruleName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecPhase1AuthSet -DisplayName $authName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecQuickModeCryptoSet -DisplayName $qmName -ErrorAction SilentlyContinue`);

  if (config.usePSK) {
    lines.push(`$authProp = New-NetIPsecAuthProposal -Machine -PreSharedKey '${psk}'`);
    lines.push(`$authSet = New-NetIPsecPhase1AuthSet -DisplayName $authName -Name $authName -Proposal $authProp`);
  }

  if (config.useCrypto) {
    lines.push(`$qmProp = New-NetIPsecQuickModeCryptoProposal -Encapsulation ESP -Encryption AES256 -ESPHash SHA256`);
    lines.push(`$qmSet = New-NetIPsecQuickModeCryptoSet -DisplayName $qmName -Name $qmName -Proposal $qmProp`);
  }

  lines.push(`$params = @{`);
  lines.push(`  DisplayName = $ruleName`);
  lines.push(`  Name = $ruleName`);
  lines.push(`  Mode = 'Transport'`);
  lines.push(`  InboundSecurity = 'Require'`);
  lines.push(`  OutboundSecurity = 'Require'`);
  lines.push(`  Enabled = 'True'`);
  lines.push(`  Profile = 'Domain,Private,Public'`);
  lines.push(`}`);

  if (config.usePSK) lines.push(`$params['Phase1AuthSet'] = $authSet.Name`);
  if (config.useIKEv2) lines.push(`$params['KeyModule'] = 'IKEv2'`);
  if (config.useCrypto) lines.push(`$params['QuickModeCryptoSet'] = $qmSet.Name`);

  if (config.useIPsecRule) {
    lines.push(`New-NetIPsecRule @params | Out-Null`);
  }

  if (config.useFirewallRule) {
    lines.push(`New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Enabled True -Action Allow -Protocol Any -Authentication Required -Encryption Dynamic | Out-Null`);
  }

  lines.push(`Write-Output 'IPSec konfiguratsiyasi muvaffaqiyatli yaratildi.'`);
  lines.push(`Get-NetIPsecRule -DisplayName $ruleName | Select-Object DisplayName, Enabled, Profile, KeyModule, Phase1AuthSet, QuickModeCryptoSet | Format-List | Out-String`);

  return lines.join('\n');
}

function buildCheckScript() {
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ruleName = '${RULE_NAME}'
Get-NetIPsecRule -DisplayName $ruleName | Select-Object DisplayName, Enabled, Profile, KeyModule, Phase1AuthSet, QuickModeCryptoSet | Format-List | Out-String
`;
}

function buildRemoveScript() {
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ruleName = '${RULE_NAME}'
$fwName = '${FW_NAME}'
$authName = '${AUTH_NAME}'
$qmName = '${QM_NAME}'
Remove-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue
Remove-NetIPsecRule -DisplayName $ruleName -ErrorAction SilentlyContinue
Remove-NetIPsecPhase1AuthSet -DisplayName $authName -ErrorAction SilentlyContinue
Remove-NetIPsecQuickModeCryptoSet -DisplayName $qmName -ErrorAction SilentlyContinue
Write-Output 'Qoida va yordamchi setlar o‘chirildi.'
`;
}

function buildAdminCheckScript() {
  return `
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Output 'ADMIN'
} else {
  Write-Output 'NOT_ADMIN'
}
`;
}

ipcMain.handle('check-admin', async () => {
  try {
    const result = await runPowerShell(buildAdminCheckScript());
    return { ok: true, isAdmin: result.output.includes('ADMIN') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('apply-ipsec', async (_event, config) => {
  try {
    return await runPowerShell(buildApplyScript(config));
  } catch (err) {
    return { ok: false, output: err.message };
  }
});

ipcMain.handle('check-ipsec', async () => {
  try {
    return await runPowerShell(buildCheckScript());
  } catch (err) {
    return { ok: false, output: err.message };
  }
});

ipcMain.handle('remove-ipsec', async () => {
  try {
    return await runPowerShell(buildRemoveScript());
  } catch (err) {
    return { ok: false, output: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});