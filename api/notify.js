// 견적 접수 시 고객에게 자동 문자(솔라피) — 중복 발송 방지(sms_sent 플래그)
// 환경변수: SUPABASE_SERVICE_KEY, SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER(발신번호)
const crypto = require('crypto');

const SUPA_URL = 'https://iaowzoejbfizeuiwohku.supabase.co';
const TABLE = 'pecha_estimates';
const SHOP_TEL = '031-868-8700';

// 고객에게 보낼 문자 (차량번호 개인화) — 수정 가능
function buildMsg(plate) {
  const car = plate ? `문의주신 차량(${plate})` : '문의주신 차량';
  return `[퍼스트 폐차] ${car} 견적 감사합니다.
정확한 폐차 견적은 전화가 가장 빨라요.
지금 ☎ ${SHOP_TEL} 로 전화주세요!
정부 관허 폐차장 · 탁송비 무료 · 판매강요 없음`;
}

async function sendSMS(to, text) {
  const key = process.env.SOLAPI_API_KEY, secret = process.env.SOLAPI_API_SECRET, from = process.env.SOLAPI_SENDER;
  if (!key || !secret || !from) throw new Error('SOLAPI 환경변수(KEY/SECRET/SENDER) 미설정');
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
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) { res.status(500).json({ error: 'SUPABASE_SERVICE_KEY 미설정' }); return; }
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const phone = (b.phone || '').trim();
    const receipt = (b.receipt_no || '').trim();
    const plate = (b.plate || '').trim();
    if (!phone) { res.status(200).json({ sent: false, skipped: true, reason: 'no phone' }); return; }

    const H = { 'apikey': svc, 'Authorization': 'Bearer ' + svc, 'Content-Type': 'application/json' };

    // 중복 체크: 이 접수번호 행이 이미 발송됨이면 skip
    if (receipt) {
      const r = await fetch(`${SUPA_URL}/rest/v1/${TABLE}?receipt_no=eq.${encodeURIComponent(receipt)}&select=sms_sent`, { headers: H });
      const rows = await r.json().catch(() => []);
      if (Array.isArray(rows) && rows[0] && rows[0].sms_sent) {
        res.status(200).json({ sent: false, skipped: true, reason: 'already sent' }); return;
      }
    }

    // 발송
    await sendSMS(phone, buildMsg(plate));

    // 발송 표시(중복 방지)
    if (receipt) {
      await fetch(`${SUPA_URL}/rest/v1/${TABLE}?receipt_no=eq.${encodeURIComponent(receipt)}`, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ sms_sent: true })
      });
    }
    res.status(200).json({ sent: true });
  } catch (e) {
    res.status(200).json({ sent: false, error: e.message });
  }
};
