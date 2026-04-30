// /api/roleplay.js - AI 역할극 (엄격 피드백 + 실시간 미니 교정)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, scenario, aiRole, history, userMessages, verb, chunks } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  let systemPrompt, contents;

  if (mode === 'feedback') {
    // 종합 피드백 모드 - 엄격
    systemPrompt = `당신은 태호님의 **엄격하고 솔직한** 영어 트레이너입니다.
역할극에서 태호님이 한 영어 답변들을 종합 평가하세요.

[학습자] 한국 PG사 AML 전문가, 영어 레벨 2.5/5.0
[오늘의 학습] ${verb || 'BE'} 동사
[핵심 청크] ${(chunks || []).join(', ')}

⚠️ **엄격 평가 원칙**
1. 점수 후하게 주지 말 것 (90점은 진짜 원어민 수준)
2. 한국인 흔한 실수 (관사, 전치사, 시제) 반드시 짚기
3. 청크 사용 안 했으면 chunks 점수 5점 이하
4. 짧은 답변, 단순한 답변은 fluency/engagement 낮게
5. "I am charge of" 같은 명백한 오류 못 본 척 X
6. 솔직한 평가만 (과장된 칭찬 X)

[점수 가이드]
- 90+: 원어민 수준 (드물게)
- 80-89: 매우 잘함, 약간 어색
- 70-79: 의사소통 OK, 명확한 약점
- 60-69: 의미 통함, 어색함 많음
- 50-59: 큰 실수, 의미 부분 전달
- 50 미만: 주요 오류 다수

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
  "chunkUsed": ["실제 사용한 청크들 (정확하게 사용한 것만)"],
  "mainErrors": [
    "❌ 'I am charge of' → ✅ 'I am in charge of' · 'in' 누락",
    "❌ 'I work here 5 years' → ✅ 'I have worked here for 5 years' · 현재완료 + for"
  ],
  "strengths": "진짜 잘한 점 (한국어 1문장, 솔직하게)",
  "improvements": ["가장 큰 약점1", "약점2"],
  "nextStep": "구체적 다음 연습 (한국어 1-2문장)",
  "cheer": "솔직한 응원 (과장 X)"
}

mainErrors는 모든 명백한 실수를 다 잡아야 합니다.`;

    const userPrompt = `[시나리오]\n${scenario}\n\n[태호님 답변들]\n${(userMessages || []).map((m, i) => `${i+1}. ${m}`).join('\n')}\n\n엄격하게 평가해주세요. 한국인 흔한 실수 다 짚어주세요.`;
    contents = [{ role: 'user', parts: [{ text: userPrompt }] }];

  } else {
    // 대화 모드 - AI가 실시간 미니 교정 포함
    systemPrompt = `당신은 영어 학습자(태호, 한국 AML 전문가)와 영어로 자연스러운 대화를 하는 역할입니다.

[당신의 역할] ${aiRole}
[시나리오] ${scenario}
[학습자 오늘의 학습] ${verb || 'BE'} 동사 + 청크: ${(chunks || []).join(', ')}

[규칙]
1. **자연스러운 대화 유지** (캐릭터 깨지 X)
2. 짧고 자연스럽게 답변 (2-3문장)
3. 학습자가 명백한 실수를 했을 때:
   - 자연스럽게 정정한 표현으로 받아쳐 사용 (recasting)
   - 예: 학습자 "I am charge of KYC"
        → AI: "Oh, you're **in** charge of KYC! That's great."
   - 직접적인 "틀렸다"는 말 X, 자연스럽게 정정
4. 학습자가 청크를 잘 썼으면 자연스럽게 같은 청크로 받기
5. 가끔 ${verb} 동사 + 청크를 자연스럽게 사용
6. 학습자 레벨에 맞춰 너무 어렵지 않게
7. 한국어 절대 금지, 100% 영어
8. 자연스럽게 다음 질문 던지기`;

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
            temperature: mode === 'feedback' ? 0.2 : 0.7,
            maxOutputTokens: mode === 'feedback' ? 1500 : 300,
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

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return res.status(500).json({ error: '응답 없음' });

    if (mode === 'feedback') {
      let parsed;
      try { parsed = JSON.parse(responseText); } catch (e) {
        return res.status(500).json({ error: 'JSON 파싱 실패', raw: responseText });
      }
      return res.status(200).json(parsed);
    } else {
      return res.status(200).json({ message: responseText.trim() });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
