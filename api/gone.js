// 옛 더조은폐차장 워드프레스 게시판(kboard) 글 주소 → 410 Gone
// 이 게시판에 스팸(유흥업소 광고)글이 대량으로 올라가 구글에 수집돼 있었음.
// 410(영구 삭제)으로 응답해야 검색엔진이 해당 주소들을 빨리 색인에서 지운다.
// vercel.json redirects 에서 /?kboard_content_redirect=… , 게시판 ?uid=… 등을 여기로 보냄.
const HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>삭제된 페이지 | 퍼스트 폐차</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f7fc;font-family:-apple-system,'Malgun Gothic',sans-serif;color:#111c2e;padding:16px;box-sizing:border-box;text-align:center}
h1{font-size:20px;margin:0 0 8px}p{color:#6b7280;font-size:14px;margin:0 0 18px}
a{display:inline-block;background:#111c2e;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:700}</style>
</head><body><div>
<h1>삭제된 페이지입니다</h1>
<p>이 게시글은 더 이상 제공되지 않아요.</p>
<a href="https://www.upcyclecar.co.kr/">퍼스트 폐차 홈으로</a>
</div></body></html>`;

module.exports = (req, res) => {
  res.statusCode = 410;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(HTML);
};
