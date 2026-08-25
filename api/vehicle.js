// CODEF 자동차등록원부(갑) 조회 — 간편인증(비회원) 2단계 처리
// 환경변수: CODEF_CLIENT_ID, CODEF_CLIENT_SECRET (public_key는 이 상품에선 미사용)
// ⚠️ 주민번호는 조회에만 사용하고 저장/로깅하지 않음.

const OAUTH_URL = 'https://oauth.codef.io/oauth/token';
const API_URL   = 'https://development.codef.io/v1/kr/public/mw/car-registration-a/issuance'; // 데모

let _token = null, _tokenExp = 0;

async function getToken() {
  const now = Date.now();
  if (_token && now < _tokenExp) return _token;
  const id = process.env.CODEF_CLIENT_ID, secret = process.env.CODEF_CLIENT_SECRET;
  if (!id || !secret) throw new Error('CODEF 환경변수(CLIENT_ID/SECRET) 미설정');
  const basic = Buffer.from(id + ':' + secret).toString('base64');
  const r = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=read'
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('토큰 발급 실패');
  _token = j.access_token;
  _tokenExp = now + ((j.expires_in ? j.expires_in - 60 : 3600) * 1000);
  return _token;
}

// CODEF 응답은 URL-encoded → 디코드 후 JSON 파싱
async function callCodef(payload) {
  const token = await getToken();
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const raw = await r.text();
  // CODEF 응답은 x-www-form-urlencoded 방식 → '+'는 공백, %XX는 문자
  let text = raw;
  try { text = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch (e) { text = raw.replace(/\+/g, ' '); }
  return JSON.parse(text);
}

// CODEF 원본 오류 메시지 → 고객 친화 문구로 변환
function friendlyMsg(code, msg) {
  msg = msg || '';
  if (code === 'CF-12872' || /미승인|승인.*(안|취소|하지)|취소|cancel/i.test(msg))
    return '간편인증이 완료되지 않았어요. 휴대폰 앱에서 승인한 뒤 [인증 완료]를 다시 눌러주세요.';
  if (/일치|잘못|불일치|없는|해당.*정보|확인.*후|다시.*확인/i.test(msg))
    return '입력하신 정보가 등록원부와 일치하지 않아요.\n이름·주민등록번호·차량번호를 다시 확인해주세요. (본인 명의 차량만 조회 가능)';
  if (/시간|timeout|초과/i.test(msg))
    return '조회 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
  return '조회에 실패했어요. 정보를 다시 확인하시거나 전화(031-868-8700)로 문의해주세요.';
}

module.exports = async (req, res) => {
  // GET: OAuth 연결 테스트 (개인정보 없음)
  if (req.method === 'GET') {
    try {
      const t = await getToken();
      res.status(200).json({ ok: true, token: t ? 'issued' : 'none' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { phase, carNo, ownerName, identity, phoneNo, loginTypeLevel, telecom, twoWayInfo } = body;

    // 공통 입력부
    const base = {
      organization: '0001',
      loginType: '6',                              // 비회원 간편인증
      loginTypeLevel: String(loginTypeLevel || '1'),
      userName: ownerName || '',
      identity: (identity || '').replace(/\D/g, ''), // 주민번호 13자리
      identityEncYn: 'N',
      birthDate: '',
      phoneNo: (phoneNo || '').replace(/\D/g, ''),
      telecom: telecom != null ? String(telecom) : '',
      carNo: (carNo || '').trim(),
      ownerName: ownerName || '',
      displyed: '1',
      isIdentityViewYn: '1',
      originDataYN: '0'
    };

    let result;
    if (phase === 'approve' && twoWayInfo) {
      // 2차 요청 (고객이 앱에서 승인한 뒤)
      const payload = Object.assign({}, base, {
        is2Way: true,
        simpleAuth: '1',
        twoWayInfo: {
          jobIndex: twoWayInfo.jobIndex,
          threadIndex: twoWayInfo.threadIndex,
          jti: twoWayInfo.jti,
          twoWayTimestamp: twoWayInfo.twoWayTimestamp
        }
      });
      result = await callCodef(payload);
    } else {
      // 1차 요청 (간편인증 푸시 발송)
      result = await callCodef(base);
    }

    const code = result && result.result && result.result.code;
    const msg  = result && result.result && result.result.message;
    let data = (result && result.data) || {};
    if (Array.isArray(data)) data = data[0] || {};

    if (code === 'CF-03002' && data.continue2Way) {
      res.status(200).json({
        status: 'need_auth',
        twoWayInfo: { jobIndex: data.jobIndex, threadIndex: data.threadIndex, jti: data.jti, twoWayTimestamp: data.twoWayTimestamp },
        message: msg
      });
      return;
    }
    if (code === 'CF-00000') {
      res.status(200).json({
        status: 'ok',
        vehicle: {
          carName: data.commCarName || '',
          modelType: data.resCarModelType || '',
          yearModel: data.resCarYearModel || '',
          vin: data.resVehicleIdNo || '',
          useType: data.resUseType || ''
        }
      });
      return;
    }
    res.status(200).json({ status: 'error', code, message: friendlyMsg(code, msg), rawMessage: msg });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};
