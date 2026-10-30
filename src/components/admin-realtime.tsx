"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export function AdminRealtime() {
  const router = useRouter();
  const [newOrders, setNewOrders] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const client = createBrowserClient(url, key);
    const channel = client
      .channel("owner-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        setNewOrders((count) => count + 1);
        router.refresh();
        if (notificationsOn && "Notification" in window && Notification.permission === "granted") {
          const order = payload.new as { order_number?: string };
          new Notification("Pesanan baru masuk", { body: order.order_number ?? "Buka dashboard untuk melihat pesanan." });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => router.refresh())
      .subscribe();
    const poll = window.setInterval(() => router.refresh(), 20000);
    return () => { window.clearInterval(poll); void client.removeChannel(channel); };
  }, [router, notificationsOn]);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsOn(permission === "granted");
  }

  return <div className="flex flex-wrap items-center gap-2">
    <span aria-live="polite" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold ${newOrders ? "bg-red-100 text-red-800" : "bg-[#e9f1e4] text-[#4d713b]"}`}>
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${newOrders ? "bg-red-600" : "bg-[#65964d]"}`} />
      {newOrders ? `${newOrders} pesanan baru` : "Pembaruan pesanan aktif"}
    </span>
    <button type="button" onClick={enableNotifications} className="rounded-full border border-[#eadfce] px-3 py-2 text-[10px] font-bold text-[#655b52]">
      {notificationsOn ? "Notifikasi aktif" : "Aktifkan notifikasi"}
    </button>
  </div>;
}

