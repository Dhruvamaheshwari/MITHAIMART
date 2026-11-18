import { useEffect, useState } from 'react'
import { Candy } from 'lucide-react'
import ProjectPhotoPicker from '../../components/ProjectPhotoPicker'
import adminApi from '../../services/adminApi'
import { formatPrice, getErrorMessage } from '../../utils/helpers'

const inputClass = 'w-full rounded-lg border border-brand-gold/60 px-3 py-2 outline-none focus:border-brand-red'

// Same limits as the backend (apps/products/image_upload.py)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_MB = 5

function backendMessage(err) {
  return (err.response && err.response.data && err.response.data.error) || getErrorMessage(err)
}

// ---------------------------------------------------------------------------
// Add / edit form
// ---------------------------------------------------------------------------
function ProductForm({ product, categories, onSaved, onCancel }) {
  const isEdit = product !== null
  const [name, setName] = useState(isEdit ? product.name : '')
  const [description, setDescription] = useState(isEdit ? product.description : '')
  const [categoryId, setCategoryId] = useState(isEdit ? product.category_id : '')
  const [imageUrl, setImageUrl] = useState(isEdit ? product.image_url : '')
  const [isActive, setIsActive] = useState(isEdit ? product.is_active : true)
  const [state, setState] = useState(isEdit ? product.state || '' : '')
  const [states, setStates] = useState([]) // names for the State drop-down
  // Existing weights (isNew: false) keep their stock: it is changed from the product list, not here.
  const [variants, setVariants] = useState(
    isEdit
      ? product.variants.map((v) => ({ weight: v.weight, price: String(v.price), stock: String(v.stock), is_available: v.is_available, isNew: false }))
      : [{ weight: '', price: '', stock: '0', is_available: true, isNew: true }],
  )
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Image upload state
  const [selectedFile, setSelectedFile] = useState(null) // chosen on the device but not uploaded yet
  const [previewUrl, setPreviewUrl] = useState('') // temporary link to show the chosen file
  const [fileInputKey, setFileInputKey] = useState(0) // changing it empties the file picker
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [uploadDone, setUploadDone] = useState(false)
  const [previewBroken, setPreviewBroken] = useState(false)
  const shownImage = selectedFile ? previewUrl : imageUrl.trim()

  // Free the memory of the temporary preview link when it changes or the form closes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function clearSelectedFile() {
    setSelectedFile(null)
    setPreviewUrl('')
    setFileInputKey((key) => key + 1)
  }

  // The browser checks type and size first so the admin gets a quick answer.
  // The backend checks them again, and that check is the one that counts.
  function handleFileChange(event) {
    const file = event.target.files[0]
    setUploadError('')
    setUploadDone(false)
    setPreviewBroken(false)
    if (!file) {
      clearSelectedFile()
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      clearSelectedFile()
      setUploadError('Only JPEG, PNG or WebP images are allowed.')
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      clearSelectedFile()
      setUploadError(`The image is too large. The maximum size is ${MAX_IMAGE_MB} MB.`)
      return
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // Send the file to OUR backend. The backend uploads it to Cloudinary (the Cloudinary secret
  // never reaches the browser) and answers with the image link.
  async function handleUpload() {
    if (!selectedFile || uploading) return
    const formData = new FormData()
    formData.append('image', selectedFile)
    setUploading(true)
    setUploadPercent(0)
    setUploadError('')
    try {
      const response = await adminApi.post('/admin/upload-image/', formData, {
        timeout: 60000,
        onUploadProgress: (progress) => {
          if (progress.total) setUploadPercent(Math.round((progress.loaded * 100) / progress.total))
        },
      })
      setImageUrl(response.data.url) // this link is saved with the product
      clearSelectedFile()
      setPreviewBroken(false)
      setUploadDone(true)
    } catch (err) {
      // The chosen file stays selected, so Save stays blocked until the upload works or the file is removed
      setUploadError(backendMessage(err))
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveImage() {
    setImageUrl('')
    setUploadDone(false)
    setPreviewBroken(false)
  }

  function changeVariant(index, field, value) {
    setVariants(variants.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)))
  }

  function addVariant() {
    setVariants([...variants, { weight: '', price: '', stock: '0', is_available: true, isNew: true }])
  }

  function removeVariant(index) {
    setVariants(variants.filter((_, i) => i !== index))
  }

  // Load the state names once for the State drop-down
  useEffect(() => {
    adminApi
      .get('/states/')
      .then((response) => setStates(response.data))
      .catch(() => setStates([]))
  }, [])

  // Quick checks for friendly messages. The backend checks everything again.
  function check() {
    const found = {}
    if (!name.trim()) found.name = 'Name is required.'
    if (!description.trim()) found.description = 'Description is required.'
    if (!categoryId) found.category_id = 'Choose a category.'
    if (variants.length === 0) found.variants = 'Add at least one weight.'
    // Never save a product while a chosen image is still waiting for its upload (or the upload failed)
    if (uploading) found.image_url = 'Please wait for the image upload to finish.'
    else if (selectedFile) found.image_url = 'You chose a file but did not upload it. Press "Upload image", or press "Remove file" to use a link or a project photo instead.'
    const seen = new Set()
    for (const [index, variant] of variants.entries()) {
      const label = `Weight ${index + 1}`
      const weight = variant.weight.trim().toLowerCase()
      if (!weight) found.variants = `${label}: enter a weight such as 250g.`
      else if (seen.has(weight)) found.variants = `${label}: "${variant.weight}" is repeated.`
      else if (variant.price === '' || Number.isNaN(Number(variant.price)) || Number(variant.price) < 0)
        found.variants = `${label}: price must be a number, 0 or more.`
      else if (variant.isNew && !/^\d+$/.test(variant.stock)) found.variants = `${label}: stock must be a whole number, 0 or more.`
      seen.add(weight)
    }
    return found
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const found = check()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const body = {
      name,
      description,
      category_id: categoryId,
      image_url: imageUrl.trim(),
      is_active: isActive,
      state,
      // For existing weights no stock is sent, so the backend keeps the current stock
      variants: variants.map((v) =>
        v.isNew
          ? { weight: v.weight.trim(), price: Number(v.price), stock: Number(v.stock), is_available: v.is_available }
          : { weight: v.weight, price: Number(v.price), is_available: v.is_available },
      ),
    }

    setSaving(true)
    try {
      if (isEdit) await adminApi.put(`/products/${product.id}/`, body)
      else await adminApi.post('/products/', body)
      onSaved(isEdit ? 'Product updated.' : 'Product added.')
    } catch (err) {
      const data = err.response && err.response.data
      if (data && data.details) setErrors(data.details)
      setFormError((data && data.error) || getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (field) => errors[field] && <p className="mt-1 text-sm text-brand-red">{errors[field]}</p>

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-brand-gold/40 bg-white p-5">
      <h2 className="text-xl font-semibold">{isEdit ? `Edit: ${product.name}` : 'Add a product'}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="product-name" className="block text-sm font-medium">Name *</label>
          <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          {fieldError('name')}
        </div>
        <div>
          <label htmlFor="product-category" className="block text-sm font-medium">Category *</label>
          <select id="product-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.is_active && ' (inactive)'}
              </option>
            ))}
          </select>
          {fieldError('category_id')}
        </div>
        <div>
          <label htmlFor="product-state" className="block text-sm font-medium">Origin state (optional)</label>
          <select id="product-state" value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
            <option value="">Not set</option>
            {states.map((stateName) => (
              <option key={stateName} value={stateName}>
                {stateName}
              </option>
            ))}
          </select>
          {fieldError('state')}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="product-description" className="block text-sm font-medium">Description *</label>
          <textarea id="product-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          {fieldError('description')}
        </div>
        <div className="sm:col-span-2">
          <p className="block text-sm font-medium">Product image (optional)</p>
          <div className="mt-2 flex flex-wrap items-start gap-4">
            {/* Preview: the chosen file (before upload) or the saved / pasted image link */}
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-brand-gold/40 bg-brand-cream">
              {shownImage && !previewBroken ? (
                <img src={shownImage} alt="Product preview" onError={() => setPreviewBroken(true)} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-brand-charcoal/60">
                  {shownImage ? 'Image could not be shown' : 'No image'}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <input
                key={fileInputKey}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={uploading}
                aria-label="Choose an image from your device"
                className="block w-full text-sm"
              />
              <p className="text-xs text-brand-charcoal/60">JPEG, PNG or WebP, up to {MAX_IMAGE_MB} MB.</p>

              {selectedFile && (
                <>
                  <p className="text-xs text-brand-charcoal/70">This file is not uploaded yet. Press "Upload image" to use it.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploading}
                      className="rounded-full bg-brand-saffron px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-red disabled:opacity-60"
                    >
                      {uploading ? `Uploading... ${uploadPercent}%` : 'Upload image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { clearSelectedFile(); setUploadError('') }}
                      disabled={uploading}
                      className="text-sm underline hover:text-brand-red disabled:opacity-60"
                    >
                      Remove file
                    </button>
                  </div>
                </>
              )}
              {uploading && (
                <div className="h-2 w-full overflow-hidden rounded bg-brand-cream" role="progressbar" aria-valuenow={uploadPercent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-brand-red transition-all" style={{ width: `${uploadPercent}%` }} />
                </div>
              )}
              {uploadError && <p role="alert" className="text-sm text-brand-red">{uploadError}</p>}
              {uploadDone && !selectedFile && <p role="status" className="text-sm text-green-800">Image uploaded. It is saved with the product when you press Save.</p>}
              {imageUrl && !selectedFile && (
                <button type="button" onClick={handleRemoveImage} disabled={uploading} className="text-sm underline hover:text-brand-red">
                  Remove image
                </button>
              )}
            </div>
          </div>

          <label htmlFor="product-image" className="mt-4 block text-sm font-medium">Or paste an image link</label>
          <input
            id="product-image"
            value={imageUrl}
            onChange={(e) => { clearSelectedFile(); setUploadError(''); setImageUrl(e.target.value); setPreviewBroken(false); setUploadDone(false) }}
            disabled={uploading}
            placeholder="https://example.com/kaju-katli.jpg"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-brand-charcoal/60">An http(s) link, or a path like /images/sweets/kaju-katli.jpg. File types: .jpg, .jpeg, .png, .webp, .gif, .avif.</p>
          <ProjectPhotoPicker
            id="product-photo-picker"
            disabled={uploading}
            onPick={(path) => { clearSelectedFile(); setUploadError(''); setImageUrl(path); setPreviewBroken(false); setUploadDone(false) }}
          />
          {fieldError('image_url')}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active (visible to customers)
      </label>

      <h3 className="mt-6 font-semibold">Weights and prices</h3>
      <ul className="mt-2 space-y-3">
        {variants.map((variant, index) => (
          <li key={index} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-brand-gold/30 p-3 sm:grid-cols-5">
            <div>
              <label className="block text-xs font-medium">Weight</label>
              <input value={variant.weight} disabled={!variant.isNew} onChange={(e) => changeVariant(index, 'weight', e.target.value)} placeholder="250g" aria-label={`Weight ${index + 1}`} className={`${inputClass} disabled:bg-brand-cream`} />
            </div>
            <div>
              <label className="block text-xs font-medium">Price (Rs)</label>
              <input type="number" min="0" step="0.01" value={variant.price} onChange={(e) => changeVariant(index, 'price', e.target.value)} aria-label={`Price ${index + 1}`} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium">Stock</label>
              {variant.isNew ? (
                <input type="number" min="0" step="1" value={variant.stock} onChange={(e) => changeVariant(index, 'stock', e.target.value)} aria-label={`Stock ${index + 1}`} className={inputClass} />
              ) : (
                <p className="py-2 text-sm" title="Change stock from the product list">{variant.stock} (edit in list)</p>
              )}
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={variant.is_available} onChange={(e) => changeVariant(index, 'is_available', e.target.checked)} />
              Available
            </label>
            <button type="button" onClick={() => removeVariant(index)} className="pb-2 text-left text-sm underline hover:text-brand-red">
              Remove
            </button>
          </li>
        ))}
      </ul>
      {fieldError('variants')}
      <button type="button" onClick={addVariant} className="mt-3 text-sm font-medium text-brand-red underline">
        + Add another weight
      </button>

      {formError && (
        <p role="alert" className="mt-4 rounded-lg border border-brand-red/40 bg-brand-red/5 p-3 text-sm text-brand-red">{formError}</p>
      )}

      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60">
          {saving ? 'Saving...' : 'Save product'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-brand-charcoal/30 px-6 py-2 hover:border-brand-red hover:text-brand-red">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState(null) // { ok, text }
  const [formProduct, setFormProduct] = useState(undefined) // undefined = hidden, null = add, object = edit
  const [stockEdits, setStockEdits] = useState({}) // "productId|weight" -> text typed by the admin

  function loadAll() {
    return Promise.all([adminApi.get('/admin/products/'), adminApi.get('/admin/categories/')])
      .then(([productsResponse, categoriesResponse]) => {
        setProducts(productsResponse.data.products)
        setCategories(categoriesResponse.data)
        setLoadError('')
      })
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
  }, [])

  function handleSaved(text) {
    setFormProduct(undefined)
    setMessage({ ok: true, text })
    loadAll()
  }

  async function handleToggleActive(product) {
    setMessage(null)
    try {
      // Same API as editing. No stock is sent, so stock stays as it is.
      await adminApi.put(`/products/${product.id}/`, {
        name: product.name,
        description: product.description,
        category_id: product.category_id,
        image_url: product.image_url,
        state: product.state,
        is_active: !product.is_active,
        variants: product.variants.map((v) => ({ weight: v.weight, price: v.price, is_available: v.is_available })),
      })
      setMessage({ ok: true, text: `${product.name} is now ${product.is_active ? 'inactive' : 'active'}.` })
      loadAll()
    } catch (err) {
      setMessage({ ok: false, text: backendMessage(err) })
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? Old orders keep their own copy of the product details.`)) return
    setMessage(null)
    try {
      await adminApi.delete(`/products/${product.id}/`)
      setMessage({ ok: true, text: `${product.name} was deleted.` })
      loadAll()
    } catch (err) {
      setMessage({ ok: false, text: backendMessage(err) })
    }
  }

  async function handleSaveStock(product, variant) {
    const key = `${product.id}|${variant.weight}`
    const typed = stockEdits[key]
    setMessage(null)
    if (!/^\d+$/.test(typed)) {
      setMessage({ ok: false, text: 'Stock must be a whole number, 0 or more.' })
      return
    }
    try {
      await adminApi.patch(`/admin/products/${product.id}/stock/`, { variant_weight: variant.weight, stock: Number(typed) })
      setStockEdits((edits) => {
        const next = { ...edits }
        delete next[key]
        return next
      })
      setMessage({ ok: true, text: `Stock of ${product.name} (${variant.weight}) is now ${typed}.` })
      loadAll()
    } catch (err) {
      setMessage({ ok: false, text: backendMessage(err) })
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Products</h1>
          <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
        </div>
        {formProduct === undefined && (
          <button type="button" onClick={() => { setMessage(null); setFormProduct(null) }} className="rounded-full bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-saffron">
            Add product
          </button>
        )}
      </div>

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`mt-6 rounded-lg border p-3 text-sm ${message.ok ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-red/40 bg-brand-red/5 text-brand-red'}`}>
          {message.text}
        </p>
      )}

      {formProduct !== undefined && (
        <div className="mt-6">
          <ProductForm key={formProduct ? formProduct.id : 'new'} product={formProduct} categories={categories} onSaved={handleSaved} onCancel={() => setFormProduct(undefined)} />
        </div>
      )}

      {loading && <p className="mt-8 text-brand-charcoal/70">Loading products...</p>}
      {loadError && <p className="mt-6 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">{loadError}</p>}
      {!loading && !loadError && products.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-brand-gold/60 p-10 text-center text-brand-charcoal/70">
          No products yet. Add your first product.
        </p>
      )}

      <ul className="mt-8 space-y-4">
        {products.map((product) => (
          <li key={product.id} className="rounded-xl border border-brand-gold/40 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-12 w-12 rounded-lg object-cover border border-brand-gold/40 shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-brand-cream border border-brand-gold/40 flex items-center justify-center shrink-0 text-brand-charcoal/40">
                    <Candy size={20} />
                  </div>
                )}
                <div>
                  <p className="font-display text-lg font-semibold">{product.name}</p>
                  <p className="text-sm text-brand-charcoal/70">{[product.category_name, product.state].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                {product.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase text-brand-charcoal/60">
                  <tr>
                    <th className="py-1 pr-3">Weight</th>
                    <th className="py-1 pr-3">Price</th>
                    <th className="py-1 pr-3">Available</th>
                    <th className="py-1">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => {
                    const key = `${product.id}|${variant.weight}`
                    const typed = stockEdits[key]
                    const changed = typed !== undefined && typed !== String(variant.stock)
                    return (
                      <tr key={variant.weight} className={variant.low_stock ? 'bg-amber-50' : ''}>
                        <td className="py-2 pr-3 font-medium">{variant.weight}</td>
                        <td className="py-2 pr-3">{formatPrice(variant.price)}</td>
                        <td className="py-2 pr-3">{variant.is_available ? 'Yes' : 'No'}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={typed !== undefined ? typed : variant.stock}
                              onChange={(e) => setStockEdits({ ...stockEdits, [key]: e.target.value })}
                              aria-label={`Stock for ${product.name} ${variant.weight}`}
                              className="w-24 rounded-lg border border-brand-gold/60 px-2 py-1"
                            />
                            {changed && (
                              <button type="button" onClick={() => handleSaveStock(product, variant)} className="rounded-full bg-brand-red px-3 py-1 text-xs font-medium text-white hover:bg-brand-saffron">
                                Save
                              </button>
                            )}
                            {variant.low_stock && (
                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                                {variant.stock === 0 ? 'Out of stock' : 'Low stock'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <button type="button" onClick={() => { setMessage(null); setFormProduct(product) }} className="underline hover:text-brand-red">Edit</button>
              <button type="button" onClick={() => handleToggleActive(product)} className="underline hover:text-brand-red">
                {product.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button type="button" onClick={() => handleDelete(product)} className="underline hover:text-brand-red">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
