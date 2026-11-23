# 오늘의 체크 (할 일 체크 앱)

할 일을 적고 체크하면 완료율 링이 채워지는 체크리스트 앱이야. 화면은 `www/` 안의 웹앱 하나이고, [Capacitor](https://capacitorjs.com)로 감싸서 안드로이드·iOS 앱 프로젝트를 만들었어.

- 앱 ID: `com.todaycheck.app` (스토어에 올리기 전에 원하는 걸로 바꿔도 됨. `capacitor.config.json`, `android/app/build.gradle`, Xcode의 Bundle Identifier를 같이 바꿔야 해)
- 데이터: 기기 안(WebView localStorage)에 저장되고, 서버로는 아무것도 보내지 않아.
- 기능: 추가 · 체크 · 길게 누르거나 두 번 눌러 수정 · 삭제 · 전체/남은 일/완료 보기 · 완료 한 번에 지우기 · 다크 모드

## 폴더

| 경로 | 설명 |
| --- | --- |
| `www/` | 앱 화면 (index.html, 매니페스트, 서비스 워커, 아이콘) |
| `android/` | 안드로이드 스튜디오 프로젝트 |
| `ios/` | Xcode 프로젝트 (Swift Package Manager 방식이라 CocoaPods 필요 없음) |
| `resources/` | 아이콘(1024px)과 스플래시 원본. 바꾸고 `npx capacitor-assets generate` 다시 실행 |

## 빌드하기

```bash
cd todo-app
npm install
npx cap sync          # www/ 수정 내용을 android/ios에 복사
```

**안드로이드** (Android Studio 필요)
```bash
npx cap open android
```
Android Studio에서 ▶ 실행으로 폰/에뮬레이터 테스트 → `Build > Generate Signed App Bundle`로 `.aab` 만들어서 Google Play Console에 올리면 돼. (Play 개발자 계정 1회 25달러)

**iOS** (Mac + Xcode 필요)
```bash
npx cap open ios
```
Xcode에서 Signing & Capabilities에 팀을 고르고 실행 → `Product > Archive`로 App Store Connect에 올려. (Apple Developer Program 연 99달러)

## 웹으로 쓰기

`www/`는 그대로 정적 사이트라 GitHub Pages에서도 열려(`/todo-app/www/`). 폰 브라우저에서 "홈 화면에 추가"하면 설치형 웹앱으로도 쓸 수 있어.
