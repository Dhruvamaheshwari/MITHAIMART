import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Layers,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react'
import adminApi from '../../services/adminApi'
import { formatDate, formatPrice, getErrorMessage } from '../../utils/helpers'

const STATUS_OPTIONS = [
  'All',
  'Pending',
  'Under Review',
  'Quotation Sent',
  'Accepted',
  'Converted to Order',
  'Rejected',
  'Expired',
]

export default function AdminWholesale() {
  const [activeTab, setActiveTab] = useState('requests') // 'requests' | 'settings'

  // Requests state
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [message, setMessage] = useState(null) // { ok, text }

  // Detail Modal state
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // Quotation Form inside Modal
  const [quoteForm, setQuoteForm] = useState({
    quoted_total_price: '',
    valid_days: 7,
    customer_notes: '',
    admin_notes: '',
  })
  const [sendingQuote, setSendingQuote] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [newStatusChoice, setNewStatusChoice] = useState('')

  // Bulk Settings state
  const [settings, setSettings] = useState({
    active: true,
    min_bulk_kg: 5.0,
    instant_order_max_kg: 50.0,
    quotation_threshold_kg: 50.0,
    slabs: [],
  })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Fetch requests
  useEffect(() => {
    fetchRequests()
    fetchSettings()
  }, [])

  async function fetchRequests() {
    setLoading(true)
    setLoadError('')
    try {
      const response = await adminApi.get('/admin/wholesale/')
      setRequests(Array.isArray(response.data) ? response.data : (response.data?.requests || []))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function fetchSettings() {
    setSettingsLoading(true)
    try {
      const response = await adminApi.get('/admin/bulk/settings/')
      if (response.data) {
        setSettings({
          active: response.data.is_active ?? response.data.active ?? true,
          min_bulk_kg: response.data.min_bulk_kg ?? 5.0,
          instant_order_max_kg: response.data.instant_order_max_kg ?? 50.0,
          quotation_threshold_kg: response.data.quotation_threshold_kg ?? 50.0,
          slabs: response.data.slabs || [],
        })
      }
    } catch (err) {
      console.error('Failed to load bulk settings', err)
    } finally {
      setSettingsLoading(false)
    }
  }

  async function handleOpenDetail(requestId) {
    setDetailLoading(true)
    setDetailError('')
    setSelectedRequest(null)
    setNewStatusChoice('')
    try {
      const response = await adminApi.get(`/admin/wholesale/${requestId}/`)
      const data = response.data
      setSelectedRequest(data)
      setNewStatusChoice(data.status)
      setQuoteForm({
        quoted_total_price: data.quoted_price ?? data.quoted_total_price ?? data.estimated_normal_total ?? data.estimated_total ?? '',
        valid_days: 7,
        customer_notes: data.quotation_notes || '',
        admin_notes: data.admin_notes || '',
      })
    } catch (err) {
      setDetailError(getErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleSendQuotation(e) {
    e.preventDefault()
    if (!selectedRequest) return
    const price = parseFloat(quoteForm.quoted_total_price)
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid quoted total price greater than 0.')
      return
    }

    setSendingQuote(true)
    try {
      const payload = {
        quoted_price: price,
        validity_days: parseInt(quoteForm.valid_days, 10) || 7,
        quotation_notes: quoteForm.customer_notes.trim(),
        admin_notes: quoteForm.admin_notes.trim(),
      }
      const response = await adminApi.put(
        `/admin/wholesale/${selectedRequest.request_id}/quotation/`,
        payload
      )
      setMessage({
        ok: true,
        text: `Official quotation sent for ${selectedRequest.request_id}! Price: ${formatPrice(price)}. Status updated to Quotation Sent.`,
      })
      // update state
      setSelectedRequest(response.data)
      fetchRequests()
    } catch (err) {
      const errorMsg =
        (err.response && err.response.data && err.response.data.error) ||
        getErrorMessage(err)
      alert(`Failed to send quotation: ${errorMsg}`)
    } finally {
      setSendingQuote(false)
    }
  }

  async function handleUpdateStatus() {
    if (!selectedRequest || !newStatusChoice || newStatusChoice === selectedRequest.status) return
    setStatusUpdating(true)
    try {
      const response = await adminApi.put(
        `/admin/wholesale/${selectedRequest.request_id}/status/`,
        { status: newStatusChoice }
      )
      setMessage({
        ok: true,
        text: `Status for ${selectedRequest.request_id} updated to ${newStatusChoice}.`,
      })
      setSelectedRequest(response.data)
      fetchRequests()
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      const response = await adminApi.post('/admin/bulk/settings/', {
        is_active: settings.active,
        min_bulk_kg: settings.min_bulk_kg,
        instant_order_max_kg: settings.instant_order_max_kg,
        quotation_threshold_kg: settings.quotation_threshold_kg,
        slabs: settings.slabs,
      })
      setMessage({
        ok: true,
        text: 'Bulk pricing discount rules and slabs successfully saved!',
      })
      if (response.data.rules) {
        setSettings({
          active: response.data.rules.is_active ?? response.data.rules.active ?? true,
          min_bulk_kg: response.data.rules.min_bulk_kg ?? 5.0,
          instant_order_max_kg: response.data.rules.instant_order_max_kg ?? 50.0,
          quotation_threshold_kg: response.data.rules.quotation_threshold_kg ?? 50.0,
          slabs: response.data.rules.slabs || [],
        })
      }
    } catch (err) {
      setMessage({
        ok: false,
        text: `Error saving settings: ${getErrorMessage(err)}`,
      })
    } finally {
      setSettingsSaving(false)
    }
  }

  function handleSlabChange(index, field, value) {
    setSettings((prev) => {
      const nextSlabs = [...prev.slabs]
      nextSlabs[index] = {
        ...nextSlabs[index],
        [field]: field === 'discount_percentage' ? parseFloat(value) || 0 : (value === '' ? null : parseFloat(value)),
      }
      return { ...prev, slabs: nextSlabs }
    })
  }

  function handleAddSlab() {
    setSettings((prev) => ({
      ...prev,
      slabs: [
        ...prev.slabs,
        { min_kg: 50, max_kg: null, discount_percentage: 15 },
      ],
    }))
  }

  function handleRemoveSlab(index) {
    setSettings((prev) => ({
      ...prev,
      slabs: prev.slabs.filter((_, i) => i !== index),
    }))
  }

  const filteredRequests =
    statusFilter === 'All'
      ? requests
      : requests.filter((r) => r.status === statusFilter)

  return (
    <section className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">
            Bulk & Wholesale Orders
          </h1>
          <p className="mt-1 text-sm text-brand-charcoal/70">
            Manage large quantity wholesale enquiries, live stock checks, custom quotes, and volume discount slabs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'requests'
                ? 'bg-brand-red text-white shadow-sm'
                : 'border border-brand-gold/40 bg-white text-brand-charcoal hover:bg-brand-cream/50'
            }`}
          >
            <Package className="h-4 w-4" />
            Wholesale Enquiries ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'settings'
                ? 'bg-brand-red text-white shadow-sm'
                : 'border border-brand-gold/40 bg-white text-brand-charcoal hover:bg-brand-cream/50'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Discount Rules & Slabs
          </button>
        </div>
      </div>

      {message && (
        <div
          role={message.ok ? 'status' : 'alert'}
          className={`flex items-center justify-between rounded-lg border p-4 text-sm ${
            message.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-brand-red/40 bg-brand-red/5 text-brand-red'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.ok ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-brand-red shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: WHOLESALE ENQUIRIES */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-gold/30 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/60">
                Status:
              </span>
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    statusFilter === status
                      ? 'bg-brand-gold text-brand-charcoal font-semibold shadow-xs'
                      : 'bg-brand-cream/60 text-brand-charcoal/70 hover:bg-brand-cream'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchRequests}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-charcoal/70 hover:text-brand-red"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading && (
            <div className="py-16 text-center text-brand-charcoal/60">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-brand-gold" />
              Loading wholesale requests...
            </div>
          )}

          {loadError && (
            <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">
              {loadError}
            </p>
          )}

          {!loading && !loadError && filteredRequests.length === 0 && (
            <div className="rounded-xl border border-dashed border-brand-gold/50 bg-white p-12 text-center text-brand-charcoal/70">
              <Package className="mx-auto mb-3 h-10 w-10 text-brand-gold/60" />
              <p className="font-semibold">No wholesale requests found</p>
              <p className="text-xs text-brand-charcoal/50 mt-1">
                {statusFilter === 'All'
                  ? 'No customer has submitted a wholesale quotation request yet.'
                  : `No requests with status "${statusFilter}".`}
              </p>
            </div>
          )}

          {/* Requests Grid / Table */}
          {!loading && !loadError && filteredRequests.length > 0 && (
            <div className="grid gap-4">
              {filteredRequests.map((req) => {
                const isPending = req.status === 'Pending'
                const isQuotationSent = req.status === 'Quotation Sent'
                const isAccepted = req.status === 'Accepted'
                const isConverted = req.status === 'Converted to Order'

                let badgeColor = 'bg-amber-100 text-amber-800 border-amber-200'
                if (isPending) badgeColor = 'bg-amber-50 text-amber-800 border-amber-300'
                if (isQuotationSent) badgeColor = 'bg-sky-50 text-sky-800 border-sky-300'
                if (isAccepted) badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300'
                if (isConverted) badgeColor = 'bg-green-100 text-green-900 border-green-400 font-bold'
                if (req.status === 'Rejected') badgeColor = 'bg-red-50 text-red-800 border-red-200'

                return (
                  <div
                    key={req.request_id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-brand-gold/30 bg-white p-5 shadow-xs transition hover:border-brand-gold/70 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-brand-charcoal">
                          {req.request_id}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}
                        >
                          {req.status}
                        </span>
                        {req.is_converted_to_order && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Order Placed: {req.converted_order_number}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-charcoal">
                        <span className="font-semibold text-brand-charcoal">
                          {req.customer_name}
                        </span>
                        {req.business_name && (
                          <span className="flex items-center gap-1 text-xs text-brand-charcoal/70">
                            <Building className="h-3.5 w-3.5 text-brand-gold" />
                            {req.business_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-brand-charcoal/70">
                          <Phone className="h-3.5 w-3.5" />
                          {req.phone}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-brand-charcoal/70">
                          <MapPin className="h-3.5 w-3.5" />
                          {req.delivery_city}, {req.delivery_state}
                        </span>
                      </div>

                      <p className="text-xs text-brand-charcoal/60">
                        {req.items?.length || 0} Sweet Items &middot; Total Weight:
                        <strong className="text-brand-charcoal"> {req.total_kg || 0} kg</strong> &middot;
                        Received: {formatDate(req.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <p className="text-xs text-brand-charcoal/60">Estimated Total</p>
                        <p className="font-display text-base font-bold text-brand-charcoal">
                          {formatPrice(req.estimated_total || 0)}
                        </p>
                        {req.quoted_total_price && (
                          <p className="text-xs font-bold text-emerald-700">
                            Quoted: {formatPrice(req.quoted_total_price)}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenDetail(req.request_id)}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-cream px-3.5 py-2 text-xs font-bold text-brand-charcoal border border-brand-gold/40 hover:bg-brand-red hover:text-white transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review / Quote
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISCOUNT RULES & SLABS SETTINGS */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-2xl border border-brand-gold/40 bg-white p-6 shadow-xs space-y-6"
        >
          <div>
            <h2 className="text-xl font-bold text-brand-charcoal">
              Bulk Discount Pricing Rules
            </h2>
            <p className="text-xs text-brand-charcoal/60 mt-1">
              Configure product-wise quantity slabs and thresholds for automatic bulk discounts and wholesale quotation routing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-gold/30 bg-brand-cream/30 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                Rule Status
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active_rule"
                  checked={settings.active}
                  onChange={(e) =>
                    setSettings({ ...settings, active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-brand-gold text-brand-red focus:ring-brand-gold"
                />
                <label htmlFor="active_rule" className="text-sm font-semibold text-brand-charcoal">
                  {settings.active ? 'Bulk Rules Active' : 'Bulk Rules Disabled'}
                </label>
              </div>
              <p className="mt-1 text-[11px] text-brand-charcoal/50">
                When disabled, standard prices apply without volume discounts.
              </p>
            </div>

            <div className="rounded-xl border border-brand-gold/30 bg-brand-cream/30 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                Minimum Bulk Quantity (kg)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={settings.min_bulk_kg}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    min_bulk_kg: parseFloat(e.target.value) || 1,
                  })
                }
                className="mt-2 w-full rounded-lg border border-brand-gold/40 bg-white px-3 py-2 text-sm font-semibold text-brand-charcoal"
              />
              <p className="mt-1 text-[11px] text-brand-charcoal/50">
                Minimum sweet weight for bulk eligibility.
              </p>
            </div>

            <div className="rounded-xl border border-brand-gold/30 bg-brand-cream/30 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                Instant Order Max Limit (kg)
              </label>
              <input
                type="number"
                step="1"
                min="5"
                value={settings.instant_order_max_kg}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instant_order_max_kg: parseFloat(e.target.value) || 50,
                    quotation_threshold_kg: parseFloat(e.target.value) || 50,
                  })
                }
                className="mt-2 w-full rounded-lg border border-brand-gold/40 bg-white px-3 py-2 text-sm font-semibold text-brand-charcoal"
              />
              <p className="mt-1 text-[11px] text-brand-charcoal/50">
                Orders beyond this size require a custom quotation enquiry.
              </p>
            </div>
          </div>

          {/* Slabs Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-brand-charcoal">
                  Volume Quantity Slabs (Product-wise)
                </h3>
                <p className="text-xs text-brand-charcoal/60">
                  Each sweet receives a percentage discount matching its own accumulated weight.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSlab}
                className="flex items-center gap-1 rounded-lg border border-brand-gold/60 bg-white px-3 py-1.5 text-xs font-bold text-brand-charcoal hover:bg-brand-cream transition"
              >
                <Plus className="h-3.5 w-3.5 text-brand-red" />
                Add Slab Tier
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-brand-gold/30">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-cream/70 text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                  <tr>
                    <th className="px-4 py-3">Min Weight (kg)</th>
                    <th className="px-4 py-3">Max Weight (kg)</th>
                    <th className="px-4 py-3">Discount (%)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-gold/20">
                  {settings.slabs.map((slab, idx) => (
                    <tr key={idx} className="hover:bg-brand-cream/20">
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={slab.min_kg}
                          onChange={(e) =>
                            handleSlabChange(idx, 'min_kg', e.target.value)
                          }
                          className="w-28 rounded-md border border-brand-gold/40 px-2 py-1 text-xs font-semibold"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="No upper limit"
                          value={slab.max_kg ?? ''}
                          onChange={(e) =>
                            handleSlabChange(idx, 'max_kg', e.target.value)
                          }
                          className="w-28 rounded-md border border-brand-gold/40 px-2 py-1 text-xs font-semibold"
                        />
                        <span className="ml-1 text-[11px] text-brand-charcoal/50">
                          {slab.max_kg == null ? '(e.g. 50+ kg)' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={slab.discount_percentage}
                            onChange={(e) =>
                              handleSlabChange(
                                idx,
                                'discount_percentage',
                                e.target.value
                              )
                            }
                            className="w-20 rounded-md border border-brand-gold/40 px-2 py-1 text-xs font-bold text-brand-red"
                          />
                          <span className="font-bold text-brand-charcoal">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSlab(idx)}
                          className="rounded p-1 text-brand-charcoal/50 hover:bg-brand-red/10 hover:text-brand-red transition"
                          title="Remove tier"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={settingsSaving}
              className="flex items-center gap-2 rounded-xl bg-brand-red px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-red/90 disabled:opacity-50 transition"
            >
              {settingsSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving Slabs...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Discount Rules
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* DETAIL & QUOTATION MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-gold/40 bg-brand-cream/80 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-brand-red" />
                <div>
                  <h3 className="font-display text-lg font-bold text-brand-charcoal">
                    Wholesale Enquiry &middot; {selectedRequest.request_id}
                  </h3>
                  <p className="text-xs text-brand-charcoal/60">
                    Received on {formatDate(selectedRequest.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-full p-1 text-brand-charcoal/60 hover:bg-brand-cream hover:text-brand-charcoal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Contact Details */}
              <div className="rounded-xl border border-brand-gold/30 bg-brand-cream/20 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                  Buyer Information
                </h4>
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-brand-charcoal/60">Customer Name:</span>
                    <p className="font-semibold text-brand-charcoal">{selectedRequest.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-brand-charcoal/60">Business / Organisation:</span>
                    <p className="font-semibold text-brand-charcoal">
                      {selectedRequest.business_name || 'Individual / Family Event'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-brand-charcoal/60">Contact Phone:</span>
                    <p className="font-semibold text-brand-charcoal">{selectedRequest.phone}</p>
                  </div>
                  <div>
                    <span className="text-xs text-brand-charcoal/60">Email:</span>
                    <p className="font-semibold text-brand-charcoal">{selectedRequest.email}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-brand-charcoal/60">Delivery Address:</span>
                    <p className="font-semibold text-brand-charcoal">
                      {selectedRequest.delivery_city}, {selectedRequest.delivery_state} - {selectedRequest.delivery_pincode}
                    </p>
                  </div>
                  {selectedRequest.preferred_delivery_date && (
                    <div>
                      <span className="text-xs text-brand-charcoal/60">Preferred Delivery Date:</span>
                      <p className="font-semibold text-brand-charcoal">{selectedRequest.preferred_delivery_date}</p>
                    </div>
                  )}
                  {selectedRequest.additional_notes && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-brand-charcoal/60">Customer Remarks:</span>
                      <p className="italic text-brand-charcoal/80 bg-white/70 p-2 rounded border border-brand-gold/20 text-xs mt-0.5">
                        &quot;{selectedRequest.additional_notes}&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Requested Items with Live Stock Check */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-brand-charcoal">
                    Requested Sweets & Live Kitchen Stock
                  </h4>
                  <span className="text-xs text-brand-charcoal/60">
                    Total Weight: <strong>{selectedRequest.total_kg} kg</strong>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-brand-gold/30">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-brand-cream/60 text-xs font-bold uppercase text-brand-charcoal/70">
                      <tr>
                        <th className="px-4 py-2.5">Sweet</th>
                        <th className="px-4 py-2.5">Variant</th>
                        <th className="px-4 py-2.5">Qty</th>
                        <th className="px-4 py-2.5">Total Wt</th>
                        <th className="px-4 py-2.5">Live Stock</th>
                        <th className="px-4 py-2.5 text-right">Standard Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-gold/20">
                      {selectedRequest.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-brand-cream/10">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {it.product_image && (
                                <img
                                  src={it.product_image}
                                  alt={it.product_name}
                                  className="h-9 w-9 rounded-md object-cover border border-brand-gold/30"
                                />
                              )}
                              <span className="font-semibold text-brand-charcoal text-xs">
                                {it.product_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">{it.variant_weight}</td>
                          <td className="px-4 py-3 text-xs font-bold">{it.quantity}</td>
                          <td className="px-4 py-3 text-xs font-semibold">{it.total_kg} kg</td>
                          <td className="px-4 py-3 text-xs">
                            {it.stock_available ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Check className="h-3 w-3" />
                                {it.current_stock} in stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-brand-red font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                <AlertCircle className="h-3 w-3" />
                                Low stock ({it.current_stock})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-brand-charcoal">
                            {formatPrice(it.line_total || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-6 text-xs text-brand-charcoal/70 pt-1">
                  <span>
                    Original Total: <strong>{formatPrice(selectedRequest.estimated_original || 0)}</strong>
                  </span>
                  <span>
                    Estimated Bulk Discount: <strong className="text-emerald-700">-{formatPrice(selectedRequest.estimated_discount || 0)}</strong>
                  </span>
                  <span>
                    System Estimate: <strong className="font-bold text-brand-charcoal text-sm">{formatPrice(selectedRequest.estimated_total || 0)}</strong>
                  </span>
                </div>
              </div>

              {/* Status Update Quick Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-gold/30 bg-white p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-charcoal">Current Status:</span>
                  <select
                    value={newStatusChoice}
                    onChange={(e) => setNewStatusChoice(e.target.value)}
                    className="rounded-lg border border-brand-gold/40 px-3 py-1.5 text-xs font-semibold"
                  >
                    {STATUS_OPTIONS.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleUpdateStatus}
                    disabled={statusUpdating || newStatusChoice === selectedRequest.status}
                    className="rounded-lg bg-brand-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red disabled:opacity-40 transition"
                  >
                    {statusUpdating ? 'Updating...' : 'Update Status'}
                  </button>
                </div>

                {selectedRequest.is_converted_to_order && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                    Order Placed: #{selectedRequest.converted_order_number}
                  </span>
                )}
              </div>

              {/* Quotation Sending Form (if not yet converted) */}
              {!selectedRequest.is_converted_to_order && (
                <form
                  onSubmit={handleSendQuotation}
                  className="rounded-xl border border-brand-gold/50 bg-brand-cream/30 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-brand-charcoal flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-brand-gold" />
                      {selectedRequest.quoted_total_price
                        ? 'Update Official Quotation'
                        : 'Generate Official Quotation'}
                    </h4>
                    {selectedRequest.quoted_at && (
                      <span className="text-[11px] text-brand-charcoal/60">
                        Last Quoted: {formatDate(selectedRequest.quoted_at)}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                        Quoted Total Price (₹) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required
                        value={quoteForm.quoted_total_price}
                        onChange={(e) =>
                          setQuoteForm({
                            ...quoteForm,
                            quoted_total_price: e.target.value,
                          })
                        }
                        placeholder="e.g. 45000"
                        className="mt-1 w-full rounded-lg border border-brand-gold/40 bg-white px-3 py-2 text-sm font-bold text-emerald-800"
                      />
                      <p className="mt-1 text-[11px] text-brand-charcoal/50">
                        Final all-inclusive discounted price offered to the buyer.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                        Quotation Validity (Days)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="60"
                        value={quoteForm.valid_days}
                        onChange={(e) =>
                          setQuoteForm({
                            ...quoteForm,
                            valid_days: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-brand-gold/40 bg-white px-3 py-2 text-sm font-semibold"
                      />
                      <p className="mt-1 text-[11px] text-brand-charcoal/50">
                        How many days the customer has to accept this offer before expiry.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                      Message / Notes to Customer
                    </label>
                    <textarea
                      rows={2}
                      value={quoteForm.customer_notes}
                      onChange={(e) =>
                        setQuoteForm({
                          ...quoteForm,
                          customer_notes: e.target.value,
                        })
                      }
                      placeholder="e.g. Special festive packaging included. Free temperature-controlled delivery."
                      className="mt-1 w-full rounded-lg border border-brand-gold/40 bg-white p-2.5 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                      Internal Admin Notes (Private)
                    </label>
                    <textarea
                      rows={1}
                      value={quoteForm.admin_notes}
                      onChange={(e) =>
                        setQuoteForm({
                          ...quoteForm,
                          admin_notes: e.target.value,
                        })
                      }
                      placeholder="Internal remarks for store team..."
                      className="mt-1 w-full rounded-lg border border-brand-gold/40 bg-white p-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="rounded-xl border border-brand-gold/40 px-4 py-2 text-xs font-bold text-brand-charcoal hover:bg-brand-cream transition"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={sendingQuote}
                      className="flex items-center gap-2 rounded-xl bg-brand-red px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-red/90 disabled:opacity-50 transition"
                    >
                      {sendingQuote ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Send Official Quotation
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
