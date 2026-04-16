import { useEffect, useMemo, useState } from 'react'
import './App.css'

function App() {
  const api = window.ipsecAPI || {
    checkAdmin: async () => ({ ok: false, isAdmin: false, error: 'ipsecAPI topilmadi' }),
    apply: async () => ({ ok: false, output: 'OK ishlamadi: ipsecAPI topilmadi' }),
    check: async () => ({ ok: false, output: 'Check ishlamadi: ipsecAPI topilmadi' }),
    remove: async () => ({ ok: false, output: 'Remove ishlamadi: ipsecAPI topilmadi' }),
  }

  const [form, setForm] = useState({
    localIP: '192.168.1.200',
    remoteIP: '192.168.1.30',
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

    useIPsecRule: true,
    useFirewallRule: true,
    usePSK: true,
    useIKEv2: true,
    useCrypto: true,

    profileDomain: true,
    profilePrivate: true,
    profilePublic: true
  })

  const [log, setLog] = useState('Dastur yuklandi.\n')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  const selectedCount = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => form[`step${i + 1}`]).filter(Boolean).length
  }, [form])

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function appendLog(title, text) {
    const stamp = new Date().toLocaleTimeString()
    setLog(prev => `${prev}\n[${stamp}] ${title}\n${text || ''}\n`)
  }

  async function checkAdmin() {
    appendLog('CHECK ADMIN', 'Administrator holati tekshirilmoqda...')
    try {
      const res = await api.checkAdmin()
      if (res.ok) {
        setIsAdmin(!!res.isAdmin)
        appendLog('CHECK ADMIN RESULT', res.isAdmin ? 'Administrator rejimi faol.' : 'Administrator rejimi faol emas.')
      } else {
        setIsAdmin(false)
        appendLog('CHECK ADMIN ERROR', res.error || 'Noma’lum xato')
      }
    } catch (err) {
      appendLog('CHECK ADMIN EXCEPTION', String(err))
    }
  }

  async function handleApply() {
    appendLog('OK BOSILDI', 'Apply boshlandi...')
    try {
      const res = await api.apply(form)
      appendLog('OK / APPLY RESULT', res?.output || 'Natija yo‘q')
    } catch (err) {
      appendLog('OK / APPLY ERROR', String(err))
    }
  }

  async function handleCheck() {
    appendLog('CHECK BOSILDI', 'Check boshlandi...')
    try {
      const res = await api.check()
      appendLog('CHECK RESULT', res?.output || 'Natija yo‘q')
    } catch (err) {
      appendLog('CHECK ERROR', String(err))
    }
  }

  async function handleRemove() {
    appendLog('REMOVE BOSILDI', 'Remove boshlandi...')
    try {
      const res = await api.remove()
      appendLog('REMOVE RESULT', res?.output || 'Natija yo‘q')
    } catch (err) {
      appendLog('REMOVE ERROR', String(err))
    }
  }

  const steps = [
    { key: 'step1', num: 1, title: 'wf.msc / Connection Security Rules', desc: 'Windows Defender Firewall with Advanced Security konsolini ochish va New Rule boshlash.' },
    { key: 'step2', num: 2, title: 'Custom rule', desc: 'Rule Type oynasida Custom tanlanadi.' },
    { key: 'step3', num: 3, title: 'Endpoint 1 IP', desc: 'Endpoint 1 uchun local server IP kiritiladi.' },
    { key: 'step4', num: 4, title: 'Endpoint 2 IP', desc: 'Endpoint 2 uchun remote host yoki subnet kiritiladi.' },
    { key: 'step5', num: 5, title: 'Require authentication', desc: 'Inbound va outbound uchun autentifikatsiya talab qilinadi.' },
    { key: 'step6', num: 6, title: 'Advanced + PreShared Key', desc: 'Customize ichidan PSK usuli yoqiladi.' },
    { key: 'step7', num: 7, title: 'Protocol Any', desc: 'Connection security rule uchun Any protokol ishlatiladi.' },
    { key: 'step8', num: 8, title: 'Profiles', desc: 'Domain, Private, Public profillari tanlanadi.' },
    { key: 'step9', num: 9, title: 'IKEv2', desc: 'Key exchange moduli sifatida IKEv2 yoqiladi.' },
    { key: 'step10', num: 10, title: 'AES256 / SHA256', desc: 'Quick Mode uchun kuchli kripto algoritmlar yoqiladi.' },
    { key: 'step11', num: 11, title: 'Firewall Rule', desc: 'Inbound uchun shifrlangan oqimlarga ruxsat beruvchi qoida yaratiladi.' },
    { key: 'step12', num: 12, title: 'Rule name / Finish', desc: 'IPSec wizard bosqichlari yakunlanadi va qoida nomi beriladi.' },
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
              <p>Windows Server GUI bosqichlarini bitta ilovaga yig‘ish</p>
            </div>
          </div>

          <div className="side-card">
            <div className="status-line">
              <span className={`status-dot ${isAdmin ? 'ok' : 'warn'}`}></span>
              <div>
                <strong>{isAdmin ? 'Administrator rejimi faol' : 'Administrator rejimi faol emas'}</strong>
                <p>OK bosilganda PowerShell qoida yaratadi</p>
              </div>
            </div>
          </div>

          <div className="side-card">
            <h3>Tanlangan bosqichlar</h3>
            <div className="big-count">{selectedCount} / 12</div>
            <p>Endi barcha bosqichlar galochka bilan tanlanadi yoki o‘chiriladi.</p>
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
              <h2>Rasmdagi IPSec wizard bosqichlari</h2>
              <p>Quyidagi menyu bo‘limlari sen yuborgan screenshot’lardagi GUI bosqichlariga moslashtirilgan.</p>
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
                <label>Endpoint 1 / Local IP</label>
                <input value={form.localIP} onChange={(e) => updateField('localIP', e.target.value)} placeholder="192.168.1.200" />
              </div>

              <div className="field">
                <label>Endpoint 2 / Remote IP yoki subnet</label>
                <input value={form.remoteIP} onChange={(e) => updateField('remoteIP', e.target.value)} placeholder="192.168.1.30" />
              </div>

              <div className="field field-full">
                <label>Pre-Shared Key</label>
                <input value={form.psk} onChange={(e) => updateField('psk', e.target.value)} placeholder="IPsuperSECRET" />
              </div>
            </div>
          </section>

          <section className="menu-card">
            <h3>Wizard Menu</h3>
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