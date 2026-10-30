import { Storefront } from "@/components/storefront";
import { getStoreData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { products, categories, settings, configured } = await getStoreData();
  return <Storefront products={products} categories={categories} settings={settings} configured={configured}/>;
}
