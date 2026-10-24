# 그린토피아 (GreenTopia)

> 혼자 고치면 비싸고, 모아 고치면 싸다.

AI가 이웃 건물의 그린리모델링 공사 수요를 묶고, 시공업체 입찰로 가격을 정하는 민간 공동공사 플랫폼 MVP.

## 실행

```bash
npm install          # prisma generate 자동 실행
cp .env.example .env # SESSION_SECRET 은 운영 시 반드시 교체
npm run setup        # SQLite 스키마 생성 + 대구 데모 데이터 시드
npm run dev          # http://localhost:3000
```

| 명령 | 설명 |
|---|---|
| `npm run db:reset` | DB를 비우고 시드를 다시 넣음 |
| `npm run typecheck` | 라우트 타입 생성 + `tsc` |
| `npm run lint` | ESLint |

### 데모 계정 (비밀번호 `demo1234`)

| 계정 | 역할 |
|---|---|
| customer@demo.kr | 건물주 김그린 (남구 대명동 다가구, 창호·보일러 수요) |
| contractor@demo.kr | 시공업체 푸른창호이엔지 (승인, 우수 등급) |
| pending@demo.kr | 시공업체 새길창호 (심사 대기) |
| admin@demo.kr | 운영자 |
| owner001~099@demo.kr, c02~c15@demo.kr | 기타 건물주·업체 |

로그인 화면의 데모 계정 버튼은 개발 모드 또는 `SHOW_DEMO_ACCOUNTS=1` 일 때만 보입니다.

## 구조

```
prisma/schema.prisma   데이터 모델 (SQLite, PostgreSQL 전환 고려)
prisma/seed.ts         대구 가상 데이터 (건물 100 · 업체 15 · 과거 공동공사 4건 · 리뷰)
src/config/            관리자가 바꿀 수 있는 설정 기본값 (지역, 이후 가격 가정치·배점 등)
src/lib/constants.ts   코드값과 한국어 라벨
src/lib/jwt.ts, session.ts, dal.ts   자체 세션 인증 (JWT 쿠키) + 역할 검사
src/proxy.ts           비로그인 사용자 보호 구역 차단 (Next 16의 middleware)
src/app/(customer|contractor|admin)  역할별 화면
storage/uploads/       업로드 파일 (공개 폴더 아님, /files/[id] 로 권한 확인 후 제공)
```

## 마일스톤 진행

- [x] 1. 프로젝트 세팅 · DB 스키마 · 시드 · 인증 · 회원 유형 온보딩
- [ ] 2. 건물 등록(건축물대장 mock) + 공사 수요 입력
- [ ] 3. 에너지 진단 + 교육 콘텐츠
- [ ] 4. AI 매칭 엔진 + 절감 시뮬레이션
- [ ] 5. 사업자 입찰 공고 · 입찰서 위저드
- [ ] 6. 입찰 방식 추천·전환 + 종합평가
- [ ] 7. 견적 비교 · 계약 · 내 공사
- [ ] 8. 리뷰 → 평판 → 등급·혜택 → PQ 규칙 후보
- [ ] 9. 관리자 화면 + 담합 감시
- [ ] 10. PWA · 다듬기 · 데모 시나리오
