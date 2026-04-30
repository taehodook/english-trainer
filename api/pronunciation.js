// /api/pronunciation.js - 발음 평가 (Gemini Audio)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // 음성 파일 크기 제한
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audioBase64, originalText, verb } = req.body;

  if (!audioBase64) return res.status(400).json({ error: '음성 파일이 없습니다' });
  if (!originalText) return res.status(400).json({ error: '원문이 없습니다' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  const systemPrompt = `당신은 영어 발음 평가 전문가입니다.

[학습자] 태호 (한국인, 영어 레벨 2.5/5.0)
[오늘 학습] ${verb || 'BE'} 동사
[원문] ${originalText}

학습자가 녹음한 음성을 듣고 발음을 평가하세요.

[평가 항목]
- 정확도 (0-100): 원문대로 발음했는지
- 강세 (0-100): 단어 강세 위치
- 연음 (0-100): 자연스러운 연결
- 억양 (0-100): 문장 끝 억양

반드시 JSON 형식으로만 응답:
{
  "overall": 종합 점수 (0-100),
  "scores": {
    "accuracy": 0-100,
    "stress": 0-100,
    "linking": 0-100,
    "intonation": 0-100
  },
  "wordScores": [
    {"word": "단어", "score": 0-100, "tip": "한국어 짧게"}
  ],
  "transcription": "AI가 들은 내용",
  "strengths": "잘한 점 (한국어 1문장)",
  "improvements": ["개선점1", "개선점2"],
  "tip": "다음 연습 팁 (한국어 1문장)"
}`;

  // base64에서 mime type 분리
  const matches = audioBase64.match(/^data:(audio\/[^;]+);base64,(.+)$/);
  let mimeType, base64Data;

  if (matches) {
    mimeType = matches[1];
    base64Data = matches[2];
  } else {
    mimeType = 'audio/wav';
    base64Data = audioBase64;
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
          contents: [{
            role: 'user',
            parts: [
              { text: `다음 음성을 평가해주세요. 원문: "${originalText}"` },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini Audio error:', data.error);
      return res.status(500).json({ error: 'AI 호출 실패: ' + data.error.message });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return res.status(500).json({ error: '응답 없음' });

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: 'JSON 파싱 실패', raw: responseText });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
