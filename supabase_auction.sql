-- =====================================================
-- 퍼스트 폐차 — 폐차장 입찰(역경매) 시스템 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- 기존 pecha_estimates 는 컬럼만 추가하고 데이터는 건드리지 않습니다.
-- =====================================================

-- 0) 기존 문의 테이블에 경매 관련 컬럼 추가 (있으면 건너뜀)
alter table public.pecha_estimates
  add column if not exists auction_status  text,          -- null=경매안함 / open / awarded / closed
  add column if not exists auction_open_at timestamptz,   -- 경매 시작
  add column if not exists auction_ends_at timestamptz,   -- 입찰 마감
  add column if not exists min_bid         bigint,        -- 최소 입찰가(원) · 선택
  add column if not exists awarded_bid_id  uuid,          -- 낙찰된 입찰
  add column if not exists car_condition_json jsonb;      -- 상태 체크(운행/사고/침수/촉매 등)

-- 1) 폐차장(파트너) --------------------------------------------------
create table if not exists public.partners (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  company      text not null,          -- 상호
  biz_no       text,                   -- 사업자등록번호
  license_no   text,                   -- 자동차관리사업(해체재활용) 등록번호
  ceo          text,                   -- 대표자
  phone        text,                   -- 대표 연락처
  email        text,                   -- 로그인 계정 이메일
  address      text,
  regions      text[],                 -- 활동 지역 (예: {'경기','서울'})
  status       text not null default 'pending',  -- pending / approved / suspended
  memo         text,                   -- 관리자 메모(승인/정지 사유)
  approved_at  timestamptz
);
create index if not exists idx_partners_status on public.partners (status);

-- 파트너 직원 계정 ↔ Supabase Auth 사용자 연결
create table if not exists public.partner_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  role       text not null default 'staff',   -- owner / staff
  created_at timestamptz not null default now()
);
create index if not exists idx_partner_users_partner on public.partner_users (partner_id);

-- 2) 입찰 -------------------------------------------------------------
create table if not exists public.bids (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estimate_id uuid not null references public.pecha_estimates(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount     bigint not null,          -- 입찰 매입가(원)
  note       text,                     -- 업체 메모(조건 등)
  status     text not null default 'active',  -- active / withdrawn / awarded / lost
  unique (estimate_id, partner_id)     -- 한 경매에 업체당 1건(수정은 update)
);
create index if not exists idx_bids_estimate on public.bids (estimate_id, amount desc);
create index if not exists idx_bids_partner on public.bids (partner_id, created_at desc);

-- 3) 낙찰 -------------------------------------------------------------
create table if not exists public.awards (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  estimate_id uuid not null references public.pecha_estimates(id) on delete cascade,
  bid_id      uuid not null references public.bids(id) on delete cascade,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  amount      bigint not null,         -- 낙찰 금액
  final_amount bigint,                 -- 실제 지급액(완료 후 기록)
  pickup_at   date,                    -- 인수 예정일
  state       text not null default 'awarded', -- awarded / picked / done / canceled
  memo        text,
  unique (estimate_id)                 -- 경매당 낙찰 1건
);

-- 4) 정산 -------------------------------------------------------------
create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  award_id    uuid references public.awards(id) on delete set null,
  fee         bigint not null default 0,   -- 수수료(원)
  period      text,                        -- 정산 월 (YYYY-MM)
  paid        boolean not null default false,
  memo        text
);
create index if not exists idx_settlements_partner on public.settlements (partner_id, period);

-- 5) 보안(RLS) ---------------------------------------------------------
alter table public.partners       enable row level security;
alter table public.partner_users  enable row level security;
alter table public.bids           enable row level security;
alter table public.awards         enable row level security;
alter table public.settlements    enable row level security;

-- 내 파트너 id 구하기
create or replace function public.my_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select partner_id from public.partner_users where user_id = auth.uid()
$$;

-- 승인된 파트너인지
create or replace function public.is_approved_partner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.partner_users pu
    join public.partners p on p.id = pu.partner_id
    where pu.user_id = auth.uid() and p.status = 'approved'
  )
$$;

-- 관리자(퍼스트 폐차 운영자) 판별 — 파트너로 등록되지 않은 로그인 사용자
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (select 1 from public.partner_users where user_id = auth.uid())
$$;

-- partners: 가입신청은 누구나(anon) / 본인 업체만 조회 / 관리자는 전체
drop policy if exists "partner signup" on public.partners;
create policy "partner signup" on public.partners
  for insert to anon, authenticated with check (status = 'pending');

drop policy if exists "partner read own" on public.partners;
create policy "partner read own" on public.partners
  for select to authenticated using (id = public.my_partner_id() or public.is_admin());

drop policy if exists "admin manage partners" on public.partners;
create policy "admin manage partners" on public.partners
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete partners" on public.partners;
create policy "admin delete partners" on public.partners
  for delete to authenticated using (public.is_admin());

-- partner_users: 본인 행만 조회, 관리자 전체
drop policy if exists "pu read own" on public.partner_users;
create policy "pu read own" on public.partner_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "pu admin write" on public.partner_users;
create policy "pu admin write" on public.partner_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bids: 승인 파트너는 본인 입찰만 쓰기/보기, 관리자는 전체 보기
drop policy if exists "bid insert own" on public.bids;
create policy "bid insert own" on public.bids
  for insert to authenticated
  with check (public.is_approved_partner() and partner_id = public.my_partner_id());

drop policy if exists "bid update own" on public.bids;
create policy "bid update own" on public.bids
  for update to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id());

-- 운영자는 낙찰/유찰 처리를 위해 입찰 상태를 바꿀 수 있어야 한다
drop policy if exists "bid admin update" on public.bids;
create policy "bid admin update" on public.bids
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "bid read own or admin" on public.bids;
create policy "bid read own or admin" on public.bids
  for select to authenticated
  using (partner_id = public.my_partner_id() or public.is_admin());

-- awards: 낙찰 업체 본인 + 관리자
drop policy if exists "award read" on public.awards;
create policy "award read" on public.awards
  for select to authenticated
  using (partner_id = public.my_partner_id() or public.is_admin());

drop policy if exists "award admin write" on public.awards;
create policy "award admin write" on public.awards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "award partner update" on public.awards;
create policy "award partner update" on public.awards
  for update to authenticated
  using (partner_id = public.my_partner_id())
  with check (partner_id = public.my_partner_id());

-- settlements: 본인 + 관리자
drop policy if exists "settle read" on public.settlements;
create policy "settle read" on public.settlements
  for select to authenticated
  using (partner_id = public.my_partner_id() or public.is_admin());

drop policy if exists "settle admin write" on public.settlements;
create policy "settle admin write" on public.settlements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 6) ⚠️ 기존 문의 테이블 읽기 권한을 "관리자만"으로 좁히기 -----------------
--    기존 "auth read" 정책은 로그인한 사용자 전체를 허용 → 파트너도 고객 연락처를
--    볼 수 있게 되므로, 관리자(파트너로 등록되지 않은 계정)만 읽도록 교체한다.
drop policy if exists "auth read" on public.pecha_estimates;
drop policy if exists "admin read leads" on public.pecha_estimates;
create policy "admin read leads" on public.pecha_estimates
  for select to authenticated using (public.is_admin());

drop policy if exists "auth update" on public.pecha_estimates;
drop policy if exists "admin update leads" on public.pecha_estimates;
create policy "admin update leads" on public.pecha_estimates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "auth insert" on public.pecha_estimates;
drop policy if exists "admin insert leads" on public.pecha_estimates;
create policy "admin insert leads" on public.pecha_estimates
  for insert to authenticated with check (public.is_admin());

-- 7) 파트너가 볼 수 있는 "경매 목록" 뷰 ---------------------------------
--    ⚠️ 연락처·차량번호 전체는 제외(마스킹). security definer 뷰라 파트너는
--    원본 테이블을 직접 읽지 못하고, 이 뷰의 가려진 정보만 볼 수 있다.
create or replace view public.auction_board as
select
  e.id,
  e.created_at,
  e.auction_ends_at,
  e.auction_status,
  e.region,
  left(coalesce(e.plate,''), 2) || '**'      as plate_masked,
  e.car_model,
  e.car_year,
  e.car_condition_json,
  e.min_bid,
  (select count(*) from public.bids b where b.estimate_id = e.id and b.status = 'active') as bid_count,
  (select max(b.amount) from public.bids b where b.estimate_id = e.id and b.status = 'active') as top_amount
from public.pecha_estimates e
where e.auction_status = 'open';

grant select on public.auction_board to authenticated;

-- 8) 낙찰 업체만 고객 연락처를 보는 뷰 ------------------------------------
create or replace view public.my_awarded_leads as
select
  a.id            as award_id,
  a.estimate_id,
  a.amount,
  a.final_amount,
  a.pickup_at,
  a.state,
  e.plate,
  e.phone,                -- 낙찰 업체에만 공개
  e.region,
  e.car_model,
  e.car_year,
  e.car_condition_json,
  a.created_at
from public.awards a
join public.pecha_estimates e on e.id = a.estimate_id
where a.partner_id = public.my_partner_id() or public.is_admin();

grant select on public.my_awarded_leads to authenticated;

-- 끝. 실행 후 관리자 화면에서 파트너 승인 → 파트너 포털에서 입찰이 가능합니다.
