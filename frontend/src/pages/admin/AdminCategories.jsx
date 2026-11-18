import { useEffect, useState } from 'react'
import ProjectPhotoPicker from '../../components/ProjectPhotoPicker'
import adminApi from '../../services/adminApi'
import { getErrorMessage } from '../../utils/helpers'

const inputClass = 'w-full rounded-lg border border-brand-gold/60 px-3 py-2 outline-none focus:border-brand-red'

function backendMessage(err) {
  return (err.response && err.response.data && err.response.data.error) || getErrorMessage(err)
}

// Add / edit form
function CategoryForm({ category, onSaved, onCancel }) {
  const isEdit = category !== null
  const [name, setName] = useState(isEdit ? category.name : '')
  const [description, setDescription] = useState(isEdit ? category.description : '')
  const [imageUrl, setImageUrl] = useState(isEdit ? category.image_url : '')
  const [isActive, setIsActive] = useState(isEdit ? category.is_active : true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    if (!name.trim()) {
      setErrors({ name: 'Name is required.' })
      return
    }
    setErrors({})
    const body = { name, description, image_url: imageUrl.trim(), is_active: isActive }
    setSaving(true)
    try {
      if (isEdit) await adminApi.put(`/categories/${category.id}/`, body)
      else await adminApi.post('/categories/', body)
      onSaved(isEdit ? 'Category updated.' : 'Category added.')
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
      <h2 className="text-xl font-semibold">{isEdit ? `Edit: ${category.name}` : 'Add a category'}</h2>
      <div className="mt-4 grid gap-4">
        <div>
          <label htmlFor="category-name" className="block text-sm font-medium">Name *</label>
          <input id="category-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          {fieldError('name')}
        </div>
        <div>
          <label htmlFor="category-description" className="block text-sm font-medium">Description (optional)</label>
          <textarea id="category-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          {fieldError('description')}
        </div>
        <div>
          <label htmlFor="category-image" className="block text-sm font-medium">Image URL (optional)</label>
          <input id="category-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/category.jpg" className={inputClass} />
          <p className="mt-1 text-xs text-brand-charcoal/60">An http(s) link, or a path like /images/sweets/barfi.jpg. File types: .jpg, .jpeg, .png, .webp, .gif, .avif.</p>
          <ProjectPhotoPicker id="category-photo-picker" onPick={setImageUrl} />
          {fieldError('image_url')}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (visible to customers)
        </label>
      </div>

      {formError && (
        <p role="alert" className="mt-4 rounded-lg border border-brand-red/40 bg-brand-red/5 p-3 text-sm text-brand-red">{formError}</p>
      )}

      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60">
          {saving ? 'Saving...' : 'Save category'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-brand-charcoal/30 px-6 py-2 hover:border-brand-red hover:text-brand-red">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState(null) // { ok, text }
  const [formCategory, setFormCategory] = useState(undefined) // undefined = hidden, null = add, object = edit

  function loadCategories() {
    return adminApi
      .get('/admin/categories/')
      .then((response) => {
        setCategories(response.data)
        setLoadError('')
      })
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCategories()
  }, [])

  function handleSaved(text) {
    setFormCategory(undefined)
    setMessage({ ok: true, text })
    loadCategories()
  }

  async function handleToggleActive(category) {
    setMessage(null)
    try {
      await adminApi.put(`/categories/${category.id}/`, {
        name: category.name,
        description: category.description,
        image_url: category.image_url,
        is_active: !category.is_active,
      })
      setMessage({ ok: true, text: `${category.name} is now ${category.is_active ? 'inactive' : 'active'}.` })
      loadCategories()
    } catch (err) {
      setMessage({ ok: false, text: backendMessage(err) })
    }
  }

  // The backend refuses to delete a category that still has products and says why (409).
  async function handleDelete(category) {
    if (!window.confirm(`Delete the category "${category.name}"?`)) return
    setMessage(null)
    try {
      await adminApi.delete(`/categories/${category.id}/`)
      setMessage({ ok: true, text: `${category.name} was deleted.` })
      loadCategories()
    } catch (err) {
      setMessage({ ok: false, text: `Could not delete "${category.name}". ${backendMessage(err)}` })
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Categories</h1>
          <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
        </div>
        {formCategory === undefined && (
          <button type="button" onClick={() => { setMessage(null); setFormCategory(null) }} className="rounded-full bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-saffron">
            Add category
          </button>
        )}
      </div>

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`mt-6 rounded-lg border p-3 text-sm ${message.ok ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-red/40 bg-brand-red/5 text-brand-red'}`}>
          {message.text}
        </p>
      )}

      {formCategory !== undefined && (
        <div className="mt-6">
          <CategoryForm key={formCategory ? formCategory.id : 'new'} category={formCategory} onSaved={handleSaved} onCancel={() => setFormCategory(undefined)} />
        </div>
      )}

      {loading && <p className="mt-8 text-brand-charcoal/70">Loading categories...</p>}
      {loadError && <p className="mt-6 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">{loadError}</p>}
      {!loading && !loadError && categories.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-brand-gold/60 p-10 text-center text-brand-charcoal/70">
          No categories yet. Add your first category.
        </p>
      )}

      <ul className="mt-8 grid gap-4 lg:grid-cols-2">
        {categories.map((category) => (
          <li key={category.id} className="rounded-xl border border-brand-gold/40 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{category.name}</p>
                {category.description && <p className="text-sm text-brand-charcoal/70">{category.description}</p>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${category.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                {category.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-2 text-sm">
              Products in this category: <span className="font-semibold">{category.product_count}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <button type="button" onClick={() => { setMessage(null); setFormCategory(category) }} className="underline hover:text-brand-red">Edit</button>
              <button type="button" onClick={() => handleToggleActive(category)} className="underline hover:text-brand-red">
                {category.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button type="button" onClick={() => handleDelete(category)} className="underline hover:text-brand-red">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
