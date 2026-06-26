'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/products'
import { createProduct, updateProduct, uploadProductImage } from './actions'
import type { ProductInput } from './schema'

type SizeRow = { id?: string; mg: string; price: string; sku: string }

type InitialProduct = {
  code: string
  name: string
  sub?: string | null
  category: string
  image?: string | null
  mechanism?: string | null
  tagline?: string | null
  purity?: string | null
  blurb?: string | null
  rating?: number | null
  reviews?: number | null
  bestseller?: boolean | null
  featured?: boolean | null
  compare_at?: number | null
  product_sizes?: Array<{ id: string; mg: string; price: number; sku: string }>
}

function emptySizeRow(): SizeRow {
  return { mg: '', price: '', sku: '' }
}

function autoSku(code: string, mg: string): string {
  return `${code}-${mg.replace(/\s+/g, '').toUpperCase()}`
}

export function ProductForm({
  mode,
  productId,
  initial,
}: {
  mode: 'create' | 'edit'
  productId?: string
  initial?: InitialProduct
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [sub, setSub] = useState(initial?.sub ?? '')
  const [category, setCategory] = useState(
    initial?.category ?? CATEGORIES.filter((c) => c !== 'All')[0],
  )
  const [image, setImage] = useState(initial?.image ?? '')
  const [mechanism, setMechanism] = useState(initial?.mechanism ?? '')
  const [tagline, setTagline] = useState(initial?.tagline ?? '')
  const [purity, setPurity] = useState(initial?.purity ?? '')
  const [blurb, setBlurb] = useState(initial?.blurb ?? '')
  const [rating, setRating] = useState(String(initial?.rating ?? 0))
  const [reviews, setReviews] = useState(String(initial?.reviews ?? 0))
  const [bestseller, setBestseller] = useState(initial?.bestseller ?? false)
  const [featured, setFeatured] = useState(initial?.featured ?? false)
  const [compareAt, setCompareAt] = useState(
    initial?.compare_at ? String(initial.compare_at) : '',
  )

  const [sizes, setSizes] = useState<SizeRow[]>(() => {
    if (initial?.product_sizes && initial.product_sizes.length > 0) {
      return initial.product_sizes.map((s) => ({
        id: s.id,
        mg: s.mg,
        price: String(s.price),
        sku: s.sku,
      }))
    }
    return [emptySizeRow()]
  })

  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const filteredCategories = CATEGORIES.filter((c) => c !== 'All')

  function updateSizeField(index: number, field: keyof SizeRow, value: string) {
    setSizes((prev) => {
      const next = prev.map((row, i) => {
        if (i !== index) return row
        const updated = { ...row, [field]: value }
        // Auto-suggest SKU when mg or code changes and sku is still empty
        if ((field === 'mg' || field === 'sku') && field !== 'sku') {
          if (!updated.sku) {
            updated.sku = autoSku(code, updated.mg)
          }
        }
        return updated
      })
      return next
    })
  }

  // When code changes, re-suggest SKU for any row that still has an auto-generated sku
  function handleCodeChange(newCode: string) {
    setCode(newCode)
    setSizes((prev) =>
      prev.map((row) => {
        if (!row.sku || row.sku === autoSku(code, row.mg)) {
          return { ...row, sku: autoSku(newCode, row.mg) }
        }
        return row
      }),
    )
  }

  function handleMgChange(index: number, value: string) {
    setSizes((prev) => {
      return prev.map((row, i) => {
        if (i !== index) return row
        const updated = { ...row, mg: value }
        // Auto-suggest if sku is blank or was previously auto-suggested
        if (!row.sku || row.sku === autoSku(code, row.mg)) {
          updated.sku = autoSku(code, value)
        }
        return updated
      })
    })
  }

  function addSize() {
    setSizes((prev) => [...prev, emptySizeRow()])
  }

  function removeSize(index: number) {
    setSizes((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('code', code || 'misc')
      const result = await uploadProductImage(fd)
      if (result.ok) {
        setImage(result.url)
      } else {
        setUploadError(result.error)
      }
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    const compareAtNum = compareAt.trim() ? Number(compareAt) : undefined
    const input: ProductInput = {
      code,
      name,
      sub: sub || '',
      category: category as ProductInput['category'],
      image: image || '',
      mechanism: mechanism || '',
      tagline: tagline || '',
      purity: purity || '',
      blurb: blurb || '',
      rating: Number(rating),
      reviews: Number(reviews),
      bestseller,
      featured,
      compareAt: compareAtNum,
      sizes: sizes.map((s) => ({
        id: s.id,
        mg: s.mg,
        price: Number(s.price),
        sku: s.sku,
      })),
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createProduct(input)
          : await updateProduct(productId!, input)
      if (!result.ok) {
        setSubmitError(result.error)
      } else {
        router.push('/admin/products')
        router.refresh()
      }
    })
  }

  const inputCls = 'rounded-md border border-black/15 px-3 py-2 text-sm w-full'
  const labelCls = 'flex flex-col gap-1 text-sm'
  const checkboxCls = 'flex items-center gap-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === 'create' ? 'New product' : 'Edit product'}
      </h1>

      {/* Core fields */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-black/40">
          Core
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelCls}>
            Code *
            <input
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              required
              className={inputCls}
              placeholder="BPC-157"
            />
          </label>
          <label className={labelCls}>
            Category *
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
            >
              {filteredCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={labelCls}>
          Name *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
            placeholder="BPC-157"
          />
        </label>
        <label className={labelCls}>
          Sub (subtitle)
          <input
            value={sub ?? ''}
            onChange={(e) => setSub(e.target.value)}
            className={inputCls}
            placeholder="e.g. 5 mg vial"
          />
        </label>
      </fieldset>

      {/* Image */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-black/40">
          Image
        </legend>
        <label className={labelCls}>
          Upload image
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={uploading}
            className="text-sm"
          />
        </label>
        {uploading && <p className="text-sm text-black/50">Uploading…</p>}
        {uploadError && (
          <p role="alert" className="text-sm text-red-600">
            {uploadError}
          </p>
        )}
        {image && (
          <div className="flex items-start gap-4">
            <img src={image} alt="Product preview" className="h-24 w-24 rounded-md object-cover" />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-black/50">Current URL</span>
              <span className="break-all text-xs text-black/70">{image}</span>
            </div>
          </div>
        )}
        <label className={labelCls}>
          Or paste image URL
          <input
            value={image ?? ''}
            onChange={(e) => setImage(e.target.value)}
            className={inputCls}
            placeholder="https://…"
          />
        </label>
      </fieldset>

      {/* Details */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-black/40">
          Details
        </legend>
        <label className={labelCls}>
          Mechanism (pill label)
          <input
            value={mechanism ?? ''}
            onChange={(e) => setMechanism(e.target.value)}
            className={inputCls}
            placeholder="e.g. Angiogenesis"
          />
        </label>
        <label className={labelCls}>
          Tagline
          <input
            value={tagline ?? ''}
            onChange={(e) => setTagline(e.target.value)}
            className={inputCls}
            placeholder="Punchy benefit headline"
          />
        </label>
        <label className={labelCls}>
          Purity
          <input
            value={purity ?? ''}
            onChange={(e) => setPurity(e.target.value)}
            className={inputCls}
            placeholder="e.g. ≥99%"
          />
        </label>
        <label className={labelCls}>
          Blurb
          <textarea
            value={blurb ?? ''}
            onChange={(e) => setBlurb(e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="Short product description"
          />
        </label>
      </fieldset>

      {/* Ratings */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-black/40">
          Social proof
        </legend>
        <div className="grid grid-cols-3 gap-4">
          <label className={labelCls}>
            Rating (0–5)
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Reviews
            <input
              type="number"
              min={0}
              step={1}
              value={reviews}
              onChange={(e) => setReviews(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Compare-at ($)
            <input
              type="number"
              min={0}
              step={0.01}
              value={compareAt}
              onChange={(e) => setCompareAt(e.target.value)}
              className={inputCls}
              placeholder="optional"
            />
          </label>
        </div>
        <div className="flex gap-6">
          <label className={checkboxCls}>
            <input
              type="checkbox"
              checked={bestseller}
              onChange={(e) => setBestseller(e.target.checked)}
            />
            Bestseller
          </label>
          <label className={checkboxCls}>
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            Featured
          </label>
        </div>
      </fieldset>

      {/* Sizes */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-black/40">
          Sizes *
        </legend>
        {sizes.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              {i === 0 && <span>mg</span>}
              <input
                value={row.mg}
                onChange={(e) => handleMgChange(i, e.target.value)}
                placeholder="5 mg"
                className={inputCls}
                required
              />
            </label>
            <label className="flex w-28 flex-col gap-1 text-sm">
              {i === 0 && <span>Price ($)</span>}
              <input
                type="number"
                min={0}
                step={0.01}
                value={row.price}
                onChange={(e) => updateSizeField(i, 'price', e.target.value)}
                placeholder="0.00"
                className={inputCls}
                required
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              {i === 0 && <span>SKU</span>}
              <input
                value={row.sku}
                onChange={(e) => updateSizeField(i, 'sku', e.target.value)}
                placeholder="CODE-5MG"
                className={inputCls}
                required
              />
            </label>
            {sizes.length > 1 && (
              <button
                type="button"
                onClick={() => removeSize(i)}
                className="mb-0.5 rounded-md border border-black/15 px-2 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addSize}
          className="self-start rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5"
        >
          Add size
        </button>
      </fieldset>

      {submitError && (
        <p role="alert" className="text-sm text-red-600">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || sizes.length === 0}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending
          ? mode === 'create'
            ? 'Creating…'
            : 'Saving…'
          : mode === 'create'
            ? 'Create product'
            : 'Save changes'}
      </button>
    </form>
  )
}
