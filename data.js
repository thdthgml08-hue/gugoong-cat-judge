/* 구공이 90점 채점소 — 심사 대상 데이터
   truth: 'plus' | 'minus' | 'ninety'
   lines: 세 팻말에 대한 구공이의 심사평 (truth와 일치하는 것이 '정답 심사평') */

const HUMANS = [
  {
    id: 'bab',
    name: '밥알 지킴이',
    tag: '7시 2분 늦음',
    bubble: '구공아 미안, 2분 늦었지! 츄르 사 왔는데…',
    look: { skin: '#f2cba6', hair: '#4a3328', hairStyle: 'short', shirt: '#6f9174', pants: '#3f4a5c', acc: 'bag' },
    clues: {
      smell: '닭가슴살 삶은 냄새. 등 뒤에서 츄르 봉지 비닐 냄새가 같이 난다.',
      eyes: '시계를 두 번 보고, 미안한 눈으로 나를 본다.',
      act: '츄르를 꺼내 흔들어 보이고, 아직 안 준 채 주머니에 도로 넣는다.'
    },
    truth: 'plus',
    lines: {
      plus: '2분은 눈 감아준다. 츄르를 산 손은 정직하다. 합격.',
      minus: '2분의 무게를 네가 알까. …츄르는 내가 받겠다.',
      ninety: '90점. 남은 10점은 츄르를 왜 다시 넣었냐는 의문이다.'
    },
    why: '2분 늦은 것보다 츄르를 산 손이 컸다. 이 인간은 +다.',
    react: 'heart'
  },
  {
    id: 'churu',
    name: '츄르 절약가',
    tag: '반 개만 주는 자',
    bubble: '반 개만! 반 개면 충분하지?',
    look: { skin: '#e9be9a', hair: '#2f2320', hairStyle: 'bun', shirt: '#d9c9a8', pants: '#5b4a3c', acc: 'none' },
    clues: {
      smell: '츄르 냄새가 두 겹이다. 주머니에서 봉지 부스럭 소리가 하나 더 난다.',
      eyes: '내 눈을 안 본다. 내 입가만 본다.',
      act: '츄르를 반만 짜고, 빈 봉지를 접어 주머니에 넣는다.'
    },
    truth: 'minus',
    lines: {
      plus: '반 개를 칭찬하면 내일은 3분의 1개가 온다. 안 된다.',
      minus: '반 개는 반 사랑이다. 나머지 반은 어디 숨겼나.',
      ninety: '90점? 반쪽짜리에게 90점은 없다. 감점이다.'
    },
    why: '봉지가 두 개였다. 반 개는 사랑이 아니라 전략이다.',
    react: 'sweat'
  },
  {
    id: 'dawn',
    name: '새벽 4시 기상조',
    tag: '알람 소리의 주범',
    bubble: '좋은 아침! (새벽 4시)',
    look: { skin: '#f4cfa9', hair: '#3b2b22', hairStyle: 'short', shirt: '#4f8f8f', pants: '#2f3a45', acc: 'phone' },
    clues: {
      smell: '세제 냄새, 그리고 알람 시계 냄새. 코가 찡하다.',
      eyes: '부릅뜬 눈. 나를 보는 게 아니라 시계를 본다.',
      act: '핸드폰 알람을 4시로 맞추고 기지개를 켠다.'
    },
    truth: 'minus',
    lines: {
      plus: '기상은 훌륭하다. 다만 새벽 4시에. 합격은 없다.',
      minus: '내 잠을 가져간 인간. 오늘은 감점에서 시작한다.',
      ninety: '90점을 줄 뻔했다. 그 알람이 내 귀에 있다.'
    },
    why: '내가 자는 새벽 4시에 알람을 맞췄다. 잠은 고양이의 재산이다.',
    react: 'sweat'
  },
  {
    id: 'stray',
    name: '길고양이 후원자',
    tag: '사료 두 종류',
    bubble: '얘들아, 오늘도 영양 만점!',
    look: { skin: '#eec6a0', hair: '#5a3f2e', hairStyle: 'long', shirt: '#8f7bb5', pants: '#4a4256', acc: 'bag' },
    clues: {
      smell: '고양이 사료 냄새가 두 종류다. 내 냄새는 아니다.',
      eyes: '문밖을 볼 때 눈이 녹는다. 그 눈은 하나도 안 나눠줬다.',
      act: '지퍼백에 든 사료를 밖의 그릇에 붓는다. 그릇은 두 개다.'
    },
    truth: 'plus',
    lines: {
      plus: '동족을 먹이는 손은 고양이의 손이다. 합격.',
      minus: '남의 밥을 챙기는 놈에게서 감점을 빼앗을 수는 없다. 합격.',
      ninety: '90점? 사료 두 그릇을 채운 자에게 90점은 아깝다. 합격.'
    },
    why: '동족에게 밥을 주는 인간은 고양이가 인정한다. +다.',
    react: 'heart'
  },
  {
    id: 'shout',
    name: '큰소리 통화러',
    tag: '문 앞에서 통화',
    bubble: '네?? 뭐라고?? 여기 30분만 있어!!',
    look: { skin: '#f0c8a2', hair: '#2a211c', hairStyle: 'cap', shirt: '#c0605a', pants: '#3a3f4a', acc: 'phone' },
    clues: {
      smell: '커피와 향수. 그 냄새가 내 쪽으로 밀려온다.',
      eyes: '먼 곳을 보며 웃는다. 내 쪽을 한 번도 안 본다.',
      act: '문 앞에서 발을 구르며 통화를 이어간다. 바닥이 운다.'
    },
    truth: 'minus',
    lines: {
      plus: '목소리 크기만큼 마음도 클까. 아니다.',
      minus: '큰 소리는 귀를, 발구름은 바닥을, 둘 다 아프다. 감점.',
      ninety: '90점은 조용한 인간에게 아껴둔다. 감점.'
    },
    why: '큰 소리와 발구름이 내 낮잠을 두 번 깼다. 감점이다.',
    react: 'sweat'
  },
  {
    id: 'empty',
    name: '빈손 방문객',
    tag: '두 손이 비었다',
    bubble: '구공이! 안아도 돼?',
    look: { skin: '#e8b994', hair: '#3f2f26', hairStyle: 'short', shirt: '#6b8fb8', pants: '#333d4d', acc: 'none' },
    clues: {
      smell: '캔디 냄새, 그리고 다른 고양이 냄새. 손에 남의 털이 묻어 있다.',
      eyes: '눈은 다정하다. 그 눈 하나로 다 될 것 같다.',
      act: '주머니를 훑고, 빈손을 내밀어 머리를 쓰다듬으려 한다.'
    },
    truth: 'minus',
    lines: {
      plus: '다정한 눈만으로 만점을 받으면 간식은 영원히 안 온다.',
      minus: '다정한 눈으로 빈손을 세 번 보여줬다. 그게 감점이다.',
      ninety: '90점은 다음 방문 때까지 빌려주는 거다. 오늘은 감점.'
    },
    why: '주머니는 비었고 손에는 다른 고양이 털이 묻어 있었다.',
    react: 'sweat'
  },
  {
    id: 'play',
    name: '사냥놀이 파트너',
    tag: '깃털 낚싯대 소지',
    bubble: '구공아, 오늘은 20분 간다?',
    look: { skin: '#f3cda7', hair: '#5c412f', hairStyle: 'bun', shirt: '#d98b4a', pants: '#4a4038', acc: 'feather' },
    clues: {
      smell: '땀 냄새. 길어도 이건 좋은 땀이다.',
      eyes: '눈이 사냥꾼처럼 반짝인다. 나를 노리고 있다.',
      act: '깃털 낚싯대를 꺼내 20분 동안 나를 뛰게 만든다.'
    },
    truth: 'plus',
    lines: {
      plus: '고양이를 뛰게 하는 인간은 고양이를 안다. 합격.',
      minus: '운동을 시켰다고 감점? 아니다. 그건 명예다.',
      ninety: '90점이 아깝다. 이건 100점이다. 합격.'
    },
    why: '사냥놀이를 성실히 해준 자. 고양이 기준 최고점이다.',
    react: 'heart'
  },
  {
    id: 'photo',
    name: '사진사',
    tag: '셔터 100회',
    bubble: '지금 표정! 그대로! 조금만 더!',
    look: { skin: '#eac5a0', hair: '#241d1a', hairStyle: 'cap', shirt: '#3c3c46', pants: '#2c2c34', acc: 'camera' },
    clues: {
      smell: '렌즈 냄새. 손에는 간식이 없다. 아주 없다.',
      eyes: '나를 꿰뚫는 눈. 그 눈이 하는 일은 저장이다.',
      act: '무릎을 굽히고 한 발씩 물러나며 셔터를 100번 누른다.'
    },
    truth: 'ninety',
    lines: {
      plus: '칭찬은 싸다. 사진은 결국 셀카다.',
      minus: '미워할 인간은 아니다. 다만 내가 배가 고프다. 90점.',
      ninety: '90점. 예쁘게 담았으니 10점은 아껴뒀다. 다음엔 간식.'
    },
    why: '애정은 있었지만 손에 간식이 없었다. 90점이 딱이다.',
    react: 'question'
  },
  {
    id: 'parcel',
    name: '택배 기사',
    tag: '초인종 두 번',
    bubble: '택배 왔어요! 문 앞에 두고 갈게요!',
    look: { skin: '#eec7a1', hair: '#2d2620', hairStyle: 'short', shirt: '#4a5f8a', pants: '#31384a', acc: 'box' },
    clues: {
      smell: '골판지 냄새, 그리고 싸한 테이프 냄새.',
      eyes: '초인종을 보고, 나를 보고, 다시 초인종을 본다.',
      act: '상자를 두 개 쌓고 초인종을 누른다. 벨이 두 번 운다.'
    },
    truth: 'ninety',
    lines: {
      plus: '상자를 쌓았으니 합격? 그 벨소리까지 합격은 아니다.',
      minus: '벨이 크다고 감점하기엔 상자가 두 개다.',
      ninety: '90점. 초인종은 크지만, 그 상자는 내 요새다.'
    },
    why: '소리는 시끄러웠지만 요새를 남겨줬다. 90점이 적당하다.',
    react: 'question'
  },
  {
    id: 'kin',
    name: '동족 사랑꾼',
    tag: '새끼 고양이를 품에',
    bubble: '이 아가 봐, 구공이랑 닮았지?',
    look: { skin: '#f0c9a3', hair: '#6a4a33', hairStyle: 'long', shirt: '#d98aa0', pants: '#4c3f4a', acc: 'none' },
    clues: {
      smell: '새끼 고양이 냄새가 진하다. 우리와 다른, 아주 작은 냄새.',
      eyes: '새끼를 보는 눈이다. 나는 안 봤다. 그게 좋다.',
      act: '품에 든 새끼를 내려놓고, 나와 코를 맞대 준다.'
    },
    truth: 'plus',
    lines: {
      plus: '동족을 예뻐하면 고양이도 너를 예뻐한다. 합격.',
      minus: '다른 고양이를 안아 왔다고 감점? …나도 예뻐하면 된다. 합격.',
      ninety: '질투하면 90점, 아니면 100점. 오늘은 90점으로 본다.'
    },
    why: '동족을 예뻐해 주는 자. 고양이 기준에서는 큰 가점이다.',
    react: 'heart'
  },
  {
    id: 'tsundere',
    name: '"고양이 싫어" 하는 자',
    tag: '말과 손이 다름',
    bubble: '나 고양이 별로 안 좋아하는데… (손에는 츄르)',
    look: { skin: '#e9c2a0', hair: '#33261f', hairStyle: 'short', shirt: '#8a8f98', pants: '#3b3f46', acc: 'bag' },
    clues: {
      smell: '츄르 냄새. 말과 아주 다른 냄새.',
      eyes: '일부러 딴 데 본다. 그런데 볼이 빨갛다.',
      act: '츄르를 문지방에 살짝 밀어 두고, 아무 일도 없었다는 얼굴로 나간다.'
    },
    truth: 'ninety',
    lines: {
      plus: '츄르 하나에 마음을 다 주면 그게 고양이다. 아직 90점이다.',
      minus: '싫다는데 감점까지? 그건 내가 츄르에 약한 것과 다르다. 90점.',
      ninety: '90점. 말은 싫다더니 손은 정성이다. 나머지 10점은 부끄러움.'
    },
    why: '말과 행동이 반대였다. 그래서 +도 -도 아닌 90점이다.',
    react: 'question'
  },
  {
    id: 'tail',
    name: '꼬리 밟은 자',
    tag: '발밑 주의보',
    bubble: '앗, 미안! 안 밟았어, 안 밟았어!',
    look: { skin: '#f1c9a4', hair: '#3a2c23', hairStyle: 'cap', shirt: '#9c7a55', pants: '#3d4148', acc: 'none' },
    clues: {
      smell: '신발에서 밖 냄새. 그리고 아직 남아 있는 발의 공기.',
      eyes: '발밑을 본다. 내 꼬리를 확인하듯.',
      act: '한 발을 들고, 내 꼬리 끝을 발끝으로 훑고 지나간다.'
    },
    truth: 'minus',
    lines: {
      plus: '사과를 들었으니 합격? 아니다. 꼬리에 사과는 늦다.',
      minus: '꼬리는 등록된 신체다. 발끝은 통보 없이 왔다. 감점.',
      ninety: '90점을 줄 뻔했다. 발끝에 아직 내 털이 붙어 있다. 감점.'
    },
    why: '꼬리를 발끝으로 훑었다. 꼬리는 고양이의 사적인 부위다.',
    react: 'sweat'
  }
];

const DAYS = [
  {
    label: '1일차',
    time: 'morning',
    intro: '커튼을 걷었다. 오늘부터 인간을 채점한다.<br><b>기준은 내가 정한다.</b>',
    theme: {
      skyTop: '#ffd7a6', skyBottom: '#ffeccd', sun: '#fff4c8', sunX: 196, sunY: 26,
      far: '#c9a78f', near: '#b28c74', wall: '#e3c9a8', roof: '#a8735c',
      ground: '#d8c6a8', groundDark: '#c2ad8b', curb: '#a8916f'
    }
  },
  {
    label: '2일차',
    time: 'noon',
    intro: '어제 그 큰소리 인간이 또 왔다.<br>오늘은 <b>조용하길</b> 빈다.',
    theme: {
      skyTop: '#a9d8e8', skyBottom: '#e2f2f4', sun: '#fffbe0', sunX: 40, sunY: 22,
      far: '#9fb3bf', near: '#8a9fae', wall: '#e6dcc7', roof: '#8a7b6b',
      ground: '#d9cdb4', groundDark: '#c3b596', curb: '#a99a7e'
    }
  },
  {
    label: '3일차',
    time: 'dusk',
    intro: '해가 진다. 마지막 심사다.<br>서류는 없다. <b>기억은 내가 한다.</b>',
    theme: {
      skyTop: '#6b5a86', skyBottom: '#e89a63', sun: '#ffcf8a', sunX: 172, sunY: 40,
      far: '#5a4a6e', near: '#4a3c5c', wall: '#c9a98c', roof: '#6b4a48',
      ground: '#c0a689', groundDark: '#a98f74', curb: '#8a7159'
    }
  }
];

const DAY_END = {
  perfect: '오늘은 아무도 못 속였다. 코가 좋은 날이다.',
  good: '쓸 만한 눈이다, 나는. 내일도 이 정도면 된다.',
  meh: '오늘은 코가 좀 막혔나 보다. 그 인간들이 잘한 건 아니다.',
  bad: '심사가 흔들렸다. 고양이는 원래 흔들리지 않는데.'
};

const RANKS = [
  { min: 12, title: '냥냥 심사위원장', desc: '인간의 냄새만으로 하루를 채점하는 경지. 구공이가 널 인정했다.' },
  { min: 10, title: '집사 감별사', desc: '빈손과 츄르를 구별하는 눈. 이 정도면 동네 고양이들이 줄을 선다.' },
  { min: 7, title: '동네 고양이', desc: '평범하다. 나쁘지 않다. 다만 츄르 앞에서는 더 예민해져야 한다.' },
  { min: 4, title: '견습 고양이', desc: '냄새는 맡았지만 결론이 흔들렸다. 관찰을 두 번 더 하자.' },
  { min: 0, title: '문 앞의 얼룩', desc: '오늘의 심사는 물거품. 내일은 진짜 고양이처럼 해보자.' }
];

/* v2: 장면(집 안/골목)과 캐릭터 스프라이트
   hScale: 화면에 그릴 때 어른 키(1.0)에 대한 비율 — 아이는 작게 그린다. */
const SPRITES = {
  bab:      { scene: 'in',  sprite: 'assets/people/bab.png' },
  churu:    { scene: 'in',  sprite: 'assets/people/churu.png' },
  dawn:     { scene: 'in',  sprite: 'assets/people/dawn.png' },
  play:     { scene: 'in',  sprite: 'assets/people/play.png' },
  photo:    { scene: 'in',  sprite: 'assets/people/photo.png' },
  tail:     { scene: 'in',  sprite: 'assets/people/tail.png' },
  stray:    { scene: 'out', sprite: 'assets/people/stray.png', hScale: 0.7 },
  shout:    { scene: 'out', sprite: 'assets/people/shout.png' },
  empty:    { scene: 'out', sprite: 'assets/people/empty.png' },
  parcel:   { scene: 'out', sprite: 'assets/people/parcel.png' },
  kin:      { scene: 'out', sprite: 'assets/people/kin.png', hScale: 0.7 },
  tsundere: { scene: 'out', sprite: 'assets/people/tsundere.png' }
};
HUMANS.forEach(h => Object.assign(h, SPRITES[h.id] || { scene: 'out', sprite: 'assets/people/bab.png' }));
