"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function ownerClient(){
  const supabase=await createSupabaseServerClient(); if(!supabase)redirect("/admin/login?error=setup");
  const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/admin/login");
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="owner")redirect("/admin/login?error=owner"); return supabase;
}
const text=(form:FormData,key:string)=>String(form.get(key)??"").trim();

export async function loginAction(formData:FormData){
  const email=z.string().email().safeParse(text(formData,"email")); const password=z.string().min(8).safeParse(text(formData,"password"));
  if(!email.success||!password.success)redirect("/admin/login?error=credentials");
  const supabase=await createSupabaseServerClient(); if(!supabase)redirect("/admin/login?error=setup");
  const {error}=await supabase.auth.signInWithPassword({email:email.data,password:password.data});
  if(error)redirect("/admin/login?error=credentials");
  const {data:{user}}=await supabase.auth.getUser(); const {data:profile}=await supabase.from("profiles").select("role").eq("id",user?.id??"").maybeSingle();
  if(profile?.role!=="owner"){await supabase.auth.signOut();redirect("/admin/login?error=owner");}
  redirect("/admin/dashboard");
}
export async function logoutAction(){const supabase=await createSupabaseServerClient();await supabase?.auth.signOut();redirect("/");}

export async function updateOrderAction(formData:FormData){
  const supabase=await ownerClient(); const id=z.string().uuid().safeParse(text(formData,"order_id"));
  const status=z.enum(["RECEIVED","PREPARING","READY","COMPLETED","CANCELLED"]).safeParse(text(formData,"status"));
  const payment=z.enum(["UNPAID","PENDING_VERIFICATION","PAID","PAYMENT_REJECTED","REFUNDED"]).safeParse(text(formData,"payment_status"));
  if(!id.success||!status.success||!payment.success)return;
  const {error}=await supabase.rpc("admin_update_order",{p_order_id:id.data,p_status:status.data,p_payment_status:payment.data,p_note:text(formData,"note").slice(0,300)});
  if(error)redirect(`/admin/dashboard?error=${encodeURIComponent(error.message.includes("PAYMENT_PROOF_REQUIRED")?"Unggah bukti QRIS sebelum menyetujui pembayaran.":"Status pesanan gagal diperbarui.")}`);
  revalidatePath("/admin/dashboard");revalidatePath("/admin/queue");revalidatePath("/admin/payments");revalidatePath("/admin/reports");revalidatePath("/order");redirect("/admin/dashboard?saved=1");
}

export async function saveProductAction(formData:FormData){
  const supabase=await ownerClient();
  const name=z.string().min(2).max(80).safeParse(text(formData,"name"));const price=z.coerce.number().int().min(0).max(100000000).safeParse(formData.get("price"));const stock=z.coerce.number().int().min(0).max(1000000).safeParse(formData.get("stock"));
  if(!name.success||!price.success||!stock.success)redirect("/admin/products?error=Periksa nama, harga, dan stok.");
  const slug=name.data.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const id=z.string().uuid().safeParse(text(formData,"id")); const image=text(formData,"image_url");
  const row={name:name.data,slug,price:price.data,stock:stock.data,description:text(formData,"description")||null,image_url:image||null,category_id:text(formData,"category_id")||null,service_type:text(formData,"service_type") as "DIRECT_PICKUP"|"PREPARED"|"CUSTOMER_CHOICE",is_active:formData.get("is_active")==="on",is_popular:formData.get("is_popular")==="on"};
  let productId=id.success?id.data:"";
  let error;
  if(id.success){
    const {data:before}=await supabase.from("products").select("stock").eq("id",id.data).single();
    const updated=await supabase.from("products").update(row).eq("id",id.data);error=updated.error;
    if(!error&&before&&before.stock!==stock.data){const {data:{user}}=await supabase.auth.getUser();await supabase.from("stock_movements").insert({product_id:id.data,change_amount:stock.data-before.stock,reason:"owner_adjustment",actor_id:user?.id??null});}
  }else{
    const inserted=await supabase.from("products").insert(row).select("id").single();error=inserted.error;productId=inserted.data?.id??"";
    if(!error&&stock.data>0){const {data:{user}}=await supabase.auth.getUser();await supabase.from("stock_movements").insert({product_id:productId,change_amount:stock.data,reason:"initial_stock",actor_id:user?.id??null});}
  }
  if(error)redirect(`/admin/products?error=${encodeURIComponent(error.message.includes("products_slug_key")?"Nama produk sudah ada.":"Produk gagal disimpan.")}`);
  await supabase.from("product_toppings").delete().eq("product_id",productId);
  const toppingIds=formData.getAll("topping_id").map(String).filter((id)=>z.string().uuid().safeParse(id).success);
  if(toppingIds.length)await supabase.from("product_toppings").insert(toppingIds.map((topping_id)=>({product_id:productId,topping_id})));
  revalidatePath("/");revalidatePath("/admin/products");redirect("/admin/products?saved=1");
}
export async function deleteProductAction(formData:FormData){
  const supabase=await ownerClient();
  const id=z.string().uuid().safeParse(text(formData,"id"));
  if(!id.success)redirect("/admin/products?error=ID produk tidak valid.");
  const {data:deleted,error}=await supabase.from("products").delete().eq("id",id.data).select("id").maybeSingle();
  if(error){
    const message=error.code==="23503"
      ?"Produk masih terhubung dengan data lain sehingga belum bisa dihapus."
      :"Produk gagal dihapus. Pastikan Anda masuk sebagai owner lalu coba lagi.";
    redirect(`/admin/products?error=${encodeURIComponent(message)}`);
  }
  if(!deleted)redirect("/admin/products?error=Produk tidak ditemukan atau akun ini tidak memiliki izin owner.");
  revalidatePath("/");
  revalidatePath("/admin/products");
  redirect("/admin/products?deleted=1");
}
export async function saveCategoryAction(formData:FormData){const supabase=await ownerClient();const name=z.string().min(2).max(50).safeParse(text(formData,"name"));const sort=z.coerce.number().int().min(0).max(999).safeParse(formData.get("sort_order"));if(!name.success||!sort.success)redirect("/admin/categories?error=Nama kategori atau urutan belum valid.");const slug=name.data.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");const id=z.string().uuid().safeParse(text(formData,"id"));const result=id.success?await supabase.from("categories").update({name:name.data,slug,sort_order:sort.data}).eq("id",id.data):await supabase.from("categories").insert({name:name.data,slug,sort_order:sort.data});if(result.error)redirect(`/admin/categories?error=${encodeURIComponent("Kategori gagal disimpan atau nama sudah ada.")}`);revalidatePath("/");revalidatePath("/admin/categories");redirect("/admin/categories?saved=1");}
export async function saveToppingAction(formData:FormData){const supabase=await ownerClient();const name=z.string().min(2).max(60).safeParse(text(formData,"name"));const price=z.coerce.number().int().min(0).safeParse(formData.get("price"));const stock=z.coerce.number().int().min(0).safeParse(formData.get("stock"));if(!name.success||!price.success||!stock.success)redirect("/admin/toppings?error=Periksa data topping.");const id=z.string().uuid().safeParse(text(formData,"id"));let error;if(id.success){const {data:before}=await supabase.from("toppings").select("stock").eq("id",id.data).single();const result=await supabase.from("toppings").update({name:name.data,price:price.data,stock:stock.data}).eq("id",id.data);error=result.error;if(!error&&before&&before.stock!==stock.data){const {data:{user}}=await supabase.auth.getUser();await supabase.from("stock_movements").insert({topping_id:id.data,change_amount:stock.data-before.stock,reason:"owner_adjustment",actor_id:user?.id??null});}}else{const result=await supabase.from("toppings").insert({name:name.data,price:price.data,stock:stock.data,is_active:true}).select("id").single();error=result.error;if(!error&&result.data&&stock.data>0){const {data:{user}}=await supabase.auth.getUser();await supabase.from("stock_movements").insert({topping_id:result.data.id,change_amount:stock.data,reason:"initial_stock",actor_id:user?.id??null});}}if(error)redirect("/admin/toppings?error=Topping gagal disimpan.");revalidatePath("/admin/toppings");redirect("/admin/toppings?saved=1");}
export async function deleteCategoryAction(formData:FormData){const supabase=await ownerClient();const id=z.string().uuid().safeParse(text(formData,"id"));if(!id.success)return;const {error}=await supabase.from("categories").update({is_active:false}).eq("id",id.data);if(error)redirect("/admin/categories?error=Kategori gagal dinonaktifkan.");revalidatePath("/");revalidatePath("/admin/categories");}
export async function deactivateToppingAction(formData:FormData){const supabase=await ownerClient();const id=z.string().uuid().safeParse(text(formData,"id"));if(!id.success)return;const {error}=await supabase.from("toppings").update({is_active:false}).eq("id",id.data);if(error)redirect("/admin/toppings?error=Topping gagal dinonaktifkan.");revalidatePath("/admin/toppings");}
export async function updateStoreSettingsAction(formData:FormData){const supabase=await ownerClient();const fee=z.coerce.number().int().min(0).max(100000).safeParse(formData.get("preparation_fee"));if(!fee.success)redirect("/admin/settings?error=Biaya layanan belum valid.");const {error}=await supabase.from("store_settings").update({store_name:text(formData,"store_name"),description:text(formData,"description"),phone:text(formData,"phone")||null,is_open:formData.get("is_open")==="on",preparation_fee:fee.data,qris_image_url:text(formData,"qris_image_url")||null,opens_at:text(formData,"opens_at")||null,closes_at:text(formData,"closes_at")||null}).eq("id",1);if(error)redirect("/admin/settings?error=Pengaturan gagal disimpan.");revalidatePath("/");revalidatePath("/admin/settings");redirect("/admin/settings?saved=1");}

export async function activateToppingAction(formData:FormData){const supabase=await ownerClient();const id=z.string().uuid().safeParse(text(formData,"id"));if(!id.success)return;const {error}=await supabase.from("toppings").update({is_active:true}).eq("id",id.data);if(error)redirect("/admin/toppings?error=Topping gagal diaktifkan.");revalidatePath("/");revalidatePath("/admin/products");revalidatePath("/admin/toppings");redirect("/admin/toppings?saved=1");}

