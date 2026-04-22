import { useEffect, useMemo, useState } from 'react'
import './App.css'

const steps = [
  { id: 1, title: 'Connection Security Rules', desc: 'Firewall oynasida IPSec qoida yaratish oynasi ochiladi.' },
  { id: 2, title: 'Custom Rule', desc: 'Custom turdagi xavfsizlik qoidasi tanlanadi.' },
  { id: 3, title: 'Endpoint 1', desc: 'Local qurilmaning tunnel manzili ishlatiladi.' },
  { id: 4, title: 'Endpoint 2', desc: 'Remote qurilmaning tunnel manzili ishlatiladi.' },
  { id: 5, title: 'Authentication', desc: 'Inbound va outbound uchun autentifikatsiya talab qilinadi.' },
  { id: 6, title: 'Pre-Shared Key', desc: 'PSK asosida xavfsiz ulanish sozlanadi.' },
  { id: 7, title: 'Protocol', desc: 'Any protokol bilan qoida ishlaydi.' },
  { id: 8, title: 'Profiles', desc: 'Domain, Private va Public profillar belgilanadi.' },
  { id: 9, title: 'IKEv2', desc: 'Key exchange moduli sifatida IKEv2 ishlatiladi.' },
  { id: 10, title: 'AES256 / SHA256', desc: 'Kuchli shifrlash algoritmlari yoqiladi.' },
  { id: 11, title: 'Firewall Rule', desc: 'IPSec-trafik uchun ruxsat qoidasi yaratiladi.' },
  { id: 12, title: 'Finish', desc: 'Sozlash yakunlanadi va nom beriladi.' },
]

const defaultForm = {
  serverRealIP: '192.168.1.72',
  clientRealIP: '192.168.1.84',
  serverTunnelIP: '10.10.10.1',
  clientTunnelIP: '10.10.10.2',
  psk: 'IPsuperSECRET',
  profileDomain: true,
  profilePrivate: true,
  profilePublic: true,
}

function App() {
  const api = window.ipsecAPI

  const [role, setRole] = useState('server')
  const [form, setForm] = useState(defaultForm)
  const [consoleLines, setConsoleLines] = useState(['Dastur ishga tushdi.'])

  const [socketPort, setSocketPort] = useState('9001')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [socketConnected, setSocketConnected] = useState(false)
  const [receivedFiles, setReceivedFiles] = useState([])

  const stepCount = useMemo(() => `${steps.length} / ${steps.length}`, [])

  function appendLog(title, text) {
    const stamp = new Date().toLocaleTimeString()
    setConsoleLines(prev => [...prev, '', `[${stamp}] ${title}`, text || 'Natija yo‘q'])
  }

  function setField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleCheckAdmin() {
    if (!api?.checkAdmin) return
    const res = await api.checkAdmin()
    appendLog('CHECK ADMIN RESULT', res?.output || res?.error || 'Natija yo‘q')
  }

  async function handleCheck() {
    const res = await api.checkIpsec()
    appendLog('CHECK RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleRemove() {
    const res = await api.removeIpsec()
    appendLog('REMOVE RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleOK() {
    const payload = {
      role,
      localIP: role === 'server' ? form.serverRealIP : form.clientRealIP,
      remoteIP: role === 'server' ? form.clientRealIP : form.serverRealIP,
      psk: form.psk,
      profileDomain: form.profileDomain,
      profilePrivate: form.profilePrivate,
      profilePublic: form.profilePublic,
      serverRealIP: form.serverRealIP,
      clientRealIP: form.clientRealIP,
      serverTunnelIP: form.serverTunnelIP,
      clientTunnelIP: form.clientTunnelIP,
    }

    const res = await api.applyIpsec(payload)
    appendLog('OK / APPLY RESULT', res?.output || 'Natija yo‘q')
  }

  async function handlePing() {
    const target = role === 'server' ? form.clientRealIP : form.serverRealIP
    const res = await api.runPing(target)
    appendLog('PING RESULT', res?.output || 'Natija yo‘q')
  }

  async function handleTunnelPing() {
    const target = role === 'server' ? form.clientTunnelIP : form.serverTunnelIP
    const res = await api.runPing(target)
    appendLog('TUNNEL PING RESULT', res?.output || 'Natija yo‘q')
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
      role: 'client',
      serverRealIP: form.serverRealIP,
      clientRealIP: form.clientRealIP,
      serverTunnelIP: form.serverTunnelIP,
      clientTunnelIP: form.clientTunnelIP,
      psk: form.psk,
      profileDomain: form.profileDomain,
      profilePrivate: form.profilePrivate,
      profilePublic: form.profilePublic,
    }

    const res = await api.saveServerPackage(payload)
    appendLog('CLIENT CONFIG SAVE', res?.output || 'Natija yo‘q')
  }

  async function handleLoadClientConfig() {
    const res = await api.loadClientPackage()
    appendLog('CLIENT CONFIG LOAD', res?.output || 'Natija yo‘q')

    if (res?.ok && res?.config) {
      setForm(prev => ({ ...prev, ...res.config }))
    }
  }

  async function handleStartMessaging() {
    if (role === 'server') {
      const res = await api.startSocketServer(socketPort)
      appendLog('SOCKET SERVER', res?.output || 'Natija yo‘q')
    } else {
      const host = form.serverRealIP?.trim() || '192.168.1.72'
      const res = await api.connectSocketClient(host, socketPort)
      appendLog('SOCKET CLIENT', res?.output || 'Natija yo‘q')
    }
  }

  async function handleDisconnectSocket() {
    const res = await api.disconnectSocket()
    appendLog('SOCKET DISCONNECT', res?.output || 'Natija yo‘q')
    setSocketConnected(false)
  }

  async function handleSendMessage() {
    if (!chatInput.trim()) {
      appendLog('CHAT SEND', 'Xabar matni bo‘sh.')
      return
    }

    const payload = {
      from: role,
      text: chatInput,
      time: new Date().toLocaleTimeString()
    }

    const res = await api.sendChatMessage(payload)
    appendLog('CHAT SEND', res?.output || 'Natija yo‘q')

    if (res?.ok) {
      setChatMessages(prev => [...prev, payload])
      setChatInput('')
    }
  }

  async function handleSendFile() {
    const res = await api.sendFileToPeer(role)
    appendLog('FILE SEND', res?.output || 'Natija yo‘q')
  }

  useEffect(() => {
    handleCheckAdmin()
  }, [])

  useEffect(() => {
    if (!api) return

    api.onSocketStatus((data) => {
      appendLog('SOCKET STATUS', data.message)

      if (data.type === 'connected') setSocketConnected(true)
      if (data.type === 'disconnected') setSocketConnected(false)
    })

    api.onChatMessage((data) => {
      setChatMessages(prev => [...prev, data])
      appendLog('CHAT RECEIVED', `${data.from}: ${data.text}`)
    })

    api.onFileReceived((data) => {
      setReceivedFiles(prev => [data, ...prev])
      appendLog('FILE RECEIVED', `${data.name} → ${data.path}`)
    })
  }, [])

  return (
    <div className="app-shell">
      <div className="dashboard">
        <aside className="sidebar">
          <section className="side-card">
            <div className="brand">
              <div className="brand-icon">🛡️</div>
              <div>
                <h2>IPSec Wizard</h2>
                <p>Server va client o‘rtasida xavfsiz tunnel boshqaruvi</p>
              </div>
            </div>
          </section>

          <section className="side-card">
            <div className="status-line">
              <span className="status-dot" />
              <span>Administrator rejimi faol</span>
            </div>
            <p>Sozlashlar PowerShell orqali bajariladi</p>
          </section>

          <section className="side-card">
            <h3>Rejim tanlash</h3>
            <div className="mode-toggle">
              <button className={`mode-btn ${role === 'server' ? 'active' : ''}`} onClick={() => setRole('server')}>
                Server
              </button>
              <button className={`mode-btn ${role === 'client' ? 'active' : ''}`} onClick={() => setRole('client')}>
                Client
              </button>
            </div>
            <p>
              {role === 'server'
                ? 'Server client uchun tunnel IP beradi va boshqaradi.'
                : 'Client server tomonidan berilgan tunnel konfiguratsiyasidan foydalanadi.'}
            </p>
          </section>

          <section className="side-card">
            <h3>Tanlangan bosqichlar</h3>
            <div className="count-box">{stepCount}</div>
            <p>Barcha bosqichlar galichka bilan yoqiladi yoki o‘chiriladi.</p>
          </section>

          <section className="side-card">
            <h3>Profiles</h3>
            <div className="profile-list">
              <div className="profile-item">Domain</div>
              <div className="profile-item">Private</div>
              <div className="profile-item">Public</div>
            </div>
          </section>
        </aside>

        <main className="main">
          <section className="hero-card">
            <div>
              <h1>IPSec Tunnel Boshqaruvi</h1>
              <p>Server va client qurilmalar o‘rtasida xavfsiz tunnel yaratish va nazorat qilish oynasi.</p>
            </div>

            <div className="hero-actions">
              <button className="action-btn dark" onClick={handleCheck}>Check</button>
              <button className="action-btn danger" onClick={handleRemove}>Remove</button>
              <button className="action-btn primary" onClick={handleOK}>OK</button>
            </div>
          </section>

          <section className="form-card">
            <div className="input-grid">
              <div className="field">
                <label>Server Real IP</label>
                <input value={form.serverRealIP} onChange={(e) => setField('serverRealIP', e.target.value)} />
              </div>

              <div className="field">
                <label>Client Real IP</label>
                <input value={form.clientRealIP} onChange={(e) => setField('clientRealIP', e.target.value)} />
              </div>

              <div className="field">
                <label>Server Tunnel IP</label>
                <input value={form.serverTunnelIP} onChange={(e) => setField('serverTunnelIP', e.target.value)} />
              </div>

              <div className="field">
                <label>Client Tunnel IP</label>
                <input value={form.clientTunnelIP} onChange={(e) => setField('clientTunnelIP', e.target.value)} />
              </div>

              <div className="field field-full">
                <label>Pre-Shared Key</label>
                <input value={form.psk} onChange={(e) => setField('psk', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="tools-card">
            <h3>Ishlash Tekshiruvi</h3>
            <div className="tools-grid">
              <button className="tool-btn" onClick={handlePing}>
                {role === 'server' ? 'Clientga Ping' : 'Serverga Ping'}
              </button>

              <button className="tool-btn" onClick={handleTunnelPing}>
                Tunnelga Ping
              </button>

              <button className="tool-btn" onClick={handleIPConfig}>Check IPConfig</button>
              <button className="tool-btn" onClick={handleGateway}>Check Gateway</button>
              <button className="tool-btn" onClick={handleTunnel}>Check Tunnel</button>
            </div>

            <div className="tools-grid" style={{ marginTop: '10px' }}>
              {role === 'server' ? (
                <button className="tool-btn" onClick={handleSaveClientConfig}>
                  Client Config Saqlash
                </button>
              ) : (
                <button className="tool-btn" onClick={handleLoadClientConfig}>
                  Client Config Yuklash
                </button>
              )}
            </div>
          </section>

          <section className="chat-card">
            <h3>Xabarlar bo‘limi</h3>

            <div className="tools-grid">
              <button className="tool-btn" onClick={handleStartMessaging}>
                {role === 'server' ? 'Chat serverni ishga tushirish' : 'Chat serverga ulanish'}
              </button>

              <button className="tool-btn" onClick={handleDisconnectSocket}>
                Chat ulanishni uzish
              </button>
            </div>

            <div className="input-grid" style={{ marginTop: '16px' }}>
              <div className="field field-full">
                <label>Socket Port</label>
                <input value={socketPort} onChange={(e) => setSocketPort(e.target.value)} />
              </div>

              <div className="field field-full">
                <label>Xabar yozish</label>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Masalan: Salom, tunnel ishlayaptimi?"
                />
              </div>
            </div>

            <div className="tools-grid" style={{ marginTop: '12px' }}>
              <button className="tool-btn" onClick={handleSendMessage} disabled={!socketConnected}>
                Xabar yuborish
              </button>
            </div>

            <div className="console-card" style={{ marginTop: '16px' }}>
              <div className="console-head">
                <h3>Chat oynasi</h3>
                <span>{socketConnected ? 'Ulangan' : 'Ulanmagan'}</span>
              </div>

              <div className="chat-box">
                {chatMessages.length === 0 && (
                  <div style={{ color: '#9ca7de' }}>Hozircha xabar yo‘q.</div>
                )}

                {chatMessages.map((msg, index) => (
                  <div
                    key={`${msg.time}-${index}`}
                    className={`chat-item ${msg.from === role ? 'own' : 'peer'}`}
                  >
                    <strong>{msg.from}</strong> [{msg.time}]
                    <br />
                    {msg.text}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="files-card">
            <h3>Fayl almashish bo‘limi</h3>

            <div className="file-hint">
              Ushbu bo‘lim orqali tunnel ichidan fayl yuborish mumkin. Masalan, client config yoki boshqa fayllar yuboriladi.
            </div>

            <div className="tools-grid">
              <button className="tool-btn" onClick={handleSendFile} disabled={!socketConnected}>
                Fayl tanlash va yuborish
              </button>
            </div>

            <div className="file-list">
              {receivedFiles.map((item, index) => (
                <div key={`${item.name}-${index}`} className="file-item">
                  <strong>{item.name}</strong>
                  <small>{item.from} → {item.path}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="process-card">
            <h3>IPSec Ishlash Jarayoni</h3>
            <div className="process-grid">
              {steps.map((step) => (
                <div className="step-card" key={step.id}>
                  <div className="step-num">{step.id}</div>
                  <div className="step-check">☑</div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="console-card">
            <div className="console-head">
              <h3>Console Output</h3>
              <span>PowerShell natijalari shu yerda chiqadi</span>
            </div>
            <div className="console-box">{consoleLines.join('\n')}</div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App