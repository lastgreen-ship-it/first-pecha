// Vercel 서버리스 함수 배포 테스트용 (CODEF 연동 전 배포방식 확인)
module.exports = (req, res) => {
  res.status(200).json({ ok: true, msg: 'pong', ts: Date.now() });
};
