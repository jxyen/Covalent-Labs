import { getCatalog } from "@/lib/catalog/queries";
import { CatalogBrowser } from "./catalog-browser";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await getCatalog();
  return <CatalogBrowser products={products} />;
}
