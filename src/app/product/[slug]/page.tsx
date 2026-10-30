import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getStoreData } from "@/lib/data";
export const dynamic="force-dynamic";
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const {products,categories,settings,configured}=await getStoreData();const product=products.find(p=>p.slug===slug);if(!product)notFound();const category=categories.find(c=>c.id===product.category_id)?.name??"Menu";return <><div className="border-b border-[#eadfce] bg-white/50 px-5 py-5 md:px-10"><a href="/" className="serif text-lg font-bold">MIE MANTAP <i className="text-[#ef6c32]">OKAREI</i></a></div><ProductDetail product={product} category={category} settings={settings} configured={configured}/></>}
