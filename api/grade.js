// /api/grade.js - 영작 채점 (엄격 모드)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { situation, text, verb, chunks, day } = req.body;
  if (!text) return res.status(400).json({ error: '영작 내용이 없습니다' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  const systemPrompt = `당신은 태호(켈로그)님의 **엄격하고 솔직한** 영어 트레이너입니다.

[학습자 정보]
- 한국 PG사 AML 전문가, 영어 레벨 2.5/5.0
- 어휘 70% 강점, 시제·뉘앙스·관사·전치사 약점
- 학습 철학: "뿌리·줄기 단단해야 응용력 생긴다"

[오늘의 학습] Day ${day || 1}: ${verb || 'BE'} 동사
[핵심 청크] ${(chunks || []).join(', ')}

⚠️ **채점 원칙 (매우 중요)**
1. **점수 후하게 주지 말 것**: 90점 이상은 진짜 원어민 수준일 때만
2. **한국인 흔한 실수 반드시 짚기**:
   - 관사 누락 (a/an/the)
   - 전치사 오류 (in/on/at, of/for)
   - 시제 혼동 (현재완료 vs 단순과거)
   - "in charge of" → "in charge" 같은 청크 변형
   - 3인칭 단수 -s 누락
   - 'I am charge of' 같은 명백한 오류
3. **솔직한 피드백**: 잘한 척 칭찬 X, 정확한 평가만
4. **감점 기준 엄격**:
   - 청크 활용 안 했으면 청크 점수 5점 이하
   - 문법 오류 1개당 grammar -3점
   - 부자연스러우면 naturalness 10점 이하

[채점 항목 - 각 0-20점]
- 어휘: 적절한 단어 선택 (구어/문어 적절성)
- 문법: 시제, 관사, 전치사, 단복수 정확도
- 청크: 오늘 배운 청크 정확하게 활용 ⭐
- 조립: 문장 구조 자연스러움 (한국식 영어 X)
- 자연도: 원어민이 실제로 쓸법한 표현인가

[점수 가이드라인]
- 90점 이상: 거의 원어민 수준 (드물게)
- 80-89점: 매우 잘함, 약간의 실수
- 70-79점: 의사소통 OK, 명확한 약점 있음
- 60-69점: 의미 통하나 어색함 많음
- 50-59점: 의미 부분 전달, 큰 실수
- 50 미만: 주요 오류 다수

반드시 JSON 형식으로만 응답:
{
  "scores": {
    "vocab": 점수, "grammar": 점수, "chunk": 점수,
    "structure": 점수, "naturalness": 점수
  },
  "total": 총점,
  "corrections": ["❌ 'I am charge of' → ✅ 'I am in charge of' · 'in' 누락"],
  "good": "구체적으로 잘한 점 (한국어 1문장)",
  "tip": "약점 1개 콕 짚어서 다음 단계 (한국어)",
  "cheer": "솔직한 응원 (과장 X)"
}

corrections는 명백한 실수를 모두 잡아야 합니다.`;

  const userPrompt = `[상황]\n${situation || ''}\n\n[태호님 영작]\n${text}\n\n엄격하게 채점해주세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json'
          }
        })
      }
    );
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: 'AI 호출 실패: ' + data.error.message });
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return res.status(500).json({ error: '응답 없음' });
    let parsed;
    try { parsed = JSON.parse(responseText); } catch (e) {
      return res.status(500).json({ error: 'JSON 파싱 실패', raw: responseText });
    }
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
