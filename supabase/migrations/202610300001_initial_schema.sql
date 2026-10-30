create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.service_type as enum ('DIRECT_PICKUP', 'PREPARED', 'CUSTOMER_CHOICE');
create type public.payment_method as enum ('CASH', 'QRIS');
create type public.payment_status as enum ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'PAYMENT_REJECTED', 'REFUNDED');
create type public.order_status as enum ('RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(), name text not null unique,
  slug text not null unique, sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default extensions.gen_random_uuid(), category_id uuid references public.categories(id) on delete set null,
  name text not null, slug text not null unique, description text, image_url text,
  price integer not null check (price >= 0), stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true, is_popular boolean not null default false,
  service_type public.service_type not null default 'DIRECT_PICKUP', low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.toppings (
  id uuid primary key default extensions.gen_random_uuid(), name text not null unique, price integer not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0), is_active boolean not null default true, image_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_toppings (
  product_id uuid not null references public.products(id) on delete cascade,
  topping_id uuid not null references public.toppings(id) on delete cascade,
  primary key(product_id,topping_id)
);
create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(), order_number text not null unique,
  idempotency_key uuid not null unique,
  customer_name text not null, phone text not null, customer_note text not null default '',
  subtotal integer not null check (subtotal >= 0), preparation_fee integer not null default 0 check (preparation_fee >= 0),
  total integer not null check (total >= 0), payment_method public.payment_method not null,
  payment_status public.payment_status not null, status public.order_status not null default 'RECEIVED',
  requires_preparation boolean not null default false,
  access_token_hash bytea not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_created_at_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status,payment_status,created_at desc);
create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  unit_price integer not null check (unit_price >= 0), quantity integer not null check (quantity > 0),
  service_choice text not null check (service_choice in ('pickup','prepared')), line_note text not null default '',
  line_total integer not null check (line_total >= 0)
);
create table public.order_item_toppings (
  id uuid primary key default extensions.gen_random_uuid(), order_item_id uuid not null references public.order_items(id) on delete cascade,
  topping_id uuid references public.toppings(id) on delete set null, topping_name text not null,
  unit_price integer not null check (unit_price >= 0), quantity integer not null check (quantity > 0)
);
create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null, status public.payment_status not null, amount integer not null check (amount >= 0),
  proof_path text, rejection_reason text, verified_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index payments_status_idx on public.payments(status,created_at desc);
create table public.queue (
  id uuid primary key default extensions.gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade,
  queue_date date not null, sequence integer not null check (sequence > 0), queue_number text not null,
  created_at timestamptz not null default now(), unique(queue_date,sequence), unique(queue_date,queue_number)
);
create table public.stock_movements (
  id uuid primary key default extensions.gen_random_uuid(), product_id uuid references public.products(id) on delete set null,
  topping_id uuid references public.toppings(id) on delete set null, change_amount integer not null check (change_amount <> 0),
  reason text not null, order_id uuid references public.orders(id) on delete set null, actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(), check ((product_id is not null)::integer + (topping_id is not null)::integer = 1)
);
create table public.store_settings (
  id integer primary key default 1 check (id=1), store_name text not null default 'Mie Mantap Okarei',
  description text not null default 'Makanan dan minuman hangat untuk teman-teman Asrama Telkom.',
  phone text, logo_url text, qris_image_url text, is_open boolean not null default false,
  preparation_fee integer not null default 0 check (preparation_fee >= 0), opens_at time, closes_at time,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values (1) on conflict do nothing;
insert into public.categories(name,slug,sort_order) values
  ('Mie','mie',1),('Makanan','makanan',2),('Minuman','minuman',3),('Topping','topping',4),('Lainnya','lainnya',5)
on conflict (slug) do nothing;
create table public.order_status_history (
  id uuid primary key default extensions.gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  previous_status public.order_status, new_status public.order_status not null, note text not null default '',
  actor_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id,created_at);

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='owner') $$;
revoke all on function private.is_owner() from public, anon;
grant usage on schema private to authenticated;
grant usage on schema private to anon,service_role;
grant execute on function private.is_owner() to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.toppings enable row level security;
alter table public.product_toppings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_toppings enable row level security;
alter table public.payments enable row level security;
alter table public.queue enable row level security;
alter table public.stock_movements enable row level security;
alter table public.store_settings enable row level security;
alter table public.order_status_history enable row level security;

revoke all on public.profiles,public.categories,public.products,public.toppings,public.product_toppings,public.orders,public.order_items,public.order_item_toppings,public.payments,public.queue,public.stock_movements,public.store_settings,public.order_status_history from anon,authenticated;
grant select on public.categories,public.products,public.toppings,public.product_toppings,public.store_settings to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.categories,public.products,public.toppings,public.product_toppings,public.orders,public.order_items,public.order_item_toppings,public.payments,public.queue,public.stock_movements,public.store_settings,public.order_status_history to authenticated;
revoke update,delete on public.stock_movements from authenticated;

create policy "active categories are public" on public.categories for select to anon,authenticated using (is_active);
create policy "active products are public" on public.products for select to anon,authenticated using (is_active);
create policy "active toppings are public" on public.toppings for select to anon,authenticated using (is_active);
create policy "topping links public" on public.product_toppings for select to anon,authenticated using (true);
create policy "store info public" on public.store_settings for select to anon,authenticated using (true);
create policy "owners manage profiles" on public.profiles for all to authenticated using ((select private.is_owner()) and id=(select auth.uid())) with check ((select private.is_owner()) and id=(select auth.uid()));
create policy "owners manage categories" on public.categories for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage products" on public.products for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage toppings" on public.toppings for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage product toppings" on public.product_toppings for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage orders" on public.orders for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage order items" on public.order_items for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage order item toppings" on public.order_item_toppings for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage payments" on public.payments for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage queue" on public.queue for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners read stock movements" on public.stock_movements for select to authenticated using ((select private.is_owner()));
create policy "owners record stock movements" on public.stock_movements for insert to authenticated with check ((select private.is_owner()));
create policy "owners manage store settings" on public.store_settings for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy "owners manage status history" on public.order_status_history for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create or replace function private.submit_order(p_order jsonb, p_idempotency_key uuid, p_access_token uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_order_id uuid := extensions.gen_random_uuid(); v_number text; v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq integer; v_subtotal integer := 0; v_prep_fee integer := 0; v_total integer := 0; v_needs_prep boolean := false;
  v_method public.payment_method; v_line jsonb; v_product public.products%rowtype; v_item_id uuid;
  v_qty integer; v_service text; v_topping_id uuid; v_topping public.toppings%rowtype; v_line_total integer;
  v_queue_number text := null; v_name text; v_phone text; v_note text; v_existing public.orders%rowtype;
  v_open time; v_close time; v_store_open boolean; v_now_time time := (now() at time zone 'Asia/Jakarta')::time;
begin
  if p_access_token is null or p_idempotency_key is null then raise exception 'INVALID_ORDER'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mmo-idem-'||p_idempotency_key::text));
  select * into v_existing from public.orders o where o.idempotency_key=p_idempotency_key;
  if found then
    if v_existing.access_token_hash<>extensions.digest(p_access_token::text,'sha256') then raise exception 'INVALID_ORDER'; end if;
    select q.queue_number into v_queue_number from public.queue q where q.order_id=v_existing.id;
    return jsonb_build_object('id',v_existing.id,'order_number',v_existing.order_number,'queue_number',v_queue_number,'payment_status',v_existing.payment_status);
  end if;
  if jsonb_typeof(p_order->'lines') <> 'array' or jsonb_array_length(p_order->'lines') not between 1 and 30 then raise exception 'INVALID_ORDER'; end if;
  v_name := trim(p_order->>'customer_name'); v_phone := p_order->>'phone'; v_note := coalesce(p_order->>'note','');
  if length(v_name) not between 2 and 80 or v_phone !~ '^(\+62|62|0)8[1-9][0-9]{6,11}$' or length(v_note)>300 then raise exception 'INVALID_CUSTOMER'; end if;
  v_method := (p_order->>'payment_method')::public.payment_method;
  select coalesce(s.is_open,false),s.opens_at,s.closes_at,s.preparation_fee into v_store_open,v_open,v_close,v_prep_fee from public.store_settings s where s.id=1;
  if not coalesce(v_store_open,false) then raise exception 'STORE_CLOSED'; end if;
  if v_open is not null and v_close is not null and not (case when v_open<=v_close then v_now_time>=v_open and v_now_time<v_close else v_now_time>=v_open or v_now_time<v_close end) then raise exception 'STORE_CLOSED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mmo-order-'||v_date::text));
  select coalesce(max((right(o.order_number,3))::integer),0)+1 into v_seq from public.orders o where o.order_number like 'ORD-'||to_char(v_date,'YYYYMMDD')||'-%';
  v_number := 'ORD-'||to_char(v_date,'YYYYMMDD')||'-'||lpad(v_seq::text,3,'0');

  for v_line in select value from jsonb_array_elements(p_order->'lines') order by (value->>'product_id') loop
    v_qty := (v_line->>'quantity')::integer; v_service := v_line->>'service';
    if v_qty not between 1 and 30 or v_service not in ('pickup','prepared') then raise exception 'INVALID_ORDER'; end if;
    if (select count(*) from jsonb_array_elements_text(coalesce(v_line->'toppings','[]'::jsonb))) <> (select count(distinct value) from jsonb_array_elements_text(coalesce(v_line->'toppings','[]'::jsonb))) then raise exception 'INVALID_ORDER'; end if;
    select * into v_product from public.products p where p.id=(v_line->>'product_id')::uuid and p.is_active for update;
    if not found or v_product.stock < v_qty then raise exception 'OUT_OF_STOCK'; end if;
    if v_product.service_type='DIRECT_PICKUP' and v_service<>'pickup' then raise exception 'INVALID_SERVICE'; end if;
    if v_product.service_type='PREPARED' and v_service<>'prepared' then raise exception 'INVALID_SERVICE'; end if;
    if v_service='prepared' then v_needs_prep := true; end if;
    v_line_total := v_product.price * v_qty;
    update public.products set stock=stock-v_qty,updated_at=now() where id=v_product.id;
    insert into public.stock_movements(product_id,change_amount,reason,order_id) values(v_product.id,-v_qty,'order_reserved',v_order_id);
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,service_choice,line_total)
      values(v_order_id,v_product.id,v_product.name,v_product.price,v_qty,v_service,v_line_total) returning id into v_item_id;
    v_subtotal := v_subtotal+v_line_total;
    for v_topping_id in select value::uuid from jsonb_array_elements_text(coalesce(v_line->'toppings','[]'::jsonb)) order by value loop
      select t.* into v_topping from public.toppings t join public.product_toppings pt on pt.topping_id=t.id
       where t.id=v_topping_id and pt.product_id=v_product.id and t.is_active for update;
      if not found or v_topping.stock < v_qty then raise exception 'OUT_OF_STOCK'; end if;
      update public.toppings set stock=stock-v_qty,updated_at=now() where id=v_topping.id;
      insert into public.stock_movements(topping_id,change_amount,reason,order_id) values(v_topping.id,-v_qty,'order_reserved',v_order_id);
      insert into public.order_item_toppings(order_item_id,topping_id,topping_name,unit_price,quantity) values(v_item_id,v_topping.id,v_topping.name,v_topping.price,v_qty);
      v_line_total := v_line_total + v_topping.price*v_qty;
      update public.order_items set line_total=v_line_total where id=v_item_id;
      v_subtotal := v_subtotal + v_topping.price*v_qty;
    end loop;
  end loop;
  v_total := v_subtotal + case when v_needs_prep then v_prep_fee else 0 end;
  insert into public.orders(id,order_number,idempotency_key,customer_name,phone,customer_note,subtotal,preparation_fee,total,payment_method,payment_status,requires_preparation,access_token_hash)
  values(v_order_id,v_number,p_idempotency_key,v_name,v_phone,v_note,v_subtotal,case when v_needs_prep then v_prep_fee else 0 end,v_total,v_method,
    case when v_method='CASH' then 'UNPAID'::public.payment_status else 'PENDING_VERIFICATION'::public.payment_status end,v_needs_prep,
    extensions.digest(p_access_token::text,'sha256'));
  insert into public.payments(order_id,method,status,amount) values(v_order_id,v_method,
    case when v_method='CASH' then 'UNPAID'::public.payment_status else 'PENDING_VERIFICATION'::public.payment_status end,v_total);
  insert into public.order_status_history(order_id,new_status,note) values(v_order_id,'RECEIVED','Pesanan diterima');
  if v_needs_prep then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mmo-queue-'||v_date::text));
    select coalesce(max(q.sequence),0)+1 into v_seq from public.queue q where q.queue_date=v_date;
    v_queue_number := 'A'||lpad(v_seq::text,3,'0');
    insert into public.queue(order_id,queue_date,sequence,queue_number) values(v_order_id,v_date,v_seq,v_queue_number);
  end if;
  return jsonb_build_object('id',v_order_id,'order_number',v_number,'queue_number',v_queue_number,'payment_status',case when v_method='CASH' then 'UNPAID' else 'PENDING_VERIFICATION' end);
end;
$$;
revoke all on function private.submit_order(jsonb,uuid,uuid) from public;
grant execute on function private.submit_order(jsonb,uuid,uuid) to anon,authenticated;
create or replace function public.submit_order(p_order jsonb,p_idempotency_key uuid,p_access_token uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.submit_order(p_order,p_idempotency_key,p_access_token) $$;
revoke all on function public.submit_order(jsonb,uuid,uuid) from public;
grant execute on function public.submit_order(jsonb,uuid,uuid) to anon,authenticated;

create or replace function private.get_order_status(p_order_number text,p_access_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('order_number',o.order_number,'customer_name',o.customer_name,'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,
    'total',o.total,'created_at',o.created_at,'queue_number',q.queue_number,'qris_image_url',(select s.qris_image_url from public.store_settings s where s.id=1),
    'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity,'service',i.service_choice,'total',i.line_total)) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.orders o left join public.queue q on q.order_id=o.id
  where o.order_number=p_order_number and o.access_token_hash=extensions.digest(p_access_token::text,'sha256')
$$;
revoke all on function private.get_order_status(text,uuid) from public;
grant execute on function private.get_order_status(text,uuid) to anon,authenticated;
create or replace function public.get_order_status(p_order_number text,p_access_token uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_order_status(p_order_number,p_access_token) $$;
revoke all on function public.get_order_status(text,uuid) from public;
grant execute on function public.get_order_status(text,uuid) to anon,authenticated;

create or replace function public.admin_update_order(p_order_id uuid,p_status public.order_status,p_payment_status public.payment_status,p_note text default '')
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_previous public.order_status; v_current_payment public.payment_status; v_payment public.payment_method;
begin
  if not (select private.is_owner()) then raise exception 'FORBIDDEN'; end if;
  select o.status,o.payment_status,o.payment_method into v_previous,v_current_payment,v_payment from public.orders o where o.id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_status='CANCELLED' and v_previous<>'CANCELLED' and v_current_payment<>'PAYMENT_REJECTED' then
    update public.products p set stock=p.stock+i.quantity,updated_at=now() from public.order_items i where i.order_id=p_order_id and i.product_id=p.id;
    insert into public.stock_movements(product_id,change_amount,reason,order_id) select i.product_id,i.quantity,'order_cancelled',p_order_id from public.order_items i where i.order_id=p_order_id and i.product_id is not null;
    update public.toppings t set stock=t.stock+it.quantity,updated_at=now() from public.order_item_toppings it join public.order_items i on i.id=it.order_item_id where i.order_id=p_order_id and it.topping_id=t.id;
    insert into public.stock_movements(topping_id,change_amount,reason,order_id) select it.topping_id,it.quantity,'order_cancelled',p_order_id from public.order_item_toppings it join public.order_items i on i.id=it.order_item_id where i.order_id=p_order_id and it.topping_id is not null;
    p_payment_status := case when v_current_payment='PAID' then 'REFUNDED'::public.payment_status else 'PAYMENT_REJECTED'::public.payment_status end;
  elsif p_payment_status='PAYMENT_REJECTED' and v_current_payment<>'PAYMENT_REJECTED' then
    update public.products p set stock=p.stock+i.quantity,updated_at=now() from public.order_items i where i.order_id=p_order_id and i.product_id=p.id;
    insert into public.stock_movements(product_id,change_amount,reason,order_id) select i.product_id,i.quantity,'payment_rejected',p_order_id from public.order_items i where i.order_id=p_order_id and i.product_id is not null;
    update public.toppings t set stock=t.stock+it.quantity,updated_at=now() from public.order_item_toppings it join public.order_items i on i.id=it.order_item_id where i.order_id=p_order_id and it.topping_id=t.id;
    insert into public.stock_movements(topping_id,change_amount,reason,order_id) select it.topping_id,it.quantity,'payment_rejected',p_order_id from public.order_item_toppings it join public.order_items i on i.id=it.order_item_id where i.order_id=p_order_id and it.topping_id is not null;
  elsif p_payment_status='PAID' and v_payment='QRIS' then
    if not exists(select 1 from public.payments p where p.order_id=p_order_id and p.proof_path is not null) then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;
  end if;
  update public.orders set status=p_status,payment_status=p_payment_status,updated_at=now() where id=p_order_id;
  update public.payments set status=p_payment_status,verified_by=(select auth.uid()),updated_at=now(),rejection_reason=case when p_payment_status='PAYMENT_REJECTED' then p_note else null end where order_id=p_order_id;
  if p_status is distinct from v_previous then insert into public.order_status_history(order_id,previous_status,new_status,note,actor_id) values(p_order_id,v_previous,p_status,coalesce(p_note,''),(select auth.uid())); end if;
end;
$$;
grant execute on function public.admin_update_order(uuid,public.order_status,public.payment_status,text) to authenticated;

create or replace function private.submit_payment_proof(p_order_number text,p_access_token uuid,p_proof_path text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype; v_item record; v_topping record;
begin
  select o.* into v_order from public.orders o where o.order_number=p_order_number and o.access_token_hash=extensions.digest(p_access_token::text,'sha256') for update;
  if not found or v_order.payment_method<>'QRIS' or v_order.status='CANCELLED' then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_status not in ('PENDING_VERIFICATION','PAYMENT_REJECTED') then raise exception 'ORDER_NOT_PENDING'; end if;
  if v_order.payment_status='PAYMENT_REJECTED' then
    for v_item in select i.product_id,i.quantity from public.order_items i where i.order_id=v_order.id and i.product_id is not null order by i.product_id for update loop
      update public.products p set stock=p.stock-v_item.quantity,updated_at=now() where p.id=v_item.product_id and p.is_active and p.stock>=v_item.quantity;
      if not found then raise exception 'OUT_OF_STOCK'; end if;
      insert into public.stock_movements(product_id,change_amount,reason,order_id) values(v_item.product_id,-v_item.quantity,'payment_resubmitted',v_order.id);
    end loop;
    for v_topping in select it.topping_id,it.quantity from public.order_item_toppings it join public.order_items i on i.id=it.order_item_id where i.order_id=v_order.id and it.topping_id is not null order by it.topping_id for update of it loop
      update public.toppings t set stock=t.stock-v_topping.quantity,updated_at=now() where t.id=v_topping.topping_id and t.is_active and t.stock>=v_topping.quantity;
      if not found then raise exception 'OUT_OF_STOCK'; end if;
      insert into public.stock_movements(topping_id,change_amount,reason,order_id) values(v_topping.topping_id,-v_topping.quantity,'payment_resubmitted',v_order.id);
    end loop;
  end if;
  update public.orders set payment_status='PENDING_VERIFICATION',updated_at=now() where id=v_order.id;
  update public.payments set status='PENDING_VERIFICATION',proof_path=p_proof_path,rejection_reason=null,updated_at=now() where order_id=v_order.id;
end;
$$;
revoke all on function private.submit_payment_proof(text,uuid,text) from public;
grant execute on function private.submit_payment_proof(text,uuid,text) to service_role;
create or replace function public.submit_payment_proof(p_order_number text,p_access_token uuid,p_proof_path text)
returns void language sql security invoker set search_path = ''
as $$ select private.submit_payment_proof(p_order_number,p_access_token,p_proof_path) $$;
revoke all on function public.submit_payment_proof(text,uuid,text) from public;
grant execute on function public.submit_payment_proof(text,uuid,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('qris','qris',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "public read product images" on storage.objects for select to anon,authenticated using (bucket_id in ('product-images','qris'));
create policy "owners upload product images qris" on storage.objects for insert to authenticated with check ((select private.is_owner()) and bucket_id in ('product-images','qris'));
create policy "owners update product images qris" on storage.objects for update to authenticated using ((select private.is_owner()) and bucket_id in ('product-images','qris')) with check ((select private.is_owner()) and bucket_id in ('product-images','qris'));
create policy "owners read payment proofs" on storage.objects for select to authenticated using ((select private.is_owner()) and bucket_id='payment-proofs');
create policy "owners upload payment proofs" on storage.objects for insert to authenticated with check ((select private.is_owner()) and bucket_id='payment-proofs');

do $$ begin
  alter publication supabase_realtime add table public.orders;
  alter publication supabase_realtime add table public.payments;
  alter publication supabase_realtime add table public.queue;
exception when duplicate_object then null; when undefined_object then null;
end $$;
