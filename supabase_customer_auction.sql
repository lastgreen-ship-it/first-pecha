-- =====================================================
-- 고객용 "내 경매 결과" 페이지 (/my?t=열쇠값)
--  · 로그인 없이, 문자로 받은 링크의 열쇠값으로만 조회·선택
--  · 고객에게는 금액만 보이고 업체명은 낙찰 후에만 공개
-- Supabase SQL Editor 에 붙여넣고 RUN
-- =====================================================

-- 1) 견적 건마다 고유 열쇠값
alter table public.pecha_estimates
  add column if not exists access_token text;

create unique index if not exists idx_pecha_token
  on public.pecha_estimates (access_token) where access_token is not null;

-- 기존 데이터에도 열쇠값 채우기(경매를 쓸 수 있게)
update public.pecha_estimates
   set access_token = encode(gen_random_bytes(18), 'hex')
 where access_token is null;

-- 앞으로 새로 들어오는 접수에도 자동 부여
create or replace function public.set_access_token()
returns trigger language plpgsql as $$
begin
  if new.access_token is null then
    new.access_token := encode(gen_random_bytes(18), 'hex');
  end if;
  return new;
end $$;

drop trigger if exists trg_set_access_token on public.pecha_estimates;
create trigger trg_set_access_token
  before insert on public.pecha_estimates
  for each row execute function public.set_access_token();

-- 2) 고객이 자기 경매를 조회 (열쇠값 필요)
--    업체명은 숨기고 'A업체/B업체'로만 표시. 낙찰 후에는 낙찰 업체만 실명 공개.
create or replace function public.my_auction(token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  e public.pecha_estimates;
  result json;
begin
  select * into e from public.pecha_estimates
   where access_token = token
     and created_at > now() - interval '60 days';
  if not found then return null; end if;

  select json_build_object(
    'plate', e.plate,
    'car_model', e.car_model,
    'car_year', e.car_year,
    'auction_status', e.auction_status,
    'ends_at', e.auction_ends_at,
    'awarded_bid_id', e.awarded_bid_id,
    'bids', coalesce((
      select json_agg(x order by x.amount desc) from (
        select b.id, b.amount,
               case when e.awarded_bid_id = b.id then p.company else null end as company,
               case when e.awarded_bid_id = b.id then p.phone   else null end as company_phone,
               (e.awarded_bid_id = b.id) as awarded,
               row_number() over (order by b.amount desc) as rank
          from public.bids b
          join public.partners p on p.id = b.partner_id
         where b.estimate_id = e.id and b.status in ('active','awarded','lost')
      ) x
    ), '[]'::json)
  ) into result;

  return result;
end $$;

-- 3) 고객이 판매할 업체(입찰)를 선택 = 낙찰 확정
create or replace function public.choose_bid(token text, bid uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  e public.pecha_estimates;
  b public.bids;
begin
  select * into e from public.pecha_estimates where access_token = token;
  if not found then return json_build_object('ok', false, 'error', '링크가 올바르지 않아요.'); end if;
  if e.awarded_bid_id is not null then
    return json_build_object('ok', false, 'error', '이미 선택이 완료된 견적이에요.');
  end if;

  select * into b from public.bids where id = bid and estimate_id = e.id and status in ('active','lost');
  if not found then return json_build_object('ok', false, 'error', '선택할 수 없는 입찰이에요.'); end if;

  insert into public.awards (estimate_id, bid_id, partner_id, amount, state)
       values (e.id, b.id, b.partner_id, b.amount, 'awarded')
  on conflict (estimate_id) do nothing;

  update public.bids set status = 'lost'    where estimate_id = e.id and id <> b.id;
  update public.bids set status = 'awarded' where id = b.id;
  update public.pecha_estimates
     set auction_status = 'awarded', awarded_bid_id = b.id
   where id = e.id;

  return json_build_object('ok', true, 'amount', b.amount);
end $$;

-- 4) 비로그인(anon)도 이 두 가지 기능만 쓸 수 있게 허용
grant execute on function public.my_auction(text)        to anon, authenticated;
grant execute on function public.choose_bid(text, uuid)  to anon, authenticated;

-- 끝. 고객 링크: https://www.upcyclecar.co.kr/my?t=<access_token>
