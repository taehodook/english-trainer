// 음성 입력을 직접 Gemini에 전달 → 트랜스크립션 + 응답 한 번에
// 클라이언트는 MediaRecorder로 녹음한 오디오를 base64로 보냄
// Gemini가 오디오 듣고 → 시나리오 맥락 이해 → 응답 생성

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'  // 오디오 base64 페이로드 (약 1분 분량까지)
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    audioBase64,      // base64 인코딩된 오디오 데이터
    audioMimeType,    // 'audio/webm' 등
    scenario,         // 시나리오 텍스트
    aiRole,           // AI 역할
    history,          // 대화 기록
    verb,             // 오늘의 동사
    chunks            // 오늘의 청크
  } = req.body;

  if (!audioBase64 || !audioMimeType) {
    return res.status(400).json({ error: '오디오 데이터 누락' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  // 시스템 프롬프트: 트랜스크립션 + 응답을 동시에
  const systemPrompt = `당신은 영어 학습자(한국인)와 역할극 중인 AI입니다.

[당신의 역할] ${aiRole || '대화 상대'}
[시나리오] ${scenario || ''}
[학습자 오늘의 학습] ${verb || 'BE'} 동사 + 청크: ${(chunks || []).join(', ')}

[작업 지침]
사용자가 영어로 말한 오디오를 받았습니다. 다음 두 가지를 한 번에 수행하세요:

1. **트랜스크립션 (transcript)**: 오디오를 영어 텍스트로 변환
   - 한국 억양이라 발음이 부정확할 수 있음
   - **시나리오 맥락을 고려해 의도를 추측**해서 자연스러운 영어 문장으로 변환
   - 예: AML 회의 시나리오에서 "I'm in charge over a meeting" 비슷하게 들리면 "I'm in charge of AML team" 같이 맥락에 맞게 추정
   - 명백한 단어만 그대로, 모호한 부분은 시나리오 맥락에서 가장 자연스러운 추정

2. **응답 (reply)**: 학습자 발화에 대한 자연스러운 응답
   - 캐릭터 유지, 짧고 자연스럽게 (2-3문장, 50단어 이내)
   - 학습자가 명백한 실수를 했으면 자연스럽게 정정한 표현으로 받아쳐 사용 (recasting)
     예: "I am charge of KYC" → "Oh, you're **in** charge of KYC! That's great."
   - 한국어 절대 금지, 100% 영어
   - 응답이 잘리지 않도록 짧고 완결된 문장

3. **간단 피드백 (feedback)**: 학습자 발화에 대한 짧은 한국어 피드백 (40자 이내)
   - 잘했으면: "✅ Good! 'in charge of' 잘 썼어요"
   - 실수가 있으면: "❌ X → ✅ Y" 형식 (한 가지만)

반드시 JSON으로만 응답:
{
  "transcript": "사용자가 말한 영어 (시나리오 맥락 반영해 추정)",
  "reply": "AI 응답 영어",
  "feedback": "한 줄 한국어 피드백"
}`;

  // 대화 기록을 텍스트로 정리해서 프롬프트에 포함
  const historyText = (history || []).map(m =>
    `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content}`
  ).join('\n');

  // contents: 텍스트 컨텍스트 + 오디오
  const userParts = [
    {
      text: `[지금까지 대화]\n${historyText || '(첫 발화)'}\n\n[학습자가 방금 말한 오디오를 분석해서 JSON으로 응답하세요]`
    },
    {
      inlineData: {
        mimeType: audioMimeType,
        data: audioBase64
      }
    }
  ];

  const contents = [{ role: 'user', parts: userParts }];

  try {
    const data = await callGeminiWithRetry(apiKey, systemPrompt, contents);
    if (data.error) {
      const msg = data.error.message || '';
      let userMsg = 'AI 호출 실패';
      if (msg.includes('high demand') || msg.includes('overloaded') || msg.includes('UNAVAILABLE')) {
        userMsg = '⏳ AI 서버가 잠시 바빠요. 잠시 후 다시 시도해주세요.';
      } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        userMsg = '⏳ 일일 사용량 초과. 잠시 후 다시 시도해주세요.';
      } else if (msg.includes('SAFETY')) {
        userMsg = '⚠️ 부적절한 내용이 감지되었어요.';
      } else {
        userMsg = 'AI 호출 실패: ' + msg;
      }
      return res.status(503).json({ error: userMsg, retryable: true });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return res.status(500).json({ error: '응답 없음', retryable: true });

    // JSON 파싱
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      // JSON 파싱 실패 - raw text를 reply로 사용 시도
      return res.status(500).json({
        error: 'AI 응답 형식 오류',
        raw: responseText.slice(0, 200),
        retryable: true
      });
    }

    if (!parsed.transcript || !parsed.reply) {
      return res.status(500).json({ error: '응답 필드 누락', retryable: true });
    }

    return res.status(200).json({
      transcript: parsed.transcript.trim(),
      reply: parsed.reply.trim(),
      feedback: (parsed.feedback || '').trim()
    });

  } catch (err) {
    return res.status(503).json({ error: '서버 오류: ' + err.message, retryable: true });
  }
}

// Gemini 호출 - 재시도 + 모델 fallback
async function callGeminiWithRetry(apiKey, systemPrompt, contents) {
  // 오디오는 2.5 Flash 이상이 좋음 (Lite도 가능하지만 정확도 ↑를 위해)
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const generationConfig = {
    temperature: 0.4,
    maxOutputTokens: 600,
    responseMimeType: 'application/json'
  };
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
    generationConfig
  });

  let lastError = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        const data = await response.json();
        if (!data.error && data.candidates) {
          return data;
        }
        const errMsg = data.error?.message || '';
        const status = data.error?.status || '';
        const retryable =
          errMsg.includes('high demand') ||
          errMsg.includes('overloaded') ||
          status === 'UNAVAILABLE' ||
          status === 'RESOURCE_EXHAUSTED' ||
          status === 'INTERNAL';
        lastError = data;
        if (!retryable) return data;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
        }
      } catch (e) {
        lastError = { error: { message: e.message } };
        await new Promise(r => setTimeout(r, 500));
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return lastError || { error: { message: '모든 모델 호출 실패' } };
}
