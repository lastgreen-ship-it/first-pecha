// 관리자에서 고객에게 문자 발송(솔라피) — 로그인(관리자) 검증 필요
// 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
const crypto = require('crypto');

const SUPA_URL = 'https://iaowzoejbfizeuiwohku.supabase.co';
const ANON = 'sb_publishable_-GbHQLU1fTsKP17qJkVSAw_QOIRySP6';

async function sendSMS(to, text) {
  const key = process.env.SOLAPI_API_KEY, secret = process.env.SOLAPI_API_SECRET, from = process.env.SOLAPI_SENDER;
  if (!key || !secret || !from) throw new Error('SOLAPI 환경변수 미설정');
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', secret).update(date + salt).digest('hex');
  const r = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: { to: String(to).replace(/\D/g, ''), from: String(from).replace(/\D/g, ''), text } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.statusCode && j.statusCode !== '2000')) {
    throw new Error('솔라피 발송 실패: ' + (j.statusMessage || j.errorMessage || r.status));
  }
  return j;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const phone = (b.phone || '').trim();
    const text = (b.text || '').trim();
    const token = (b.token || '').trim();
    if (!phone || !text) { res.status(200).json({ sent: false, error: '수신번호와 내용을 확인해주세요.' }); return; }

    // 관리자 로그인 검증 (Supabase 세션 토큰)
    if (!token) { res.status(401).json({ sent: false, error: '로그인이 필요해요.' }); return; }
    const u = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + token } });
    if (!u.ok) { res.status(401).json({ sent: false, error: '인증이 만료됐어요. 다시 로그인해주세요.' }); return; }
    const user = await u.json().catch(() => ({}));
    if (!user || !user.id) { res.status(401).json({ sent: false, error: '권한이 없어요.' }); return; }

    await sendSMS(phone, text);
    res.status(200).json({ sent: true });
  } catch (e) {
    res.status(200).json({ sent: false, error: e.message });
  }
};
