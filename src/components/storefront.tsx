"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Flame, Menu, Minus, Plus, Search, ShoppingBag, Soup, X } from "lucide-react";
import type { Category, Product, StoreSettings } from "@/lib/types";
import { formatRupiah } from "@/lib/types";

type CartMap = Record<string, number>;

export function Storefront({ products, categories, settings, configured }: { products: Product[]; categories: Category[]; settings: StoreSettings | null; configured: boolean }) {
  const [activeCategory, setActiveCategory] = useState("semua");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartMap>({});
  const [serviceChoices,setServiceChoices]=useState<Record<string,"pickup"|"prepared">>({});
  const [toppingChoices,setToppingChoices]=useState<Record<string,string[]>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(()=>{try{setCart(JSON.parse(localStorage.getItem("mmo-cart-v1")??"{}"));setServiceChoices(JSON.parse(localStorage.getItem("mmo-service-v1")??"{}"));setToppingChoices(JSON.parse(localStorage.getItem("mmo-toppings-v1")??"{}"));}catch{localStorage.removeItem("mmo-cart-v1");}},[]);
  const cartCount = Object.values(cart).reduce((sum, amount) => sum + amount, 0);
  const visibleProducts = useMemo(() => products.filter((product) =>
    (activeCategory === "semua" || product.category_id === activeCategory) &&
    `${product.name} ${product.description ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  ), [products, activeCategory, query]);

  function changeCart(productId: string, delta: number) {
    setCart((current) => {
      const next = { ...current, [productId]: Math.max(0, (current[productId] ?? 0) + delta) };
      if (next[productId] === 0) delete next[productId];
      localStorage.setItem("mmo-cart-v1", JSON.stringify(next));
      return next;
    });
  }
  function chooseService(productId:string,service:"pickup"|"prepared"){setServiceChoices(c=>{const n={...c,[productId]:service};localStorage.setItem("mmo-service-v1",JSON.stringify(n));return n;});}
  function chooseTopping(productId:string,toppingId:string){setToppingChoices(c=>{const current=c[productId]??[];const n={...c,[productId]:current.includes(toppingId)?current.filter(id=>id!==toppingId):[...current,toppingId]};localStorage.setItem("mmo-toppings-v1",JSON.stringify(n));return n;});}

  if (configured && settings && !settings.is_open) return <>
    <header className="border-b border-[#eadfce] bg-[#fffaf1]">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Mie Mantap Okarei beranda">
          <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#ef6c32] text-white shadow-md shadow-orange-200"><Soup size={25} strokeWidth={2.4}/></span>
          <span className="leading-none"><b className="block text-[15px] tracking-[.11em]">MIE MANTAP</b><i className="mt-1 block text-[10px] font-semibold not-italic tracking-[.2em] text-[#ef6c32]">OKAREI · GEDUNG 9</i></span>
        </Link>
        <span className="rounded-full bg-[#fff0d3] px-4 py-2 text-xs font-bold text-[#8c5b20]">Toko sedang tutup</span>
      </div>
    </header>
    <main className="grain grid min-h-[78vh] place-items-center px-5 py-16">
      <section className="w-full max-w-2xl rounded-[32px] border border-[#eadfce] bg-white p-8 text-center shadow-xl shadow-[#9d7440]/10 md:p-14">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-[#fff0d3] text-4xl">🌙</span>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[.22em] text-[#ef6c32]">Mie Mantap Okarei</p>
        <h1 className="serif mt-3 text-4xl tracking-tight text-[#28231f] md:text-5xl">Toko sedang tutup.</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#74695f]">Maaf, saat ini kami belum menerima pesanan. Silakan kembali lagi saat toko sudah buka.</p>
        <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-[#fff7e9] px-5 py-4 text-left">
          <b className="block text-xs text-[#342e29]">📍 Lokasi layanan</b>
          <span className="mt-1 block text-sm text-[#81766c]">Khusus penghuni Asrama Telkom, Gedung 9.</span>
        </div>
        <Link href="/order" className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#29241f] px-6 text-xs font-bold text-white transition hover:bg-[#ef6c32]">Lacak pesanan</Link>
      </section>
    </main>
    <footer className="bg-[#28231f] px-5 py-7 text-center text-xs text-[#b8aaa0]">Mie Mantap Okarei · Asrama Telkom Gedung 9</footer>
  </>;
  return <>
    <header className="sticky top-0 z-30 border-b border-[#eadfce] bg-[#fffaf1]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Mie Mantap Okarei beranda">
          <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#ef6c32] text-white shadow-md shadow-orange-200"><Soup size={25} strokeWidth={2.4}/></span>
          <span className="leading-none"><b className="block text-[15px] tracking-[.11em]">MIE MANTAP</b><i className="mt-1 block text-[10px] font-semibold not-italic tracking-[.25em] text-[#ef6c32]">OKAREI · GEDUNG 9</i></span>
        </Link>
        <nav className="hidden items-center gap-9 text-sm font-medium text-[#6a625b] md:flex">
          <a className="hover:text-[#ef6c32]" href="#menu">Menu</a><a className="hover:text-[#ef6c32]" href="#cerita">Tentang kami</a><a className="hover:text-[#ef6c32]" href="#lokasi">Lokasi</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/order" className="hidden rounded-full border border-[#eadfce] px-4 py-2.5 text-xs font-semibold text-[#51463c] hover:border-[#ef6c32] sm:block">Lacak pesanan</Link>
          <a href="#menu" className="relative grid h-11 w-11 place-items-center rounded-full bg-[#28231f] text-white transition hover:bg-[#ef6c32]" aria-label={`Keranjang, ${cartCount} item`}><ShoppingBag size={18}/>{cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ffc857] px-1 text-[10px] font-bold text-[#30261d]">{cartCount}</span>}</a>
          <button className="grid h-11 w-10 place-items-center md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Buka menu">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </div>
      {menuOpen && <div className="grid gap-4 border-t border-[#eadfce] bg-[#fffaf1] px-6 py-5 text-sm md:hidden"><a href="#menu" onClick={() => setMenuOpen(false)}>Menu</a><a href="#cerita" onClick={() => setMenuOpen(false)}>Tentang kami</a><Link href="/order">Lacak pesanan</Link></div>}
    </header>

    <main>
      <section className="grain relative overflow-hidden">
        <div className="mx-auto grid min-h-[650px] max-w-7xl items-center gap-8 px-5 pb-16 pt-12 md:grid-cols-[1.04fr_.96fr] md:px-10 md:pb-20 md:pt-14">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#eddfc9] bg-white/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[.15em] text-[#75654f]"><span className={`h-2 w-2 rounded-full ${settings?.is_open ? "bg-emerald-500" : "bg-[#d9a93a]"}`}/>{settings ? settings.is_open ? "Lagi buka · siap menerima pesanan" : "Toko sedang tutup" : "Mie hangat, mood meningkat"}</div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[.24em] text-[#e26931]">Khusus penghuni Asrama Telkom Gedung 9</p>
            <h1 className="serif max-w-[680px] text-[58px] leading-[.99] tracking-[-.055em] text-[#28231f] md:text-[84px]">Mau makan<br/>apa <span className="relative italic text-[#ef6c32]">hari ini?<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 330 18" fill="none"><path d="M5 12C93 2 231 2 324 10" stroke="#ffc857" strokeWidth="8" strokeLinecap="round"/></svg></span></h1>
            <p className="mt-8 max-w-[475px] text-base leading-7 text-[#74695f] md:text-[17px]">Mie, camilan, dan minuman favoritmu, dibuat hangat khusus untuk penghuni Asrama Telkom Gedung 9.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3"><a href="#menu" className="focus-ring inline-flex h-14 items-center gap-3 rounded-full bg-[#ef6c32] px-7 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#d95622]">Lihat menu <ArrowRight size={17}/></a><span className="inline-flex items-center gap-2 px-2 text-xs text-[#756b61]"><Clock3 size={16} className="text-[#ef6c32]"/> Pesan, lalu ambil di toko</span></div>
            <div className="mt-12 flex items-center gap-4 border-t border-[#e7dccb] pt-6"><div className="flex -space-x-2"><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#fffaf1] bg-[#ffe0bb]">🍜</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#fffaf1] bg-[#e8efda]">🥤</span><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#fffaf1] bg-[#f7d7c2]">🍳</span></div><p className="text-xs leading-5 text-[#786e65]"><b className="text-[#342e29]">Dibuat dekat, dinikmati hangat.</b><br/>Jajan enak nggak perlu jauh-jauh.</p></div>
          </div>
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -right-8 -top-3 h-40 w-40 rounded-full bg-[#ffd46d]/70 blur-[1px]"/><div className="absolute -bottom-8 -left-2 h-36 w-36 rounded-full bg-[#f4a77c]/40 blur-xl"/>
            <div className="relative aspect-[.93] overflow-hidden rounded-[44%_44%_26px_26px] bg-gradient-to-br from-[#f9d18c] via-[#f4a260] to-[#d95732] shadow-[0_28px_80px_rgba(174,84,37,.24)]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_55%_70%,rgba(255,242,205,.83)_0%,rgba(255,242,205,.22)_42%,transparent_70%)]"/>
              <div className="absolute left-1/2 top-[18%] grid h-[56%] w-[75%] -translate-x-1/2 place-items-center rounded-[50%] border-[14px] border-[#fff9ec] bg-[#f9e9cd] shadow-[inset_0_-15px_25px_rgba(100,55,22,.13),0_22px_25px_rgba(83,40,17,.25)]"><div className="relative grid h-[84%] w-[84%] place-items-center overflow-hidden rounded-full bg-[radial-gradient(ellipse_at_50%_44%,#f3b145_0%,#e99131_55%,#bd552a_100%)]"><div className="absolute h-[72%] w-[78%] rounded-full opacity-90" style={{background:"repeating-radial-gradient(ellipse at 50% 50%, transparent 0 9px, #f8cf76 10px 13px, transparent 14px 18px)"}}/><span className="relative -mt-2 text-[88px] drop-shadow-[0_5px_5px_rgba(90,42,12,.3)]">🍜</span><span className="absolute right-[18%] top-[25%] text-4xl">🍳</span><span className="absolute bottom-[19%] left-[23%] text-2xl">🌿</span><span className="absolute bottom-[25%] right-[21%] text-xl">🌶️</span></div></div>
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-7 md:p-9"><div className="rounded-2xl border border-white/50 bg-white/80 px-4 py-3 backdrop-blur"><span className="block text-[9px] font-bold uppercase tracking-[.2em] text-[#93755a]">Dibuat penuh</span><span className="serif text-2xl italic text-[#3b2e24]">rasa & cerita</span></div><span className="grid h-[68px] w-[68px] -rotate-12 place-items-center rounded-full bg-[#ffc857] text-center text-[10px] font-black uppercase leading-[1.1] text-[#3b2c1c] shadow-lg">Enak<br/>banget!</span></div>
            </div>
            <div className="absolute -left-5 top-[40%] rounded-2xl bg-white px-4 py-3 shadow-xl"><span className="flex items-center gap-2 text-xs font-bold"><Flame size={16} className="fill-[#f07338] text-[#f07338]"/> Favorit anak asrama</span><span className="mt-1 block pl-6 text-[10px] text-[#8a7a6c]">Racikan hangat setiap hari</span></div>
          </div>
        </div>
        <div className="border-y border-[#eaddc9] bg-[#fff7e9]"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#8f7b63] md:px-10"><span>🍜 Hangat & fresh</span><span>✦ Dekat dari kamar</span><span>✳ Pesan tanpa ribet</span><span>☼ Makan enak, hati senang</span></div></div>
      </section>

      <section id="menu" className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-28">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ef6c32]">Dari dapur kami</p><h2 className="serif mt-3 text-5xl tracking-[-.04em] md:text-6xl">Menu <i className="text-[#ef6c32]">favoritmu.</i></h2></div><p className="max-w-[370px] text-sm leading-6 text-[#786e65]">Temukan teman makan yang pas. Semua menu disiapkan untuk bikin waktu istirahatmu lebih menyenangkan.</p></div>
        <div className="mt-10 flex flex-col gap-4 border-b border-[#e8ddce] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">{[{id:"semua",name:"Semua"},...categories].map((cat)=><button key={cat.id} onClick={()=>setActiveCategory(cat.id)} className={`focus-ring shrink-0 rounded-full px-5 py-2.5 text-xs font-bold transition ${activeCategory===cat.id?"bg-[#2c2722] text-white":"border border-[#e9dece] bg-white text-[#786e65] hover:border-[#ef6c32] hover:text-[#ef6c32]"}`}>{cat.name}</button>)}</div>
          <label className="flex h-11 min-w-[220px] items-center gap-2 rounded-full border border-[#e9dece] bg-white px-4"><Search size={16} className="text-[#a49a90]"/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="focus-ring w-full bg-transparent text-xs outline-none placeholder:text-[#a49a90]" placeholder="Cari menu..." aria-label="Cari produk"/></label>
        </div>
        {!configured && <div className="mt-7 rounded-2xl border border-[#f1d2ab] bg-[#fff2dc] p-5 text-sm text-[#694a2b]">Katalog sedang disiapkan. Hubungkan Supabase dan jalankan migrasi untuk menampilkan menu dari database.</div>}
        {configured && visibleProducts.length===0 && <div className="mt-8 rounded-[26px] border border-dashed border-[#d9c7ae] bg-white/70 px-6 py-14 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0d3] text-[#e46c33]"><Soup/></span><h3 className="serif mt-4 text-2xl">Menunya sedang disiapkan</h3><p className="mt-2 text-sm text-[#80756a]">Coba kategori lain atau mampir lagi sebentar.</p></div>}
        {visibleProducts.length>0 && <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product)=>{
          const count=cart[product.id]??0;
          return <article key={product.id} className="group overflow-hidden rounded-[26px] border border-[#eee3d3] bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#9d7440]/10">
            <div className="relative aspect-[1.35] overflow-hidden bg-[#f6e4c9]">{product.image_url ? <Image src={product.image_url} alt={product.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105"/> : <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_60%_35%,#ffdb9d,#ef9c5c_70%,#dc6a3a)] text-7xl">{product.category_id&&categories.find(c=>c.id===product.category_id)?.name.toLowerCase().includes("minum")?"🥤":"🍜"}</div>}{product.is_popular&&<span className="absolute left-4 top-4 rounded-full bg-[#ffc857] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.13em] text-[#543917]">★ Banyak disuka</span>}{product.stock<=0&&<span className="absolute inset-0 grid place-items-center bg-black/45 text-xs font-black tracking-[.2em] text-white">HABIS</span>}</div>
            <div className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#e5743d]">{categories.find(c=>c.id===product.category_id)?.name??"Menu"}</p><h3 className="serif mt-1 text-2xl leading-tight"><Link className="hover:text-[#ef6c32]" href={`/product/${product.slug}`}>{product.name}</Link></h3></div><Link href={`/product/${product.slug}`} aria-label={`Detail ${product.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#eee3d3] text-[#ef6c32]"><ArrowUpRight size={16}/></Link></div><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#81766c]">{product.description??"Dibuat hangat untuk teman istirahatmu."}</p>{product.service_type==="CUSTOMER_CHOICE"&&<div className="mt-3 flex gap-2"><button onClick={()=>chooseService(product.id,"pickup")} className={`rounded-full px-3 py-2 text-[10px] font-bold ${serviceChoices[product.id]!=="prepared"?"bg-[#29241f] text-white":"bg-[#f5eee4] text-[#71665b]"}`}>Ambil langsung</button><button onClick={()=>chooseService(product.id,"prepared")} className={`rounded-full px-3 py-2 text-[10px] font-bold ${serviceChoices[product.id]==="prepared"?"bg-[#29241f] text-white":"bg-[#f5eee4] text-[#71665b]"}`}>Siapkan (+ biaya)</button></div>}{(product.toppingOptions?.length??0)>0&&<div className="mt-3 flex flex-wrap gap-2">{product.toppingOptions?.map(t=><label key={t.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] ${t.stock>0?"bg-[#fff5e8] text-[#7b5b35]":"bg-[#f2eeee] text-[#a49a90]"}`}><input type="checkbox" disabled={t.stock<=0} checked={(toppingChoices[product.id]??[]).includes(t.id)} onChange={()=>chooseTopping(product.id,t.id)} className="accent-[#ef6c32]"/>{t.name} +{formatRupiah(t.price)}</label>)}</div>}<div className="mt-5 flex items-center justify-between border-t border-[#f0e7db] pt-4"><div><b className="block text-sm">{formatRupiah(product.price)}</b><span className="mt-1 block text-[10px] text-[#90867c]">{product.stock>0?`Tersedia ${product.stock}`:"Stok habis"}</span></div>{count===0?<button disabled={product.stock<=0||!settings?.is_open} onClick={()=>changeCart(product.id,1)} className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-[#ef6c32] text-white transition hover:bg-[#d95622] disabled:cursor-not-allowed disabled:bg-[#d2c9be]" aria-label={`Tambah ${product.name}`}><Plus size={18}/></button>:<div className="flex items-center gap-3 rounded-full bg-[#fff1df] p-1"><button onClick={()=>changeCart(product.id,-1)} className="grid h-8 w-8 place-items-center rounded-full bg-white" aria-label="Kurangi"><Minus size={14}/></button><b className="min-w-4 text-center text-xs">{count}</b><button disabled={count>=product.stock} onClick={()=>changeCart(product.id,1)} className="grid h-8 w-8 place-items-center rounded-full bg-[#ef6c32] text-white disabled:bg-[#d2c9be]" aria-label="Tambah"><Plus size={14}/></button></div>}</div></div>
          </article>;
        })}</div>}
        <div className="mt-12 flex flex-col items-center justify-between gap-5 rounded-[26px] bg-[#29241f] px-7 py-6 text-white sm:flex-row md:px-9"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#ffc857]">Pesananmu siap kapan?</p><p className="serif mt-1 text-2xl">Langsung ambil atau kami siapkan.</p></div><Link href="/checkout" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#ffc857] px-6 text-xs font-bold text-[#392c1c] transition hover:bg-white">Lanjut ke checkout <ArrowRight size={15}/></Link></div>
      </section>

      <section id="cerita" className="bg-[#f5e6d0]"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-[.8fr_1.2fr] md:items-center md:px-10 md:py-24"><div className="relative mx-auto grid aspect-square w-full max-w-[380px] place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_45%_40%,#ffdc98,#f5a55f_68%,#e56d3e)]"><div className="absolute inset-7 rounded-full border border-white/50"/><div className="absolute inset-12 rounded-full border border-white/35"/><span className="relative text-[130px] drop-shadow-lg">🥡</span><span className="absolute bottom-12 rounded-full bg-white/85 px-4 py-2 text-[9px] font-bold uppercase tracking-[.16em]">Rasa rumahan di dekatmu</span></div><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#df6630]">Sedekat itu dengan enak</p><h2 className="serif mt-4 text-5xl leading-[1.03] tracking-[-.04em] md:text-6xl">Dari dapur kecil,<br/><i className="text-[#ef6c32]">buat hari lebih oke.</i></h2><p className="mt-6 max-w-[530px] text-sm leading-7 text-[#716358]">Mie Mantap Okarei melayani khusus penghuni Asrama Telkom Gedung 9. Pesan dengan mudah, pilih cara penyajian yang kamu suka, lalu nikmati tanpa harus pergi jauh.</p><a href="#lokasi" className="mt-7 inline-flex items-center gap-2 border-b border-[#ef6c32] pb-1 text-xs font-bold text-[#cf5526]">Kenali tempat kami <ArrowRight size={14}/></a></div></div></section>

      <section id="lokasi" className="mx-auto max-w-7xl px-5 py-16 md:px-10"><div className="flex flex-col gap-6 rounded-[26px] border border-[#eadfce] bg-white p-7 md:flex-row md:items-center md:justify-between md:p-10"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ef6c32]">Mampir, yuk</p><h2 className="serif mt-2 text-3xl">Khusus Asrama Telkom, Gedung 9.</h2><p className="mt-2 text-sm text-[#81766c]">{settings?.description??"Makanan dan minuman hangat untuk teman-teman asrama."}</p></div><div className="flex items-center gap-3 rounded-2xl bg-[#fff4e3] px-5 py-4 text-sm"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#ef6c32]">📍</span><span><b className="block">Asrama Telkom · Gedung 9</b><span className="mt-1 block text-xs text-[#83766a]">{settings?.phone??"Info pemesanan tersedia di toko"}</span></span></div></div></section>
    </main>
    <footer className="bg-[#28231f] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-10"><Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ef6c32]"><Soup size={22}/></span><span><b className="block text-xs tracking-[.12em]">MIE MANTAP OKAREI</b><span className="mt-1 block text-[10px] text-[#b8aaa0]">Dari kami, buat hari lebih oke.</span></span></Link><p className="text-xs text-[#b8aaa0]">© {new Date().getFullYear()} Mie Mantap Okarei · Khusus penghuni Asrama Telkom Gedung 9</p><Link href="/admin/login" className="text-xs text-[#d2c1b1] hover:text-white">Owner</Link></div></footer>
    {cartCount>0&&<Link href="/checkout" className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-3 rounded-full bg-[#29241f] px-5 py-4 text-sm font-bold text-white shadow-2xl"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#ffc857] text-xs text-[#30261d]">{cartCount}</span>Lihat keranjang <ArrowRight size={16}/></Link>}
  </>;
}
