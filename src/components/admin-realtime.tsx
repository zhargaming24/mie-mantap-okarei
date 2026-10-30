"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
export function AdminRealtime(){
 const router=useRouter();
 useEffect(()=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return;const client=createBrowserClient(url,key);const channel=client.channel("owner-orders").on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>router.refresh()).on("postgres_changes",{event:"*",schema:"public",table:"payments"},()=>router.refresh()).subscribe();return()=>{void client.removeChannel(channel);};},[router]);
 return <span className="inline-flex items-center gap-2 rounded-full bg-[#e9f1e4] px-3 py-2 text-[10px] font-bold text-[#4d713b]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#65964d]"/> Notifikasi langsung aktif</span>;
}
