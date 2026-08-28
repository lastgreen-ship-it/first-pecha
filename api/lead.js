// 간편인증 정확견적 저장 — 무료견적 행이 있으면 갱신, 없으면 신규 (중복 방지)
// 환경변수: SUPABASE_SERVICE_KEY (service_role, 서버리스 전용 · 절대 프론트 노출 금지)
const SUPA_URL = 'https://iaowzoejbfizeuiwohku.supabase.co';
const TABLE = 'pecha_estimates';

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) { res.status(500).json({ error: 'SUPABASE_SERVICE_KEY 미설정' }); return; }
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const fields = {
      car_brand: b.modelType || null,
      car_model: b.carName || null,
      car_year: b.yearModel || null,
      est_low: b.estLow || null,
      est_high: b.estHigh || null,
      source: '간편인증 정확견적'
    };
    const H = { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key };

    // 1) 무료견적 행이 있으면 그 행을 갱신(중복 방지)
    if (b.leadReceipt) {
      const r = await fetch(`${SUPA_URL}/rest/v1/${TABLE}?receipt_no=eq.${encodeURIComponent(b.leadReceipt)}`, {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify(fields)
      });
      const arr = await r.json();
      if (Array.isArray(arr) && arr.length) { res.status(200).json({ status: 'updated', receipt_no: b.leadReceipt }); return; }
      // 못 찾으면 아래 신규 저장으로 진행
    }

    // 2) 신규 저장 (간편인증만 한 경우)
    const newReceipt = 'PC-' + Date.now();
    const ins = Object.assign({
      plate: b.plate || null, region: b.region || null, phone: b.phone || null,
      agree: true, receipt_no: newReceipt, status: 'new'
    }, fields);
    await fetch(`${SUPA_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: Object.assign({}, H, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(ins)
    });
    res.status(200).json({ status: 'inserted', receipt_no: newReceipt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
