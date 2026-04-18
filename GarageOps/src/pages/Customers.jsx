import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Btn, Badge } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'

export default function Customers() {
  const { customers, invoices, addCustomer, updateCustomer, deleteCustomer } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [search, setSearch] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  
  const [form, setForm] = useState({ name: '', email: '', phone: '', vehicles: [] })
  const [vehicleForm, setVehicleForm] = useState({ reg: '', make: '', model: '' })
  
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const vf = (k, v) => setVehicleForm(p => ({ ...p, [k]: v }))

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

  // Check for duplicate customer
  const checkDuplicate = (email, phone, excludeId = null) => {
    if (!email && !phone) return null
    
    const duplicate = customers.find(c => {
      if (excludeId && c.id === excludeId) return false
      if (email && c.email?.toLowerCase() === email.toLowerCase()) return { field: 'email', customer: c }
      if (phone && c.phone === phone) return { field: 'phone', customer: c }
      return false
    })
    
    return duplicate || null
  }

  const openAdd = () => { 
    setEditing(null)
    setForm({ name: '', email: '', phone: '', vehicles: [] })
    setDuplicateWarning(null)
    setShowModal(true) 
  }

  const openEdit = (c) => { 
    setEditing(c)
    // Parse vehicles - support both old format (single reg/vehicle) and new format (vehicles array)
    let vehicles = c.vehicles || []
    if (!vehicles.length && (c.reg || c.vehicle)) {
      vehicles = [{ reg: c.reg || '', make: '', model: c.vehicle || '' }]
    }
    setForm({ 
      name: c.name, 
      email: c.email || '', 
      phone: c.phone || '', 
      vehicles 
    })
    setDuplicateWarning(null)
    setShowModal(true) 
  }

  const handleEmailChange = (email) => {
    f('email', email)
    const dup = checkDuplicate(email, null, editing?.id)
    setDuplicateWarning(dup)
  }

  const handlePhoneChange = (phone) => {
    f('phone', phone)
    const dup = checkDuplicate(null, phone, editing?.id)
    setDuplicateWarning(dup)
  }

  const addVehicle = () => {
    if (!vehicleForm.reg) return alert('Registration required')
    
    // Check if reg already exists in this customer's vehicles
    if (form.vehicles.some(v => v.reg.toUpperCase() === vehicleForm.reg.toUpperCase())) {
      return alert('This vehicle is already added')
    }
    
    // Check if reg exists for another customer
    const existingOwner = customers.find(c => {
      if (editing && c.id === editing.id) return false
      const vehicles = c.vehicles || []
      // Check old format too
      if (c.reg?.toUpperCase() === vehicleForm.reg.toUpperCase()) return true
      return vehicles.some(v => v.reg.toUpperCase() === vehicleForm.reg.toUpperCase())
    })
    
    if (existingOwner) {
      const confirm = window.confirm(
        `This vehicle (${vehicleForm.reg.toUpperCase()}) is currently registered to ${existingOwner.name}. ` +
        `Do you want to transfer it to this customer?`
      )
      if (!confirm) return
      
      // Remove vehicle from previous owner
      const updatedVehicles = (existingOwner.vehicles || []).filter(
        v => v.reg.toUpperCase() !== vehicleForm.reg.toUpperCase()
      )
      // Handle old format
      if (existingOwner.reg?.toUpperCase() === vehicleForm.reg.toUpperCase()) {
        updateCustomer(existingOwner.id, { reg: '', vehicle: '', vehicles: updatedVehicles })
      } else {
        updateCustomer(existingOwner.id, { vehicles: updatedVehicles })
      }
    }
    
    f('vehicles', [...form.vehicles, { 
      reg: vehicleForm.reg.toUpperCase(), 
      make: vehicleForm.make, 
      model: vehicleForm.model 
    }])
    setVehicleForm({ reg: '', make: '', model: '' })
    setShowVehicleModal(false)
  }

  const removeVehicle = (index) => {
    f('vehicles', form.vehicles.filter((_, i) => i !== index))
  }

  const save = () => {
    if (!form.name) return alert('Name required')
    
    // Final duplicate check
    const dup = checkDuplicate(form.email, form.phone, editing?.id)
    if (dup) {
      const proceed = window.confirm(
        `A customer with this ${dup.field} already exists (${dup.customer.name}). ` +
        `Are you sure you want to continue?`
      )
      if (!proceed) return
    }
    
    // For backwards compatibility, also set reg and vehicle from first vehicle
    const firstVehicle = form.vehicles[0] || {}
    const saveData = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      vehicles: form.vehicles,
      reg: firstVehicle.reg || '',
      vehicle: firstVehicle.model ? `${firstVehicle.make} ${firstVehicle.model}`.trim() : ''
    }
    
    if (editing) updateCustomer(editing.id, saveData)
    else addCustomer({ id: 'C' + Date.now(), ...saveData })
    setShowModal(false)
  }

  // Filter customers
  const filtered = customers.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const vehicles = c.vehicles || []
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.reg?.toLowerCase().includes(q) ||
      vehicles.some(v => v.reg?.toLowerCase().includes(q))
    )
  })

  return (
    <div>
      <PageHeader title="Customers" subtitle="Profiles, vehicles and invoice history">
        <Btn variant="primary" onClick={openAdd}>+ Add Customer</Btn>
      </PageHeader>

      {/* Global Search */}
      <div style={{ marginBottom: '16px' }}>
        <GlobalSearch maxWidth="500px" placeholder="Search customers, invoices, car reg..." />
      </div>

      {/* Page Filter */}
      <div style={{ marginBottom: '16px' }}>
        <input 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter customers on this page..."
          style={{ 
            ...inputStyle, 
            maxWidth: '300px',
            padding: '8px 12px',
          }}
        />
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{['Name', 'Contact', 'Vehicles', 'Invoices', 'Total Spent', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>
                  {search ? 'No customers match your search' : 'No customers yet. Add your first customer!'}
                </td></tr>
              ) : filtered.map(c => {
                const custInvs = invoices.filter(i => i.custId === c.id)
                const spent = custInvs.filter(i => i.status === 'paid').reduce((a, i) => a + i.lines.reduce((b, l) => b + l.qty * l.unit, 0), 0)
                const vehicles = c.vehicles || []
                // Include old format vehicle if exists
                const allVehicles = vehicles.length ? vehicles : (c.reg ? [{ reg: c.reg, model: c.vehicle }] : [])
                
                return (
                  <tr key={c.id} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                        {c.email && <div>📧 {c.email}</div>}
                        {c.phone && <div>📱 {c.phone}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {allVehicles.length === 0 ? (
                        <span style={{ color: 'var(--text3)', fontSize: '11px' }}>No vehicles</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {allVehicles.map((v, i) => (
                            <span key={i} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontFamily: 'DM Mono, monospace',
                              background: 'var(--surface3)',
                              border: '1px solid var(--border)',
                            }}>
                              🚗 {v.reg}
                              {v.model && <span style={{ color: 'var(--text3)' }}>({v.make} {v.model})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>{custInvs.length}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>£{spent.toFixed(2)}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <Btn sm variant="ghost" onClick={() => openEdit(c)}>Edit</Btn>
                        <Btn sm variant="danger" onClick={() => { 
                          if (custInvs.length > 0) {
                            alert(`Cannot delete ${c.name} - they have ${custInvs.length} invoice(s). Delete the invoices first.`)
                            return
                          }
                          if (confirm('Delete customer?')) deleteCustomer(c.id) 
                        }}>✕</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '26px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '19px', fontWeight: 700, marginBottom: '18px' }}>
              {editing ? 'Edit Customer' : 'Add Customer'}
            </div>
            
            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div style={{ 
                background: 'rgba(245,200,66,0.1)', 
                border: '1px solid rgba(245,200,66,0.3)', 
                borderRadius: '8px', 
                padding: '12px',
                marginBottom: '16px',
                fontSize: '12px',
                color: 'var(--accent)'
              }}>
                ⚠️ Customer with this {duplicateWarning.field} already exists: <strong>{duplicateWarning.customer.name}</strong>
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => f('name', e.target.value)} placeholder="John Smith" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Email</label>
                  <input 
                    style={{ ...inputStyle, borderColor: duplicateWarning?.field === 'email' ? 'var(--accent)' : undefined }} 
                    value={form.email} 
                    onChange={e => handleEmailChange(e.target.value)} 
                    placeholder="john@example.com" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Phone</label>
                  <input 
                    style={{ ...inputStyle, borderColor: duplicateWarning?.field === 'phone' ? 'var(--accent)' : undefined }} 
                    value={form.phone} 
                    onChange={e => handlePhoneChange(e.target.value)} 
                    placeholder="07700 900000" 
                  />
                </div>
              </div>

              {/* Vehicles Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)' }}>Vehicles</label>
                  <Btn sm variant="teal" onClick={() => setShowVehicleModal(true)}>+ Add Vehicle</Btn>
                </div>
                
                {form.vehicles.length === 0 ? (
                  <div style={{ 
                    background: 'var(--surface2)', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    textAlign: 'center',
                    color: 'var(--text3)',
                    fontSize: '12px'
                  }}>
                    No vehicles added. Click "Add Vehicle" to register a car.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.vehicles.map((v, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--surface2)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                      }}>
                        <div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{v.reg}</div>
                          {(v.make || v.model) && (
                            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                              {v.make} {v.model}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => removeVehicle(i)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--red)', 
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '18px' }}>
              <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={save}>Save Customer</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showVehicleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setShowVehicleModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '400px', maxWidth: '100%', padding: '24px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>
              Add Vehicle
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Registration *</label>
                <input 
                  style={{ ...inputStyle, textTransform: 'uppercase' }} 
                  value={vehicleForm.reg} 
                  onChange={e => vf('reg', e.target.value)} 
                  placeholder="MK21 ABC" 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Make</label>
                  <input style={inputStyle} value={vehicleForm.make} onChange={e => vf('make', e.target.value)} placeholder="Ford" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Model</label>
                  <input style={inputStyle} value={vehicleForm.model} onChange={e => vf('model', e.target.value)} placeholder="Focus" />
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Btn variant="secondary" onClick={() => setShowVehicleModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={addVehicle}>Add Vehicle</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}