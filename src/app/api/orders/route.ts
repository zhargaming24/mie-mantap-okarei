import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  customer_name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^(\\+62|62|0)8[1-9][0-9]{6,11}$/),
  room_number: z.string().trim().min(1).max(20),
  note: z.string().max(300).optional().default(""),
  payment_method: z.enum(["CASH", "QRIS"]),
  idempotency_key: z.string().uuid(),
  access_token: z.string().uuid(),
  lines: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(30), service: z.enum(["pickup", "prepared"]), toppings: z.array(z.string().uuid()).max(12).default([]) })).min(1).max(30),
});

async function validProof(file: File) {
  if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (file.type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Form pesanan tidak valid." }, { status: 400 });
  const rawOrder = JSON.parse(String(form.get("order") ?? "null"));
  const parsed = schema.safeParse(rawOrder);
  if (!parsed.success) return NextResponse.json({ error: "Periksa kembali data pesanan dan nomor HP." }, { status: 400 });
  const { access_token, idempotency_key, ...input } = parsed.data;
  let proofPath: string | null = null;
  if (input.payment_method === "QRIS") {
    const admin = createSupabaseAdminClient();
    const proof = form.get("proof");
    if (!(proof instanceof File) || !admin) return NextResponse.json({ error: "Unggah bukti pembayaran QRIS sebelum membuat pesanan." }, { status: 400 });
    if (!await validProof(proof)) return NextResponse.json({ error: "Gunakan JPG, PNG, atau WebP yang valid, maksimal 5 MB." }, { status: 400 });
    proofPath = `pending/${crypto.randomUUID()}.${proof.type.split("/")[1]}`;
    const { error } = await admin.storage.from("payment-proofs").upload(proofPath, proof, { contentType: proof.type, upsert: false });
    if (error) return NextResponse.json({ error: "Bukti pembayaran gagal diunggah." }, { status: 400 });
  }
  const orderInput = proofPath ? { ...input, proof_path: proofPath } : input;
  const { data, error } = await supabase.rpc("submit_order", { p_order: orderInput, p_idempotency_key: idempotency_key, p_access_token: access_token });
  if (error) {
    if (proofPath) await createSupabaseAdminClient()?.storage.from("payment-proofs").remove([proofPath]);
    return NextResponse.json({ error: error.message.includes("PROOF_REQUIRED") ? "Unggah bukti pembayaran sebelum membuat pesanan." : error.message.includes("STORE_CLOSED") ? "Toko sedang tutup." : error.message.includes("OUT_OF_STOCK") ? "Stok salah satu menu baru saja habis." : "Pesanan belum dapat dibuat. Periksa stok dan coba lagi." }, { status: 400 });
  }
  return NextResponse.json({ order: { ...data, access_token } }, { status: 201 });
}
