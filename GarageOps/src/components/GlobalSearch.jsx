import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

/**
 * GlobalSearch - unified search across vehicles, customers, invoices and purchases.
 *
 * Searching a car reg surfaces the vehicle itself (→ Database page with its
 * full history), plus every matching customer, invoice and purchase.
 * Customers + invoices come from the store; purchases are fetched from
 * Supabase with a small debounce.
 *
 * Props:
 * - placeholder: Custom placeholder text
 * - onResultClick: Optional callback when a result is clicked (receives { type, item })
 * - autoFocus: Whether to focus the input on mount
 * - maxWidth: Max width of the search bar (default: '100%')
 * - showInSidebar: Compact mode for sidebar display
 */
export default function GlobalSearch({ 
  placeholder = "Search customers, invoices, car reg...",
  onResultClick,
  autoFocus = false,
  maxWidth = '100%',
  showInSidebar = false,
}) {
  const navigate = useNavigate()
  const { customers, invoices, garageId } = useStore()
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [purchaseHits, setPurchaseHits] = useState([])
  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  // Focus input on mount if autoFocus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // ---------- Purchases: debounced Supabase lookup ----------
  useEffect(() => {
    if (!garageId || search.trim().length < 2) { setPurchaseHits([]); return }
    const q = search.trim()
    const t = setTimeout(async () => {
      try {
        const like = `%${q.replace(/[%_,]/g, '')}%`
        const { data, error } = await supabase
          .from('purchases')
          .select('id, supplier, description, purchase_date, gross, vehicle_reg')
          .eq('account_id', garageId)
          .or(`vehicle_reg.ilike.${like},description.ilike.${like},supplier.ilike.${like},supplier_ref.ilike.${like}`)
          .order('purchase_date', { ascending: false })
          .limit(4)
        if (!error) setPurchaseHits(data || [])
      } catch { /* search stays usable even if the purchases lookup fails */ }
    }, 250)
    return () => clearTimeout(t)
  }, [search, garageId])

  const normReg = (r) => (r || '').replace(/\s+/g, '').toUpperCase()

  // Search function
  const getSearchResults = () => {
    if (search.length < 2) return { vehicles: [], customers: [], invoices: [], purchases: [], total: 0 }
    
    const q = search.toLowerCase().trim()
    const qReg = normReg(search)
    const results = { vehicles: [], customers: [], invoices: [], purchases: [] }

    // Vehicles — every reg the garage knows about, from any record
    const regSeen = new Set()
    const addReg = (reg) => {
      const key = normReg(reg)
      if (!key || regSeen.has(key) || !key.includes(qReg)) return
      regSeen.add(key)
      results.vehicles.push({ reg: (reg || '').toUpperCase().trim(), key })
    }
    if (qReg.length >= 2) {
      customers.forEach(c => {
        if (c.reg) addReg(c.reg)
        ;(c.vehicles || []).forEach(v => addReg(v.reg))
      })
      invoices.forEach(inv => addReg(inv.reg))
      purchaseHits.forEach(p => addReg(p.vehicle_reg))
    }
    results.vehicles = results.vehicles.slice(0, 3)
    
    // Search customers
    customers.forEach(c => {
      const vehicles = c.vehicles || []
      const matchesVehicle = vehicles.some(v => v.reg?.toLowerCase().includes(q))
      
      if (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.reg?.toLowerCase().includes(q) ||
        matchesVehicle
      ) {
        results.customers.push({
          ...c,
          matchedVehicle: matchesVehicle ? vehicles.find(v => v.reg?.toLowerCase().includes(q)) : null
        })
      }
    })
    results.customers = results.customers.slice(0, 5)
    
    // Search invoices
    invoices.forEach(inv => {
      if (
        inv.id?.toLowerCase().includes(q) ||
        inv.custName?.toLowerCase().includes(q) ||
        inv.custEmail?.toLowerCase().includes(q) ||
        inv.reg?.toLowerCase().includes(q)
      ) {
        results.invoices.push(inv)
      }
    })
    results.invoices = results.invoices.slice(0, 5)

    // Purchases (already limited by the Supabase query)
    results.purchases = purchaseHits
    
    results.total = results.vehicles.length + results.customers.length + results.invoices.length + results.purchases.length
    return results
  }

  const results = getSearchResults()
  const allResults = [
    ...results.vehicles.map(v => ({ type: 'vehicle', item: v })),
    ...results.customers.map(c => ({ type: 'customer', item: c })),
    ...results.invoices.map(i => ({ type: 'invoice', item: i })),
    ...results.purchases.map(p => ({ type: 'purchase', item: p })),
  ]

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showResults || allResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleResultClick(allResults[selectedIndex])
    } else if (e.key === 'Enter' && selectedIndex < 0 && results.vehicles.length > 0) {
      // Enter with nothing highlighted on a reg-ish search → straight to the Database
      e.preventDefault()
      handleResultClick({ type: 'vehicle', item: results.vehicles[0] })
    } else if (e.key === 'Escape') {
      setShowResults(false)
      setSelectedIndex(-1)
    }
  }

  // Handle result click
  const handleResultClick = (result) => {
    if (onResultClick) {
      onResultClick(result)
    }
    // Navigate — carry the record id / reg so the target page can open it.
    if (result.type === 'vehicle') {
      navigate(`/database?reg=${encodeURIComponent(result.item.reg)}`)
    } else if (result.type === 'customer') {
      navigate(`/customers?focus=${encodeURIComponent(result.item.id)}`, {
        state: { focusCustomerId: result.item.id },
      })
    } else if (result.type === 'invoice') {
      navigate(`/invoices?focus=${encodeURIComponent(result.item.id)}`, {
        state: { focusInvoiceId: result.item.id },
      })
    } else if (result.type === 'purchase') {
      navigate(`/purchases?q=${encodeURIComponent(result.item.vehicle_reg || search.trim())}`)
    }
    setShowResults(false)
    setSearch('')
    setSelectedIndex(-1)
  }

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(`[data-idx="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const inputStyle = {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: showInSidebar ? '12px' : '13px',
  }

  const sectionHeader = {
    padding: '10px 14px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '.8px',
    textTransform: 'uppercase',
    color: 'var(--text3)',
    fontFamily: 'DM Mono, monospace',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
  }

  const rowBase = (isSelected) => ({
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    background: isSelected ? 'var(--surface3)' : 'transparent',
  })

  const hoverHandlers = (globalIdx, isSelected) => ({
    onMouseEnter: e => {
      if (!isSelected) e.currentTarget.style.background = 'var(--surface2)'
      setSelectedIndex(globalIdx)
    },
    onMouseLeave: e => {
      if (!isSelected) e.currentTarget.style.background = ''
    },
  })

  // Section start offsets for keyboard indices
  const offV = 0
  const offC = results.vehicles.length
  const offI = offC + results.customers.length
  const offP = offI + results.invoices.length

  return (
    <div style={{ position: 'relative', maxWidth, width: '100%' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        background: 'var(--surface2)', 
        border: '1px solid var(--border)', 
        borderRadius: showInSidebar ? '8px' : '10px', 
        padding: showInSidebar ? '8px 12px' : '10px 14px',
      }}>
        <span style={{ color: 'var(--text3)', fontSize: showInSidebar ? '14px' : '16px' }}>🔍</span>
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setShowResults(true); setSelectedIndex(-1) }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={inputStyle}
        />
        {search && (
          <button 
            onClick={() => { setSearch(''); setShowResults(false); setSelectedIndex(-1) }}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '14px', padding: '0' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && search.length >= 2 && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
            onClick={() => { setShowResults(false); setSelectedIndex(-1) }} 
          />
          <div 
            ref={resultsRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 100,
              maxHeight: '420px',
              overflowY: 'auto',
            }}
          >
            {results.total === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                No results found for "{search}"
              </div>
            ) : (
              <>
                {/* Vehicles — full history in the Database */}
                {results.vehicles.length > 0 && (
                  <>
                    <div style={sectionHeader}>🚗 Vehicles ({results.vehicles.length})</div>
                    {results.vehicles.map((v, idx) => {
                      const globalIdx = offV + idx
                      const isSelected = selectedIndex === globalIdx
                      return (
                        <div
                          key={v.key}
                          data-idx={globalIdx}
                          onClick={() => handleResultClick({ type: 'vehicle', item: v })}
                          style={{ ...rowBase(isSelected), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          {...hoverHandlers(globalIdx, isSelected)}
                        >
                          <div style={{ fontWeight: 600, fontSize: '13px', fontFamily: 'DM Mono, monospace', letterSpacing: '1px' }}>{v.reg}</div>
                          <div style={{ fontSize: '11px', color: 'var(--accent)' }}>Full history →</div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Customers */}
                {results.customers.length > 0 && (
                  <>
                    <div style={sectionHeader}>👥 Customers ({results.customers.length})</div>
                    {results.customers.map((c, idx) => {
                      const globalIdx = offC + idx
                      const isSelected = selectedIndex === globalIdx
                      return (
                        <div 
                          key={c.id}
                          data-idx={globalIdx}
                          onClick={() => handleResultClick({ type: 'customer', item: c })}
                          style={rowBase(isSelected)}
                          {...hoverHandlers(globalIdx, isSelected)}
                        >
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', gap: '12px', marginTop: '2px', flexWrap: 'wrap' }}>
                            {c.email && <span>📧 {c.email}</span>}
                            {c.phone && <span>📱 {c.phone}</span>}
                            {c.matchedVehicle && (
                              <span style={{ 
                                background: 'rgba(245,200,66,0.15)', 
                                color: 'var(--accent)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontFamily: 'DM Mono, monospace',
                              }}>
                                🚗 {c.matchedVehicle.reg}
                              </span>
                            )}
                            {!c.matchedVehicle && c.reg && (
                              <span style={{ fontFamily: 'DM Mono, monospace' }}>🚗 {c.reg}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Invoices */}
                {results.invoices.length > 0 && (
                  <>
                    <div style={sectionHeader}>📄 Invoices ({results.invoices.length})</div>
                    {results.invoices.map((inv, idx) => {
                      const globalIdx = offI + idx
                      const isSelected = selectedIndex === globalIdx
                      const total = inv.lines?.reduce((a, l) => a + l.qty * l.unit, 0) || 0
                      return (
                        <div 
                          key={inv.id}
                          data-idx={globalIdx}
                          onClick={() => handleResultClick({ type: 'invoice', item: inv })}
                          style={{ 
                            ...rowBase(isSelected),
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          {...hoverHandlers(globalIdx, isSelected)}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{inv.custName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>
                              {inv.id} · {inv.reg} · {inv.date}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--accent)' }}>
                              £{total.toFixed(2)}
                            </div>
                            <div style={{ 
                              fontSize: '10px', 
                              fontWeight: 600,
                              color: inv.status === 'paid' ? 'var(--green)' : inv.status === 'overdue' ? 'var(--red)' : 'var(--text3)',
                            }}>
                              {inv.status?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Purchases */}
                {results.purchases.length > 0 && (
                  <>
                    <div style={sectionHeader}>🛒 Purchases ({results.purchases.length})</div>
                    {results.purchases.map((p, idx) => {
                      const globalIdx = offP + idx
                      const isSelected = selectedIndex === globalIdx
                      return (
                        <div
                          key={p.id}
                          data-idx={globalIdx}
                          onClick={() => handleResultClick({ type: 'purchase', item: p })}
                          style={{ ...rowBase(isSelected), display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                          {...hoverHandlers(globalIdx, isSelected)}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>
                              {p.supplier}{p.vehicle_reg ? ` · ${p.vehicle_reg}` : ''} · {p.purchase_date}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, flexShrink: 0 }}>
                            £{(Number(p.gross) || 0).toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Keyboard hint */}
                <div style={{ 
                  padding: '8px 14px', 
                  fontSize: '10px', 
                  color: 'var(--text3)',
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center',
                  background: 'var(--surface2)',
                }}>
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                  <span>Esc Close</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * PageSearch - A simpler search component for filtering page content
 * 
 * Props:
 * - value: Current search value
 * - onChange: Callback when value changes
 * - placeholder: Placeholder text
 * - maxWidth: Max width of search bar
 */
export function PageSearch({ value, onChange, placeholder = "Search...", maxWidth = "400px" }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px',
      background: 'var(--surface2)', 
      border: '1px solid var(--border)', 
      borderRadius: '8px', 
      padding: '8px 12px',
      maxWidth,
      width: '100%',
    }}>
      <span style={{ color: 'var(--text3)', fontSize: '14px' }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: '12px',
        }}
      />
      {value && (
        <button 
          onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '12px', padding: '0' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
