# 퍼스트 폐차 (First Pecha)

번호판 기반 폐차 비교견적 랜딩페이지. 헤이딜러 폐차 모델을 벤치마킹.

## 구성
- `index.html` — 단일 파일 랜딩페이지 (모바일 최적화)
- `supabase_pecha.sql` — 폐차 전용 테이블 + RLS 보안 설정
- `DEPLOY_GUIDE.md` — GitHub + Vercel + Supabase + 번호판 API 연동 가이드

## 기술 스택
- 정적 HTML/CSS/JS (프레임워크 없음)
- 데이터: Supabase (`pecha_estimates` 테이블, RLS 익명 insert만 허용)
- 호스팅: Vercel
- 번호판 자동조회: 국토교통부 자동차종합정보 API (승인 후 연동 예정)

## 보안 원칙
- 프론트에는 **publishable(anon) 키만** 사용 → RLS로 보호
- service_role 키·API 비밀키는 **절대 프론트/깃허브에 올리지 않음** (Vercel 환경변수 사용)
- 개인정보(연락처·차량번호)는 HTTPS + 수집 동의 체크 후 저장
