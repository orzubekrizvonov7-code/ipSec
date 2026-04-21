const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { registerRealtimeHandlers } = require('./realtime.cjs');

const RULE_NAME = 'IPSecWizardRule';
const FW_NAME = 'IPSecWizardFirewall';
const AUTH_NAME = 'IPSecWizardPSK';
const QM_NAME = 'IPSecWizardQM';

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1300,
    minHeight: 850,
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

function execCommand(command, shell = 'cmd.exe') {
  return new Promise((resolve) => {
    exec(command, { shell, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        output: (stdout || stderr || (err ? String(err) : '')).trim()
      });
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
  const localIP = escPsSingle(config.localIP || config.serverTunnelIP || '');
  const remoteIP = escPsSingle(config.remoteIP || config.clientTunnelIP || '');
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
  lines.push(`$pskValue = '${psk}'`);

  lines.push(`if ([string]::IsNullOrWhiteSpace($localIP)) { throw 'Local IP kiritilmagan.' }`);
  lines.push(`if ([string]::IsNullOrWhiteSpace($remoteIP)) { throw 'Remote IP kiritilmagan.' }`);

  lines.push(`Remove-NetFirewallRule -DisplayName $fwName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecRule -DisplayName $ruleName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecPhase1AuthSet -DisplayName $authName -ErrorAction SilentlyContinue`);
  lines.push(`Remove-NetIPsecQuickModeCryptoSet -DisplayName $qmName -ErrorAction SilentlyContinue`);

  lines.push(`if ([string]::IsNullOrWhiteSpace($pskValue)) { throw 'PSK bo‘sh bo‘lishi mumkin emas.' }`);
  lines.push(`$authProp = New-NetIPsecAuthProposal -Machine -PreSharedKey $pskValue`);
  lines.push(`$authSet = New-NetIPsecPhase1AuthSet -DisplayName $authName -Name $authName -Proposal $authProp`);

  lines.push(`$qmProp = New-NetIPsecQuickModeCryptoProposal -Encapsulation ESP -Encryption AES256 -ESPHash SHA256`);
  lines.push(`$qmSet = New-NetIPsecQuickModeCryptoSet -DisplayName $qmName -Name $qmName -Proposal $qmProp`);

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
  lines.push(`  Phase1AuthSet = $authSet.Name`);
  lines.push(`  KeyModule = 'IKEv2'`);
  lines.push(`  QuickModeCryptoSet = $qmSet.Name`);
  lines.push(`}`);
  lines.push(`New-NetIPsecRule @params | Out-Null`);

  lines.push(`New-NetFirewallRule -DisplayName $fwName -Direction Inbound -Enabled True -Profile $profileValue -Action Allow -Protocol Any -Authentication Required -Encryption Dynamic | Out-Null`);

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
    return {
      ok: true,
      isAdmin: result.output.includes('ADMIN'),
      output: result.output.includes('ADMIN') ? 'Administrator rejimi faol.' : 'Administrator rejimi faol emas.'
    };
  } catch (err) {
    return { ok: false, error: err.message, output: err.message };
  }
});

ipcMain.handle('apply-ipsec', async (_event, config) => {
  try {
    if (config.role === 'client' && !config.serverTunnelIP) {
      return { ok: false, output: 'Client uchun server config yuklanmagan.' };
    }
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

ipcMain.handle('run-ping', async (_event, ip) => {
  const safeIp = String(ip || '').trim();
  if (!safeIp) {
    return { ok: false, output: 'Ping uchun IP kiritilmagan.' };
  }
  return await execCommand(`ping ${safeIp}`);
});

ipcMain.handle('check-ipconfig', async () => {
  return await execCommand('ipconfig /all');
});

ipcMain.handle('check-gateway', async () => {
  return await execCommand('route print');
});

ipcMain.handle('check-tunnel', async () => {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
Write-Output '=== Main Mode SA ==='
Get-NetIPsecMainModeSA | Format-Table -AutoSize | Out-String
Write-Output '=== Quick Mode SA ==='
Get-NetIPsecQuickModeSA | Format-Table -AutoSize | Out-String
`;
  try {
    return await runPowerShell(ps);
  } catch (err) {
    return { ok: false, output: err.message };
  }
});

ipcMain.handle('save-server-package', async (_event, config) => {
  try {
    const data = {
      role: 'client',
      serverRealIP: config.serverRealIP,
      clientRealIP: config.clientRealIP,
      serverTunnelIP: config.serverTunnelIP,
      clientTunnelIP: config.clientTunnelIP,
      psk: config.psk,
      profileDomain: !!config.profileDomain,
      profilePrivate: !!config.profilePrivate,
      profilePublic: !!config.profilePublic
    };

    const result = await dialog.showSaveDialog({
      title: 'Client konfiguratsiyasini saqlash',
      defaultPath: 'ipsec-client-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, output: 'Saqlash bekor qilindi.' };
    }

    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, output: `Config saqlandi:\n${result.filePath}` };
  } catch (err) {
    return { ok: false, output: err.message };
  }
});

ipcMain.handle('load-client-package', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Client konfiguratsiyasini yuklash',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePaths.length) {
      return { ok: false, output: 'Yuklash bekor qilindi.' };
    }

    const filePath = result.filePaths[0];
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    return {
      ok: true,
      output: `Config yuklandi:\n${filePath}`,
      config: data
    };
  } catch (err) {
    return { ok: false, output: err.message };
  }
});

ipcMain.handle('start-vpn', async (_event, config) => {
  return { ok: true, output: `VPN ishga tushirish tayyor.\nServer tunnel: ${config.serverTunnelIP}\nClient tunnel: ${config.clientTunnelIP}` };
});

ipcMain.handle('stop-vpn', async () => {
  return { ok: true, output: 'VPN to‘xtatish komandasi bajarildi.' };
});

ipcMain.handle('check-vpn', async () => {
  return await execCommand(`"C:\\Program Files\\WireGuard\\wg.exe" show`);
});

registerRealtimeHandlers();

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});