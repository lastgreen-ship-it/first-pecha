-- =====================================================
-- 퍼스트 폐차 전용 테이블 (기존 Supabase 프로젝트에 추가)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN 하세요.
-- =====================================================

-- 1) 폐차 견적 신청 테이블
create table if not exists public.pecha_estimates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  plate       text,            -- 차량번호
  region      text,            -- 판매지역
  phone       text,            -- 연락처
  car_model   text,            -- 차종(향후 API/수동)
  car_year    text,            -- 연식
  mileage     text,            -- 주행거리
  agree       boolean default false,  -- 개인정보 동의
  receipt_no  text,            -- 접수번호 (PC- 자체폼)
  source      text,            -- 유입경로
  status      text default 'new'      -- 처리상태 (new/contacted/done)
);

-- 2) RLS(행 수준 보안) 켜기
alter table public.pecha_estimates enable row level security;

-- 3) 익명(anon) 사용자는 INSERT만 허용, 조회/수정/삭제 차단
--    → 공개 키가 노출돼도 남의 데이터를 읽거나 지울 수 없음
drop policy if exists "anon insert only" on public.pecha_estimates;
create policy "anon insert only"
  on public.pecha_estimates
  for insert
  to anon
  with check (true);

-- (SELECT/UPDATE/DELETE 정책은 만들지 않음 = 익명 차단)
-- 데이터 확인/관리는 Supabase 대시보드 또는 service_role 키로만.

-- 4) 조회 성능용 인덱스
create index if not exists idx_pecha_created on public.pecha_estimates (created_at desc);
