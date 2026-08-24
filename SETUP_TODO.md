# 퍼스트 폐차 — 실제 오픈 전 설정 체크리스트

> 현재 라이브: https://firstpecha-1.vercel.app (테스트/개발용, 임시 정보 포함)
> 아래 항목을 실제 값으로 채우고 **폴더 재드래그 1회**로 배포하면 정식 오픈 준비 완료.

---

## 1. 실제 정보 교체 (index.html / privacy.html)

| 항목 | 현재(임시) | 위치 |
|---|---|---|
| **전화번호** | `1600-0000` (footer) | footer, privacy.html footer |

> ⚠️ **하단 "📞 전화 문의" 버튼**: 현재는 전화번호가 없어서 **상단 견적폼으로 스크롤(`href="#quote"`)** 되게 해둠. **실제 대표 전화번호가 나오면** index.html의 sticky `<a class="call">` href를 `#quote` → `tel:번호`로 되돌릴 것. (코드에 TODO 주석 있음)
| **사업자등록번호** | `000-00-00000` | index.html footer, privacy.html footer |
| **자동차관리사업등록번호** | `제00-0000-000000호` | index.html footer |
| **대표자명** | `홍길동` | index.html footer, privacy.html footer |
| **사업장 주소** | `(사업장 주소 입력)` | index.html footer, privacy.html footer |
| **개인정보 보호책임자** | `(담당자명/연락처/이메일 입력)` | privacy.html "7. 개인정보 보호책임자" |
| **영업시간** | 평일 10~18시 | index.html footer |

## 2. 카카오톡 채널 연결
- 현재 하단 "💬 카톡 견적" 버튼은 `#quote`(폼)로만 이동
- 카카오톡 채널 개설 후 채널 URL로 교체하면 실제 상담 연결
  - index.html: `<a class="kakao" href="#quote">💬 카톡 견적</a>` → `href`를 카카오채널 주소로

## 3. 프로모션·후기 (선택)
- 프로모션 문구 "🎁 모바일 기프티콘" — 실제 이벤트(상품·조건)로 교체하거나, 이벤트 없으면 삭제
- 후기 4개 — 실제 후기로 교체 시 신뢰도↑ (현재는 예시)

## 4. 배포 (수정 후)
1. https://vercel.com/new
2. "folder" → `C:\Users\퍼스트\.claude\firstpecha` 선택 → 업로드
3. Project Name 입력 → Deploy
   - ⚠️ 현재 Git 자동배포는 GitHub 이메일 인증 문제로 막힘 → 수정 때마다 폴더 재드래그 방식
   - GitHub 인증이 풀리면: Vercel 프로젝트 Settings→Git 연결 시 이후 자동배포 가능

## 5. 광고 돌리기 전 (원하면 도와드림)
- **Meta/구글 광고 픽셀**: 픽셀 ID 확보 후 알려주면 전환 추적 코드 심어드림
- **담당자 알림**: 폼 제출 시 이메일/카톡 알림 원하면 Zapier 연동(철거 방식 재활용)

## 6. Supabase 운영 주의
- 무료 플랜은 **7일 미사용 시 자동 정지**(폼 저장 중단) → 오픈 후 문의 들어오면 유지됨. 장기적으론 Pro($25/월) 고려
- 테스트 데이터 삭제: 대시보드 Table Editor `pecha_estimates` → `PC-TEST-*`, `PC-RESUMECHK*`, `PC-OWNERCHK`, 테스트 홍길동 행

## 7. 도메인 (원할 때)
- `firstpecha.kr` — 후이즈(whois.co.kr)에서 구매 (철거 도메인 산 곳)
- 구매 후 **새 프로젝트(firstpecha-1)** Settings→Domains에 추가 + DNS A레코드 `@ → 216.198.79.1`

---

## 다음 자동화 로드맵 (유료/승인 필요)
- **번호판 자동조회**: 상용 API(기웅정보통신/CODEF 등) 또는 공공 API + 소유자명·동의 + Vercel 서버리스 함수. 헤이딜러도 번호판+소유자명+휴대폰 본인인증 요구(번호판만은 불가).
- **휴대폰 본인인증**(헤이딜러식): PASS/나이스 계약 필요.
