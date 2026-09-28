// 폐차장(파트너) 승인 — 업체 승인 + 로그인 계정 연결(partner_users)을 한 번에 처리
// 관리자 로그인 토큰 검증 필수. 환경변수: SUPABASE_SERVICE_KEY
const SUPA_URL = 'https://iaowzoejbfizeuiwohku.supabase.co';
const ANON = 'sb_publishable_-GbHQLU1fTsKP17qJkVSAw_QOIRySP6';

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) { res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_KEY 미설정' }); return; }

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const partnerId = (b.partner_id || '').trim();
    const status = (b.status || '').trim();          // approved / suspended
    const token = (b.token || '').trim();
    if (!partnerId || !['approved', 'suspended'].includes(status)) {
      res.status(400).json({ ok: false, error: '잘못된 요청' }); return;
    }

    // 1) 관리자 로그인 검증
    if (!token) { res.status(401).json({ ok: false, error: '로그인이 필요해요.' }); return; }
    const u = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: 'Bearer ' + token } });
    if (!u.ok) { res.status(401).json({ ok: false, error: '로그인이 만료되었어요.' }); return; }
    const me = await u.json();

    const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };

    // 관리자인지 확인 (파트너 계정이면 거부)
    const pu = await fetch(`${SUPA_URL}/rest/v1/partner_users?user_id=eq.${me.id}&select=user_id`, { headers: H });
    const puRows = await pu.json().catch(() => []);
    if (Array.isArray(puRows) && puRows.length) { res.status(403).json({ ok: false, error: '운영자만 사용할 수 있어요.' }); return; }

    // 2) 업체 상태 변경
    const patch = { status };
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    const up = await fetch(`${SUPA_URL}/rest/v1/partners?id=eq.${partnerId}`, {
      method: 'PATCH', headers: Object.assign({}, H, { Prefer: 'return=representation' }), body: JSON.stringify(patch)
    });
    const rows = await up.json().catch(() => []);
    if (!up.ok || !rows.length) { res.status(500).json({ ok: false, error: '업체 상태 변경 실패' }); return; }
    const partner = rows[0];

    // 3) 승인이면 로그인 계정을 업체에 연결 (이메일로 auth 사용자 조회)
    let linked = false, note = '';
    if (status === 'approved' && partner.email) {
      const au = await fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=200`, { headers: { apikey: svc, Authorization: 'Bearer ' + svc } });
      const aj = await au.json().catch(() => ({}));
      const users = aj.users || aj || [];
      const found = Array.isArray(users) ? users.find(x => (x.email || '').toLowerCase() === partner.email.toLowerCase()) : null;
      if (found) {
        const ins = await fetch(`${SUPA_URL}/rest/v1/partner_users`, {
          method: 'POST',
          headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({ user_id: found.id, partner_id: partnerId, role: 'owner' })
        });
        linked = ins.ok;
        if (!ins.ok) note = '계정 연결 실패 — 수동 연결이 필요해요.';
      } else {
        note = '해당 이메일로 가입된 로그인 계정이 없어요. 업체가 가입 화면에서 계정을 먼저 만들어야 합니다.';
      }
    }

    res.status(200).json({ ok: true, status, linked, note });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
