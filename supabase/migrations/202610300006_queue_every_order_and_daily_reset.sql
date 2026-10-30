do $$
declare v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  update public.queue q set sequence=q.sequence+1000000,queue_number='TMP-'||q.id::text where q.queue_date=v_today;
  insert into public.queue(order_id,queue_date,sequence,queue_number)
  select o.id,v_today,2000000+row_number() over(order by o.created_at,o.id)::integer,'TMP-'||o.id::text
  from public.orders o
  where (o.created_at at time zone 'Asia/Jakarta')::date=v_today
    and not exists(select 1 from public.queue q where q.order_id=o.id);
  with ranked as (
    select q.id,row_number() over(order by o.created_at,o.id)::integer as new_sequence
    from public.queue q join public.orders o on o.id=q.order_id
    where q.queue_date=v_today
  )
  update public.queue q set sequence=r.new_sequence,queue_number='A'||lpad(r.new_sequence::text,3,'0')
  from ranked r where q.id=r.id;
end $$;
CREATE OR REPLACE FUNCTION private.submit_order(p_order jsonb, p_idempotency_key uuid, p_access_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order_id uuid := extensions.gen_random_uuid(); v_number text; v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq integer; v_subtotal integer := 0; v_prep_fee integer := 0; v_total integer := 0; v_needs_prep boolean := false;
  v_method public.payment_method; v_line jsonb; v_product public.products%rowtype; v_item_id uuid;
  v_qty integer; v_service text; v_topping_id uuid; v_topping public.toppings%rowtype; v_line_total integer;
  v_queue_number text := null; v_name text; v_phone text; v_room text; v_note text; v_existing public.orders%rowtype;
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
  v_name := trim(p_order->>'customer_name'); v_phone := p_order->>'phone'; v_room := trim(p_order->>'room_number'); v_note := coalesce(p_order->>'note','');
  if length(v_name) not between 2 and 80 or v_phone !~ '^(\+62|62|0)8[1-9][0-9]{6,11}$' or length(v_note)>300 or length(v_room) not between 1 and 20 then raise exception 'INVALID_CUSTOMER'; end if;
  v_method := (p_order->>'payment_method')::public.payment_method;
  select coalesce(s.is_open,false),s.opens_at,s.closes_at,s.preparation_fee into v_store_open,v_open,v_close,v_prep_fee from public.store_settings s where s.id=1;
  if not coalesce(v_store_open,false) then raise exception 'STORE_CLOSED'; end if;
  if v_open is not null and v_close is not null and not (case when v_open<=v_close then v_now_time>=v_open and v_now_time<v_close else v_now_time>=v_open or v_now_time<v_close end) then raise exception 'STORE_CLOSED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mmo-order-'||v_date::text));
  select coalesce(max((right(o.order_number,3))::integer),0)+1 into v_seq from public.orders o where o.order_number like 'ORD-'||to_char(v_date,'YYYYMMDD')||'-%';
  v_number := 'ORD-'||to_char(v_date,'YYYYMMDD')||'-'||lpad(v_seq::text,3,'0');

  insert into public.orders(id,order_number,idempotency_key,customer_name,phone,room_number,customer_note,subtotal,preparation_fee,total,payment_method,payment_status,requires_preparation,access_token_hash)
  values(v_order_id,v_number,p_idempotency_key,v_name,v_phone,v_room,v_note,0,0,0,v_method,
    case when v_method='CASH' then 'UNPAID'::public.payment_status else 'PENDING_VERIFICATION'::public.payment_status end,false,
    extensions.digest(p_access_token::text,'sha256'));

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
      select t.* into v_topping from public.toppings t left join public.product_toppings pt on pt.topping_id=t.id and pt.product_id=v_product.id
       where t.id=v_topping_id and t.is_active and (pt.product_id is not null or exists(select 1 from public.products p join public.categories c on c.id=p.category_id where p.id=v_product.id and c.name='Makanan')) for update of t;
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
  update public.orders set subtotal=v_subtotal,preparation_fee=case when v_needs_prep then v_prep_fee else 0 end,total=v_total,requires_preparation=v_needs_prep,updated_at=now() where id=v_order_id;
  insert into public.payments(order_id,method,status,amount) values(v_order_id,v_method,
    case when v_method='CASH' then 'UNPAID'::public.payment_status else 'PENDING_VERIFICATION'::public.payment_status end,v_total);
  insert into public.order_status_history(order_id,new_status,note) values(v_order_id,'RECEIVED','Pesanan diterima');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mmo-queue-'||v_date::text));
  select coalesce(max(q.sequence),0)+1 into v_seq from public.queue q where q.queue_date=v_date;
  v_queue_number := 'A'||lpad(v_seq::text,3,'0');
  insert into public.queue(order_id,queue_date,sequence,queue_number) values(v_order_id,v_date,v_seq,v_queue_number);
  return jsonb_build_object('id',v_order_id,'order_number',v_number,'queue_number',v_queue_number,'payment_status',case when v_method='CASH' then 'UNPAID' else 'PENDING_VERIFICATION' end);
end;
$function$
;
