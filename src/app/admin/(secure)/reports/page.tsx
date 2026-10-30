import { BarChart3, CalendarDays, Download, TrendingUp } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/types";

export const dynamic="force-dynamic";

export default async function ReportsPage(){
 const supabase=await createSupabaseServerClient();
 const now=new Date();
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(now);
 const start=new Date(now);start.setDate(start.getDate()-30);
 const since=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(start);
 const {data:orders}=await supabase!.from("orders").select("total,payment_method,payment_status,created_at,order_items(product_name,quantity)").gte("created_at",`${since}T00:00:00+07:00`).order("created_at",{ascending:false});
 const all=orders??[];
 const paid=all.filter(order=>order.payment_status==="PAID");
 const outstanding=all.filter(order=>["UNPAID","PENDING_VERIFICATION","PAYMENT_REJECTED"].includes(order.payment_status));
 const revenue=paid.reduce((sum,order)=>sum+order.total,0);
 const todaySales=paid.filter(order=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date(order.created_at))===today).reduce((sum,order)=>sum+order.total,0);
 const products=new Map<string,number>();
 for(const order of all)for(const item of order.order_items??[])products.set(item.product_name,(products.get(item.product_name)??0)+item.quantity);
 const best=[...products.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
 const max=Math.max(1,...best.map(product=>product[1]));
 return <><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ef6c32]">Angka toko</p><h1 className="serif mt-2 text-4xl">Laporan penjualan.</h1><p className="mt-2 text-xs text-[#81766c]">30 hari terakhir · omzet hanya menghitung pembayaran lunas.</p></div><a href="/api/admin/reports.csv" className="inline-flex items-center gap-2 rounded-full bg-[#29241f] px-5 py-3 text-[10px] font-bold text-white"><Download size={14}/> Ekspor CSV</a></div>
 <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<TrendingUp size={18}/>} label="Omzet 30 hari" value={formatRupiah(revenue)}/><Metric icon={<CalendarDays size={18}/>} label="Penjualan hari ini" value={formatRupiah(todaySales)}/><Metric icon={<BarChart3 size={18}/>} label="Transaksi lunas" value={String(paid.length)}/><Metric icon={<CalendarDays size={18}/>} label="Belum lunas / verifikasi" value={`${outstanding.length} pesanan`}/></div>
 <section className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-[#eadfce] bg-white p-6"><h2 className="text-sm font-bold">Menu terlaris</h2><p className="mt-1 text-[10px] text-[#8d8175]">Jumlah item dari semua pesanan periode ini.</p><div className="mt-6 space-y-5">{best.length?best.map(([name,quantity],index)=><div key={name}><div className="mb-2 flex justify-between text-xs"><span><b className="mr-3 text-[#b49e82]">0{index+1}</b>{name}</span><b>{quantity} item</b></div><div className="h-2 overflow-hidden rounded-full bg-[#f2eadf]"><div className="h-full rounded-full bg-[#ef6c32]" style={{width:`${Math.max(8,(quantity/max)*100)}%`}}/></div></div>):<p className="text-xs text-[#8d8175]">Belum ada data produk.</p>}</div></div>
 <div className="rounded-2xl border border-[#eadfce] bg-white p-6"><h2 className="text-sm font-bold">Metode pembayaran</h2><p className="mt-1 text-[10px] text-[#8d8175]">Lunas dan belum lunas ditampilkan terpisah.</p><div className="mt-6 space-y-4">{["CASH","QRIS"].map(method=>{const rows=all.filter(order=>order.payment_method===method);const settled=rows.filter(order=>order.payment_status==="PAID");const waiting=rows.filter(order=>["UNPAID","PENDING_VERIFICATION","PAYMENT_REJECTED"].includes(order.payment_status));return <div key={method} className="rounded-xl bg-[#fff8ed] p-4"><div className="flex items-center justify-between"><span><b className="block text-xs">{method}</b><span className="mt-1 block text-[10px] text-[#8d8175]">{settled.length} lunas · {waiting.length} menunggu / perlu tindakan</span></span><b className="text-sm">{formatRupiah(settled.reduce((sum,order)=>sum+order.total,0))}</b></div>{waiting.length>0&&<p className="mt-2 border-t border-[#eadfce] pt-2 text-[10px] text-[#8d8175]">Belum masuk omzet: {formatRupiah(waiting.reduce((sum,order)=>sum+order.total,0))}</p>}</div>})}</div><p className="mt-5 text-[10px] leading-5 text-[#9a8e82]">Cash masuk omzet setelah ditandai lunas. QRIS masuk omzet setelah owner menyetujui bukti pembayaran.</p></div></section></>;
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-2xl border border-[#eadfce] bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0d3] text-[#ef6c32]">{icon}</span><span className="mt-5 block text-[10px] text-[#8d8175]">{label}</span><b className="serif mt-1 block text-2xl">{value}</b></div>}

