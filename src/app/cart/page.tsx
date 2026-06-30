import { getAccessories } from "@/lib/catalog/queries";
import { CartContents } from "@/components/cart-contents";

export default async function CartPage() {
  const accessories = await getAccessories();
  return (
    <main className="container cart-page" style={{ padding: "32px 20px 80px", maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Your cart</h1>
      <CartContents variant="page" accessories={accessories} />
    </main>
  );
}
