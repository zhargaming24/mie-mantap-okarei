import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const supabase=await createSupabaseServerClient(); const admin=createSupabaseAdminClient();
  if(!supabase||!admin)return NextResponse.json({error:"Layanan upload belum dikonfigurasi."},{status:503});
  const form=await request.formData().catch(()=>null);
  if(!form)return NextResponse.json({error:"Form upload tidak valid."},{status:400});
  const orderNumber=z.string().min(8).max(32).safeParse(form.get("order_number"));
  const token=z.string().uuid().safeParse(form.get("access_token"));
  const file=form.get("proof");
  if(!orderNumber.success||!token.success||!(file instanceof File))return NextResponse.json({error:"Lengkapi nomor pesanan, token akses, dan bukti pembayaran."},{status:400});
  if(file.size>5*1024*1024||!(["image/jpeg","image/png","image/webp"] as string[]).includes(file.type))return NextResponse.json({error:"Gunakan JPG, PNG, atau WebP maksimal 5 MB."},{status:400});
  const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const jpeg=signature[0]===0xff&&signature[1]===0xd8&&signature[2]===0xff;
  const png=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>signature[index]===byte);
  const webp=String.fromCharCode(...signature.slice(0,4))==="RIFF"&&String.fromCharCode(...signature.slice(8,12))==="WEBP";
  if(!(file.type==="image/jpeg"&&jpeg)&&!(file.type==="image/png"&&png)&&!(file.type==="image/webp"&&webp))return NextResponse.json({error:"File bukan gambar yang valid."},{status:400});
  const {data:order,error}=await supabase.rpc("get_order_status",{p_order_number:orderNumber.data,p_access_token:token.data});
  if(error||!order)return NextResponse.json({error:"Pesanan tidak ditemukan atau token tidak valid."},{status:404});
  if(order.payment_method!=="QRIS"||!["PENDING_VERIFICATION","PAYMENT_REJECTED"].includes(order.payment_status))return NextResponse.json({error:"Pesanan ini tidak menunggu bukti QRIS."},{status:409});
  const {data:record}=await admin.from("orders").select("id").eq("order_number",orderNumber.data).single();
  if(!record)return NextResponse.json({error:"Pesanan tidak ditemukan."},{status:404});
  const path=`${record.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
  const {error:uploadError}=await admin.storage.from("payment-proofs").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError)return NextResponse.json({error:"Bukti pembayaran gagal diunggah."},{status:400});
  const {error:saveError}=await admin.rpc("submit_payment_proof",{p_order_number:orderNumber.data,p_access_token:token.data,p_proof_path:path});
  if(saveError){await admin.storage.from("payment-proofs").remove([path]); return NextResponse.json({error:saveError.message.includes("OUT_OF_STOCK")?"Stok sudah tidak cukup untuk mengaktifkan kembali pesanan ini.":"Bukti tidak dapat dikaitkan ke pesanan."},{status:409});}
  return NextResponse.json({ok:true});
}
