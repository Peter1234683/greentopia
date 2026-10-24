@AGENTS.md

# 그린토피아 작업 규칙

- 마일스톤 순서대로 진행하고, 각 마일스톤이 끝나면 실행 방법·확인할 화면을 요약한 뒤 사용자 확인을 받는다. (진행 현황: README.md)
- UI 문구는 전부 한국어, 건축 비전문가도 이해하는 생활 언어.
- 외부 API(건축물대장, GR-AI)는 어댑터 인터페이스 + mock 으로 먼저 구현. GR-AI 스크래핑 금지.
- 확정되지 않은 법·제도 수치, 할인율, 배점, 등급 기준은 `src/config/` 설정값으로 빼고 화면에 "가정 기반" 근거를 표기한다. 확정 할인을 약속하는 문구 금지.
- DB는 SQLite: enum·배열·Json 대신 String 사용 (`*Json` 필드는 JSON 문자열, 허용값은 `src/lib/constants.ts`).
- 역할 검사는 서버에서 `requireRole()` (src/lib/dal.ts). proxy.ts 는 로그인 여부만 낙관적으로 확인.
- 계약은 건물별 개별 체결, 플랫폼은 공동발주 대행·중개자.
- 확인: `npm run typecheck && npm run lint && npm test` (계산 엔진), 화면 흐름은 `npm run build && npm run test:e2e`.
- 시드는 결정적 난수를 쓴다. 데모 고객이 Cluster 에 묶이지 않으면 시드가 오류로 멈춘다 (README 데모 시나리오 참고).
- AI 기능은 `src/lib/ai` 의 `aiJson` / `aiChat` 만 거친다. 항상 규칙 기반 fallback 을 함께 넘기고, AI 결과에는 "AI 참고 의견" 표시.
- 지원금 정보는 지원금 DB(SubsidyProgram)에 출처가 있는 항목만. 수치를 코드나 프롬프트에 지어 넣지 않는다.
