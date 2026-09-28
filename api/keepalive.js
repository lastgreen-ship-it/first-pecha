// DB 자동 깨우기 — Vercel Cron이 하루 1번 호출 (vercel.json "crons")
// Supabase 무료 플랜은 7일간 요청이 없으면 프로젝트를 일시정지한다.
// 여기서는 문의 테이블을 1건 "읽기만" 한다. 저장·수정·삭제·문자 발송 없음. 데이터 내용은 응답에 담지 않는다.
// 환경변수: SUPABASE_SERVICE_KEY (기존), CRON_SECRET(선택 — 설정하면 Vercel Cron 호출만 허용)
const SUPA_URL = 'https://iaowzoejbfizeuiwohku.supabase.co';
const TABLE = 'pecha_estimates';

// 마감 시간이 지난 'open' 경매를 닫고, 그 경매의 진행중 입찰을 유찰로 바꾼다.
async function closeExpiredAuctions(H) {
  const now = new Date().toISOString();
  const q = `auction_status=eq.open&auction_ends_at=lt.${now}`;
  const up = await fetch(`${SUPA_URL}/rest/v1/${TABLE}?${q}`, {
    method: 'PATCH',
    headers: Object.assign({}, H, { Prefer: 'return=representation' }),
    body: JSON.stringify({ auction_status: 'closed' })
  });
  const rows = await up.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return 0;

  const ids = rows.map(r => r.id);
  await fetch(`${SUPA_URL}/rest/v1/bids?status=eq.active&estimate_id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: Object.assign({}, H, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ status: 'lost' })
  });
  return ids.length;
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' }); return;
  }
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) { res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_KEY 미설정' }); return; }
  try {
    const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    const r = await fetch(`${SUPA_URL}/rest/v1/${TABLE}?select=id&limit=1`, { headers: H });
    await r.text();

    // 마감 시간이 지난 경매 자동 종료 (+ 남은 입찰은 유찰 처리)
    const closed = await closeExpiredAuctions(H);

    res.status(r.ok ? 200 : 502).json({ ok: r.ok, db: r.status, closed, at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
};
