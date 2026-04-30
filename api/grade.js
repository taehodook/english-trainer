// /api/grade.js - 영작 채점 (Gemini 2.5 Flash-Lite)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { situation, text, verb, chunks, day } = req.body;

  if (!text) return res.status(400).json({ error: '영작 내용이 없습니다' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  const systemPrompt = `당신은 태호(켈로그)님의 영어 트레이너입니다.
배경: 한국 PG사 AML 전문가, 레벨 2.5/5.0, 어휘 70% 강점, 시제·뉘앙스 약점

[오늘의 학습] Day ${day || 1}: ${verb || 'BE'} 동사
[핵심 청크] ${(chunks || []).join(', ')}

[채점 기준]
- 어휘 (0-20점): 적절한 단어 선택
- 문법 (0-20점): 시제, 관사, 전치사
- 청크 (0-20점): 오늘 배운 청크 활용도 ⭐
- 조립 (0-20점): 문장 구조의 자연스러움
- 자연도 (0-20점): 원어민 느낌

반드시 JSON 형식으로만 응답:
{
  "scores": {
    "vocab": 점수,
    "grammar": 점수,
    "chunk": 점수,
    "structure": 점수,
    "naturalness": 점수
  },
  "total": 총점,
  "corrections": ["❌ 틀린 부분 → ✅ 교정 · 이유 (한국어로 짧게)"],
  "good": "잘한 점 (한국어 1문장)",
  "tip": "다음 단계 팁 (한국어 1문장)",
  "cheer": "응원 메시지 (한국어 짧게)"
}`;

  const userPrompt = `[상황]\n${situation || ''}\n\n[태호님 영작]\n${text}\n\n채점해주세요. 청크 활용도를 특히 신경써주세요.`;

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
            temperature: 0.3,
            maxOutputTokens: 1000,
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
