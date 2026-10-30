import { CheckoutForm } from "@/components/checkout-form";
import { getStoreData } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function CheckoutPage() {
  const { products, settings, configured } = await getStoreData();
  return <><div className="border-b border-[#eadfce] bg-white/50 px-5 py-5 md:px-10"><a href="/" className="serif text-lg font-bold">MIE MANTAP <i className="text-[#ef6c32]">OKAREI</i></a></div><CheckoutForm products={products} settings={settings} configured={configured}/><div className="border-t border-[#eadfce] px-5 py-5 text-center text-[10px] text-[#93877a]">© Mie Mantap Okarei · Asrama Telkom</div></>;
}
