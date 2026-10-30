import { OrderStatus } from "@/components/order-status";
export const dynamic="force-dynamic";
export default async function OrderPage({searchParams}:{searchParams:Promise<{number?:string;token?:string}>}){
 const params=await searchParams;
 return <><div className="border-b border-[#eadfce] bg-white/50 px-5 py-5 md:px-10"><a href="/" className="serif text-lg font-bold">MIE MANTAP <i className="text-[#ef6c32]">OKAREI</i></a></div><OrderStatus initialNumber={params.number??""} initialToken={params.token??""}/><div className="border-t border-[#eadfce] px-5 py-5 text-center text-[10px] text-[#93877a]">Simpan tautan akses pribadi ini untuk membuka status pesanan lagi.</div></>;
}
