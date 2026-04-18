const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const RULE_NAME = 'IPSecWizardRule';
const FW_NAME = 'IPSecWizardFirewall';
const AUTH_NAME = 'IPSecWizardPSK';
const QM_NAME = 'IPSecWizardQM';

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 950,
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

function buildProfileString(config) {
  const profiles = [];
  if (config.profileDomain) profiles.push('Domain');
  if (config.profilePrivate) profiles.push('Private');
  if (config.profilePublic) profiles.push('Public');
  return profiles.length ? profiles.join(',') : 'Any';
}

function buildApplyScript(config) {
  const localIP = escPsSingle(config.localIP || '');
  const remoteIP = escPsSingle(config.remoteIP || '');
  const psk = escPsSingle(config.psk || '');
  const profileValue = escPsSingle(buildProfileString(config));

  const lines = [];
  lines.push(`$ErrorActionPreference = 'Stop'`);
  lines.push(`$ProgressPreference = 'SilentlyContinue'`);
  lines.push(`$ruleName = '${RULE_NAME}'`);
  lines.push(`$fwName = '${FW_NAME}'`);
  lines.push(`$authName = '${AUTH_NAME}'`);
  lines.push(`$qmName = '${QM_NAME}'`);
  lines.push(`$localIP = '${localIP}'`);
  lines.push(`$remoteIP = '${remoteIP}'`);
  lines.push(`$profileValue = '${profileValue}'`);

  lines.push(`if ([string]::IsNullOrWhiteSpace($localIP)) { throw 'Local IP kiritilmagan.' }`);
  lines.push(`if ([string]::IsNullOrWhiteSpace($remoteIP)) { throw 'Remote IP kiritilmagan.' }`);

  lines.push(`Remove-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecRule -DisplayName $ruleName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecPhase1AuthSet -DisplayName $authName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecQuickModeCryptoSet -DisplayName $qmName -ErrorAction SilentlyContinue`);

  if (config.usePSK) {
    lines.push(`if ([string]::IsNullOrWhiteSpace('${psk}')) { throw 'PSK bo‘sh bo‘lishi mumkin emas.' }`);
    lines.push(`$authProp = New-NetIPsecAuthProposal -Machine -PreSharedKey '${psk}'`);
    lines.push(`$authSet = New-NetIPsecPhase1AuthSet -DisplayName $authName -Name $authName -Proposal $authProp`);
  }

  if (config.useCrypto) {
    lines.push(`$qmProp = New-NetIPsecQuickModeCryptoProposal -Encapsulation ESP -Encryption AES256 -ESPHash SHA256`);
    lines.push(`$qmSet = New-NetIPsecQuickModeCryptoSet -DisplayName $qmName -Name $qmName -Proposal $qmProp`);
  }

  if (config.useIPsecRule) {
    lines.push(`$params = @{`);
    lines.push(`  DisplayName = $ruleName`);
    lines.push(`  Name = $ruleName`);
    lines.push(`  Enabled = 'True'`);
    lines.push(`  Mode = 'Transport'`);
    lines.push(`  LocalAddress = $localIP`);
    lines.push(`  RemoteAddress = $remoteIP`);
    lines.push(`  InboundSecurity = 'Require'`);
    lines.push(`  OutboundSecurity = 'Require'`);
    lines.push(`  Profile = $profileValue`);
    lines.push(`}`);

    if (config.usePSK) {
      lines.push(`$params['Phase1AuthSet'] = $authSet.Name`);
    }

    if (config.useIKEv2) {
      lines.push(`$params['KeyModule'] = 'IKEv2'`);
    }

    if (config.useCrypto) {
      lines.push(`$params['QuickModeCryptoSet'] = $qmSet.Name`);
    }

    lines.push(`New-NetIPsecRule @params | Out-Null`);
  }

  if (config.useFirewallRule) {
    lines.push(`New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Enabled True -Profile $profileValue -Action Allow -Protocol Any -Authentication Required -Encryption Dynamic | Out-Null`);
  }

  lines.push(`Write-Output 'IPSec konfiguratsiyasi muvaffaqiyatli yaratildi.'`);
  lines.push(`Write-Output ''`);
  lines.push(`Write-Output '=== IPSec Rule ==='`);
  lines.push(`Get-NetIPsecRule -DisplayName $ruleName | Select-Object DisplayName, Enabled, LocalAddress, RemoteAddress, Profile, KeyModule, Phase1AuthSet, QuickModeCryptoSet | Format-List | Out-String`);
  lines.push(`Write-Output '=== Firewall Rule ==='`);
  lines.push(`Get-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue | Select-Object DisplayName, Enabled, Direction, Profile, Action | Format-List | Out-String`);

  return lines.join('\n');
}

function buildCheckScript() {
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ruleName = '${RULE_NAME}'
$fwName = '${FW_NAME}'

Write-Output '=== IPSec Rule ==='
Get-NetIPsecRule -DisplayName $ruleName | Select-Object DisplayName, Enabled, LocalAddress, RemoteAddress, Profile, KeyModule, Phase1AuthSet, QuickModeCryptoSet | Format-List | Out-String

Write-Output '=== Firewall Rule ==='
Get-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue | Select-Object DisplayName, Enabled, Direction, Profile, Action | Format-List | Out-String
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

Write-Output 'IPSec qoida, firewall qoida va yordamchi setlar o‘chirildi.'
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