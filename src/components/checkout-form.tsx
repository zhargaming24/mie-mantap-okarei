"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import type { Product, StoreSettings } from "@/lib/types";
import { formatRupiah } from "@/lib/types";

type Cart = Record<string, number>;
type OrderResult = { order_number: string; access_token: string; queue_number: string | null };

export function CheckoutForm({ products, settings, configured }: { products: Product[]; settings: StoreSettings | null; configured: boolean }) {
  const [cart, setCart] = useState<Cart>({});
  const [serviceChoices, setServiceChoices] = useState<Record<string, "pickup" | "prepared">>({});
  const [toppingChoices, setToppingChoices] = useState<Record<string, string[]>>({});
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<OrderResult | null>(null);
  const [step, setStep] = useState<"details" | "qris">("details");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [method, setMethod] = useState<"CASH" | "QRIS">("CASH");
  const [form, setForm] = useState({ customer_name: "", phone: "", room_number: "", note: "" });

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("mmo-cart-v1") ?? "{}"));
      setServiceChoices(JSON.parse(localStorage.getItem("mmo-service-v1") ?? "{}"));
      setToppingChoices(JSON.parse(localStorage.getItem("mmo-toppings-v1") ?? "{}"));
    } catch { setCart({}); }
    setReady(true);
  }, []);

  const rows = useMemo(() => Object.entries(cart).map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return {
      product,
      quantity,
      service: serviceChoices[id] ?? (product?.service_type === "PREPARED" ? "prepared" : "pickup"),
      toppings: (product?.toppingOptions ?? []).filter((topping) => (toppingChoices[id] ?? []).includes(topping.id)),
    };
  }).filter((row): row is { product: Product; quantity: number; service: "pickup" | "prepared"; toppings: NonNullable<Product["toppingOptions"]> } => Boolean(row.product)), [cart, products, serviceChoices, toppingChoices]);

  const subtotal = rows.reduce((sum, row) => sum + (row.product.price + row.toppings.reduce((amount, topping) => amount + topping.price, 0)) * row.quantity, 0);
  const preparationFee = rows.some((row) => row.service === "prepared") ? settings?.preparation_fee ?? 0 : 0;
  const total = subtotal + preparationFee;

  function update(id: string, delta: number) {
    setCart((current) => {
      const next = { ...current, [id]: Math.max(0, Math.min(products.find((item) => item.id === id)?.stock ?? 99, (current[id] ?? 0) + delta)) };
      if (!next[id]) {
        delete next[id];
        const services = { ...serviceChoices }; delete services[id]; setServiceChoices(services); localStorage.setItem("mmo-service-v1", JSON.stringify(services));
        const toppings = { ...toppingChoices }; delete toppings[id]; setToppingChoices(toppings); localStorage.setItem("mmo-toppings-v1", JSON.stringify(toppings));
      }
      localStorage.setItem("mmo-cart-v1", JSON.stringify(next));
      return next;
    });
  }

  function updateService(id: string, service: "pickup" | "prepared") {
    setServiceChoices((current) => { const next = { ...current, [id]: service }; localStorage.setItem("mmo-service-v1", JSON.stringify(next)); return next; });
  }

  async function createOrder() {
    setError("");
    if (!configured) { setError("Sambungkan Supabase terlebih dahulu agar pesanan tersimpan dengan aman."); return; }
    if (!settings?.is_open) { setError("Toko sedang tutup dan belum bisa menerima pesanan."); return; }
    if (!rows.length) { setError("Keranjang masih kosong."); return; }
    setLoading(true);
    const requestKey = idempotencyKey || crypto.randomUUID();
    const token = accessToken || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(requestKey);
    if (!accessToken) setAccessToken(token);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, payment_method: method, access_token: token, idempotency_key: requestKey, lines: rows.map(({ product, quantity, service, toppings }) => ({ product_id: product.id, quantity, service: product.service_type === "PREPARED" ? "prepared" : service, toppings: toppings.map((topping) => topping.id) })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Pesanan belum dapat dibuat.");
      localStorage.removeItem("mmo-cart-v1"); localStorage.removeItem("mmo-service-v1"); localStorage.removeItem("mmo-toppings-v1");
      setCart({}); setSuccess(result.order);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Terjadi kendala. Silakan coba lagi.");
    } finally { setLoading(false); }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (method === "QRIS") { setStep("qris"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    void createOrder();
  }

  if (success) return <main className="mx-auto max-w-2xl px-5 py-20"><div className="rounded-[30px] border border-[#eee2d2] bg-white p-8 text-center soft-shadow md:p-12"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e8f4e7] text-emerald-700"><CheckCircle2 size={32}/></span><p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-[#ef6c32]">Pesanan berhasil dibuat</p><h1 className="serif mt-2 text-4xl">Terima kasih, {form.customer_name}!</h1><p className="mt-3 text-sm text-[#81766c]">Nomor pesananmu</p><p className="mt-1 text-2xl font-black tracking-wide">{success.order_number}</p>{success.queue_number&&<p className="mt-3 inline-flex rounded-full bg-[#fff0d3] px-4 py-2 text-xs font-bold text-[#76501c]">Antrean {success.queue_number}</p>}<p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#81766c]">{method === "QRIS" ? "Pesanan tercatat. Unggah bukti pembayaran di halaman status agar owner dapat memeriksanya." : "Simpan tautan status ini untuk melihat perkembangan pesanan."}</p><Link href={`/order?number=${success.order_number}&token=${success.access_token}`} className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#29241f] px-6 text-xs font-bold text-white">Lihat status pesanan <ArrowRight size={15}/></Link></div></main>;

  if (step === "qris") return <main className="mx-auto min-h-[75vh] max-w-2xl px-5 py-10 md:py-16"><button type="button" onClick={() => { setStep("details"); setError(""); }} className="inline-flex items-center gap-2 text-xs font-semibold text-[#84786b]"><ArrowLeft size={14}/> Kembali ke checkout</button><section className="mt-6 rounded-[26px] border border-[#eee2d2] bg-white p-6 text-center soft-shadow md:p-9"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ef6c32]">Pembayaran QRIS</p><h1 className="serif mt-2 text-4xl">Pindai & bayar.</h1><p className="mt-2 text-sm text-[#81766c]">{form.customer_name} · Kamar {form.room_number}</p><p className="mt-6 text-xs text-[#81766c]">Total yang harus dibayar</p><b className="serif mt-1 block text-4xl">{formatRupiah(total)}</b>{settings?.qris_image_url ? <img src={settings.qris_image_url} alt="QRIS resmi Mie Mantap Okarei" className="mx-auto mt-6 max-h-[420px] w-auto max-w-full rounded-xl bg-white object-contain"/> : <p role="alert" className="mt-6 rounded-xl bg-[#fff0ec] p-4 text-sm text-[#ae3d27]">Gambar QRIS toko belum tersedia. Silakan pilih Cash atau hubungi pemilik toko.</p>}<p className="mt-5 text-xs leading-5 text-[#81766c]">Setelah membayar, lanjutkan untuk membuat pesanan. Bukti pembayaran dapat diunggah melalui halaman status pesanan.</p>{error&&<p role="alert" className="mt-4 rounded-xl bg-[#fff0ec] p-3 text-xs text-[#ae3d27]">{error}</p>}<button type="button" onClick={() => void createOrder()} disabled={loading || !settings?.qris_image_url} className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#ef6c32] text-sm font-bold text-white disabled:bg-[#cfc5ba]">{loading ? <LoaderCircle className="animate-spin" size={18}/> : <>Saya sudah membayar · Buat pesanan <ArrowRight size={16}/></>}</button></section></main>;

  return <main className="mx-auto min-h-[75vh] max-w-7xl px-5 py-10 md:px-10 md:py-16"><Link href="/#menu" className="inline-flex items-center gap-2 text-xs font-semibold text-[#84786b] hover:text-[#e66b34]"><ArrowLeft size={14}/> Kembali ke menu</Link><div className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><section><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ef6c32]">Satu langkah lagi</p><h1 className="serif mt-2 text-5xl tracking-[-.04em]">Checkout <i className="text-[#ef6c32]">pesanan.</i></h1><form onSubmit={submit} className="mt-8 space-y-7 rounded-[26px] border border-[#eee2d2] bg-white p-6 md:p-8"><div><h2 className="text-sm font-bold">Data pemesan</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Nama<input required minLength={2} maxLength={80} value={form.customer_name} onChange={(event)=>setForm({...form,customer_name:event.target.value})} placeholder="Nama kamu" className="focus-ring mt-2 h-12 w-full rounded-xl border border-[#e8ddce] bg-[#fffdf9] px-4 text-sm font-normal outline-none"/></label><label className="text-xs font-semibold">Nomor HP<input required inputMode="tel" pattern="^(\+62|62|0)8[1-9][0-9]{6,11}$" value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value})} placeholder="08xxxxxxxxxx" className="focus-ring mt-2 h-12 w-full rounded-xl border border-[#e8ddce] bg-[#fffdf9] px-4 text-sm font-normal outline-none"/></label></div><label className="mt-4 block text-xs font-semibold">Nomor kamar<input required maxLength={20} value={form.room_number} onChange={(event)=>setForm({...form,room_number:event.target.value})} placeholder="Contoh: 204" className="focus-ring mt-2 h-12 w-full rounded-xl border border-[#e8ddce] bg-[#fffdf9] px-4 text-sm font-normal outline-none"/></label><label className="mt-4 block text-xs font-semibold">Catatan umum <span className="font-normal text-[#9b9085]">(opsional)</span><textarea maxLength={300} value={form.note} onChange={(event)=>setForm({...form,note:event.target.value})} placeholder="Contoh: tanpa pedas" className="focus-ring mt-2 min-h-24 w-full rounded-xl border border-[#e8ddce] bg-[#fffdf9] p-4 text-sm font-normal outline-none"/></label></div><div><h2 className="text-sm font-bold">Metode pembayaran</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={()=>setMethod("CASH")} className={`rounded-2xl border p-4 text-left transition ${method==="CASH"?"border-[#ef6c32] bg-[#fff6e9]":"border-[#e8ddce]"}`}><span className="text-sm font-bold">💵 Bayar cash</span><span className="mt-1 block text-[11px] text-[#81766c]">Bayar saat ambil pesanan</span></button><button type="button" onClick={()=>setMethod("QRIS")} className={`rounded-2xl border p-4 text-left transition ${method==="QRIS"?"border-[#ef6c32] bg-[#fff6e9]":"border-[#e8ddce]"}`}><span className="text-sm font-bold">▦ QRIS</span><span className="mt-1 block text-[11px] text-[#81766c]">Lanjut untuk melihat kode dan total</span></button></div></div>{error&&<div role="alert" className="rounded-xl bg-[#fff0ec] p-3 text-xs leading-5 text-[#ae3d27]">{error}</div>}<button disabled={loading||!ready||!rows.length} className="focus-ring flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#ef6c32] text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-[#d95622] disabled:cursor-not-allowed disabled:bg-[#cfc5ba]">{loading?<LoaderCircle className="animate-spin" size={18}/>:method==="QRIS"?<>Lanjut ke QRIS <ArrowRight size={16}/></>:<>Buat pesanan <ArrowRight size={16}/></>}</button><p className="flex items-center justify-center gap-2 text-[10px] text-[#93877a]"><ShieldCheck size={13}/> Harga dan stok diperiksa ulang di server sebelum pesanan dibuat.</p></form></section><aside><div className="sticky top-24 rounded-[26px] border border-[#eee2d2] bg-white p-6 md:p-8"><h2 className="flex items-center gap-3 text-lg font-bold"><ShoppingBag size={19} className="text-[#ef6c32]"/> Ringkasan keranjang</h2>{rows.length?<div className="mt-5 divide-y divide-[#f0e7db]">{rows.map(({product,quantity,service,toppings})=><div key={product.id} className="py-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{product.name}</b><span className="mt-1 block text-xs text-[#8c8177]">{formatRupiah(product.price)} · {service==="prepared"?"Disiapkan":"Ambil langsung"}</span>{product.service_type==="CUSTOMER_CHOICE"&&<select value={service} onChange={(event)=>updateService(product.id,event.target.value as "pickup"|"prepared")} className="mt-2 rounded-lg border border-[#e8ddce] px-2 py-1 text-[10px]"><option value="pickup">Ambil langsung</option><option value="prepared">Diseduh / disiapkan (+ biaya)</option></select>}<div className="mt-2 flex items-center gap-2"><button type="button" onClick={()=>update(product.id,-1)} className="grid h-7 w-7 place-items-center rounded-full border border-[#eadfce]" aria-label="Kurangi"><Minus size={12}/></button><span className="w-4 text-center text-xs">{quantity}</span><button type="button" onClick={()=>update(product.id,1)} className="grid h-7 w-7 place-items-center rounded-full border border-[#eadfce]" aria-label="Tambah"><Plus size={12}/></button><button type="button" onClick={()=>update(product.id,-quantity)} className="ml-2 text-[#9b8f83] hover:text-red-600" aria-label="Hapus"><Trash2 size={14}/></button></div></div><b className="shrink-0 text-sm">{formatRupiah((product.price+toppings.reduce((sum,topping)=>sum+topping.price,0))*quantity)}</b></div>{toppings.map((topping)=><span key={topping.id} className="mr-1 mt-2 inline-block rounded-full bg-[#fff4e3] px-2 py-1 text-[9px] text-[#795e3c]">+ {topping.name} · {formatRupiah(topping.price)}</span>)}</div>)}</div>:<p className="mt-6 rounded-xl bg-[#fff6e9] p-5 text-center text-sm text-[#81766c]">Keranjang kosong. <Link href="/#menu" className="font-bold text-[#e66931]">Pilih menu</Link></p>}<div className="mt-4 space-y-3 border-t border-[#eee2d2] pt-4 text-xs"><div className="flex justify-between text-[#81766c]"><span>Subtotal termasuk topping</span><span>{formatRupiah(subtotal)}</span></div><div className="flex justify-between text-[#81766c]"><span>Biaya penyajian</span><span>{formatRupiah(preparationFee)}</span></div><div className="flex justify-between border-t border-[#eee2d2] pt-4 text-sm font-bold"><span>Total</span><span>{formatRupiah(total)}</span></div></div>{!configured&&<p className="mt-5 rounded-xl bg-[#fff2dc] p-4 text-[11px] leading-5 text-[#75562e]">Supabase belum tersambung. Pesanan belum bisa disimpan.</p>}</div></aside></div></main>;
}

