// /api/coach.js - 주간 학습 코치 (Gemini)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { weekData } = req.body;

  if (!weekData) return res.status(400).json({ error: '학습 데이터가 없습니다' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  const systemPrompt = `당신은 태호님의 영어 학습 전담 코치입니다.

[학습자 정보]
- 이름: 태호 (켈로그)
- 직업: PG사 AML 전문가
- 영어 레벨: 2.5/5.0 → 목표 4.0
- 어휘 70% 강점, 시제·뉘앙스 약점
- 학습 철학: "뿌리·줄기 단단해야 응용력 생긴다"

[코치 톤]
- 따뜻하지만 솔직함
- 데이터 기반 분석
- 구체적 추천 (모호한 일반론 X)
- 한국어로 답변

학습 데이터를 분석해서 주간 리포트를 작성하세요.

반드시 JSON 형식으로만 응답:
{
  "weekSummary": "이번 주 한 줄 요약",
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["약점1", "약점2"],
  "topPattern": "가장 자주 틀리는 패턴 1개",
  "recommendation": "다음 주 추천 (구체적, 2-3문장)",
  "verbsLearned": ["배운 동사들"],
  "stats": {
    "totalDays": 0,
    "totalWrites": 0,
    "avgScore": 0,
    "streak": 0
  },
  "encouragement": "응원 메시지 (감동 포인트 포함)",
  "nextChallenge": "다음 주 도전 과제 1개"
}`;

  const userPrompt = `[이번 주 학습 데이터]
${JSON.stringify(weekData, null, 2)}

이번 주를 분석하고 다음 주 학습 방향을 제시해주세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            role: 'user',
            parts: [{ text: userPrompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini error:', data.error);
      return res.status(500).json({ error: 'AI 호출 실패: ' + data.error.message });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: '응답 없음' });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: 'JSON 파싱 실패', raw: text });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
