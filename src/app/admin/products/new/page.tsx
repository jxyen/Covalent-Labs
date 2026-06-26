import { requireStaff } from '@/lib/auth/dal'
import { ProductForm } from '../product-form'

export default async function NewProductPage() {
  await requireStaff()
  return <ProductForm mode="create" />
}
