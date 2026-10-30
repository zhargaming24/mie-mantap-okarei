import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  customer_name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/),
  note: z.string().max(300).optional().default(""),
  payment_method: z.enum(["CASH", "QRIS"]),
  idempotency_key: z.string().uuid(),
  access_token: z.string().uuid().length(36).or(z.string().uuid().length(36)),
  lines: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(30), service: z.enum(["pickup", "prepared"]), toppings: z.array(z.string().uuid()).max(12).default([]) })).min(1).max(30),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Periksa kembali data pesanan dan nomor HP." }, { status: 400 });
  const { access_token, idempotency_key, ...input } = parsed.data;
  const { data, error } = await supabase.rpc("submit_order", { p_order: input, p_idempotency_key: idempotency_key, p_access_token: access_token });
  if (error) return NextResponse.json({ error: error.message.includes("STORE_CLOSED") ? "Toko sedang tutup." : error.message.includes("OUT_OF_STOCK") ? "Stok salah satu menu baru saja habis." : error.message.includes("INVALID_CUSTOMER") ? "Periksa kembali nama dan nomor HP." : error.message.includes("INVALID_SERVICE") ? "Pilihan layanan untuk salah satu menu tidak sesuai." : "Pesanan belum dapat disimpan. Coba lagi beberapa saat." }, { status: 400 });
  return NextResponse.json({ order: { ...data, access_token } }, { status: 201 });
}
