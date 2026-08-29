// --- 오디오 (BGM) 설정 ---
const lobbyBgm = new Audio('lobby.mp3');
lobbyBgm.loop = true;
lobbyBgm.volume = 0.3;

const gameBgm = new Audio();
gameBgm.volume = 0.2;
const mainBgmTracks = [
  'main1.mp3',
  'main2.mp3',
  'main3.mp3',
  'main4.mp3',
  'main5.mp3',
  'main6.mp3',
];
let lastPlayedBgmIndex = -1;
let isBgmPausedForPopup = false;

function playNextGameBgm() {
  if (mainBgmTracks.length === 0) return;
  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * mainBgmTracks.length);
  } while (nextIndex === lastPlayedBgmIndex && mainBgmTracks.length > 1);

  lastPlayedBgmIndex = nextIndex;
  gameBgm.src = mainBgmTracks[nextIndex];
  gameBgm.play().catch((e) => console.log('게임 BGM 재생 실패:', e));
}

gameBgm.addEventListener('ended', playNextGameBgm);

function stopAllBgm() {
  lobbyBgm.pause();
  gameBgm.pause();
  isBgmPausedForPopup = false;
}

function goToLobby() {
  stopAllBgm();
  lobbyBgm
    .play()
    .catch((e) => console.log('로비 BGM 재생 대기(사용자 인터랙션 필요)'));
  switchScreen('lobby');
}

function pauseGameBgm() {
  if (!gameBgm.paused) {
    gameBgm.pause();
    isBgmPausedForPopup = true;
  }
}

function resumeGameBgm() {
  if (isBgmPausedForPopup) {
    gameBgm.play();
    isBgmPausedForPopup = false;
  }
}

// --- 전역 변수 ---
let currentMode = '';
let currentWordList = [];
let currentWordIndex = 0;
let currentWord = {};
let guessedChars = [];
let mistakes = 0;
const maxMistakes = 6;

let itemMeaningCount = 3;
let itemHintCount = 3;
let isMeaningUsedThisStage = false; // 이번 스테이지 뜻 보기 사용 여부

let score = 0;
let sessionWords = [];
const PRACTICE_MAX_STAGE = 20;
let currentStage = 1;

let timerInterval;
let timeLeft = 600;

const vowels = ['a', 'e', 'i', 'o', 'u', 'v'];
const screens = {
  opening: document.getElementById('opening-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
};

const qwertyLayout = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

document.addEventListener(
  'touchmove',
  function (event) {
    if (!event.target.closest('.scrollable-list')) {
      event.preventDefault();
    }
  },
  { passive: false },
);

document.getElementById('view-ranking-btn').addEventListener('click', () => {
  updateRankingUI();
  document.getElementById('ranking-modal').classList.remove('hidden');
});
document.getElementById('close-ranking-btn').addEventListener('click', () => {
  document.getElementById('ranking-modal').classList.add('hidden');
});

screens.opening.addEventListener('click', () => {
  generateStageButtons();
  goToLobby();
});

document.getElementById('home-btn').addEventListener('click', () => {
  clearInterval(timerInterval);
  goToLobby();
});

function switchScreen(screenName) {
  Object.values(screens).forEach((screen) => screen.classList.add('hidden'));
  screens[screenName].classList.remove('hidden');
}

function generateStageButtons() {
  const container = document.getElementById('stage-buttons');
  container.innerHTML = '';
  const maxLesson = 30;

  for (let i = 1; i <= maxLesson; i += 2) {
    const btn = document.createElement('button');
    btn.textContent = `${i}~${i + 1}과`;
    btn.onclick = () => startGame('practice', [i, i + 1]);
    container.appendChild(btn);
  }
}

document.getElementById('real-mode-btn').addEventListener('click', () => {
  startGame('real', []);
});

function startGame(mode, lessons) {
  currentMode = mode;
  score = 0;
  currentWordIndex = 0;
  currentStage = 1;
  sessionWords = [];
  clearInterval(timerInterval);

  stopAllBgm();
  playNextGameBgm();

  document.getElementById('score-display').querySelector('span').textContent =
    score;

  if (mode === 'practice') {
    let filtered = wordData
      .filter((w) => lessons.includes(w.lesson))
      .sort(() => 0.5 - Math.random());
    currentWordList = filtered.slice(0, PRACTICE_MAX_STAGE);

    document.getElementById('timer-display').classList.add('hidden');
    document.getElementById('score-display').classList.add('hidden');
    document.getElementById('stage-display').classList.remove('hidden');
  } else {
    currentWordList = [...wordData].sort(() => 0.5 - Math.random());

    document.getElementById('timer-display').classList.remove('hidden');
    document.getElementById('score-display').classList.remove('hidden');
    document.getElementById('stage-display').classList.remove('hidden');

    startTimer(600);
  }

  itemMeaningCount = 3;
  itemHintCount = 3;

  switchScreen('game');
  initKeyboard();
  loadNextWord();
}

function startTimer(seconds) {
  timeLeft = seconds;
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endRealMode();
    }
  }, 1000);
}

function updateTimerUI() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  document.getElementById('timer-display').innerHTML =
    `⏳ ${m}:${s.toString().padStart(2, '0')}`;
}

function loadNextWord() {
  if (currentMode === 'practice' && currentStage > currentWordList.length) {
    endPracticeMode();
    return;
  }
  if (currentMode === 'real' && currentWordIndex >= currentWordList.length) {
    currentWordList = [...wordData].sort(() => 0.5 - Math.random());
    currentWordIndex = 0;
  }

  currentWord = currentWordList[currentWordIndex];
  if (!sessionWords.some((w) => w.hanzi === currentWord.hanzi)) {
    sessionWords.push(currentWord);
  }

  guessedChars = [];
  mistakes = 0;
  isMeaningUsedThisStage = false; // 스테이지가 바뀌면 뜻 보기 제한 초기화
  updateItemUI();

  if (currentMode === 'practice') {
    document.getElementById('stage-display').textContent =
      `Stage ${currentStage} / ${currentWordList.length}`;
  } else {
    document.getElementById('stage-display').textContent =
      `Stage ${currentStage}`;
  }

  document.getElementById('hanzi').textContent = currentWord.hanzi;
  const meaningEl = document.getElementById('meaning');
  meaningEl.textContent = currentWord.meaning;
  meaningEl.classList.add('hidden-meaning');

  document.querySelectorAll('.key').forEach((key) => {
    key.classList.remove('disabled', 'hint-highlight');
  });
  for (let i = 1; i <= maxMistakes; i++) {
    document.getElementById(`part-${i}`).style.display = 'none';
  }
  renderWord();
}

function renderWord() {
  const displayEl = document.getElementById('word-display');
  const chars = Array.from(currentWord.pinyin);
  const displayStr = chars
    .map((char) => {
      if (char === ' ' || char === "'") return char;
      return guessedChars.includes(char) ? char : '_';
    })
    .join(' ');
  displayEl.textContent = displayStr;
}

function initKeyboard() {
  qwertyLayout.forEach((row, idx) => {
    const rowEl = document.getElementById(`row-${idx + 1}`);
    rowEl.innerHTML = '';
    row.forEach((letter) => {
      const btn = document.createElement('div');
      btn.className = 'key';
      btn.id = `key-${letter}`;
      btn.textContent = letter === 'v' ? 'ü' : letter;
      btn.addEventListener('click', () => handleKeyPress(letter, btn));
      rowEl.appendChild(btn);
    });
  });
}

function handleKeyPress(letter, btnEl) {
  if (btnEl.classList.contains('disabled')) return;
  document
    .querySelectorAll('.key')
    .forEach((k) => k.classList.remove('hint-highlight'));

  if (vowels.includes(letter)) {
    showTonePopup(letter, btnEl);
  } else {
    processGuess(letter);
    btnEl.classList.add('disabled');
  }
}

function showTonePopup(vowelLetter, baseBtnEl) {
  const popup = document.getElementById('tone-popup');
  const optionsContainer = popup.querySelector('.tone-options');
  optionsContainer.innerHTML = '';

  const tones = toneMap[vowelLetter];
  tones.forEach((tonedChar) => {
    const btn = document.createElement('button');
    btn.className = 'tone-btn';
    btn.textContent = tonedChar;
    if (guessedChars.includes(tonedChar)) {
      btn.classList.add('disabled-tone');
    }
    btn.onclick = (e) => {
      e.stopPropagation();
      processGuess(tonedChar);
      popup.classList.add('hidden');
    };
    optionsContainer.appendChild(btn);
  });
  popup.classList.remove('hidden');
}

document.getElementById('tone-popup').addEventListener('click', (e) => {
  if (e.target === document.getElementById('tone-popup')) {
    document.getElementById('tone-popup').classList.add('hidden');
  }
});

function processGuess(char) {
  if (guessedChars.includes(char)) return;
  guessedChars.push(char);

  const charsInWord = Array.from(currentWord.pinyin);

  if (charsInWord.includes(char)) {
    renderWord();
    checkWin(charsInWord);
  } else {
    mistakes++;
    document.getElementById(`part-${mistakes}`).style.display = 'block';
    if (currentMode === 'real') {
      score = Math.max(0, score - 5);
      document.querySelector('#score-display span').textContent = score;
    }
    checkLose();
  }
}

function checkWin(charsInWord) {
  const isWin = charsInWord.every(
    (char) => char === ' ' || char === "'" || guessedChars.includes(char),
  );
  if (isWin) {
    if (currentMode === 'real') {
      score += 20;
      document.querySelector('#score-display span').textContent = score;
    }
    showResultModal(true);
  }
}

function checkLose() {
  if (mistakes >= maxMistakes) {
    showResultModal(false);
  }
}

function showResultModal(isWin) {
  const modal = document.getElementById('result-modal');
  const msg = document.getElementById('result-message');
  const ans = document.getElementById('result-answer');
  const ttsBtn = document.getElementById('result-tts-btn');
  const nextBtn = document.getElementById('next-btn');

  pauseGameBgm();

  msg.textContent = isWin ? '정답입니다! 🎉' : '틀렸습니다 💀';
  msg.style.color = isWin ? 'var(--correct-color)' : 'var(--wrong-color)';
  ans.innerHTML = `<strong>${currentWord.hanzi}</strong>${currentWord.pinyin}<br><span style="color:#7f8c8d; font-size:1rem;">${currentWord.meaning}</span>`;

  ttsBtn.onclick = () => playTTS(currentWord.hanzi);

  if (currentMode === 'real' && !isWin) {
    nextBtn.textContent = '결과 보기';
    nextBtn.onclick = () => {
      modal.classList.add('hidden');
      clearInterval(timerInterval);
      endRealMode();
    };
  } else {
    nextBtn.textContent = '다음';
    nextBtn.onclick = () => {
      modal.classList.add('hidden');
      resumeGameBgm();
      currentWordIndex++;
      currentStage++;
      loadNextWord();
    };
  }
  modal.classList.remove('hidden');
}

function playTTS(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';

    const voices = window.speechSynthesis.getVoices();
    const zhVoices = voices.filter(
      (v) => v.lang.includes('zh') || v.lang.includes('cmn'),
    );

    if (zhVoices.length > 0) {
      const femaleVoice = zhVoices.find((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('female') ||
          name.includes('woman') ||
          name.includes('xiaoxiao') ||
          name.includes('yaoyao') ||
          name.includes('ting-ting') ||
          name.includes('lili')
        );
      });
      utterance.voice = femaleVoice || zhVoices[0];
    }
    window.speechSynthesis.speak(utterance);
  } else {
    alert('이 브라우저에서는 음성 듣기를 지원하지 않습니다.');
  }
}
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}

function endPracticeMode() {
  showReviewModal();
}

function endRealMode() {
  document.getElementById('final-score').textContent = score;
  document.getElementById('nickname-input').value = '';
  document.getElementById('nickname-modal').classList.remove('hidden');
  pauseGameBgm();
}

document.getElementById('save-score-btn').addEventListener('click', () => {
  let nickname =
    document.getElementById('nickname-input').value.trim() || '익명';
  saveRanking(nickname, score);
  document.getElementById('nickname-modal').classList.add('hidden');
  showReviewModal();
});

function showReviewModal() {
  const list = document.getElementById('review-list');
  list.innerHTML = '';

  sessionWords.forEach((w) => {
    const li = document.createElement('li');
    li.innerHTML = `
            <div class="review-word-info">
                <strong>${w.hanzi}</strong> 
                <span style="color:#e74c3c">${w.pinyin}</span> - ${w.meaning}
            </div>
            <button class="review-tts-btn" title="듣기">🔊</button>
        `;
    li.querySelector('.review-tts-btn').addEventListener('click', () =>
      playTTS(w.hanzi),
    );
    list.appendChild(li);
  });
  document.getElementById('review-modal').classList.remove('hidden');
}

document.getElementById('close-review-btn').addEventListener('click', () => {
  document.getElementById('review-modal').classList.add('hidden');
  goToLobby();
});

function saveRanking(name, newScore) {
  let rankings = JSON.parse(localStorage.getItem('jindam_rankings')) || [];
  rankings.push({ name: name, score: newScore });
  rankings.sort((a, b) => b.score - a.score);
  rankings = rankings.slice(0, 3);
  localStorage.setItem('jindam_rankings', JSON.stringify(rankings));
}

function updateRankingUI() {
  const list = document.getElementById('ranking-list');
  list.innerHTML = '';
  let rankings = JSON.parse(localStorage.getItem('jindam_rankings')) || [];

  if (rankings.length === 0) {
    list.innerHTML =
      '<li><span style="display:block; text-align:center; width:100%; color:#95a5a6;">아직 랭킹이 없습니다.</span></li>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  rankings.forEach((r, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${medals[idx]} ${r.name}</span> <strong>${r.score}점</strong>`;
    list.appendChild(li);
  });
}

function updateItemUI() {
  document.getElementById('item-meaning-count').textContent = itemMeaningCount;
  document.getElementById('item-hint-count').textContent = itemHintCount;

  // 남은 개수가 없거나, 이번 스테이지에서 이미 사용했으면 비활성화
  document.getElementById('item-meaning').disabled =
    itemMeaningCount <= 0 || isMeaningUsedThisStage;
  document.getElementById('item-hint').disabled = itemHintCount <= 0;
}

document.getElementById('item-meaning').addEventListener('click', () => {
  if (itemMeaningCount > 0 && !isMeaningUsedThisStage) {
    document.getElementById('meaning').classList.remove('hidden-meaning');
    itemMeaningCount--;
    isMeaningUsedThisStage = true; // 현재 스테이지에서 사용 완료 처리
    updateItemUI();
  }
});

document.getElementById('item-hint').addEventListener('click', () => {
  if (itemHintCount > 0) {
    const charsInWord = Array.from(currentWord.pinyin);
    const unguessedCorrectChars = charsInWord.filter(
      (c) => c !== ' ' && c !== "'" && !guessedChars.includes(c),
    );
    if (unguessedCorrectChars.length === 0) return;
    const targetChar =
      unguessedCorrectChars[
        Math.floor(Math.random() * unguessedCorrectChars.length)
      ];
    const correctBaseKey = getBaseChar(targetChar);
    const allKeys = [].concat(...qwertyLayout);
    const wrongKeys = allKeys.filter(
      (k) => !charsInWord.map((c) => getBaseChar(c)).includes(k),
    );
    const wrongBaseKey =
      wrongKeys[Math.floor(Math.random() * wrongKeys.length)];
    document
      .getElementById(`key-${correctBaseKey}`)
      .classList.add('hint-highlight');
    document
      .getElementById(`key-${wrongBaseKey}`)
      .classList.add('hint-highlight');
    itemHintCount--;
    updateItemUI();
  }
});
