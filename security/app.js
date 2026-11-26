/* 구공이(902) 보안 친구 — 데모 모드 엔진
 *
 * 공개 웹앱에는 API 키 입력란을 두지 않는다(합의안).
 * 아래 대화 엔진은 클로드 MVP 시스템 프롬프트의 판별·검수 규칙을 그대로 따른다.
 *   - 위험도는 '위험 / 주의 / 확인 필요' 세 단계, 이유는 1~2개
 *   - "안전해"라고 단정하지 않는다. 신호가 없어도 '확인 필요' + 공식 경로 확인
 *   - 비밀번호·인증번호·카드번호·주민번호는 받지 않는다
 *   - 삭제·초기화·송금은 사용자가 직접 하도록 안내만 한다
 *   - 증거 보존: 문자·링크는 지우라고 하지 않는다("지우지 말고, 열지만 마")
 *     받은 .apk 같은 설치 파일만 열지 말고 삭제하도록 안내한다(삭제는 사용자가 직접)
 *   - 이미 눌렀을 때: 화면 닫기 → 있었던 일 확인 → 기종별 확인(한 번에 한 단계) → 상황별 대처 → 다독임
 *   - 한 번에 질문은 하나만. 기억은 전부 하고, 위험한 것부터 챙긴다
 *   - 선택지를 기다리는 중에 다른 입력이 오면 엉뚱하게 처리하지 않는다
 *     (문자·링크면 새로 판별하고, 애매하면 "아까 질문부터 골라줄래?" 하고 다시 보여 준다)
 *   - 신고는 기관에 접수하지 않는다. 118·112·1332 번호 안내와 tel: 연결까지만 하고,
 *     준비 안내(캡처 → 문자 보존 → 지급정지 → 접수번호)는 한 번에 하나씩 보여 준다
 *   - 서버에 실제 AI를 붙일 때는 이 파일 대신 system-prompt.md를 그대로 쓰면 된다
 */
(function () {
  "use strict";

  var chat = document.getElementById("chat");
  var form = document.getElementById("composer");
  var input = document.getElementById("input");
  var resetBtn = document.getElementById("reset");
  var reportBtn = document.getElementById("reportBtn");
  var sheet = document.getElementById("reportSheet");
  var sheetBody = document.getElementById("reportSheetBody");
  var chips = Array.prototype.slice.call(document.querySelectorAll("#quickstart .chip"));

  var ASSET = "../assets/icon-180.png";

  var state = {
    pending: null,        // 'installed' | 'device' | 'steps' | 'info' | 'recall_input' | 'recall_file'
    caseHasInput: false,  // 이번 사건에 '주소/정보 입력'이 포함됐는지
    recallStage: null,
    reask: null,          // 대기 중인 질문을 다시 보여 주는 함수
    stepNext: null,       // 기종별 안내: 다음 단계
    stepHint: null,       // 기종별 안내: 메뉴 위치
    moneyLikely: false    // 이번 사건에 돈이 오갔을 가능성(1332를 먼저 보여 준다)
  };

  /* ───────────────────────── 렌더링 ───────────────────────── */

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");
  }

  function scrollDown() {
    requestAnimationFrame(function () {
      chat.scrollTop = chat.scrollHeight;
    });
  }

  function addBot(paras) {
    var row = document.createElement("div");
    row.className = "row bot";

    var av = document.createElement("img");
    av.className = "avatar";
    av.src = ASSET;
    av.alt = "";

    var block = document.createElement("div");
    block.className = "bot-block";

    var bubble = document.createElement("div");
    bubble.className = "bubble";

    paras.forEach(function (p) {
      var el = document.createElement("p");
      if (typeof p === "string") el.innerHTML = fmt(p);
      else if (p.nodeType === 1 && p.tagName === "P") el = p;
      else el.appendChild(p);
      bubble.appendChild(el);
    });

    block.appendChild(bubble);
    row.appendChild(av);
    row.appendChild(block);
    chat.appendChild(row);
    scrollDown();
    return block;
  }

  function addUser(text) {
    var row = document.createElement("div");
    row.className = "row user";
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    var p = document.createElement("p");
    p.textContent = text;
    bubble.appendChild(p);
    row.appendChild(bubble);
    chat.appendChild(row);
    scrollDown();
  }

  function dim(text) {
    var p = document.createElement("p");
    p.className = "dim";
    p.textContent = text;
    return p;
  }

  var BADGE_CLASS = { "위험": "danger", "주의": "warn", "확인 필요": "check" };

  function riskCard(level, title, reasons, guide) {
    var box = document.createElement("div");
    box.className = "risk " + BADGE_CLASS[level];

    var head = document.createElement("div");
    head.className = "risk-head";
    var badge = document.createElement("span");
    badge.className = "badge " + BADGE_CLASS[level];
    badge.textContent = level;
    var t = document.createElement("span");
    t.className = "risk-title";
    t.textContent = title;
    head.appendChild(badge);
    head.appendChild(t);
    box.appendChild(head);

    var ul = document.createElement("ul");
    reasons.forEach(function (r) {
      var li = document.createElement("li");
      li.innerHTML = fmt(r);
      ul.appendChild(li);
    });
    box.appendChild(ul);

    if (guide) {
      var g = document.createElement("p");
      g.className = "guide";
      g.innerHTML = fmt(guide);
      box.appendChild(g);
    }
    return box;
  }

  function choices(block, options, onPick) {
    var wrap = document.createElement("div");
    wrap.className = "picker";
    var btns = options.map(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "choice";
      b.textContent = o.label;
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.disabled = true; x.classList.remove("on"); });
        b.classList.add("on");
        wrap.classList.add("used");
        addUser(o.label);
        onPick(o.value, o.label);
      });
      wrap.appendChild(b);
      return b;
    });
    block.appendChild(wrap);
    scrollDown();
  }

  function multiSelect(block, options, onDone) {
    var wrap = document.createElement("div");
    wrap.className = "picker multi";
    var picked = [];

    options.forEach(function (label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pick";
      b.textContent = label;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.classList.toggle("on", on);
        picked = options.filter(function (o) {
          var i = options.indexOf(o);
          var el = wrap.children[i];
          return el && el.getAttribute("aria-pressed") === "true";
        });
        done.disabled = picked.length === 0;
      });
      wrap.appendChild(b);
    });

    var done = document.createElement("button");
    done.type = "button";
    done.className = "pick-done";
    done.textContent = "선택 완료";
    done.disabled = true;
    done.addEventListener("click", function () {
      var sel = picked.slice();
      if (!sel.length) return;
      wrap.remove();
      addUser(sel.join(", "));
      onDone(sel);
    });
    wrap.appendChild(done);

    block.appendChild(wrap);
    scrollDown();
  }

  /* ────────────── 대기 중인 질문 관리 ────────────── */

  var REASK_LEAD = "아까 질문부터 골라줄래? ";

  function clearPending() {
    state.pending = null;
    state.reask = null;
    state.stepNext = null;
    state.stepHint = null;
  }

  function reaskPending() {
    if (state.reask) return state.reask();
    addBot(["아까 질문부터 골라줄래? 아래 버튼에서 골라 주면 돼."]);
  }

  /* 새 문자를 판별하는 동안 잠시 접어 둔 질문 */
  var PENDING_LABEL = {
    installed: "받은 파일로 앱을 설치했는지 확인",
    device: "쓰는 폰 기종 확인",
    steps: "폰에서 하나씩 하던 확인",
    info: "입력한 정보 확인",
    recall_input: "입력 칸이 있었는지 확인",
    recall_file: "파일·설치 버튼이 있었는지 확인",
    report: "신고 전에 챙길 것 확인"
  };

  function suspendPending() {
    if (!state.pending) return null;
    var saved = {
      name: state.pending,
      reask: state.reask,
      stepNext: state.stepNext,
      stepHint: state.stepHint,
      label: PENDING_LABEL[state.pending] || "하던 확인"
    };
    clearPending();
    return saved;
  }

  function resumeSaved(saved) {
    if (!saved) return;
    state.pending = saved.name;
    state.reask = saved.reask;
    state.stepNext = saved.stepNext;
    state.stepHint = saved.stepHint;
    addBot(["좋아, 아까 하던 데로 돌아가자."]);
    if (state.reask) state.reask();
  }

  /* 새 문자 판별 뒤, 접어 둔 질문으로 돌아갈 버튼 */
  function resumeOffer(block, saved) {
    if (!saved) return;
    var p = document.createElement("p");
    p.className = "dim";
    p.innerHTML = fmt("아까 하던 이야기(**" + saved.label + "**)도 마저 챙길까?");
    block.appendChild(p);
    choices(block, [
      { label: "아까 하던 이야기 이어서", value: "resume" }
    ], function () { resumeSaved(saved); });
  }

  /* ───────────────────────── 공통 판별 ───────────────────────── */

  var SELF_BLAME = /(내가\s*(바보|멍청|한심|미쳤)|왜\s*(눌렀|샀|보냈|열었)|내\s*(잘못|탓)|나\s*바보|한심)/;

  function comfort(text) {
    return SELF_BLAME.test(text) ? "누구나 속을 수 있어. " : "";
  }

  var CATS = [
    { key: "credential", re: /(비밀번호|비번|인증번호|otp|카드번호|주민번호|공인인증|보안카드)/i,
      reason: "비밀번호·인증번호 같은 걸 요구하는 문구가 있어. 기관이나 은행은 문자로 먼저 이걸 묻지 않아." },
    { key: "link", re: /(https?:\/\/|www\.|\.com|\.kr|\.ly|bit\.ly|me2\.do|\.app|링크|클릭|눌러서|주소를\s*누르)/i,
      reason: "링크 주소가 들어 있어. 짧은 주소나 낯선 도메인은 특히 조심해야 해." },
    { key: "urgency", re: /(오늘\s*안에|오늘까지|지금\s*바로|즉시|긴급|급하게|급한|24시간|마감|최종|내일까지|며칠\s*안에|곧\s*(차단|정지|삭제|반송))/,
      reason: "‘오늘 안에’, ‘지금 바로’처럼 재촉하는 문구가 있어. 재촉은 판단을 흐리게 만드는 수법이야." },
    { key: "money", re: /(결제|입금|환불|청구|미납|요금|송금|상품권|대출|카드값|만\s*원|돈\s*(좀|보내|줘))/,
      reason: "결제·환불·입금을 언급하는 부분이 있어." },
    { key: "family", re: /(엄마|아빠|아들|딸|누나|형|가족|액정|폰이\s*깨|새\s*번호|나야|효자|효녀)/,
      reason: "가족을 사칭하는 문구가 있어. 가족은 보통 새 번호로 급하게 돈을 부탁하지 않아." },
    { key: "fine", re: /(과태료|범칙금|고지서|위반|벌금|교통|주정차)/,
      reason: "과태료·고지서를 빙자한 문구가 있어." },
    { key: "app", re: /(apk|앱을?\s*(설치|깔)|어플|다운로드|첨부파일)/,
      reason: "앱 설치나 파일 다운로드를 권하는 부분이 있어." },
    { key: "delivery", re: /(택배|배송|운송장|반송|주소\s*(오류|확인|변경|수정|고치)|집\s*앞|문\s*앞|물건이\s*왔)/,
      reason: "택배·배송을 빙자한 문구가 있어. 진짜 배송 알림은 쇼핑 앱 안에서도 확인할 수 있어." }
  ];

  function analyze(text) {
    var hits = CATS.filter(function (c) { return c.re.test(text); });
    var keys = {};
    hits.forEach(function (h) { keys[h.key] = true; });

    var level = "확인 필요";
    if (keys.credential ||
        (keys.link && hits.length >= 2) ||
        (keys.app && keys.link) ||
        (keys.family && keys.money)) {
      level = "위험";
    } else if (hits.length) {
      level = "주의";
    }

    var order = ["credential", "link", "urgency", "money", "family", "fine", "app", "delivery"];
    var reasons = order
      .filter(function (k) { return keys[k]; })
      .slice(0, 2)
      .map(function (k) {
        return CATS.filter(function (c) { return c.key === k; })[0].reason;
      });

    if (!reasons.length) {
      reasons = ["지금 보이는 문구에서는 뚜렷한 위험 신호를 못 찾았어. 그래도 이건 ‘안전하다’는 뜻은 아니야."];
    }

    var titles = {
      "위험": "위험 신호가 여러 개 겹쳐 있어",
      "주의": "조심해야 할 신호가 있어",
      "확인 필요": "단정할 수 없어"
    };

    return { level: level, reasons: reasons, title: titles[level] };
  }

  /* 대기 중인 질문보다 새 문자·링크 판별을 먼저 해야 하는 입력인지 */
  function looksLikeNewLetter(t) {
    if (/(https?:\/\/|www\.)/i.test(t)) return true;
    if (/\[[^\]]{2,20}\]/.test(t)) return true;   // [CJ대한통운] 같은 머리표
    var hits = CATS.filter(function (c) { return c.re.test(t); });
    return t.length >= 20 && hits.length >= 2;
  }

  var GUIDE_OFFICIAL =
    "문자에 있는 링크는 누르지 말고, 그 회사나 기관의 **공식 앱이나 공식 홈페이지를 직접 열어서** 확인해 줘. 그래도 이상하면 KISA 118에 물어봐도 돼.";

  var EVIDENCE =
    "문자는 118이나 경찰에 신고할 때 증거가 되니까 지우지 말고, 열지만 마.";

  var CLOSING =
    "여기까지 하면 오늘 챙길 건 다 챙긴 거야. 누구나 속을 수 있어. 혹시 뭔가 이상해 보이면 언제든 다시 불러 줘.";

  var UNKNOWN_CLOSING =
    "그럼 더 조심하는 쪽으로 해 두자. 그 문자는 118이나 경찰에 신고할 때 증거가 되니까 지우지 말고 열지도 마. 다른 기기에서 그 사이트 비밀번호를 바꾸고, 카드사 앱에서 결제 알림도 켜 줘.";

  /* ───────────────────────── 대화 흐름 ───────────────────────── */

  function flowGreet() {
    clearPending();
    state.caseHasInput = false;
    state.moneyLikely = false;
    addBot([
      "안녕, 나는 구공이(902)야. 보안 쪽을 같이 봐 주는 경비 친구야.",
      "수상한 문자나 링크가 왔으면 내용을 붙여넣어도 되고, 아래 버튼에서 골라도 돼. 이름·주소는 가려도 괜찮아.",
      "이미 눌렀어도 괜찮아. 하나씩 같이 챙기자."
    ]);
  }

  // 1) 누르기 전 — 택배 문자
  function flowParcelPreview() {
    clearPending();
    var block = addBot([
      "누르기 전에 같이 보자. 이름이나 주소는 가리고, 문자에 뭐라고 적혀 있는지만 보여줄래?",
      dim("문구를 그대로 붙여넣어도 돼.")
    ]);
    choices(block, [
      { label: "오늘 안에 주소를 고치래", value: "urgent" },
      { label: "사실 이미 눌렀어...", value: "clicked" }
    ], function (v) {
      if (v === "clicked") flowClicked();
      else flowAddressUrgent();
    });
  }

  function flowAddressUrgent() {
    clearPending();
    var block = addBot([
      "오늘 안에 주소를 고치라며 링크로 재촉하는 점이 수상해. 이 문구만으로는 누가 보냈는지 확실히 알기 어려워."
    ]);
    block.appendChild(riskCard(
      "위험",
      "재촉 + 배송 주소 변경 요구",
      [
        "‘오늘 안에’처럼 재촉하는 문구로 판단할 시간을 줄이려 해.",
        "주소를 고치라며 링크를 누르게 만드는 건 대표적인 스미싱 수법이야."
      ],
      "주문한 쇼핑 앱을 직접 열어서 배송 상태를 확인해 보자. 링크는 누르지 말고, 진짜인지 궁금하면 그 앱 안에서 확인하면 돼."
    ));
    choices(block, [
      { label: "그 링크 눌렀어", value: "clicked" },
      { label: "안 눌렀어", value: "safe" }
    ], function (v) {
      if (v === "clicked") flowClicked();
      else {
        addBot([
          "좋아. 그 문자는 지우지 말고 열지만 마. 118이나 경찰에 신고할 때 증거가 되니까. 같은 문자가 또 오면 그때도 열지 말아 줘.",
          "배송이 궁금하면 쇼핑 앱을 직접 열어서 보면 돼. 혹시 다른 문자도 이상하면 여기 붙여넣어 줘."
        ]);
      }
    });
  }

  // 2) 이미 눌렀을 때 — 있었던 일 고르기
  function flowClicked(prefix) {
    clearPending();
    var block = addBot([
      (prefix || "") + "말해줘서 고마워. 아직 그 화면이 열려 있으면 닫아도 돼. 그다음에 있었던 일을 골라줄래?",
      dim("여러 개 골라도 돼. 비밀번호나 인증번호는 적지 않아도 돼.")
    ]);
    multiSelect(block, ["화면만 봤어", "뭔가 입력했어", "파일을 받았어", "앱을 설치했어", "잘 모르겠어"], function (sel) {
      handleIncidents(sel);
    });
  }

  function handleIncidents(sel) {
    var has = function (k) { return sel.indexOf(k) !== -1; };
    var hasInput = has("뭔가 입력했어");
    var hasFile = has("파일을 받았어");
    var hasApp = has("앱을 설치했어");
    var onlyScreen = sel.length === 1 && has("화면만 봤어");
    var unknown = has("잘 모르겠어");

    state.caseHasInput = hasInput;

    if (hasApp) {
      state.pending = "device";
      var b = addBot(["앱을 설치했구나. 그럼 지금부터 하나씩 확인하자. 쓰는 폰이 아이폰이야, 갤럭시 같은 안드로이드폰이야?"]);
      state.reask = function () {
        var b2 = addBot([REASK_LEAD + "쓰는 폰이 아이폰이야, 갤럭시 같은 안드로이드폰이야?"]);
        choices(b2, [
          { label: "아이폰", value: "iphone" },
          { label: "안드로이드", value: "android" }
        ], function (kind) { answerDevice(kind, hasInput); });
      };
      choices(b, [
        { label: "아이폰", value: "iphone" },
        { label: "안드로이드", value: "android" }
      ], function (kind) { answerDevice(kind, hasInput); });
      return;
    }
    if (hasFile) {
      if (hasInput) return flowBoth();
      flowInstallQuestion(false);
      return;
    }
    if (hasInput) {
      flowInfoQuestion();
      return;
    }
    if (onlyScreen) {
      flowScreenOnly();
      return;
    }
    if (unknown) {
      flowRecallInput();
      return;
    }
    flowRecallInput();
  }

  // 3) 파일은 받았는데 설치했는지 — 한 번에 하나
  var Q_INSTALLED = "받은 파일은 다시 열지 말고, 아까 그 파일로 앱을 설치했는지만 알려줄래?";

  function askInstalled(alsoEnteredInfo) {
    var opts = [
      { label: "설치했어", value: "yes" },
      { label: "설치하지 않았어", value: "no" },
      { label: "잘 모르겠어", value: "unknown" }
    ];
    var pick = function (v) { answerInstall(v, alsoEnteredInfo); };
    state.pending = "installed";
    state.reask = function () {
      var b = addBot([REASK_LEAD + Q_INSTALLED]);
      choices(b, opts, pick);
    };
    var block = addBot([Q_INSTALLED]);
    choices(block, opts, pick);
  }

  function flowInstallQuestion(alsoEnteredInfo) {
    askInstalled(alsoEnteredInfo);
  }

  // 첫 공동 검수 케이스: 주소 입력 + 파일 수신을 함께 말했을 때
  function flowBoth() {
    state.caseHasInput = true;
    var opts = [
      { label: "설치했어", value: "yes" },
      { label: "설치하지 않았어", value: "no" },
      { label: "잘 모르겠어", value: "unknown" }
    ];
    var pick = function (v) { answerInstall(v, true); };
    var q = "말해줘서 고마워. 주소를 입력했고 파일도 받았구나. 주소는 여기 다시 적을 필요 없어. 받은 파일은 다시 열지 말고, 아까 그 파일로 앱을 설치했는지만 알려줄래?";
    state.pending = "installed";
    state.reask = function () {
      var b = addBot([REASK_LEAD + Q_INSTALLED]);
      choices(b, opts, pick);
    };
    var block = addBot([q]);
    choices(block, opts, pick);
  }

  function answerInstall(v, alsoEnteredInfo) {
    clearPending();
    if (v === "no") {
      var block = addBot([
        "그럼 방금 받은 설치 파일은 열지 말고 삭제해 줘 — 삭제는 네가 직접 눌러 줘. 파일은 남겨 둘 이유가 없어.",
        "대신 문자 자체는 지우지 말고 그대로 두자. 118이나 경찰에 신고할 때 증거가 되니까, 열지만 마."
      ]);
      if (alsoEnteredInfo) {
        flowInfoQuestion();
      } else {
        block.appendChild(riskNote("파일을 열지 않았다면 지금 할 일은 그거 하나야. 그래도 그 문자가 어디서 왔는지 이상하면 118에 물어봐 줘."));
        offerReport(block, state.moneyLikely);
      }
      return;
    }
    // 설치했어 / 잘 모르겠어 → 기종 확인
    state.pending = "device";
    state.reask = function () {
      var b2 = addBot([REASK_LEAD + "쓰는 폰이 아이폰이야, 갤럭시 같은 안드로이드폰이야?"]);
      choices(b2, [
        { label: "아이폰", value: "iphone" },
        { label: "안드로이드", value: "android" }
      ], function (kind) { answerDevice(kind, alsoEnteredInfo); });
    };
    var b = addBot(["쓰는 폰이 아이폰이야, 갤럭시 같은 안드로이드폰이야?"]);
    choices(b, [
      { label: "아이폰", value: "iphone" },
      { label: "안드로이드", value: "android" }
    ], function (kind) {
      answerDevice(kind, alsoEnteredInfo);
    });
  }

  function riskNote(text) {
    var p = document.createElement("p");
    p.className = "dim";
    p.textContent = text;
    return p;
  }

  // 4) 기종별 확인·대처 — 한 번에 한 단계씩, 확인받고 다음으로
  var DEVICE_STEPS = {
    iphone: [
      {
        text: "**설정 → 일반 → VPN 및 기기 관리**를 열어서, 낯선 프로파일이 등록돼 있는지 봐 줘. 있으면 ‘프로파일 제거’를 네가 직접 눌러 줘.",
        hint: "설정 앱 → 맨 위 이름 → 일반 → 아래쪽 ‘VPN 및 기기 관리’에 있어. 거기 낯선 이름이 보이면 그걸 눌러 ‘프로파일 제거’를 골라 줘. 폰마다 메뉴 이름이 조금 다를 수 있어."
      },
      {
        text: "**설정 → 일반 → iPhone 저장 공간**에서, 오늘 새로 깔린 낯선 앱이 있는지 봐 줘. 있으면 삭제는 네가 직접 눌러 줘.",
        hint: "설정 → 일반 → iPhone 저장 공간으로 들어가면 앱 목록이 나와. 오늘 날짜로 새로 생긴 이름이 있으면 그걸 눌러 ‘앱 삭제’를 골라 줘. 폰마다 메뉴 이름이 조금 다를 수 있어."
      },
      {
        text: "**파일** 앱 → **최근 항목**에서 방금 받은 파일을 찾아, 열지 말고 길게 눌러서 삭제해 줘. 설치 파일은 남겨 둘 이유가 없어.",
        hint: "홈 화면의 ‘파일’ 앱을 열고 아래 ‘최근 항목’을 눌러 봐. 방금 받은 파일이 맨 위에 있을 거야. 폰마다 메뉴 이름이 조금 다를 수 있어."
      }
    ],
    android: [
      {
        text: "먼저 **와이파이와 모바일 데이터를 잠깐 꺼 줘.** 출처를 모르는 앱이 밖으로 뭔가 보내는 걸 막는 거야. 폰마다 메뉴 이름이 조금 다를 수 있어.",
        hint: "화면 맨 위를 아래로 쓸어내리면 와이파이·모바일 데이터 버튼이 보여. 둘 다 눌러서 끄면 돼. 폰마다 메뉴 이름이 조금 다를 수 있어."
      },
      {
        text: "**설정 → 앱**(또는 ‘애플리케이션’)에서, 오늘 새로 깔린 낯선 앱이 있는지 봐 줘. 있으면 삭제는 네가 직접 눌러 줘.",
        hint: "설정 → 앱(애플리케이션)으로 들어가서 정렬을 ‘최근 설치’로 바꾸거나 ‘최근에 연 앱’을 보면 오늘 깔린 게 보여. 폰마다 메뉴 이름이 조금 다를 수 있어."
      },
      {
        text: "**내 파일 → 다운로드**에서 방금 받은 파일을 찾아, 열지 말고 삭제해 줘. 설치 파일은 남겨 둘 이유가 없어.",
        hint: "‘내 파일’(또는 ‘파일 관리자’) 앱 → 다운로드 폴더에 방금 받은 파일이 있어. 폰마다 메뉴 이름이 조금 다를 수 있어."
      },
      {
        text: "마지막으로 **설정 → 보안 → 알 수 없는 앱 설치**(또는 ‘출처를 알 수 없는 앱’)에서, 허용돼 있는 앱이 있는지 봐 줘. 낯선 앱이 켜져 있으면 꺼 줘.",
        hint: "설정 → 보안 → 알 수 없는 앱 설치에 들어가면 앱 목록이 나와. 낯선 이름이 켜져 있으면 그 앱을 눌러 허용을 꺼 줘. 폰마다 메뉴 이름이 조금 다를 수 있어."
      }
    ]
  };

  function answerDevice(kind, alsoEnteredInfo) {
    var steps = DEVICE_STEPS[kind] || DEVICE_STEPS.android;
    var i = 0;

    function label() {
      return i === steps.length - 1 ? "다 확인했어" : "확인했어, 다음";
    }

    function stepButtons(block, onOk) {
      choices(block, [
        { label: label(), value: "ok" },
        { label: "어디 있는지 모르겠어", value: "hint" }
      ], function (v) {
        if (v === "hint") return showHint();
        onOk();
      });
    }

    function advance() {
      if (i >= steps.length - 1) {
        clearPending();
        if (alsoEnteredInfo) {
          flowInfoQuestion("단계마다 확인해 줘서 고마워. 이제 처음에 말한 **주소 입력 건**을 챙기자.");
        } else {
          var endBlock = addBot([CLOSING]);
          offerReport(endBlock, state.moneyLikely);
        }
        return;
      }
      i++;
      showStep("좋아, 다음은 이거야.");
    }

    function showHint() {
      var b = addBot([steps[i].hint]);
      state.pending = "steps";
      state.stepNext = advance;
      state.stepHint = showHint;
      stepButtons(b, advance);
    }

    function showStep(head) {
      var block = addBot([
        head + " (" + (i + 1) + "/" + steps.length + ")",
        steps[i].text
      ]);
      state.pending = "steps";
      state.stepNext = advance;
      state.stepHint = showHint;
      state.reask = function () {
        var b = addBot(["아까 단계부터 볼까? (" + (i + 1) + "/" + steps.length + ")", steps[i].text]);
        state.pending = "steps";
        state.stepNext = advance;
        state.stepHint = showHint;
        stepButtons(b, advance);
      };
      stepButtons(block, advance);
    }

    showStep(kind === "iphone"
      ? "아이폰이구나. 하나씩 같이 하자. 지금은 이것만 하면 돼."
      : "안드로이드구나. 하나씩 같이 하자. 지금은 이것만 하면 돼.");
  }

  // 5) 입력한 정보 확인 → 마무리
  var Q_INFO = "이제 아까 입력했다는 정보 쪽도 챙기자. 혹시 이름·주소만 적었어, 아니면 카드번호·비밀번호 같은 것도 적었어?";

  function flowInfoQuestion(lead) {
    var opts = [
      { label: "이름·주소만", value: "addr" },
      { label: "카드번호·비밀번호도", value: "secret" },
      { label: "잘 모르겠어", value: "unknown" }
    ];
    var pick = function (v) { answerInfo(v); };
    state.pending = "info";
    state.reask = function () {
      var b = addBot([REASK_LEAD + Q_INFO]);
      choices(b, opts, pick);
    };
    var paras = [];
    if (lead) paras.push(lead);
    paras.push(Q_INFO);
    var block = addBot(paras);
    choices(block, opts, pick);
    return block;
  }

  function answerInfo(v) {
    clearPending();
    if (v === "secret") {
      state.moneyLikely = true;
      var secretBlock = addBot([
        "그건 꼭 챙겨야 해. 지금 쓰는 폰 말고 **다른 기기**에서 그 사이트 비밀번호부터 바꿔 줘. 같은 비밀번호를 쓴 다른 사이트도 같이 바꾸고, 카드사 앱에서 결제 알림을 켜 줘.",
        "결제가 이미 찍혔다면 카드사 고객센터에 바로 전화해 줘. 문자에 있던 링크는 다시 열지 말고, 필요하면 112(경찰)나 KISA 118에 신고하면 돼.",
        CLOSING
      ]);
      offerReport(secretBlock, true);
      return;
    }
    if (v === "addr") {
      var addrBlock = addBot([
        "그럼 지금 할 일은 두 가지야. 하나, 그 문자는 지우지 말고 열지도 말기 — 118이나 경찰에 신고할 때 증거가 돼. 둘, 며칠 안에 ‘주소 오류’나 ‘배송 보류’ 같은 문자가 또 올 수 있으니, 오면 열지 말고 118에 전달해 주기.",
        "이름·주소만으로 바로 결제가 되지는 않지만, 다른 곳과 조합되면 쓰일 수 있어. 그래서 같은 문자가 또 오면 그때도 나한테 보여 줘.",
        CLOSING
      ]);
      offerReport(addrBlock, state.moneyLikely);
      return;
    }
    var unknownBlock = addBot([
      "괜찮아, 기억 안 나도 돼. 그럼 더 조심하는 쪽으로 해 두자.",
      "다른 기기에서 그 사이트 비밀번호를 바꾸고, 카드사 앱에서 결제 알림을 켜 줘. 그리고 그 문자는 지우지 말고 그대로 두고 118에 신고해 줘 — 신고할 때 증거가 돼.",
      CLOSING
    ]);
    offerReport(unknownBlock, state.moneyLikely);
  }

  function flowScreenOnly() {
    clearPending();
    addBot([
      "그것만이면 지금 할 일은 하나야. 그 문자는 지우지 말고, 다시 오면 열지 말아 줘. 118이나 경찰에 신고할 때 증거가 되니까.",
      "혹시 그 화면에서 내려받으라는 창이나 ‘설치’ 버튼이 떴다면 알려 줘. 뭔가 달라지는 게 보이면 바로 말해 줘."
    ]);
  }

  function flowRecallInput() {
    var opts = [
      { label: "있었어", value: "yes" },
      { label: "없었어", value: "no" },
      { label: "기억 안 나", value: "unknown" }
    ];
    var q = "괜찮아, 기억 안 나도 돼. 하나씩 짚어 보자. 그 화면에서 글자를 적는 칸은 있었어?";
    state.pending = "recall_input";
    state.reask = function () {
      var b = addBot([REASK_LEAD + q]);
      choices(b, opts, function (v) {
        if (v === "yes") { state.caseHasInput = true; flowInfoQuestion(); return; }
        flowRecallFileStage();
      });
    };
    var block = addBot([q]);
    choices(block, opts, function (v) {
      if (v === "yes") { state.caseHasInput = true; flowInfoQuestion(); return; }
      flowRecallFileStage();
    });
  }

  // 6) 의심 문구 판별
  function flowTextVerdict(text, saved) {
    clearPending();
    var a = analyze(text);
    var block = addBot([
      "붙여넣어 준 문구를 같이 볼게. 이름·주소 같은 건 이미 가렸다고 생각하고 볼 테니 괜찮아."
    ]);
    block.appendChild(riskCard(a.level, a.title, a.reasons, GUIDE_OFFICIAL));
    choices(block, [
      { label: "그 링크 눌렀어", value: "clicked" },
      { label: "안 눌렀어", value: "safe" }
    ], function (v) {
      if (v === "clicked") flowClicked();
      else {
        addBot([
          "좋아. 그 문자는 지우지 말고 열지만 마. 118이나 경찰에 신고할 때 증거가 되니까.",
          "같은 문자가 또 오면 그때도 열지 말아 줘. 진짜 배송이나 결제가 궁금하면 공식 앱을 직접 열어서 확인하면 돼."
        ]);
      }
    });
    resumeOffer(block, saved);
  }

  /* ───────────────────────── 신고 안내 ───────────────────────── */

  /* 실제 신고 접수는 하지 않는다. 번호 안내와 tel: 연결까지만. */
  var REPORT_NUMBERS = [
    {
      num: "118",
      tel: "tel:118",
      org: "한국인터넷진흥원(KISA)",
      what: "스미싱 문자·해킹·개인정보 피해 신고"
    },
    {
      num: "112",
      tel: "tel:112",
      org: "경찰",
      what: "돈을 보냈거나 협박·협의를 받았을 때"
    },
    {
      num: "1332",
      tel: "tel:1332",
      org: "금융감독원 금융상담센터",
      what: "계좌이체·카드 결제 피해 상담, 지급정지 문의"
    }
  ];

  function reportCard(money) {
    var box = document.createElement("div");
    box.className = "report";

    var head = document.createElement("div");
    head.className = "report-head";
    head.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 8.2v4.2M12 15.4v.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
    var title = document.createElement("span");
    title.className = "report-title";
    title.textContent = "신고 번호";
    head.appendChild(title);
    box.appendChild(head);

    var note = document.createElement("p");
    note.className = "report-note";
    note.innerHTML = fmt("나는 기관에 **직접 신고를 접수할 수는 없어.** 번호로 전화를 연결해 주는 데까지만 도와줄 수 있어.");
    box.appendChild(note);

    var list = document.createElement("ul");
    list.className = "report-list";
    var items = money
      ? [REPORT_NUMBERS[2], REPORT_NUMBERS[1], REPORT_NUMBERS[0]]
      : REPORT_NUMBERS;

    items.forEach(function (r) {
      var li = document.createElement("li");
      li.className = "report-item";

      var a = document.createElement("a");
      a.className = "report-tel";
      a.href = r.tel;
      a.setAttribute("aria-label", r.num + " " + r.org + "로 전화 걸기");
      var num = document.createElement("b");
      num.textContent = r.num;
      var conn = document.createElement("span");
      conn.textContent = "통화 연결";
      a.appendChild(num);
      a.appendChild(conn);

      var tx = document.createElement("div");
      tx.className = "report-text";
      var org = document.createElement("div");
      org.className = "report-org";
      var orgName = document.createElement("span");
      orgName.textContent = r.org;
      org.appendChild(orgName);
      if (money && r.num === "1332") {
        var first = document.createElement("span");
        first.className = "report-first";
        first.textContent = "먼저";
        org.appendChild(first);
      }
      var desc = document.createElement("div");
      desc.className = "report-desc";
      desc.textContent = r.what;

      tx.appendChild(org);
      tx.appendChild(desc);
      li.appendChild(a);
      li.appendChild(tx);
      list.appendChild(li);
    });
    box.appendChild(list);

    var foot = document.createElement("p");
    foot.className = "report-foot";
    foot.textContent = "컴퓨터에서는 전화 앱이 안 열릴 수 있어. 그럴 땐 화면에 보이는 숫자를 그대로 걸면 돼.";
    box.appendChild(foot);

    return box;
  }

  /* 신고 전에 챙길 것 — 한 번에 하나씩 */
  var REPORT_STEPS = [
    {
      text: "먼저 **문자·링크 화면을 캐처**해 둬. 링크 주소가 같이 보이게 찍으면 좋아.",
      hint: "아이폰은 옆면 버튼과 볼륨 올림 버튼을 같이 누르면 찍혀. 안드로이드는 전원 버튼과 볼륨 내림 버튼을 같이 누르면 돼. 폰마다 조금 다를 수 있어."
    },
    {
      text: "그 문자는 **지우지 말고 그대로** 둬. 신고할 때 증거가 돼. 열지만 마.",
      hint: "지우면 신고할 때 보여 줄 게 없어져. 그대로 두고, 문자를 열어서 링크를 누르지는 말자."
    },
    {
      text: "돈을 보냈거나 카드로 결제됐으면, **은행·카드사 고객센터에 먼저 전화해서 지급정지**를 부탁해 줘. 1332(금융감독원)에서도 같이 안내받을 수 있어.",
      hint: "카드 뒷면이나 은행 앱에 적힌 고객센터 번호로 걸면 돼. 지급정지는 빠를수록 좋으니 오늘 이체했으면 이것부터 해 줘."
    },
    {
      text: "신고하고 나면 **접수번호(처리번호)를 메모**해 둬. 나중에 진행 상황을 물어볼 때 필요해.",
      hint: "전화로 신고하면 담당자가 번호를 불러 줘. 문자로도 올 수 있으니 그 문자는 지우지 말고 두자."
    }
  ];

  function reportPrep(startNote) {
    var i = 0;

    function label() {
      return i === REPORT_STEPS.length - 1 ? "다 챙겼어" : "확인했어, 다음";
    }

    function finish() {
      clearPending();
      var block = addBot([
        "여기까지면 신고 준비는 끝이야. 급하게 하지 않아도 돼. 하고 싶을 때 하면 되고, 그전에 뭐가 궁금하면 또 물어봐 줘.",
        dim("번호는 위쪽 **신고 안내**에서 언제든 다시 볼 수 있어.")
      ]);
      choices(block, [
        { label: "번호 다시 볼래", value: "numbers" },
        { label: "이제 괜찮아", value: "done" }
      ], function (v) {
        if (v === "numbers") openSheet();
        else addBot(["응. 다른 문자도 이상하면 언제든 불러 줘."]);
      });
    }

    function advance() {
      if (i >= REPORT_STEPS.length - 1) return finish();
      i++;
      show("좋아, 다음은 이거야.");
    }

    function showHint() {
      var b = addBot([REPORT_STEPS[i].hint]);
      state.pending = "report";
      state.stepNext = advance;
      state.stepHint = showHint;
      stepButtons(b);
    }

    function stepButtons(block) {
      choices(block, [
        { label: label(), value: "ok" },
        { label: "어떻게 하는 거야", value: "hint" }
      ], function (v) {
        if (v === "hint") return showHint();
        advance();
      });
    }

    function show(head) {
      var block = addBot([
        head + " (" + (i + 1) + "/" + REPORT_STEPS.length + ")",
        REPORT_STEPS[i].text
      ]);
      state.pending = "report";
      state.stepNext = advance;
      state.stepHint = showHint;
      state.reask = function () {
        var b = addBot(["아까 단계부터 볼까? (" + (i + 1) + "/" + REPORT_STEPS.length + ")", REPORT_STEPS[i].text]);
        state.pending = "report";
        state.stepNext = advance;
        state.stepHint = showHint;
        stepButtons(b);
      };
      stepButtons(block);
    }

    show(startNote || "신고 전에 챙길 것부터 하나씩 볼게. 다 안 해도 되고, 순서만 알아 두자.");
  }

  /* 대화 중 신고를 권하는 자리 */
  function showReport(lead, money) {
    clearPending();
    var block = addBot([
      lead || "신고까지 챙길까? 지금 바로 할 필요는 없어. 피해가 있었으면 이 번호로 연결해 줄게.",
      dim("자동으로 신고되는 건 아니야. 버튼을 누르면 네 폰의 전화 앱에 번호가 열려.")
    ]);
    block.appendChild(reportCard(!!money));
    choices(block, [
      { label: "신고 전에 챙길 것 볼게", value: "prep" },
      { label: "지금은 괜찮아", value: "later" }
    ], function (v) {
      if (v === "prep") return reportPrep();
      addBot(["응. 나중에 필요하면 위쪽 **신고 안내**에서 언제든 다시 볼 수 있어."]);
    });
  }

  /* 마무리 인사에 살짝 붙이는 신고 제안 */
  function offerReport(block, money) {
    if (!block) return;
    var p = document.createElement("p");
    p.className = "dim";
    p.textContent = "원하면 신고까지 챙길게. 지금 바로 안 해도 돼.";
    block.appendChild(p);
    choices(block, [
      { label: "신고 안내 볼게", value: "report" },
      { label: "지금은 괜찮아", value: "later" }
    ], function (v) {
      if (v === "report") {
        return showReport("좋아. 아래 번호로 연결돼. 지금 걸지 않아도 되고, 필요할 때 누르면 돼.", money);
      }
      addBot(["응, 알겠어. 나중에 필요하면 위쪽 **신고 안내**에서 언제든 볼 수 있어."]);
    });
  }

  /* 헤더의 ‘신고 안내’ 시트 */
  function openSheet() {
    if (!sheet || !sheetBody) return;
    sheetBody.innerHTML = "";

    var lead = document.createElement("p");
    lead.className = "sheet-lead";
    lead.innerHTML = fmt("지금 바로 신고할 필요는 없어. 피해가 있었으면 이 번호로 연결해 줄게. 나는 기관에 직접 신고를 접수하지는 못하고, **전화 연결까지만** 도와줄 수 있어.");
    sheetBody.appendChild(lead);
    sheetBody.appendChild(reportCard(state.moneyLikely));

    var acts = document.createElement("div");
    acts.className = "sheet-actions";

    var b1 = document.createElement("button");
    b1.type = "button";
    b1.className = "choice primary";
    b1.textContent = "신고 전에 챙길 것 볼게";
    b1.addEventListener("click", function () {
      closeSheet();
      reportPrep();
    });

    var b2 = document.createElement("button");
    b2.type = "button";
    b2.className = "choice";
    b2.textContent = "닫기";
    b2.addEventListener("click", closeSheet);

    acts.appendChild(b1);
    acts.appendChild(b2);
    sheetBody.appendChild(acts);

    sheet.hidden = false;
    if (reportBtn) reportBtn.setAttribute("aria-expanded", "true");
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.hidden = true;
    if (reportBtn) reportBtn.setAttribute("aria-expanded", "false");
  }

  /* ───────────────────────── 입력 해석 ───────────────────────── */

  var NOT_DONE = /(안\s*(눌렀|클릭|열었|입력|적었|받았|했)|않았|없었|못\s*받)/;

  function isClickedIntent(t) {
    return /(눌렀|클릭했|열었|들어갔|접속했)/.test(t);
  }
  function hasInputWord(t) {
    return /(입력|적었|적은|썼|넣었|기재)/.test(t);
  }
  function hasFileWord(t) {
    return /(파일|첨부|다운로드|다운\s*받|apk|문서)/i.test(t);
  }

  function respond(raw) {
    var t = raw.trim();
    var c = comfort(t);

    /* 돈이 오간 사건이면 신고 번호에서 1332를 먼저 보여 준다 */
    if (/(이체|송금|입금|결제|카드값|대출|상품권|돈을\s*보냈)/.test(t)) state.moneyLikely = true;

    /* 대기 중인 질문이 있어도, 새 문자·링크를 붙여넣으면 그 문자의 판별을 먼저 한다.
       판별이 끝나면 접어 둔 질문으로 돌아갈 버튼을 함께 보여 준다. */
    if (state.pending && looksLikeNewLetter(t)) {
      var saved = suspendPending();
      addBot(["새로 보여 준 문자부터 볼게. 아까 하던 이야기는 판별이 끝나면 아래 버튼으로 이어 갈 수 있어."]);
      return flowTextVerdict(t, saved);
    }

    /* 기종별 안내 단계를 기다리는 중 */
    if (state.pending === "steps") {
      if (/(모르|어디|못\s*찾|어떻게)/.test(t) && state.stepHint) return state.stepHint();
      if (/(다\s*확인|확인\s*했|확인\s*완료|다음|완료|했어|했음|응|네|ㅇㅇ)/.test(t) && state.stepNext) return state.stepNext();
      return reaskPending();
    }

    /* 신고 전에 챙길 것 안내를 기다리는 중 */
    if (state.pending === "report") {
      if (/(어떻게|모르|못\s*찾|어디)/.test(t) && state.stepHint) return state.stepHint();
      if (/(다\s*챙겼|확인\s*했|다음|완료|했어|했음|응|네|ㅇㅇ)/.test(t) && state.stepNext) return state.stepNext();
      return reaskPending();
    }

    /* 대기 중인 질문의 답을 먼저 받는다 */
    if (state.pending === "installed") {
      if (/(설치하지\s*않|설치\s*안|안\s*설치|안\s*깔|안\s*했)/.test(t)) return answerInstall("no", state.caseHasInput);
      if (/(설치했|깔았|설치\s*함|설치\s*했어)/.test(t)) return answerInstall("yes", state.caseHasInput);
      if (/(모르|글쎄|기억\s*안)/.test(t)) return answerInstall("unknown", state.caseHasInput);
      return reaskPending();
    }

    if (state.pending === "device") {
      if (/(아이폰|아이\s*폰|iphone)/i.test(t)) return answerDevice("iphone", state.caseHasInput);
      if (/(안드로이드|갤럭시|갤럭시폰|android|삼성)/i.test(t)) return answerDevice("android", state.caseHasInput);
      return reaskPending();
    }

    if (state.pending === "info") {
      if (/(카드|비번|비밀번호|주민|계좌|인증|otp)/i.test(t)) return answerInfo("secret");
      if (/(이름|주소|성함)/.test(t)) return answerInfo("addr");
      if (/(모르|기억\s*안|글쎄)/.test(t)) return answerInfo("unknown");
      return reaskPending();
    }

    if (state.pending === "recall_input") {
      if (/(모르|기억\s*안|글쎄)/.test(t)) { clearPending(); return flowRecallFileStage(); }
      if (/(없|아니)/.test(t)) { clearPending(); return flowRecallFileStage(); }
      if (/(있었|있어|응|네)/.test(t)) { state.caseHasInput = true; clearPending(); return flowInfoQuestion(); }
      return reaskPending();
    }

    if (state.pending === "recall_file") {
      if (/(있었|있어|응|네)/.test(t)) { clearPending(); return flowInstallQuestion(true); }
      if (/(없|아니|모르)/.test(t)) {
        clearPending();
        return addBot([
          UNKNOWN_CLOSING,
          "이 문자는 118에 신고해 줘. 여기까지 하면 내가 봐 줄 수 있는 건 다 챙긴 거야."
        ]);
      }
      return reaskPending();
    }

    /* 첫 공동 검수 케이스: 주소 입력 + 파일 수신 */
    if (hasInputWord(t) && hasFileWord(t) && !NOT_DONE.test(t)) {
      return flowBoth();
    }

    /* 이미 눌렀다는 말 */
    if (isClickedIntent(t) && !NOT_DONE.test(t)) {
      return flowClicked(c);
    }

    /* 신고 안내를 찾을 때 */
    if (/(신고|118|112|1332)/.test(t) && !looksLikeNewLetter(t)) {
      return showReport(null, state.moneyLikely);
    }

    /* 누르기 전 — 눌러도 되는지 묻는 말 */
    if (/(눌러도|눌러\s*될까|눌러도\s*괜찮|열어도|클릭해도)/.test(t)) {
      return flowParcelPreview();
    }

    /* 파일을 받았다는 말만 */
    if (hasFileWord(t) && /(받았|왔|있)/.test(t) && !hasInputWord(t) && !NOT_DONE.test(t)) {
      state.caseHasInput = false;
      return flowInstallQuestion(false);
    }

    /* 그 밖의 문구는 판별 */
    if (t.length >= 2) {
      if (c) {
        var b = addBot([c + "같이 볼게. 붙여넣어 준 문구를 하나씩 읽어 볼게."]);
        var a = analyze(t);
        b.appendChild(riskCard(a.level, a.title, a.reasons, GUIDE_OFFICIAL));
        return;
      }
      return flowTextVerdict(t);
    }

    addBot([
      "응, 나 여기 있어. 수상한 문자나 링크가 왔으면 내용을 붙여넣어 줘. 이름·주소는 가려도 돼.",
      "아래 버튼에서 골라도 되고, 그냥 상황을 말해 줘도 돼."
    ]);
  }

  function flowRecallFileStage() {
    var opts = [
      { label: "있었어", value: "yes" },
      { label: "없었어", value: "no" },
      { label: "기억 안 나", value: "unknown" }
    ];
    var q = "그럼 파일을 받으라는 창이나 ‘설치’ 버튼은 있었어?";
    var pick = function (v2) {
      if (v2 === "yes") { clearPending(); flowInstallQuestion(true); return; }
      clearPending();
      addBot([
        UNKNOWN_CLOSING,
        "이 문자는 118에 신고해 줘. 여기까지 하면 내가 봐 줄 수 있는 건 다 챙긴 거야."
      ]);
    };
    state.pending = "recall_file";
    state.reask = function () {
      var b = addBot([REASK_LEAD + q]);
      choices(b, opts, pick);
    };
    var b2 = addBot([q]);
    choices(b2, opts, pick);
  }

  /* ───────────────────────── 연결 ───────────────────────── */

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 118) + "px";
  }

  function send(text) {
    var t = (text != null ? text : input.value).trim();
    if (!t) return;
    if (text == null) {
      input.value = "";
      autoGrow();
    }
    addUser(t);
    respond(t);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener("input", autoGrow);

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      clearPending();
      send(chip.textContent.trim());
    });
  });

  resetBtn.addEventListener("click", function () {
    chat.innerHTML = "";
    clearPending();
    state.caseHasInput = false;
    state.moneyLikely = false;
    input.value = "";
    autoGrow();
    closeSheet();
    flowGreet();
  });

  if (reportBtn) {
    reportBtn.addEventListener("click", function () {
      if (sheet && !sheet.hidden) closeSheet();
      else openSheet();
    });
  }

  if (sheet) {
    Array.prototype.forEach.call(sheet.querySelectorAll("[data-close]"), function (el) {
      el.addEventListener("click", closeSheet);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !sheet.hidden) closeSheet();
    });
  }

  flowGreet();
  autoGrow();
})();
