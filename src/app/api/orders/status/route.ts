import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
const schema=z.object({order_number:z.string().min(8).max(32),access_token:z.string().uuid()});
export async function POST(request:Request){
  const supabase=await createSupabaseServerClient();
  if(!supabase)return NextResponse.json({error:"Sistem pesanan belum terhubung."},{status:503});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Masukkan nomor pesanan dan tautan akses yang valid."},{status:400});
  const {data,error}=await supabase.rpc("get_order_status",{p_order_number:parsed.data.order_number,p_access_token:parsed.data.access_token});
  if(error||!data)return NextResponse.json({error:"Pesanan tidak ditemukan atau tautan akses tidak valid."},{status:404});
  return NextResponse.json({order:data});
}
