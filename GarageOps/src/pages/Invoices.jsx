import { useState, useRef, useEffect } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader, Card, Badge, Btn } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'
import { sendInvoiceEmail, generateInvoiceEmailHTML, generateInvoiceEmailText
} from '../lib/email'

const STATUS_BADGE = { draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red' }
const PAYMENT_METHODS = ['pending', 'cash', 'card', 'bank_transfer']
const PAYMENT_LABELS = { pending: '⏳ Pending', cash: '💵 Cash', card: '💳 Card', bank_transfer: '🏦 Bank Transfer' }

function calcVAT(lines, scheme, flatRate, tier) {
  let vat = 0
  lines.forEach(l => {
    const lt = l.qty * l.unit
    const margin = l.qty * (l.unit - (l.cost || 0))
    if (l.lineType === 'used' && l.marginScheme && tier === 'gold') {
      vat += margin * 0.2
    } else if (scheme === 'standard') {
      vat += lt * 0.2
    } else if (scheme === 'flatrate') {
      vat += lt * (flatRate / 100)
    }
  })
  return vat
}

// Consistent action button for table actions
function ActionBtn({ icon, label, onClick, variant = 'default' }) {
  const variants = {
    default: { bg: 'var(--surface3)', color: 'var(--text2)', hoverBg: 'var(--surface2)' },
    success: { bg: 'rgba(61,214,140,0.15)', color: 'var(--green)', hoverBg: 'rgba(61,214,140,0.25)' },
    danger: { bg: 'rgba(255,95,95,0.15)', color: 'var(--red)', hoverBg: 'rgba(255,95,95,0.25)' },
  }
  const v = variants[variant] || variants.default
  
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        background: v.bg,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.15s',
        color: v.color,
      }}
      onMouseEnter={e => e.currentTarget.style.background = v.hoverBg}
      onMouseLeave={e => e.currentTarget.style.background = v.bg}
    >
      {icon}
    </button>
  )
}

// Searchable Customer Dropdown Component
function CustomerSearch({ customers, value, onChange, onAddNew }) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '', reg: '', vehicle: '' })
  const wrapperRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter customers by search (name or reg)
  const filtered = customers.filter(c => {
    const s = search.toLowerCase()
    if (!s) return true
    return c.name?.toLowerCase().includes(s) || 
           c.reg?.toLowerCase().includes(s) ||
           c.email?.toLowerCase().includes(s) ||
           c.phone?.includes(s)
  })

  const selectedCustomer = customers.find(c => c.id === value)

  const inputStyle = { 
    background: 'var(--surface2)', 
    border: '1px solid var(--border)', 
    borderRadius: '8px', 
    padding: '8px 11px', 
    color: 'var(--text)', 
    fontSize: '12px', 
    outline: 'none', 
    width: '100%' 
  }

  const handleSelect = (customer) => {
    onChange(customer)
    setSearch('')
    setIsOpen(false)
  }

  const handleAddCustomer = () => {
    if (!newCust.name) { alert('Customer name required'); return }
    onAddNew(newCust)
    setNewCust({ name: '', email: '', phone: '', reg: '', vehicle: '' })
    setShowAddForm(false)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>
        Customer
      </label>
      
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          style={{ 
            ...inputStyle, 
            paddingRight: '30px',
            borderColor: isOpen ? 'var(--accent)' : 'var(--border)'
          }}
          placeholder="Search by name, reg, email or phone..."
          value={isOpen ? search : (selectedCustomer ? `${selectedCustomer.name} ${selectedCustomer.reg ? `(${selectedCustomer.reg})` : ''}` : '')}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => { setIsOpen(true); setSearch('') }}
        />
        <span style={{ 
          position: 'absolute', 
          right: '10px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: 'var(--text3)',
          fontSize: '10px'
        }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginTop: '4px',
          maxHeight: '250px',
          overflowY: 'auto',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {/* Filtered customers */}
          {filtered.length > 0 ? (
            filtered.map(c => (
              <div
                key={c.id}
                onClick={() => handleSelect(c)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 600, fontSize: '12px' }}>{c.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '2px' }}>
                  {c.reg && <span style={{ fontFamily: 'DM Mono, monospace', background: 'var(--surface3)', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>{c.reg}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span style={{ marginLeft: '8px' }}>{c.phone}</span>}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
              No customers found matching "{search}"
            </div>
          )}

          {/* Add New Customer Option */}
          <div
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              background: 'rgba(45,212,191,0.08)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,191,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,191,0.08)'}
          >
            <span style={{ fontSize: '16px' }}>➕</span>
            <span style={{ color: 'var(--teal)', fontWeight: 600, fontSize: '12px' }}>Add New Customer</span>
          </div>
        </div>
      )}

      {/* Add New Customer Form Modal */}
      {showAddForm && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,.75)', 
          zIndex: 600, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }} onClick={e => { if (e.target === e.currentTarget) setShowAddForm(false) }}>
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '24px', 
            width: '400px', 
            maxWidth: '95vw' 
          }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>
              ➕ Add New Customer
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Name *</label>
                <input 
                  style={inputStyle} 
                  value={newCust.name} 
                  onChange={e => setNewCust(c => ({ ...c, name: e.target.value }))} 
                  placeholder="John Smith"
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Email</label>
                  <input 
                    style={inputStyle} 
                    type="email"
                    value={newCust.email} 
                    onChange={e => setNewCust(c => ({ ...c, email: e.target.value }))} 
                    placeholder="john@email.com"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Phone</label>
                  <input 
                    style={inputStyle} 
                    value={newCust.phone} 
                    onChange={e => setNewCust(c => ({ ...c, phone: e.target.value }))} 
                    placeholder="07700 900123"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Vehicle Reg</label>
                  <input 
                    style={{ ...inputStyle, textTransform: 'uppercase' }} 
                    value={newCust.reg} 
                    onChange={e => setNewCust(c => ({ ...c, reg: e.target.value.toUpperCase() }))} 
                    placeholder="AB12 CDE"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Vehicle</label>
                  <input 
                    style={inputStyle} 
                    value={newCust.vehicle} 
                    onChange={e => setNewCust(c => ({ ...c, vehicle: e.target.value }))} 
                    placeholder="Ford Focus"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <Btn variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddCustomer}>Add Customer</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Payment Method Modal
function PaymentModal({ invoice, onClose, onConfirm }) {
  const [method, setMethod] = useState('card')
  
  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,.75)', 
      zIndex: 600, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ 
        background: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: '16px', 
        padding: '24px', 
        width: '360px', 
        maxWidth: '95vw' 
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
          Mark as Paid
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '16px' }}>
          Invoice {invoice.id} • {invoice.custName}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '8px' }}>
            Payment Method
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PAYMENT_METHODS.filter(m => m !== 'pending').map(m => (
              <div
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  padding: '12px 14px',
                  background: method === m ? 'rgba(34,197,94,0.1)' : 'var(--surface2)',
                  border: `1px solid ${method === m ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: `2px solid ${method === m ? 'var(--green)' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {method === m && (
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--green)'
                    }} />
                  )}
                </div>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: method === m ? 600 : 400,
                  color: method === m ? 'var(--green)' : 'var(--text)'
                }}>
                  {PAYMENT_LABELS[m]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="success" onClick={() => onConfirm(method)}>✓ Confirm Payment</Btn>
        </div>
      </div>
    </div>
  )
}

// Email Sending Modal with status feedback and fallback preview
function EmailSendingModal({ invoice, settings, tier, onClose, onSuccess }) {
  const [status, setStatus] = useState('checking') // checking, sending, success, error, preview
  const [error, setError] = useState('')
  const [method, setMethod] = useState('')
  const [emailContent, setEmailContent] = useState({ subject: '', body: '', html: '' })

  useEffect(() => {
    const attemptSend = async () => {
      try {
        const subtotal = invoice.lines.reduce((a, l) => a + l.qty * l.unit, 0)
        const vat = calcVAT(invoice.lines, invoice.vatScheme, settings.flatRate, tier || 'gold')
        const totals = { subtotal, vat, total: subtotal + vat }

        // Generate email content first
        const subject = `Invoice ${invoice.id} from ${settings.name || 'Alzaro GarageOps'}`
        const textContent = generateInvoiceEmailText(invoice, settings, invoice.lines, totals)
        const htmlContent = generateInvoiceEmailHTML(invoice, settings, invoice.lines, totals)
        
        setEmailContent({ subject, body: textContent, html: htmlContent })
        setStatus('sending')

        const result = await sendInvoiceEmail(invoice, settings, invoice.lines, totals)
        
        if (result.success) {
          // If it opened Gmail/mailto, show preview instead
          if (result.method === 'gmail_compose' || result.method === 'mailto') {
            setStatus('preview')
            setMethod(result.method)
          } else {
            setStatus('success')
            setMethod(result.method)
            setTimeout(() => {
              onSuccess && onSuccess()
              onClose()
            }, 2000)
          }
        } else {
          setStatus('error')
          setError(result.error || 'Failed to send email')
        }
      } catch (err) {
        setStatus('error')
        setError(err.message || 'An unexpected error occurred')
      }
    }

    attemptSend()
  }, [])

  // Copy email body to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(emailContent.body)
      alert('Email content copied to clipboard!')
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = emailContent.body
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Email content copied to clipboard!')
    }
  }

  // Open in default mail client
  const openMailClient = () => {
    window.location.href = `mailto:${invoice.custEmail}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`
  }

  // Open in Gmail
  const openGmail = () => {
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invoice.custEmail)}&su=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`, '_blank')
  }

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,.75)', 
      zIndex: 600, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '16px'
    }} onClick={e => { if (e.target === e.currentTarget && status !== 'sending') onClose() }}>
      <div style={{ 
        background: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: '16px', 
        padding: '28px', 
        width: status === 'preview' ? '600px' : '380px', 
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {(status === 'checking' || status === 'sending') && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
              Sending Invoice...
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
              Sending to {invoice.custEmail}
            </div>
            <div style={{ marginTop: '20px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '3px solid var(--surface2)', 
                borderTopColor: 'var(--accent)', 
                borderRadius: '50%', 
                margin: '0 auto',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, marginBottom: '8px', color: 'var(--green)' }}>
              Email Sent!
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
              Invoice {invoice.id} sent to {invoice.custEmail}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>
              Sent via {method === 'smtp' ? 'SMTP' : method === 'emailjs' ? 'EmailJS' : method === 'resend' ? 'Resend' : method}
            </div>
          </div>
        )}

        {status === 'preview' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700 }}>
                ✉️ Email Preview
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ 
              background: 'rgba(245,200,66,0.1)', 
              border: '1px solid rgba(245,200,66,0.3)', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '16px',
              fontSize: '12px',
              color: 'var(--accent)'
            }}>
              💡 No email service configured. You can copy the email content or open in your mail client.
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>To</div>
              <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '10px 12px', fontSize: '13px' }}>
                {invoice.custName} &lt;{invoice.custEmail}&gt;
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Subject</div>
              <div style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '10px 12px', fontSize: '13px' }}>
                {emailContent.subject}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Message</div>
              <div style={{ 
                background: 'var(--surface2)', 
                borderRadius: '6px', 
                padding: '12px', 
                fontSize: '12px',
                fontFamily: 'DM Mono, monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: '250px',
                overflowY: 'auto',
                lineHeight: 1.5
              }}>
                {emailContent.body}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Btn variant="primary" onClick={copyToClipboard}>📋 Copy to Clipboard</Btn>
              <Btn variant="secondary" onClick={openMailClient}>📧 Open Mail App</Btn>
              <Btn variant="secondary" onClick={openGmail}>Gmail</Btn>
              <Btn variant="ghost" onClick={onClose}>Close</Btn>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '12px', textAlign: 'center' }}>
              💡 Tip: Configure SMTP in Settings → Email for automatic sending
            </div>
          </>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, marginBottom: '8px', color: 'var(--red)' }}>
              Failed to Send
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '16px' }}>
              {error}
            </div>
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Invoices() {
  const { invoices, customers, skus, batches, usedTyres, tier, settings,
    addInvoice, updateInvoice, deleteInvoice, addCustomer } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null) // For edit mode
  const [viewInv, setViewInv] = useState(null)
  const [payingInv, setPayingInv] = useState(null) // For payment modal
  const [sendingInv, setSendingInv] = useState(null) // For email sending modal
  const [lines, setLines] = useState([])
  const [form, setForm] = useState({ custId: '', custName: '', custEmail: '', reg: '', date: '', due: '', notes: '', paymentMethod: 'pending' })

  const isSilverPlus = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver')
  const isBronze = tier === 'bronze'
  const isGold = tier === 'gold'

  const filtered = invoices.filter(inv => {
    if (filter !== 'all' && inv.status !== filter) return false
    const s = search.toLowerCase()
    if (s && !inv.custName.toLowerCase().includes(s) && !inv.id.toLowerCase().includes(s) && !(inv.reg || '').toLowerCase().includes(s)) return false
    return true
  })

  const openNew = () => {
    if (isBronze && invoices.filter(i => i.status !== 'draft').length >= 50) {
      alert('Bronze plan limit: 50 invoices/month. Please upgrade.')
      return
    }
    const today = new Date().toISOString().split('T')[0]
    setForm({ custId: '', custName: '', custEmail: '', reg: '', date: today, due: today, notes: '', paymentMethod: 'pending' })
    setLines([])
    setEditingInvoice(null)
    setShowModal(true)
  }

  // Open edit invoice modal
  const openEdit = (inv) => {
    setForm({
      custId: inv.custId || '',
      custName: inv.custName || '',
      custEmail: inv.custEmail || '',
      reg: inv.reg || '',
      date: inv.date || '',
      due: inv.due || '',
      notes: inv.notes || '',
      paymentMethod: inv.paymentMethod || 'pending'
    })
    setLines(inv.lines.map((l, i) => ({
      ...l,
      id: l.id || `line-${i}-${Date.now()}`,
      type: l.lineType === 'service' ? 'service' : 'tyre'
    })))
    setEditingInvoice(inv)
    setShowModal(true)
  }

  const handleCustomerSelect = (customer) => {
    setForm(f => ({ 
      ...f, 
      custId: customer.id, 
      custName: customer.name, 
      custEmail: customer.email || '', 
      reg: customer.reg || '' 
    }))
  }

  const handleAddNewCustomer = async (newCust) => {
    // Add customer to store (which saves to Supabase)
    await addCustomer(newCust)
    // Get the newly added customer (last one in the list with matching name)
    const added = customers.find(c => c.name === newCust.name && c.email === newCust.email) || 
                  { id: 'temp-' + Date.now(), ...newCust }
    setForm(f => ({ 
      ...f, 
      custId: added.id, 
      custName: added.name, 
      custEmail: added.email || '', 
      reg: added.reg || '' 
    }))
  }

  const addTyreLine = () => {
    setLines(l => [...l, { id: Date.now(), type: 'tyre', skuId: '', batchId: '', usedId: '', desc: '', qty: 1, unit: 0, cost: 0, lineType: 'new', marginScheme: false, sizeFilter: '' }])
  }

  const addServiceLine = () => {
    setLines(l => [...l, { id: Date.now(), type: 'service', desc: '', qty: 1, unit: 0, cost: 0, lineType: 'service' }])
  }

  const updateLine = (id, updates) => {
    setLines(l => l.map(line => line.id === id ? { ...line, ...updates } : line))
  }

  const removeLine = (id) => setLines(l => l.filter(line => line.id !== id))

  const onSkuChange = (lineId, skuId) => {
    const sk = skus.find(s => s.id === skuId)
    const fb = batches.filter(b => b.skuId === skuId && b.remaining > 0).sort((a, b) => new Date(a.date) - new Date(b.date))[0]
    updateLine(lineId, {
      skuId, desc: sk ? `${sk.brand} ${sk.model} (${sk.w}/${sk.p}R${sk.r})` : '',
      unit: sk?.sell || 0, cost: fb?.cost || 0, batchId: fb?.id || '', lineType: 'new'
    })
  }

  const onUsedChange = (lineId, usedId) => {
    const u = usedTyres.find(u => u.id === usedId)
    updateLine(lineId, {
      usedId, desc: u ? `${u.brand} ${u.model} (${u.w}/${u.p}R${u.r}) — Used` : '',
      unit: u?.sell || 0, cost: u?.cost || 0, lineType: 'used', marginScheme: true
    })
  }

  const sub = lines.reduce((a, l) => a + l.qty * l.unit, 0)
  const vat = calcVAT(lines, settings.vatScheme, settings.flatRate, tier)
  const total = sub + vat

  const saveInv = (status) => {
    if (!lines.length) { alert('Add at least one item'); return }
    if (!form.custName) { alert('Enter customer name'); return }
    
    // Determine final status based on payment method
    let finalStatus = status
    let paymentMethod = form.paymentMethod
    
    // If payment method is not pending and status is sent, mark as paid
    if (paymentMethod !== 'pending' && status === 'sent') {
      finalStatus = 'paid'
    }
    
    // Handle edit mode
    if (editingInvoice) {
      const updatedInv = { 
        ...editingInvoice,
        ...form, 
        lines: lines.map(l => ({ ...l, type: undefined })), // Remove internal 'type' field
        status: finalStatus,
        vatScheme: settings.vatScheme,
        paymentMethod: paymentMethod !== 'pending' ? paymentMethod : null,
        paidAt: finalStatus === 'paid' ? new Date().toISOString() : editingInvoice.paidAt
      }
      
      // Mark used tyres as sold if status changed to sent/paid
      if ((finalStatus === 'sent' || finalStatus === 'paid') && editingInvoice.status === 'draft') {
        lines.forEach(l => {
          if (l.usedId) {
            const u = usedTyres.find(u => u.id === l.usedId)
            if (u) useStore.getState().updateUsedTyre(u.id, { sold: true })
          }
        })
      }
      
      updateInvoice(editingInvoice.id, updatedInv)
      return updatedInv
    }
    
    // New invoice
    const id = 'INV-' + String(invoices.length + 1).padStart(3, '0')
    const inv = { 
      id, 
      status: finalStatus, 
      ...form, 
      lines: lines.map(l => ({ ...l, type: undefined })), // Remove internal 'type' field
      vatScheme: settings.vatScheme,
      paymentMethod: paymentMethod !== 'pending' ? paymentMethod : null,
      paidAt: finalStatus === 'paid' ? new Date().toISOString() : null
    }
    
    if (finalStatus === 'sent' || finalStatus === 'paid') {
      lines.forEach(l => {
        if (l.usedId) {
          const u = usedTyres.find(u => u.id === l.usedId)
          if (u) useStore.getState().updateUsedTyre(u.id, { sold: true })
        }
      })
    }
    addInvoice(inv)
    return inv
  }

  const handleMarkPaid = (invoice, paymentMethod) => {
    updateInvoice(invoice.id, { 
      status: 'paid', 
      paymentMethod,
      paidAt: new Date().toISOString()
    })
    setPayingInv(null)
    if (viewInv?.id === invoice.id) setViewInv(null)
  }

  // Send email directly via SMTP/API
  const handleSendEmail = (inv) => {
    if (!inv.custEmail) {
      alert('No customer email address. Please add an email to send the invoice.')
      return
    }
    setSendingInv(inv)
    // Update status to sent if it was draft
    if (inv.status === 'draft') {
      updateInvoice(inv.id, { status: 'sent' })
    }
  }

  // Legacy Gmail compose fallback
  const sendGmailFallback = (inv) => {
    const s = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
    const v = calcVAT(inv.lines, inv.vatScheme, settings.flatRate, tier)
    const body = `Dear ${inv.custName},\n\nInvoice ${inv.id} from ${settings.name}\nDate: ${inv.date} | Due: ${inv.due}\nReg: ${inv.reg || 'N/A'}\n\nItems:\n${inv.lines.map(l => `- ${l.desc} x${l.qty} @ £${l.unit.toFixed(2)} = £${(l.qty * l.unit).toFixed(2)}`).join('\n')}\n\nSubtotal: £${s.toFixed(2)}\nVAT: £${v.toFixed(2)}\nTOTAL: £${(s + v).toFixed(2)}\n\nThank you,\n${settings.name}\n${settings.phone}`
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(inv.custEmail || '')}&su=${encodeURIComponent(`Invoice ${inv.id} from ${settings.name}`)}&body=${encodeURIComponent(body)}`, '_blank')
  }

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Create, send and track customer invoices">
        <Btn variant="primary" onClick={openNew}>+ New Invoice</Btn>
      </PageHeader>

      {/* Global Search */}
      <div style={{ marginBottom: '16px' }}>
        <GlobalSearch maxWidth="500px" placeholder="Search customers, invoices, car reg..." />
      </div>

      {isBronze && invoices.filter(i => i.status !== 'draft').length >= 40 && (
        <div style={{ background: 'rgba(245,200,66,.08)', border: '1px solid rgba(245,200,66,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--accent)', marginBottom: '12px' }}>
          ⚠ Approaching Bronze limit (50/month). Upgrade for unlimited invoices.
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface2)', borderRadius: '9px', padding: '4px', marginBottom: '16px', width: 'fit-content' }}>
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            background: filter === f ? 'var(--surface3)' : 'transparent',
            color: filter === f ? 'var(--text)' : 'var(--text2)',
          }}>{f.charAt(0).toUpperCase() + f.slice(1)}</div>
        ))}
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>Invoice List</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '200px' }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{['#', 'Customer', 'Reg', 'Date', 'Subtotal', 'VAT', 'Total', 'Status', 'Payment', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>No invoices found</td></tr>
              ) : filtered.map(inv => {
                const s = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
                const v = calcVAT(inv.lines, inv.vatScheme, settings.flatRate, tier)
                return (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{inv.id}</td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{inv.custName}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{inv.reg || '—'}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{inv.date}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>£{s.toFixed(2)}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>£{v.toFixed(2)}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>£{(s + v).toFixed(2)}</td>
                    <td style={{ padding: '10px' }}><Badge variant={STATUS_BADGE[inv.status] || 'gray'}>{inv.status}</Badge></td>
                    <td style={{ padding: '10px', fontSize: '11px', color: 'var(--text2)' }}>
                      {inv.paymentMethod ? PAYMENT_LABELS[inv.paymentMethod] : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <ActionBtn icon="👁" label="View" onClick={() => setViewInv(inv)} />
                        <ActionBtn icon="✏️" label="Edit" onClick={() => openEdit(inv)} />
                        <ActionBtn icon="✉️" label="Email" onClick={() => handleSendEmail(inv)} />
                        {inv.status !== 'paid' && (
                          <ActionBtn icon="✓" label="Paid" variant="success" onClick={() => setPayingInv(inv)} />
                        )}
                        <ActionBtn icon="🗑" label="Delete" variant="danger" onClick={() => { if (confirm('Delete invoice ' + inv.id + '?')) deleteInvoice(inv.id) }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Method Modal */}
      {payingInv && (
        <PaymentModal 
          invoice={payingInv} 
          onClose={() => setPayingInv(null)}
          onConfirm={(method) => handleMarkPaid(payingInv, method)}
        />
      )}

      {/* Email Sending Modal */}
      {sendingInv && (
        <EmailSendingModal
          invoice={sendingInv}
          settings={settings}
          tier={tier}
          onClose={() => setSendingInv(null)}
          onSuccess={() => {
            // Optionally update invoice status
          }}
        />
      )}

      {/* New/Edit Invoice Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditingInvoice(null) } }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '700px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '26px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '19px', fontWeight: 700, marginBottom: '18px' }}>
              {editingInvoice ? `Edit Invoice ${editingInvoice.id}` : 'New Invoice'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              {/* Searchable Customer Dropdown */}
              <CustomerSearch 
                customers={customers}
                value={form.custId}
                onChange={handleCustomerSelect}
                onAddNew={handleAddNewCustomer}
              />
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Vehicle Reg</label>
                <input style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%', textTransform: 'uppercase' }}
                  value={form.reg} onChange={e => setForm(f => ({ ...f, reg: e.target.value.toUpperCase() }))} placeholder="MK21 ABC" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Customer Name</label>
                <input style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }}
                  value={form.custName} onChange={e => setForm(f => ({ ...f, custName: e.target.value }))} placeholder="John Smith" />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Customer Email</label>
                <input style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }}
                  value={form.custEmail} onChange={e => setForm(f => ({ ...f, custEmail: e.target.value }))} placeholder="john@example.com" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Invoice Date</label>
                <input type="date" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }}
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Due Date</label>
                <input type="date" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }}
                  value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Payment Method</label>
                <select 
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }}
                  value={form.paymentMethod} 
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payment method indicator */}
            {form.paymentMethod !== 'pending' && (
              <div style={{ 
                background: 'rgba(34,197,94,0.1)', 
                border: '1px solid rgba(34,197,94,0.3)', 
                borderRadius: '8px', 
                padding: '10px 14px', 
                marginBottom: '16px',
                fontSize: '12px',
                color: 'var(--green)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>✓</span>
                <span>Invoice will be marked as <strong>Paid</strong> ({PAYMENT_LABELS[form.paymentMethod]})</span>
              </div>
            )}

            {/* Lines */}
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>Line Items</div>
            {lines.map((line, i) => (
              <div key={line.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
                {line.type === 'tyre' ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Tyre / Used</label>
                        <select 
                          style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text)', fontSize: '11px', outline: 'none', width: '100%' }}
                          value={line.skuId || line.usedId || ''}
                          onChange={e => {
                            const val = e.target.value
                            if (val.startsWith('used-')) {
                              onUsedChange(line.id, val.replace('used-', ''))
                            } else {
                              onSkuChange(line.id, val)
                            }
                          }}
                        >
                          <option value="">— Select —</option>
                          <optgroup label="New Tyres">
                            {skus.map(sk => {
                              const stock = batches.filter(b => b.skuId === sk.id && b.remaining > 0).reduce((a, b) => a + b.remaining, 0)
                              return <option key={sk.id} value={sk.id} disabled={stock === 0}>{sk.brand} {sk.model} ({sk.w}/{sk.p}R{sk.r}) — {stock} in stock</option>
                            })}
                          </optgroup>
                          {isSilverPlus && (
                            <optgroup label="♻ Used Tyres">
                              {usedTyres.filter(u => !u.sold).map(u => (
                                <option key={u.id} value={`used-${u.id}`}>♻ {u.brand} {u.model} ({u.w}/{u.p}R{u.r}) — £{u.sell}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Qty</label>
                        <input type="number" min="1" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text)', fontSize: '11px', outline: 'none', width: '100%' }}
                          value={line.qty} onChange={e => updateLine(line.id, { qty: parseInt(e.target.value) || 1 })} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Unit £</label>
                        <input type="number" step="0.01" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text)', fontSize: '11px', outline: 'none', width: '100%' }}
                          value={line.unit} onChange={e => updateLine(line.id, { unit: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <button onClick={() => removeLine(line.id)} style={{ background: 'rgba(255,95,95,0.1)', color: 'var(--red)', border: 'none', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                    {line.lineType === 'used' && isGold && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '6px 8px', background: 'rgba(45,212,191,0.08)', borderRadius: '6px' }}>
                        <input type="checkbox" checked={line.marginScheme} onChange={e => updateLine(line.id, { marginScheme: e.target.checked })} />
                        <span style={{ fontSize: '11px', color: 'var(--teal)' }}>Apply VAT Margin Scheme (Gold)</span>
                      </div>
                    )}
                    {(line.skuId || line.usedId) && (
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '6px', fontFamily: 'DM Mono, monospace' }}>
                        Line total: £{(line.qty * line.unit).toFixed(2)} · FIFO cost: £{line.cost.toFixed(2)} · Margin: £{(line.qty * (line.unit - line.cost)).toFixed(2)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Description</label>
                      <input style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text)', fontSize: '11px', outline: 'none', width: '100%' }}
                        value={line.desc} onChange={e => updateLine(line.id, { desc: e.target.value })} placeholder="Fitting & balancing" />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Qty</label>
                      <input type="number" min="1" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text)', fontSize: '11px', outline: 'none', width: '100%' }}
                        value={line.qty} onChange={e => updateLine(line.id, { qty: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text2)', display: 'block', marginBottom: '3px' }}>Unit £</label>
                      <input type="number" step="0.01" style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 9px', color: 'var(--text)', fontSize: '11px', outline: 'none', width: '100%' }}
                        value={line.unit} onChange={e => updateLine(line.id, { unit: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <button onClick={() => removeLine(line.id)} style={{ background: 'rgba(255,95,95,0.1)', color: 'var(--red)', border: 'none', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <Btn sm variant="secondary" onClick={addTyreLine}>+ Tyre</Btn>
              <Btn sm variant="secondary" onClick={addServiceLine}>+ Service</Btn>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
              <div style={{ width: '240px' }}>
                {[['Subtotal', `£${sub.toFixed(2)}`], [`VAT (${settings.vatScheme === 'standard' ? '20%' : settings.vatScheme})`, `£${vat.toFixed(2)}`], ['Total', `£${total.toFixed(2)}`]].map(([l, v], i) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: i === 2 ? '14px' : '12px', fontWeight: i === 2 ? 700 : 400, color: i === 0 || i === 1 ? 'var(--text2)' : 'var(--text)', borderTop: i === 2 ? '1px solid var(--border)' : 'none', marginTop: i === 2 ? '4px' : 0 }}>
                    <span>{l}</span><span style={{ fontFamily: 'DM Mono, monospace' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Notes</label>
              <textarea style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%', resize: 'vertical' }}
                rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment terms, notes..." />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '14px', flexWrap: 'wrap' }}>
              <Btn variant="secondary" onClick={() => { setShowModal(false); setEditingInvoice(null) }}>Cancel</Btn>
              <Btn variant="secondary" onClick={() => { saveInv('draft'); setShowModal(false); setEditingInvoice(null) }}>Save Draft</Btn>
              <Btn variant="primary" onClick={() => { 
                const inv = saveInv('sent')
                if (inv && inv.custEmail) {
                  setSendingInv(inv)
                }
                setShowModal(false)
                setEditingInvoice(null)
              }}>✉️ Send Invoice</Btn>
              <Btn variant="success" onClick={() => { saveInv('sent'); setShowModal(false); setEditingInvoice(null) }}>
                {form.paymentMethod !== 'pending' ? '✓ Save as Paid' : '✓ Mark Sent'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {viewInv && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setViewInv(null) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '660px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 800 }}>Alzaro<span style={{ color: 'var(--accent)' }}>GarageOps</span></div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '3px' }}>{settings.name}<br />{settings.addr}, {settings.city}<br />{settings.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '18px', color: 'var(--accent)' }}>{viewInv.id}</div>
                <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Date: {viewInv.date}<br />Due: {viewInv.due}</div>
                <div style={{ marginTop: '6px' }}>
                  <Badge variant={STATUS_BADGE[viewInv.status] || 'gray'}>{viewInv.status}</Badge>
                  {viewInv.paymentMethod && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text2)' }}>
                      {PAYMENT_LABELS[viewInv.paymentMethod]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginBottom: '3px' }}>BILL TO</div>
              <div style={{ fontWeight: 600 }}>{viewInv.custName}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{viewInv.custEmail} {viewInv.reg ? `· Reg: ${viewInv.reg}` : ''}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '14px' }}>
              <thead><tr>{['Description', 'Qty', 'Unit', 'Total'].map(h => <th key={h} style={{ textAlign: h === 'Description' ? 'left' : 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>{h}</th>)}</tr></thead>
              <tbody>
                {viewInv.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 10px' }}>{l.desc}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{l.qty}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>£{l.unit.toFixed(2)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>£{(l.qty * l.unit).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <div style={{ width: '220px' }}>
                {(() => { const s = viewInv.lines.reduce((a, l) => a + l.qty * l.unit, 0); const v = calcVAT(viewInv.lines, viewInv.vatScheme, settings.flatRate, tier); return [['Subtotal', s], ['VAT', v], ['Total', s + v]].map(([l, val], i) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: i === 2 ? '14px' : '12px', fontWeight: i === 2 ? 700 : 400, color: i < 2 ? 'var(--text2)' : 'var(--text)', borderTop: i === 2 ? '1px solid var(--border)' : 'none' }}><span>{l}</span><span style={{ fontFamily: 'DM Mono, monospace' }}>£{val.toFixed(2)}</span></div>) })()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setViewInv(null)}>Close</Btn>
              <Btn variant="ghost" onClick={() => sendGmailFallback(viewInv)} title="Open in Gmail">📧 Gmail</Btn>
              <Btn variant="primary" onClick={() => handleSendEmail(viewInv)}>📧 Send Email</Btn>
              {viewInv.status !== 'paid' && <Btn variant="success" onClick={() => setPayingInv(viewInv)}>Mark Paid</Btn>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}