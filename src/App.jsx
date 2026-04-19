import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const api = window.ipsecAPI || {
    checkAdmin: async () => ({ ok: false, isAdmin: false, error: 'ipsecAPI topilmadi' }),
    apply: async () => ({ ok: false, output: 'OK ishlamadi' }),
    check: async () => ({ ok: false, output: 'Check ishlamadi' }),
    remove: async () => ({ ok: false, output: 'Remove ishlamadi' }),
    runPing: async () => ({ ok: false, output: 'Ping ishlamadi' }),
    checkIPConfig: async () => ({ ok: false, output: 'ipconfig ishlamadi' }),
    checkGateway: async () => ({ ok: false, output: 'Gateway tekshiruvi ishlamadi' }),
    checkTunnel: async () => ({ ok: false, output: 'Tunnel tekshiruvi ishlamadi' }),
    saveClientConfig: async () => ({ ok: false, output: 'Config saqlash ishlamadi' }),
    loadClientConfig: async () => ({ ok: false, output: 'Config yuklash ishlamadi' })
  }

  const [role, setRole] = useState('server')
  const [form, setForm] = useState({
    serverRealIP: '192.168.1.100',
    clientRealIP: '192.168.1.200',
    serverTunnelIP: '10.10.10.1',
    clientTunnelIP: '10.10.10.2',
    psk: 'IPsuperSECRET',

    step1: true,
    step2: true,
    step3: true,
    step4: true,
    step5: true,
    step6: true,
    step7: true,
    step8: true,
    step9: true,
    step10: true,
    step11: true,
    step12: true,

    profileDomain: true,
    profilePrivate: true,
    profilePublic: true
  })

  const [log, setLog] = useState('Dastur ishga tushdi.\n')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  const selectedCount = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => form[`step${i + 1}`]).filter(Boolean).length
  }, [form])

  const localIP = role === 'server' ? form.serverTunnelIP : form.clientTunnelIP
  const remoteIP = role === 'server' ? form.clientTunnelIP : form.serverTunnelIP

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function appendLog(title, text) {
    const stamp = new Date().toLocaleTimeString()
    setLog(prev => `${prev}\n[${stamp}] ${title}\n${text || ''}\n`)
  }

  async function checkAdmin() {
    try {
      const res = await api.checkAdmin()
      if (res.ok) {
        setIsAdmin(!!res.isAdmin)
        appendLog('CHECK ADMIN RESULT', res.isAdmin ? 'Administrator rejimi faol.' : 'Administrator rejimi faol emas.')
      } else {
        appendLog('CHECK ADMIN ERROR', res.error || 'Noma’lum xato')
      }
    } catch (err) {
      appendLog('CHECK ADMIN EXCEPTION', String(err))
    }
  }

  async function handleApply() {
    appendLog('OK BOSILDI', `${role.toUpperCase()} rejimida IPSec sozlash boshlandi...`)
    try {
      const payload = {
        role,
        localIP,
        remoteIP,
        serverRealIP: form.serverRealIP,
        clientRealIP: form.clientRealIP,
        serverTunnelIP: form.serverTunnelIP,
        clientTunnelIP: form.clientTunnelIP,
        psk: form.psk,
        profileDomain: form.profileDomain,
        profilePrivate: form.profilePrivate,
        profilePublic: form.profilePublic
      }
      const res = await api.apply(payload)
      appendLog('OK / APPLY RESULT', res?.output || 'Natija yo‘q')
    } catch (err) {
      appendLog('OK / APPLY ERROR', String(err))
    }
  }

  async function handleCheck() {
    const res = await api.check()
    appendLog('CHECK RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleRemove() {
    const res = await api.remove()
    appendLog('REMOVE RESULT', res?.output || 'Natija yo‘q')
  }

  async function handlePing() {
    const target = role === 'server' ? form.clientTunnelIP : form.serverTunnelIP
    appendLog('PING TEST', `${target} manziliga ping yuborilmoqda...`)
    const res = await api.runPing(target)
    appendLog('PING RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleIPConfig() {
    const res = await api.checkIPConfig()
    appendLog('IPCONFIG RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleGateway() {
    const res = await api.checkGateway()
    appendLog('GATEWAY RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleTunnel() {
    const res = await api.checkTunnel()
    appendLog('TUNNEL RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleSaveClientConfig() {
    const payload = {
      serverRealIP: form.serverRealIP,
      clientRealIP: form.clientRealIP,
      serverTunnelIP: form.serverTunnelIP,
      clientTunnelIP: form.clientTunnelIP,
      psk: form.psk,
      profileDomain: form.profileDomain,
      profilePrivate: form.profilePrivate,
      profilePublic: form.profilePublic
    }
    const res = await api.saveClientConfig(payload)
    appendLog('SAVE CLIENT CONFIG', res?.output || 'Natija yo‘q')
  }

  async function handleLoadClientConfig() {
    const res = await api.loadClientConfig()
    appendLog('LOAD CLIENT CONFIG', res?.output || 'Natija yo‘q')

    if (res?.ok && res?.config) {
      setRole('client')
      setForm(prev => ({
        ...prev,
        serverRealIP: res.config.serverRealIP || prev.serverRealIP,
        clientRealIP: res.config.clientRealIP || prev.clientRealIP,
        serverTunnelIP: res.config.serverTunnelIP || prev.serverTunnelIP,
        clientTunnelIP: res.config.clientTunnelIP || prev.clientTunnelIP,
        psk: res.config.psk || prev.psk,
        profileDomain: !!res.config.profileDomain,
        profilePrivate: !!res.config.profilePrivate,
        profilePublic: !!res.config.profilePublic
      }))
    }
  }

  const steps = [
    { key: 'step1', num: 1, title: 'Connection Security Rules', desc: 'Firewall oynasida IPSec qoida yaratish oynasi ochiladi.' },
    { key: 'step2', num: 2, title: 'Custom Rule', desc: 'Custom turdagi xavfsizlik qoidasi tanlanadi.' },
    { key: 'step3', num: 3, title: 'Endpoint 1', desc: 'Local qurilmaning tunnel manzili ishlatiladi.' },
    { key: 'step4', num: 4, title: 'Endpoint 2', desc: 'Remote qurilmaning tunnel manzili ishlatiladi.' },
    { key: 'step5', num: 5, title: 'Authentication', desc: 'Inbound va outbound uchun autentifikatsiya talab qilinadi.' },
    { key: 'step6', num: 6, title: 'Pre-Shared Key', desc: 'PSK asosida xavfsiz ulanish sozlanadi.' },
    { key: 'step7', num: 7, title: 'Protocol', desc: 'Any protokol bilan qoida ishlaydi.' },
    { key: 'step8', num: 8, title: 'Profiles', desc: 'Domain, Private va Public profillar belgilanadi.' },
    { key: 'step9', num: 9, title: 'IKEv2', desc: 'Key exchange moduli sifatida IKEv2 ishlatiladi.' },
    { key: 'step10', num: 10, title: 'AES256 / SHA256', desc: 'Kuchli shifrlash algoritmlari yoqiladi.' },
    { key: 'step11', num: 11, title: 'Firewall Rule', desc: 'IPSec-trafik uchun ruxsat qoidasi yaratiladi.' },
    { key: 'step12', num: 12, title: 'Finish', desc: 'Sozlash yakunlanadi va nom beriladi.' },
  ]

  return (
    <div className="wizard-page">
      <div className="wizard-bg wizard-bg-1"></div>
      <div className="wizard-bg wizard-bg-2"></div>

      <div className="wizard-layout">
        <aside className="wizard-sidebar">
          <div className="brand-box">
            <div className="brand-icon">🛡️</div>
            <div>
              <h1>IPSec Wizard</h1>
              <p>Server va client o‘rtasida xavfsiz tunnel boshqaruvi</p>
            </div>
          </div>

          <div className="side-card">
            <div className="status-line">
              <span className={`status-dot ${isAdmin ? 'ok' : 'warn'}`}></span>
              <div>
                <strong>{isAdmin ? 'Administrator rejimi faol' : 'Administrator rejimi faol emas'}</strong>
                <p>Sozlashlar PowerShell orqali bajariladi</p>
              </div>
            </div>
          </div>

          <div className="side-card">
            <h3>Rejim tanlash</h3>
            <div className="role-box">
              <button
                className={`role-btn ${role === 'server' ? 'active' : ''}`}
                onClick={() => setRole('server')}
              >
                Server
              </button>
              <button
                className={`role-btn ${role === 'client' ? 'active' : ''}`}
                onClick={() => setRole('client')}
              >
                Client
              </button>
            </div>
            <p>
              {role === 'server'
                ? 'Server client uchun tunnel IP beradi va boshqaradi.'
                : 'Client faqat server belgilagan tunnel ma’lumotlarini ko‘radi.'}
            </p>
          </div>

          <div className="side-card">
            <h3>Tanlangan bosqichlar</h3>
            <div className="big-count">{selectedCount} / 12</div>
            <p>Barcha bosqichlar galichka bilan yoqiladi yoki o‘chiriladi.</p>
          </div>

          <div className="side-card">
            <h3>Profiles</h3>
            <label className="profile-item">
              <input type="checkbox" checked={form.profileDomain} onChange={(e) => updateField('profileDomain', e.target.checked)} />
              Domain
            </label>
            <label className="profile-item">
              <input type="checkbox" checked={form.profilePrivate} onChange={(e) => updateField('profilePrivate', e.target.checked)} />
              Private
            </label>
            <label className="profile-item">
              <input type="checkbox" checked={form.profilePublic} onChange={(e) => updateField('profilePublic', e.target.checked)} />
              Public
            </label>
          </div>
        </aside>

        <main className="wizard-main">
          <section className="hero-card">
            <div>
              <h2>IPSec Tunnel Boshqaruvi</h2>
              <p>Server va client qurilmalar o‘rtasida xavfsiz tunnel yaratish va nazorat qilish oynasi.</p>
            </div>

            <div className="hero-actions">
              <button className="btn secondary" onClick={handleCheck}>Check</button>
              <button className="btn danger" onClick={handleRemove}>Remove</button>
              <button className="btn primary" onClick={handleApply}>OK</button>
            </div>
          </section>

          <section className="input-card">
            <div className="input-grid">
              <div className="field">
                <label>Server Real IP</label>
                <input
                  value={form.serverRealIP}
                  onChange={(e) => updateField('serverRealIP', e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={role === 'client'}
                />
              </div>

              <div className="field">
                <label>Client Real IP</label>
                <input
                  value={form.clientRealIP}
                  onChange={(e) => updateField('clientRealIP', e.target.value)}
                  placeholder="192.168.1.200"
                  disabled={role === 'client'}
                />
              </div>

              <div className="field">
                <label>Server Tunnel IP</label>
                <input
                  value={form.serverTunnelIP}
                  onChange={(e) => updateField('serverTunnelIP', e.target.value)}
                  placeholder="10.10.10.1"
                  disabled={role === 'client'}
                />
              </div>

              <div className="field">
                <label>Client Tunnel IP</label>
                <input
                  value={form.clientTunnelIP}
                  onChange={(e) => updateField('clientTunnelIP', e.target.value)}
                  placeholder="10.10.10.2"
                  disabled={role === 'client'}
                />
              </div>

              <div className="field field-full">
                <label>Pre-Shared Key</label>
                <input
                  value={form.psk}
                  onChange={(e) => updateField('psk', e.target.value)}
                  placeholder="Masalan: test123"
                  disabled={role === 'client'}
                />
              </div>
            </div>
          </section>

          <section className="tools-card">
            <h3>Ishlash Tekshiruvi</h3>
            <div className="tools-grid">
              <button className="tool-btn" onClick={handlePing}>
                {role === 'server' ? 'Clientga Ping' : 'Serverga Ping'}
              </button>
              <button className="tool-btn" onClick={handleIPConfig}>Check IPConfig</button>
              <button className="tool-btn" onClick={handleGateway}>Check Gateway</button>
              <button className="tool-btn" onClick={handleTunnel}>Check Tunnel</button>
              {role === 'server' ? (
                <button className="tool-btn" onClick={handleSaveClientConfig}>Client Config Saqlash</button>
              ) : (
                <button className="tool-btn" onClick={handleLoadClientConfig}>Server Config Yuklash</button>
              )}
            </div>
          </section>

          <section className="menu-card">
            <h3>IPSec Ishlash Jarayoni</h3>
            <div className="wizard-grid">
              {steps.map((step) => (
                <label className="wizard-step" key={step.key}>
                  <div className="step-top">
                    <span className="step-num">{step.num}</span>
                    <input
                      type="checkbox"
                      checked={form[step.key]}
                      onChange={(e) => updateField(step.key, e.target.checked)}
                    />
                  </div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </label>
              ))}
            </div>
          </section>

          <section className="console-card">
            <div className="console-head">
              <h3>Console Output</h3>
              <span>PowerShell natijalari shu yerda chiqadi</span>
            </div>
            <textarea className="console-box" readOnly value={log} />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App