# 퍼스트 폐차 배포 가이드

순서대로 따라 하시면 됩니다. (① Supabase → ② GitHub → ③ Vercel → ④ 번호판 API)

---

## ① Supabase — 폐차 전용 테이블 만들기

기존 철거 프로젝트를 그대로 쓰되, **폐차 전용 새 테이블**만 추가합니다.

1. https://supabase.com 로그인 → 기존 프로젝트(`losdjgpghhsdybxhbnex`) 선택
2. 왼쪽 메뉴 **SQL Editor** 클릭
3. `supabase_pecha.sql` 파일 내용 전체 복사 → 붙여넣기 → **RUN**
4. **Table Editor** 에서 `pecha_estimates` 테이블 생성 확인

> ✅ 이미 `index.html`에 이 프로젝트의 publishable 키가 들어 있어, 테이블만 만들면 바로 저장됩니다.
> ✅ RLS로 익명은 insert만 가능 → 키가 공개돼도 데이터 조회/삭제 불가 (안전).

---

## ② GitHub — 코드 올리기

**방법 A: 웹에서 (가장 쉬움)**
1. https://github.com → 우측 상단 **+** → **New repository**
2. 이름: `first-pecha` → Private 선택 → **Create repository**
3. **uploading an existing file** 클릭 → `firstpecha` 폴더 안의 파일 전부 드래그 업로드
4. **Commit changes**

**방법 B: 명령어로 (터미널)**
```bash
cd "C:/Users/퍼스트/.claude/firstpecha"
git init
git add .
git commit -m "퍼스트 폐차 랜딩페이지 초기 배포"
git branch -M main
git remote add origin https://github.com/<내계정>/first-pecha.git
git push -u origin main
```

---

## ③ Vercel — 배포하기

1. https://vercel.com 로그인 (GitHub 계정으로)
2. **Add New… → Project**
3. 방금 만든 `first-pecha` 저장소 **Import**
4. 프레임워크: **Other** (정적 사이트라 설정 불필요) → **Deploy**
5. 30초 후 `https://first-pecha.vercel.app` 발급 완료 🎉

**도메인 연결(선택)**: Project → Settings → Domains → 내 도메인(`firstpecha.co.kr`) 추가 후 안내대로 DNS 설정.

> 코드 수정 후 GitHub에 push하면 Vercel이 **자동 재배포**됩니다.

---

## ④ 번호판 자동조회 API 연동 (승인 후)

지금은 고객이 차량번호를 입력만 하고, 실제 차량정보는 상담 때 확인하는 구조입니다.
아래 공공 API 승인 후 자동조회로 업그레이드하세요.

### 4-1. API 신청 (무료)
1. https://www.data.go.kr 회원가입/로그인
2. "자동차종합정보" 검색 → **국토교통부 자동차종합정보 API** 활용신청
3. 승인까지 보통 1~2일. (자동차365 이용가이드 참고: car365.go.kr)
4. 입력값: **차량번호 + 소유주명 + 제3자 정보제공 동의** → 우리 폼의 동의 체크가 이 근거가 됩니다.

### 4-2. 연동은 반드시 "서버(Vercel 함수)"에서
API 인증키는 **절대 프론트(index.html)에 넣으면 안 됩니다.** 아래처럼 서버 함수 뒤에 숨깁니다.

`api/vehicle.js` (예시 — Vercel Serverless Function):
```js
export default async function handler(req, res) {
  const { plate, owner } = req.query;
  const KEY = process.env.CAR_API_KEY;   // Vercel 환경변수 (비공개)
  const r = await fetch(`https://공공API주소?serviceKey=${KEY}&plate=${plate}&owner=${owner}`);
  const data = await r.json();
  res.status(200).json(data);            // 필요한 값만 골라서 반환
}
```

- Vercel → Settings → **Environment Variables** 에 `CAR_API_KEY` 추가 (여기서 키 입력)
- `index.html`의 `lookupVehicle()`를 `fetch('/api/vehicle?plate=...&owner=...')`로 교체

---

## ⑤ (선택) Meta 리드광고 연동
철거처럼 Zapier로 연결하려면: Facebook Lead Ads → Webhooks POST →
`https://losdjgpghhsdybxhbnex.supabase.co/rest/v1/pecha_estimates`
헤더에 `apikey`, `Authorization: Bearer <publishable key>` 추가, `source`에 "인스타 광고" 등 표기.

---

## 마무리 체크
- [ ] Supabase 테이블 생성 & 테스트 신청 1건 저장 확인
- [ ] Vercel URL 접속 & 모바일에서 폼 작동 확인
- [ ] 전화번호/사업자정보/카카오채널 링크 실제 값으로 교체 (index.html 하단)
- [ ] 번호판 API 신청 접수
- [ ] (광고 전) 개인정보처리방침 페이지 작성
