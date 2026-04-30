// /api/roleplay.js - AI 역할극 (Gemini 2.5 Flash-Lite)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, scenario, aiRole, history, userMessages, verb, chunks } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  // 모드: 'chat' (대화 응답) | 'feedback' (종합 피드백)
  let systemPrompt, userPrompt, contents;

  if (mode === 'feedback') {
    // 종합 피드백 모드
    systemPrompt = `당신은 태호님 영어 트레이너입니다.
역할극에서 태호님이 한 영어 답변들을 종합 평가하세요.

[오늘의 학습] ${verb || 'BE'} 동사
[핵심 청크] ${(chunks || []).join(', ')}

반드시 JSON 형식으로만 응답:
{
  "scores": {
    "fluency": 0-20,
    "grammar": 0-20,
    "chunks": 0-20,
    "natural": 0-20,
    "engagement": 0-20
  },
  "total": 총점,
  "chunkUsed": ["사용한 청크들"],
  "strengths": "잘한 점 (한국어 1문장)",
  "improvements": ["개선점1", "개선점2"],
  "nextStep": "다음 단계 추천 (한국어 1문장)",
  "cheer": "응원 (한국어 짧게)"
}`;

    userPrompt = `[시나리오]\n${scenario}\n\n[태호님 답변들]\n${(userMessages || []).map((m, i) => `${i+1}. ${m}`).join('\n')}\n\n종합 평가해주세요.`;

    contents = [{ role: 'user', parts: [{ text: userPrompt }] }];

  } else {
    // 대화 모드 (chat)
    systemPrompt = `당신은 영어 학습자(태호, 한국 AML 전문가)와 영어로 자연스러운 대화를 하는 역할입니다.

[당신의 역할] ${aiRole}
[시나리오] ${scenario}

[규칙]
1. 짧고 자연스럽게 답변 (2-3문장)
2. 학습자의 답변에 자연스럽게 반응
3. 가끔 BE 동사 청크(be supposed to, be in charge of 등)를 자연스럽게 사용
4. 학습자 레벨에 맞춰 너무 어렵지 않게
5. 한국어 절대 금지, 100% 영어
6. 학습자가 짧게 답해도 이어서 대화 진행
7. 자연스럽게 다음 질문 던지기`;

    // history는 [{role: 'user'/'assistant', content: '...'}] 형식
    contents = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    if (contents.length === 0) {
      return res.status(400).json({ error: '대화 기록이 없습니다' });
    }
  }

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
          contents: contents,
          generationConfig: {
            temperature: mode === 'feedback' ? 0.3 : 0.7,
            maxOutputTokens: mode === 'feedback' ? 1000 : 300,
            ...(mode === 'feedback' && { responseMimeType: 'application/json' })
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

    if (mode === 'feedback') {
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) {
        return res.status(500).json({ error: 'JSON 파싱 실패', raw: text });
      }
      return res.status(200).json(parsed);
    } else {
      return res.status(200).json({ message: text.trim() });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
