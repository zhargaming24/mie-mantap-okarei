import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Category, Product, StoreSettings, Topping } from "@/lib/types";

export async function getStoreData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { configured: false, products: [] as Product[], categories: [] as Category[], settings: null as StoreSettings | null, toppings: [] as Topping[] };
  const [products, categories, settings, toppings, productToppings] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name,slug,sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("store_settings").select("store_name,description,phone,is_open,preparation_fee,qris_image_url,opens_at,closes_at").limit(1).maybeSingle(),
    supabase.from("toppings").select("id,name,price,stock,is_active").eq("is_active", true).order("name"),
    supabase.from("product_toppings").select("product_id,topping_id"),
  ]);
  const toppingRows = (toppings.data ?? []) as Topping[];
  const links = productToppings.data ?? [];
  const productsWithToppings = ((products.data ?? []) as Product[]).map((product) => {
    const categoryName = (categories.data ?? []).find((category) => category.id === product.category_id)?.name;
    return {
      ...product,
      toppingOptions: toppingRows.filter((topping) => categoryName === "Makanan" || links.some((link) => link.product_id === product.id && link.topping_id === topping.id)),
    };
  });
  return {
    configured: true,
    products: productsWithToppings,
    categories: (categories.data ?? []) as Category[],
    settings: settings.data ? { ...(settings.data as StoreSettings), is_open: isWithinHours(settings.data as StoreSettings) } : null,
    toppings: toppingRows,
  };
}

function isWithinHours(settings:StoreSettings){
  if(!settings.is_open||!settings.opens_at||!settings.closes_at)return settings.is_open;
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()).split(":").map(Number);
  const now=parts[0]*60+parts[1];const [openHour,openMinute]=settings.opens_at.split(":").map(Number);const [closeHour,closeMinute]=settings.closes_at.split(":").map(Number);const open=openHour*60+openMinute;const close=closeHour*60+closeMinute;
  return open<=close?now>=open&&now<close:now>=open||now<close;
}

