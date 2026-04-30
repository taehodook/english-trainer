# 🌳 영어 트레이너 — 동사 50개 마스터

태호님(켈로그) 전용 영어 학습 앱.
**핵심 동사 50개 → 청크 → 상황별 응용** 구조로 설계.

---

## 📋 기능

```
✅ 매일 1동사 마스터 (의미 3개 + 청크 5개)
✅ TTS 음성 + YouTube 검증 채널 큐레이션
✅ 마이크 녹음 + AI 발음 평가 ⭐
✅ 5개 상황 카테고리 (사내/이메일/AML/사교/일상)
✅ AI 역할극 (실시간 영어 대화) ⭐
✅ 자유 영작 + AI 5항목 채점
✅ 한→영 작문 + 3초 챌린지
✅ 망각곡선 복습 (1일/3일/7일)
✅ 약점 패턴 자동 분석
✅ 주간 AI 코치 리포트 ⭐
✅ localStorage 자동 저장
```

---

## 🚀 배포 가이드 (Vercel)

### 1단계. GitHub 저장소 만들기

```bash
# 1. github.com 에서 새 저장소 생성
#    이름: kellogg-english-trainer (또는 원하는 이름)
#    Private 또는 Public

# 2. 로컬에서 Git 초기화
cd english-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

### 2단계. Vercel 연결

```
1. https://vercel.com 접속 → GitHub 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 선택
4. "Deploy" 클릭 (별도 설정 필요 없음)
```

### 3단계. Gemini API 키 설정 (중요!)

```
1. https://aistudio.google.com/apikey 접속
2. "Create API Key" 클릭 → 키 복사

3. Vercel Dashboard → 프로젝트 선택
   → Settings → Environment Variables
   → 추가:
       Key: GEMINI_API_KEY
       Value: (방금 복사한 키)
       Environment: Production, Preview, Development 모두 체크

4. 재배포: Deployments → 최신 배포 → 점 3개 → Redeploy
```

### 4단계. 완료!

```
배포된 URL: https://your-project.vercel.app
→ 매일 같은 URL 접속하면 자동으로 그날 콘텐츠
```

---

## 📁 폴더 구조

```
english-app/
├── public/
│   └── index.html          # 메인 앱
├── data/
│   ├── index.json          # day 메타데이터
│   └── day1.json           # Day 1 (BE 동사)
│   └── day2.json (예정)    # Day 2 (HAVE 동사)
│   └── ...
├── api/
│   ├── grade.js            # 영작 채점
│   ├── roleplay.js         # AI 역할극
│   ├── pronunciation.js    # 발음 평가
│   └── coach.js            # 주간 코치
├── package.json
├── vercel.json
└── README.md
```

---

## 🔄 새 Day 추가하는 법

매주 7일치씩 추가하는 흐름:

```
1. data/dayN.json 파일 추가 (Claude한테 만들어달라고)
2. data/index.json 업데이트:
   {
     "totalDays": 7,        # 사용 가능한 day 수
     "available": [1,2,3,4,5,6,7]
   }
3. git push
4. Vercel 자동 재배포 (30초)
5. 다음 Day 자동 진행!
```

---

## 💰 비용

```
✅ Vercel Hobby: 무료 (월 100GB 트래픽)
✅ Gemini 2.5 Flash-Lite: 무료 (1,000 RPD)
   → 영작 채점, 역할극, 발음 평가, 코치 모두 무료

→ 월 0원
```

---

## 🐛 문제 해결

### "API 키 미설정" 오류
→ Vercel 환경변수 `GEMINI_API_KEY` 확인 + 재배포

### 마이크 안 됨
→ HTTPS 필수 (Vercel은 자동 HTTPS)
→ 브라우저 마이크 권한 허용

### 콘텐츠 로드 실패
→ 브라우저 캐시 삭제 (Ctrl+Shift+R)
→ data/index.json 형식 확인

---

## 📚 학습 철학

**"뿌리·줄기 단단해야 응용력 생긴다"**

```
❌ 표현 100개 외우기 → 응용 안 됨
✅ 동사 50개 깊이 마스터 → 무한 응용

매일 구조:
  ① 동사 (의미 3개)
  ② 청크 5개 ⭐
  ③ 의미별 응용 5문장
  ④ 듣기 빈칸
  ⑤ 한→영 작문
  ⑥ 3초 챌린지
  ⑦ 자유 영작 + AI 채점
  ⑧ 망각곡선 복습
```

---

## 🗓️ 50일 커리큘럼

```
Stage 1 (Day 1-5):   BE, HAVE, DO, GET, MAKE
Stage 2 (Day 6-15):  TAKE, GIVE, GO, COME, SEE, LOOK, FIND, ...
Stage 3 (Day 16-25): THINK, KNOW, MEAN, WANT, NEED, FEEL, ...
Stage 4 (Day 26-35): SAY, TELL, ASK, AGREE, SUGGEST, ...
Stage 5 (Day 36-45): IDENTIFY, VERIFY, FLAG, REPORT, ...
Day 46-50:           종합 응용
```

---

Made with ❤️ for 켈로그
