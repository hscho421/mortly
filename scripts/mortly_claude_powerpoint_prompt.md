아래 프롬프트를 `Claude for PowerPoint`에 그대로 붙여 넣어 사용해. 필요한 경우 맨 위의 괄호형 변수만 바꿔서 써라.

---

너는 최고 수준의 사업제안서 프레젠테이션 디렉터이자 스토리텔러다.  
`mortly`를 위한 한국어 중심의 `business proposal PowerPoint`를 만들어라.

기본 전제:
- 발표 목적: `[투자자 미팅 / 전략적 제휴 / 액셀러레이터 지원 / 데모데이 중 택1 또는 직접 입력]`
- 발표 대상: `[초기 투자자, mortgage ecosystem 파트너, 모기지 전문가 네트워크, 한인 커뮤니티 파트너 등 구체적으로 입력]`
- 발표 길이: `12~15분`
- 문서 언어: `한국어 중심`, 단 제품명/기술명/짧은 태그라인은 영어 병기 가능
- 문서 형식: `16:9 PowerPoint`
- 결과물: 실제 발표 가능한 슬라이드 덱

중요:
- 이 프레젠테이션은 현재 `mortly` 코드베이스를 읽고 정리한 사실을 기반으로 해야 한다.
- 없는 기능을 있는 것처럼 쓰지 마라.
- 실측 데이터가 없는 숫자는 지어내지 마라.
- 외부 시장 수치, TAM/SAM/SOM, 실제 매출, 실제 활성 사용자 수, 실제 제휴사, 실제 전환율은 내가 별도로 주지 않았다. 따라서 이런 숫자가 필요하면 반드시 `[placeholder]` 또는 `assumption`으로 명시하라.
- `mortly`는 `대출기관`, `금융자문사`, `모기지 전문가`가 아니다. 플랫폼/마켓플레이스다.

용어 규칙:
- 발표자료 전체에서 사용자 역할은 반드시 `모기지 신청자 / 모기지 전문가 / 관리자`로만 표기해라.
- 역할명을 줄이거나 다른 표현으로 바꾸지 마라.
- 내부 코드 enum 명칭도 슬라이드, 발표 노트, 표, 다이어그램에 노출하지 마라.
- 영어 역할 표기가 꼭 필요하면 `Mortgage Applicant / Mortgage Professional / Administrator`만 사용해라.


## 1. mortly의 사실 기반 제품 정의

`mortly`는 캐나다 시장을 대상으로 하는 `privacy-first`, `bilingual (KO/EN)` 모기지 마켓플레이스다.

핵심 한 줄:
- `모기지 전문가가 먼저 제안하고, 모기지 신청자가 비교해서 선택하는 새로운 모기지 방식`
- 영어 태그라인 후보: `Mortgage Professionals compete. You choose.`

플랫폼 정체성:
- 캐나다 모기지 신청자와 검증된 모기지 전문가를 연결하는 양면 마켓플레이스
- 모기지 신청자는 무료로 사용
- 모기지 전문가는 월 구독제로 사용
- 플랫폼 안에서 비교, 메시징, 운영관리, 검증, 결제가 이루어짐
- 직접 연락처는 기본 요청 열람 및 기본 메시징 과정에서 자동 공개되지 않음

시장 포지셔닝:
- 캐나다 시장용
- 한국어/영어 이중언어 지원
- 한국어 지원은 강한 초기 wedge가 될 수 있으나, 전체 포지셔닝은 `Canadian bilingual mortgage marketplace`


## 2. 현재 코드베이스 기준 실제 구현 기능

다음은 현재 구현된 것으로 간주해도 되는 내용이다.

### 사용자 및 인증
- 이메일/비밀번호 회원가입
- 이메일 인증 6자리 코드 발송
- 비밀번호 재설정
- Google 로그인
- Google 로그인 후 역할 선택 플로우
- 시스템상 사용자 유형은 3가지뿐이다: `모기지 신청자`, `모기지 전문가`, `관리자`

### 모기지 신청자 플로우
- 모기지 신청자는 회원가입 후 대시보드에서 새 요청 생성 가능
- 요청은 `RESIDENTIAL` 또는 `COMMERCIAL`
- 요청 작성은 구조화된 멀티스텝 폼
- 주거용/상업용 요청 필드가 다름
- 요청은 관리자 승인 전 `PENDING_APPROVAL`
- 승인되면 모기지 전문가에게 `OPEN` 상태로 공개
- 요청별로 모기지 전문가 응답 수와 대화 수 확인 가능
- 요청 수정/삭제 가능 상태가 존재
- 모기지 전문가와 플랫폼 내 메시징 가능
- 모기지 신청자가 대화를 종료 가능

### Residential 요청 특징
- 상품 유형 선택
- 목적 선택
- 소득 유형 선택
- 연도별 소득 입력
- 지역/도시/타임라인/메모 입력

### Commercial 요청 특징
- 상품 유형 선택
- 비즈니스 유형
- 법인 연매출/연지출
- 소유주 순이익
- 지역/도시/타임라인/메모 입력

### 모기지 전문가 플로우
- 모기지 전문가 회원가입 후 별도 온보딩 프로필 작성
- 중개업체명, 주, 라이선스 번호, 전화번호, 소개, 경력, 서비스 지역, 전문분야 입력
- 관리자 검증 전에는 `PENDING`
- `VERIFIED` 된 모기지 전문가만 요청 열람 가능
- 모기지 전문가는 공개된 요청 목록을 필터링해 탐색 가능
- 요청 상세 확인 후 대화 시작 가능
- 대화 시작 시 구독 티어에 따라 크레딧 사용

### 모기지 전문가 구독/과금
- Stripe 기반 월 구독
- 플랜:
  - `FREE`: $0
  - `BASIC`: $29/월 (UI 상 원가 $49, 할인 표기 존재)
  - `PRO`: $69/월 (원가 $99)
  - `PREMIUM`: $129/월 (원가 $199)
- FREE 모기지 전문가는 요청 열람은 가능하지만 실제 고객 메시징은 불가
- BASIC은 월 5 response credits
- PRO는 월 20 response credits
- PREMIUM은 무제한
- 업그레이드는 즉시 적용 가능
- 다운그레이드는 다음 결제 주기로 예약
- Stripe customer portal, invoice history 지원

### 메시징
- 모기지 신청자와 모기지 전문가 간 플랫폼 내 메시징
- Supabase realtime 기반 실시간 업데이트
- unread count 표시
- 모기지 전문가가 먼저 너무 많은 메시지를 보내지 못하도록 제한 존재
  - 모기지 신청자가 응답하기 전 모기지 전문가 초기 메시지 제한값이 시스템 설정으로 존재
  - 기본값은 3

### Trust / Safety / Ops
- 모기지 전문가 검증 상태: `PENDING`, `VERIFIED`, `REJECTED`
- 사용자 상태: `ACTIVE`, `SUSPENDED`, `BANNED`
- 요청 신고, 모기지 전문가 신고, 대화 신고
- 관리자 공지(notices) 전송 가능
- 관리자 행동 로그(audit trail) 저장
- 관리자 대시보드에서 전체 현황 모니터링 가능
- 관리자 요청 승인/거절 가능
- 관리자 모기지 전문가 검증/반려 가능
- 관리자 크레딧 수동 조정 가능
- 관리자 시스템 설정 변경 가능
- 유지보수 모드 존재

### 자동화 / 운영 정책
- 요청 자동 만료 cron 존재
- 비활성 대화 자동 종료 cron 존재
- 요청 만료일, 유지보수 모드, 크레딧 값, 초기 메시지 제한 등은 시스템 설정으로 관리

### 기술 스택
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth
- Stripe
- Supabase Realtime
- Resend
- PostHog
- Vercel Analytics
- next-i18next

### 사이트/브랜드 성격
- 기본 locale은 한국어
- 영어 locale 지원
- SEO/OG/meta/canonical/hreflang 세팅 존재
- PWA manifest 존재
- Service worker 등록
- 도메인 기준은 `mortly.ca`


## 3. 절대 과장하면 안 되는 항목

다음은 현재 코드 기준으로 `이미 구현된 기능`처럼 말하면 안 된다.  
원하면 `로드맵`, `planned`, `future`, `next milestone`로만 표현해라.

- 실제 리뷰/평점 시스템
- 별점 기반 모기지 전문가 랭킹
- 문서 업로드 기능
- 연간 결제
- credit pack 구매 플로우
- 푸시 알림
- lender/bank 직접 연동
- 자동 매칭 AI 엔진
- 모기지 전문가 featured placement 알고리즘이 실제 운영 중이라는 주장
- 고객 실명 공개 이전에 정교한 identity exchange workflow가 이미 제품화됐다는 주장
- 실사용자 수, 매출, 거래량, CAC, LTV, 전환율, retention 숫자
- “캐나다 최초” 같은 표현은 법적/시장 검증이 없으므로 매우 조심해서 쓰거나 피하라

또한 다음도 주의:
- 과거 초안 문서에는 `reviews`, `credit packs`, `평점`, `문서 업로드`, `고급 analytics`, `push` 등이 섞여 있었지만 현재 코드의 단일 truth는 아니다.
- 따라서 deck은 반드시 `현재 구현`과 `계획 로드맵`을 분리해서 보여줘라.


## 4. 이 사업제안서가 전달해야 하는 핵심 메시지

이 deck은 다음 서사를 분명하게 전달해야 한다.

1. 캐나다 모기지 탐색 경험은 여전히 비효율적이고 불투명하다.
2. 기존 흐름은 모기지 신청자가 먼저 정보를 내고 모기지 전문가를 찾아야 한다.
3. `mortly`는 그 구조를 뒤집는다.
4. 모기지 신청자는 익명에 가까운 상태로 요청을 올리고, 검증된 모기지 전문가들이 먼저 경쟁적으로 응답한다.
5. 모기지 신청자는 플랫폼 안에서 비교하고 대화한 뒤, 원할 때만 더 많은 정보를 공유할 수 있다.
6. 모기지 전문가 입장에서는 광고/콜드리드 대신 의도 기반 inbound demand를 받는 구조다.
7. 이 플랫폼은 단순 랜딩페이지가 아니라 검증, 운영, 대화, 결제, 정책 자동화까지 갖춘 실제 marketplace operating system이다.
8. 초기 wedge는 `Canada + Korean/English bilingual + privacy-first trust layer`다.
9. 장기적으로는 broader mortgage lead infrastructure / marketplace / vertical SaaS로 확장 가능한 구조다.


## 5. 디자인 및 브랜드 가이드

슬라이드 디자인은 현재 웹 제품의 시각 언어를 강하게 반영해라.

### 전체 무드
- premium
- calm
- trustworthy
- private-banking 느낌이 살짝 있지만 너무 old-school financial institution 같지는 않게
- 세련된 SaaS + regulated marketplace 분위기
- flashy startup deck 금지
- neon, 과한 gradient, crypto풍 금지

### 컬러 팔레트
- Deep forest/navy primary: `#0F1729`
- Secondary deep blue: `#1F2D52`
- Supporting dark blue: `#2E3D68`
- Warm cream background: `#F8F7F4`
- Soft border cream: `#E5E2DC`
- Gold/amber accent: `#D4A853`
- Lighter gold accent: `#E6C96E`
- Deep gold accent: `#A8812E`
- Muted sage/supporting text: `#576285`
- Wordmark dark neutral reference: `#2D3136`

### 색 사용 원칙
- 표지/섹션 전환 슬라이드: deep forest/navy 배경 + gold accent
- 본문/설명 슬라이드: cream/light background + dark text
- 강조선, badge, small highlight는 gold
- 숫자 강조나 KPI는 gold 또는 dark forest
- 위험/주의는 muted rose나 amber 계열로만 제한적으로

### 타이포그래피
- 한국어: `Pretendard` 느낌
- 영어: `Outfit` 계열 geometric sans
- 제목은 semibold, 타이트한 tracking
- 본문은 절제된 줄간격
- 과도한 굵기 남발 금지

### 컴포지션
- 라운드 카드, pill badge, thin divider line 활용
- 넓은 여백
- 한 슬라이드에 너무 많은 bullet 금지
- 표는 최소화
- 인포그래픽은 직선적이고 깔끔하게
- 아이콘은 outline 스타일 또는 simple glyph
- 스톡 포토 남발 금지
- 가능하면 UI mock, flow diagram, comparison card, pipeline view 위주

### 로고 사용
- 가능하면 `mortly` 로고 또는 최소한 gold `m` monogram + dark background를 활용
- 로고를 크게 남발하지 말고, 표지/마지막/섹션 헤더 정도에서만 절제해 사용


## 6. 추천 슬라이드 구조

슬라이드는 `15~17장` 정도로 구성해라.  
너무 짧지도 너무 길지도 않게, 실제 미팅용으로 날카롭게 만들어라.

추천 구조:

1. Cover
2. Executive Summary / Thesis
3. Problem
4. Existing Workflow vs Mortly Workflow
5. Product Overview
6. Mortgage Applicant Journey
7. Mortgage Professional Journey
8. Privacy, Trust & Safety
9. Marketplace Operations / 관리자 운영 체계
10. Customer Segments & Initial Wedge
11. Business Model & Pricing
12. Go-To-Market
13. Product Readiness / What Is Already Built
14. Tech & Scalability
15. Roadmap
16. Team / Founder Placeholder
17. Closing / Ask

필요하면 appendix 1~2장을 추가해도 되지만 본편은 간결하게 유지해라.


## 7. 각 슬라이드별 구체적 지시

### Slide 1. Cover
- 제목 후보: `모기지 전문가가 먼저 제안하는 새로운 모기지 방식`
- 부제 후보: `캐나다의 프라이버시 중심 이중언어 모기지 마켓플레이스`
- 영어 태그라인을 작은 보조 카피로 넣어도 좋음: `Mortgage Professionals compete. You choose.`
- 시각: deep forest 배경, gold monogram 또는 로고, 여백 넓게

### Slide 2. Executive Summary / Thesis
- 이 회사가 한 문장으로 무엇인지
- 누구의 어떤 문제를 어떻게 해결하는지
- 왜 지금 타이밍이 맞는지
- 한 줄로 business model
- 한 줄로 wedge
- 이 슬라이드는 투자자/파트너가 `아 이게 뭐구나`를 15초 내 이해하게 만들어라

### Slide 3. Problem
- 모기지 신청자 관점 문제:
  - 모기지 전문가를 어떻게 비교해야 할지 모름
  - 기존 탐색 경로가 소개/광고/전화 위주
  - 상담 전에 개인정보를 먼저 내야 한다는 부담
- 모기지 전문가 관점 문제:
  - high-intent lead 획득 비효율
  - 광고/콜드 아웃리치 의존
  - 차별화보다 노출이 우선되는 시장 구조
- regulated vertical에서 trust friction이 크다는 점을 강조

### Slide 4. Existing Workflow vs Mortly Workflow
- 좌측: 기존 방식
  - mortgage applicant searches
  - contacts multiple mortgage professionals
  - repeats same story
  - shares info early
  - low comparability
- 우측: mortly 방식
  - mortgage applicant posts one structured request
  - verified mortgage professionals respond
  - mortgage applicant compares inside platform
  - contact disclosure happens only when ready
- 이 슬라이드는 반드시 구조 전환을 시각적으로 보여줘라

### Slide 5. Product Overview
- 한 문장 정의:
  - `익명에 가까운 요청 게시 + 검증된 모기지 전문가 응답 + 플랫폼 내 비교/채팅 + 모기지 전문가 SaaS monetization`
- 3개 기둥 정도로 정리:
  - Privacy-first mortgage applicant experience
  - Verified mortgage professional marketplace
  - Operational infrastructure for trust
- 너무 많은 기능 설명보다 구조를 보여줘라

### Slide 6. Mortgage Applicant Journey
- 실제 코드 흐름 기반으로 구성:
  - 회원가입 / 로그인
  - 이메일 인증
  - residential or commercial request 작성
  - 관리자 승인 대기
  - 모기지 전문가 응답 수신
  - 플랫폼 내 비교 및 메시징
  - 원할 때만 직접 연결
- 핵심 포인트:
  - 모기지 신청자는 무료
  - direct contact auto exposure 없음
  - 주거용/상업용 모두 대응

### Slide 7. Mortgage Professional Journey
- 실제 코드 흐름 기반:
  - 모기지 전문가 회원가입
  - 프로필 온보딩
  - 관리자 검증
  - OPEN request 탐색
  - 유료 플랜/크레딧 기반으로 고객 대화 시작
  - 메시징/후속관리
- 핵심 포인트:
  - FREE는 browse only
  - BASIC/PRO/PREMIUM 구조
  - response credit monetization
  - 검증된 모기지 전문가만 진입

### Slide 8. Privacy, Trust & Safety
- 이 deck의 가장 중요한 차별화 슬라이드 중 하나
- 반드시 다음 요소를 담아라:
  - direct contact not auto-shared
  - verified mortgage professional access gate
  - report system
  - 관리자 moderation
  - public IDs instead of exposing internal identifiers
  - marketplace, not lender
- regulated category에서 trust layer 자체가 제품이라는 느낌을 줘라

### Slide 9. Marketplace Operations / 관리자 운영 체계
- 이 제품이 `단순 매칭 랜딩페이지`가 아니라는 증거
- 다음을 시각화:
  - 관리자 dashboard
  - request approval queue
  - 모기지 전문가 verification queue
  - report handling
  - credit adjustment
  - system settings
  - audit trail
  - maintenance mode
  - cron-based lifecycle automation
- 운영 복잡성을 해소하는 플랫폼이라는 인상을 만들어라

### Slide 10. Customer Segments & Initial Wedge
- 모기지 신청자 세그먼트
  - first-time buyers
  - refinance/renewal seekers
  - privacy-sensitive users
  - commercial mortgage seekers
  - Korean-speaking users in Canada
- 모기지 전문가 세그먼트
  - independent mortgage professionals
  - growth-stage mortgage teams
  - Korean-community specialists
  - mortgage professionals needing better digital demand capture
- 초기 wedge:
  - bilingual trust layer
  - underserved Korean-speaking segment
  - Canada-wide expansion potential

### Slide 11. Business Model & Pricing
- 모기지 신청자는 free
- 모기지 전문가는 monthly subscription
- 현재 코드 기준 pricing을 사용:
  - FREE: $0
  - BASIC: $29/mo
  - PRO: $69/mo
  - PREMIUM: $129/mo
- credit logic:
  - BASIC 5/month
  - PRO 20/month
  - PREMIUM unlimited
- 단, 이 슬라이드에서 `credit pack 판매`는 현재 구현 사실처럼 쓰지 마라
- 원하면 `future monetization expansion`으로만 언급 가능

### Slide 12. Go-To-Market
- 실제 제품 성격에 맞는 현실적인 GTM을 설계해라
- 추천 방향:
  - Phase 1: Korean-Canadian community wedge
  - Phase 2: bilingual SEO / content / mortgage professional partnerships
  - Phase 3: broader Canadian mortgage demand capture
- acquisition hypothesis 예시:
  - community partnerships
  - Korean-language content
  - mortgage professional referral loops
  - region-based launch concentration
- 수치는 넣지 말고 전략 구조를 명확히

### Slide 13. Product Readiness / What Is Already Built
- 이 슬라이드는 현재 구현 범위를 강하게 보여줘라
- 포함할 수 있는 항목:
  - bilingual public site
  - 모기지 신청자 dashboards
  - structured request intake
  - 모기지 전문가 onboarding
  - 관리자 verification
  - Stripe billing
  - realtime messaging
  - reports and notices
  - analytics instrumentation
  - policy automation
- 표현 방식:
  - `Concept`가 아니라 `working MVP with operational depth`

### Slide 14. Tech & Scalability
- 기술 스택을 과시하려고 하지 말고, business readiness 관점으로 정리해라
- 포인트:
  - Next.js + TypeScript frontend
  - Prisma + PostgreSQL data model
  - NextAuth auth system
  - Supabase realtime chat
  - Stripe subscription billing
  - Resend email verification/reset
  - PostHog analytics
  - 관리자 operations + cron automation
- 메시지:
  - fast iteration 가능
  - operational control 가능
  - bilingual expansion 가능
  - vertical marketplace로 확장 가능한 구조

### Slide 15. Roadmap
- 반드시 `현재 구현`과 분리해서 보여줘라
- future examples:
  - mortgage professional-side advanced analytics
  - notification enhancements
  - richer matching / ranking
  - document exchange
  - annual plans
  - partnership integrations
  - multilingual expansion beyond Korean/English
- roadmap는 현실적인 3-phase로

### Slide 16. Team / Founder Placeholder
- 내가 실제 팀 정보를 주지 않았으므로 사람을 지어내지 마라
- 대신 두 가지 방식 중 하나를 택해라:
  - `[Founder / Team info to be inserted]` placeholder
  - 팀이 아직 작다면 `small, execution-focused founding team` 정도의 안전한 표현 + placeholder 박스

### Slide 17. Closing / Ask
- 발표 목적에 맞춰 마무리:
  - investor면 `fundraise ask`
  - partner면 `pilot / partnership proposal`
  - accelerator면 `why us, why now, why this team`
- 마무리 문장은 강하지만 과장되지 않게
- 추천 정조:
  - `mortly is building the trust layer for a better mortgage discovery experience in Canada.`


## 8. 슬라이드 작성 스타일

텍스트 작성 원칙:
- 문장 길이는 짧고 단정하게
- bullet은 3~5개 이내
- 한 슬라이드에 메시지는 하나만
- 같은 말을 반복하지 말 것
- “혁신”, “파괴”, “game changer” 같은 상투어 남발 금지
- regulated category답게 신뢰감 있는 문체 유지
- 모기지 신청자와 모기지 전문가 양쪽 가치가 모두 드러나야 함
- `privacy`, `trust`, `verified access`, `structured demand`, `bilingual wedge`를 반복 테마로 잡아라

문체 톤:
- 차분함
- 선명함
- 투자자 친화적
- 현실적
- 과장 적음
- elegant but not dry


## 9. 시각 요소 제작 원칙

가능한 한 다음 유형의 시각 자료를 사용해라:
- workflow diagram
- split before/after comparison
- tiered pricing cards
- operating system style dashboard blocks
- funnel or phase diagram
- wedge-to-expansion map
- trust shield / gated access concept visual

피해야 할 것:
- 웃는 사람 stock photo
- 집 사진 남발
- generic handshake imagery
- crypto 스타일 3D icon
- 블루-퍼플 기본 SaaS 스타일

스크린/UI를 보여줘야 하면:
- 현재 mortly 웹 UI와 비슷한 톤으로
- cream background, dark forest cards/text, amber highlights
- rounded cards
- clean dashboard modules
- bilingual labels가 있어도 어색하지 않게


## 10. 숫자와 데이터 처리 규칙

다음 데이터는 현재 코드에서 확인 가능한 사실이므로 활용 가능:
- 가격 체계
- response credits 구조
- 역할 구조
- request / 모기지 전문가 / conversation / 관리자 workflow
- 기술 스택
- bilingual support
- Stripe/Supabase/Resend/PostHog 사용
- 관리자 운영 기능 존재

다음 데이터는 내가 별도로 주지 않았으므로 확정 숫자로 쓰지 마라:
- 실제 사용자 수
- 실제 모기지 전문가 수
- 실제 요청 수
- 실제 revenue/ARR/MRR
- 실제 conversion
- 실제 CAC/LTV
- 실제 시장 점유율
- 실제 partnership
- 실제 team size

시장 슬라이드가 필요하면:
- 정확한 숫자 대신 placeholder를 두어라
- 예:
  - `[캐나다 모기지 시장 규모 - source required]`
  - `[Licensed mortgage professional count - source required]`
  - `[Korean-Canadian addressable segment - source required]`


## 11. 발표 노트 / 스크립트

가능하면 각 슬라이드마다 presenter notes도 함께 설계해라.

발표 노트 원칙:
- 슬라이드당 60~120자 또는 2~4문장 정도의 간결한 한국어 발표 멘트
- 슬라이드 본문을 그대로 읽지 말고, 핵심 해석을 덧붙여라
- 투자자/파트너가 궁금해할 포인트를 미리 짚어라
- 특히 다음 슬라이드에는 notes 품질을 높여라:
  - Problem
  - Workflow inversion
  - Trust & Safety
  - Business model
  - Product readiness
  - Roadmap
  - Ask


## 12. 최종 QA 체크리스트

최종 결과물을 만들기 전에 스스로 다음을 검토해라.

- 이 deck이 현재 코드베이스 truth와 모순되지 않는가?
- reviews, ratings, credit packs, annual billing, document upload 등을 현재 기능처럼 말하지 않았는가?
- `mortly`가 lender나 advisor처럼 들리지 않는가?
- 모기지 신청자 value와 모기지 전문가 value가 모두 선명한가?
- privacy / trust / verification이 중심 축으로 살아 있는가?
- bilingual wedge가 지나치게 niche해 보이지 않으면서도 선명한 초기 전략으로 보이는가?
- MVP 이상의 운영 깊이가 충분히 드러나는가?
- 슬라이드 수가 과도하지 않은가?
- 디자인이 forest/cream/amber 브랜드 테마를 일관되게 따르는가?
- 투자자/제휴 대상이 봤을 때 `실제 제품이 이미 많이 만들어져 있다`는 인상을 주는가?


## 13. 원하는 최종 출력 방식

실제 PowerPoint를 제작해라.  
단순 outline이 아니라, 각 슬라이드에 들어갈 제목/본문/도형 구조/시각적 계층이 명확한 deck로 만들어라.

추가 요구:
- 표지와 마지막 슬라이드는 가장 고급스럽게
- 섹션 전환 슬라이드는 dark forest 계열로 통일
- 본문 슬라이드는 cream 배경으로 가독성 높게
- 가격 슬라이드는 카드형으로
- workflow 슬라이드는 직관적인 흐름도로
- 운영 슬라이드는 dashboard/pipeline 느낌으로
- roadmap 슬라이드는 `Now / Next / Later` 또는 `Phase 1 / 2 / 3` 구조로
- 팀 정보가 없으면 placeholder를 깔끔하게 남겨라
- 숫자가 불명확하면 placeholder로 남겨라

이제 위 조건을 모두 반영해서, `mortly`에 대한 설득력 있고 사실 기반이며 디자인 완성도가 높은 business proposal PowerPoint를 만들어라.

---

추가 메모:
- 구 버전 자료나 상상 속 기능이 아니라 `현재 제품 truth + 현실적 roadmap`으로 정리하는 것이 가장 중요하다.
- deck의 느낌은 “이미 상당 부분 구현된 trust-heavy marketplace”여야 한다.
