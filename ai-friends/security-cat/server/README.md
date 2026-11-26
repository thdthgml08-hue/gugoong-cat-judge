# 🛡️ 보안전문 구공이 서버

글·채팅·이미지를 **검열**하고, 보안 로그와 코드를 **점검**하는 작은 Node 서버입니다.
규칙 엔진이 먼저 확실한 것(주민번호, 욕설, 해킹 시도 패턴)을 잡고, Claude가 문맥을 한 번 더 봅니다.
API 키가 없어도 규칙만으로 돌아갑니다.

그리고 **사이버 지킴이**(`src/shield.js`)가 사이트 앞에 서서 해킹 시도를 그 자리에서 막습니다.

막는 일은 AI가 아니라 **정해진 규칙**이 합니다. 그래서 빠르고 결과를 예측할 수 있어요. 차단도 정해진 시간이 지나면 저절로 풀립니다.
지우기, 계정 잠금, 설정 변경은 여전히 못 해요. 지킴이가 하는 일은 "이 요청을 들여보낼까 말까"뿐입니다.

## 실행

```bash
cd ai-friends/security-cat/server
npm install
npm test                       # 규칙 엔진 테스트 (API 키 없이)
npm start                      # http://127.0.0.1:8787
```

| 환경 변수 | 뜻 | 기본값 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude 판정에 쓸 키. 없으면 규칙만 사용 | 없음 |
| `GUARD_TOKEN` | 호출할 때 `Authorization: Bearer <토큰>` 필요. 없으면 127.0.0.1에서만 받음 | 없음 |
| `GUARD_MODEL` | 판정 모델 | `claude-opus-5-5` |
| `GUARD_DISABLE_AI` | `1`이면 키가 있어도 규칙만 사용 | 꺼짐 |
| `GUARD_RATE_PER_MIN` | IP당 분당 요청 수 | 60 |
| `PORT` / `HOST` | 포트 / 바인딩 주소 | 8787 / 토큰 있으면 0.0.0.0 |

키는 코드나 레포에 넣지 말고 환경 변수로만 주세요. 서버 로그에는 원문을 남기지 않고 판정 결과만 남깁니다.

## API

모든 응답에 `level`(`정상`·`주의`·`위험`)이 붙습니다. 검열 응답에는 `verdict`도 붙어요:
`allow`(올려도 됨) · `review`(사람이 확인) · `block`(바로 가림).
규칙과 AI 중 **더 엄격한 쪽**을 따르고, AI가 실패하거나 답을 거절하면 통과시키지 않고 `review`로 보냅니다.

### `POST /v1/moderate/text` 글·채팅 검열

```bash
curl -s localhost:8787/v1/moderate/text -d '{"text":"연락주세요 010-1234-5678"}'
```
```json
{ "verdict": "review", "level": "주의",
  "findings": [{ "category": "personal_info", "rule": "phone", "detail": "휴대전화번호: 01*********78" }],
  "masked_text": "연락주세요 01*********78", "ai": { "verdict": "review", "categories": ["personal_info"], "reason": "..." } }
```
잡는 것: 욕설·비속어(띄어쓰기 변형 포함), 혐오·괴롭힘·성적·폭력·자해 조장(AI), 개인정보(주민번호·카드번호·전화·이메일·계좌), 스팸·광고, AI를 속이려는 지시문.
개인정보는 가린 글(`masked_text`)만 Claude에게 보냅니다.

### `POST /v1/moderate/image` 이미지 검열

```json
{ "image_base64": "<base64>", "media_type": "image/png", "caption": "선택" }
```
jpeg·png·gif·webp, 5MB까지. 이미지는 AI로만 볼 수 있어서 키가 없으면 항상 `review`.

### `POST /v1/analyze/logs` 보안 로그 분석

```json
{ "text": "로그 여러 줄..." }   // 또는 { "lines": ["...", "..."] }
```
잡는 것: 로그인 실패 반복(5회 이상), **실패 뒤 성공**(계정 탈취 의심), `.env`·`wp-admin`·`.git` 같은 민감 경로 탐색, SQL 인젝션·XSS·경로 조작·명령 실행 시도.
AI가 켜져 있으면 `ai.summary`, `ai.incidents`, `ai.proposed_actions`(승인이 필요한 제안)이 붙습니다.

### `POST /v1/scan/code` 코드 점검 (규칙만)

```json
{ "files": [{ "path": "app.js", "content": "..." }] }
```
API 키·토큰·개인 키·코드에 적힌 비밀번호(값은 가려서 보고), `eval`, 변수를 넣는 `innerHTML`, 셸 실행.

### `GET /health`

## 사이버 지킴이 (공격 차단)

```bash
npm run guard                               # 채점소 게임을 지키면서 띄움 → http://localhost:8080
TARGET=http://127.0.0.1:3000 npm run guard  # 다른 서버 앞에 서는 문지기(리버스 프록시)
```

| 막는 것 | 응답 |
| --- | --- |
| SQL 인젝션, XSS, 경로 조작(`../../etc/passwd`), 명령 실행 시도. URL 인코딩을 두 번 해도 풀어서 봐요 | 403 |
| `.env`, `.git`, `wp-admin`, `phpmyadmin` 같은 민감한 경로 탐색 | 404 |
| sqlmap, nikto, nuclei 같은 해킹 도구로 접속 | 403 |
| 1분에 너무 많은 요청 (기본 120번) | 429 |
| TRACE/CONNECT 메서드, 너무 긴 주소 | 405 / 414 |
| **공격 3번** → 그 IP를 **15분 차단** (지나면 자동 해제) | 403 |

정적 파일을 내줄 때는 폴더 밖 파일, 숨김 파일(`.git`, `.env`), `node_modules`를 절대 내주지 않아요.
보안 헤더(`nosniff`, `X-Frame-Options` 등)도 붙여요. 검열 서버(`npm start`)도 같은 지킴이가 지켜요.

| 환경 변수 | 뜻 | 기본값 |
| --- | --- | --- |
| `GUARD_MODE` | `block`(막기) / `monitor`(기록만, 처음 켤 때 오탐 확인용) | `block` |
| `GUARD_RATE_PER_MIN` | IP당 분당 요청 | 120 |
| `GUARD_BAN_MINUTES` | 자동 차단 시간 | 15 |
| `GUARD_ALLOWLIST` | 검사하지 않을 IP (쉼표로 구분) | `127.0.0.1,::1` |
| `GUARD_TRUST_PROXY` | `1`이면 `X-Forwarded-For`로 IP 판단 (Cloudflare·nginx 뒤에 있을 때만) | 꺼짐 |
| `GUARD_TOKEN` | 관리 페이지 토큰 | 없음 (관리 페이지 꺼짐) |

관리 (토큰 필요):
```bash
curl -H "Authorization: Bearer $GUARD_TOKEN" localhost:8080/__guard/status             # 차단 목록, 최근 기록
curl -X POST -H "Authorization: Bearer $GUARD_TOKEN" "localhost:8080/__guard/unban?ip=1.2.3.4"  # 잘못 막힌 IP 풀기
```

다른 Node 서버에 바로 붙일 수도 있어요:
```js
import { createShield } from './src/shield.js';
const shield = createShield();
app.use(shield.middleware);                      // Express
// 또는 http.createServer((req, res) => { if (shield.handle(req, res)) return; ... })
```

**한계도 알아 두세요.** 지킴이는 주소와 헤더를 봐요. POST 본문 속 공격은 앱에서 입력값을 검증해야 막을 수 있어요.
대량 트래픽 공격(DDoS)은 서버 하나로는 못 막으니, 실제로 서비스한다면 Cloudflare 같은 앞단 서비스를 함께 쓰세요.

## 레포 점검 CLI

```bash
npm run scan            # 이 레포 전체
npm run scan -- ../..   # 다른 폴더
```
읽기만 하고 아무것도 고치지 않습니다. 비밀키 같은 `위험`이 있으면 종료 코드 1이라 CI에 걸어 둘 수 있어요.

## 구조

| 파일 | 내용 |
| --- | --- |
| `src/rules.js` | 규칙 엔진 (개인정보·욕설·스팸·인젝션, 로그 공격 패턴, 비밀키) |
| `src/claude.js` | Claude 판정. `../system-prompt.md`의 성격을 그대로 씀. 구조화 출력 + 거절 시 자동 대체 모델 |
| `src/shield.js` | 사이버 지킴이: 공격 차단, 자동 임시 차단, 보안 헤더 |
| `src/guard.js` | 문지기 서버 (정적 파일 또는 프록시 앞에서 지킴이 실행) |
| `src/server.js` | 검열 HTTP 서버 (토큰 인증, 요청 크기 제한, 지킴이 적용) |
| `src/scan-repo.js` | 레포 점검 CLI |
| `test/` | 규칙 엔진·지킴이 테스트 |

## 아직 없는 것

- **로그 자동 수집**: 지금은 로그를 직접 보내야 합니다. 서버를 운영하게 되면 cron이나 로그 수집기에서 `/v1/analyze/logs`로 보내면 돼요.
- **욕설 목록**: `rules.js`의 `BADWORDS`는 최소 목록이에요. 운영하며 늘려 주세요.
- **채점소 연결**: 채점소는 아직 사용자가 글을 쓰는 기능이 없어요. 닉네임·댓글·랭킹이 생기면 저장하기 전에 `/v1/moderate/text`를 거치게 하면 됩니다.
