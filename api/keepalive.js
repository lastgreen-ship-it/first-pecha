// DB 자동 깨우기 — Vercel Cron이 하루 1번 호출 (vercel.json "crons")
// Supabase 무료 플랜은 7일간 요청이 없으면 프로젝트를 일시정지한다.
// 여기서는 문의 테이블을 1건 "읽기만" 한다. 저장·수정·삭제·문자 발송 없음. 데이터 내용은 응답에 담지 않는다.
// 환경변수: SUPABASE_SERVICE_KEY (기존), CRON_SECRET(선택 — 설정하면 Vercel Cron 호출만 허용)
const SUPA_URL = 'https://iaowzoejbfizeuiwohku.supabase.co';
const TABLE = 'pecha_estimates';

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' }); return;
  }
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) { res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_KEY 미설정' }); return; }
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${TABLE}?select=id&limit=1`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    await r.text();
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, db: r.status, at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
};
