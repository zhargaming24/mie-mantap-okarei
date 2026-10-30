export type ServiceType = "DIRECT_PICKUP" | "PREPARED" | "CUSTOMER_CHOICE";
export type Category = { id: string; name: string; slug: string; sort_order: number };
export type Product = {
  id: string; category_id: string | null; name: string; slug: string; description: string | null;
  image_url: string | null; price: number; stock: number; is_active: boolean; is_popular: boolean;
  service_type: ServiceType; created_at: string; toppingOptions?: Topping[];
};
export type Topping = { id: string; name: string; price: number; stock: number; is_active: boolean };
export type StoreSettings = {
  store_name: string; description: string; phone: string | null; is_open: boolean;
  preparation_fee: number; qris_image_url: string | null; opens_at: string | null; closes_at: string | null;
};
export type CartLine = { productId: string; name: string; price: number; quantity: number; imageUrl: string | null; service: "pickup" | "prepared"; toppings: { id: string; name: string; price: number }[] };

export const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);
