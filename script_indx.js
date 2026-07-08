// =========================================================
// ESTADO GLOBAL
// =========================================================
const state = {
  quizzes: [],        // [{ quiz, disciplina, questoes, sourceFile }]
  selectedIndex: null, // índice da prova selecionada na pilha
  activeQuiz: null,    // prova em andamento
  currentQuestion: 0,
  answers: [],         // respostas escolhidas pelo usuário (índice 1/2/3) por questão
};

// =========================================================
// ELEMENTOS
// =========================================================
const screens = {
  import: document.getElementById('screen-import'),
  quiz: document.getElementById('screen-quiz'),
  result: document.getElementById('screen-result'),
};

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const importError = document.getElementById('importError');
const quizStackEl = document.getElementById('quizStack');
const stackList = document.getElementById('stackList');
const stackCount = document.getElementById('stackCount');
const startBtn = document.getElementById('startBtn');

const disciplinaStamp = document.getElementById('disciplinaStamp');
const quizTitle = document.getElementById('quizTitle');
const qCurrentEl = document.getElementById('qCurrent');
const qTotalEl = document.getElementById('qTotal');
const progressFill = document.getElementById('progressFill');
const questionText = document.getElementById('questionText');
const optionsList = document.getElementById('optionsList');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const gradeStamp = document.getElementById('gradeStamp');
const gradeValue = document.getElementById('gradeValue');
const gradeLabel = document.getElementById('gradeLabel');
const resultDisciplina = document.getElementById('resultDisciplina');
const resultTitle = document.getElementById('resultTitle');
const resultSummary = document.getElementById('resultSummary');
const reviewList = document.getElementById('reviewList');
const retryBtn = document.getElementById('retryBtn');
const backBtn = document.getElementById('backBtn');

// =========================================================
// NAVEGAÇÃO ENTRE TELAS
// =========================================================
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

// =========================================================
// IMPORTAÇÃO DE ARQUIVOS JSON
// =========================================================
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer.files).filter((f) =>
    f.name.toLowerCase().endsWith('.json')
  );
  if (files.length) handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length) handleFiles(files);
  fileInput.value = ''; // permite reimportar o mesmo arquivo depois
});

function showImportError(message) {
  importError.textContent = message;
  importError.hidden = false;
}

function clearImportError() {
  importError.hidden = true;
  importError.textContent = '';
}

async function handleFiles(files) {
  clearImportError();
  const errors = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const validated = validateQuizData(data);
      state.quizzes.push({ ...validated, sourceFile: file.name });
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (errors.length) {
    showImportError(
      `Não foi possível importar ${errors.length === 1 ? 'o arquivo' : 'os arquivos'} a seguir:\n` +
      errors.join('\n')
    );
  }

  renderStack();
}

/**
 * Valida a estrutura esperada do JSON:
 * { quiz, disciplina, questoes: [{ questao, perg1, perg2, perg3, resposta }] }
 */
function validateQuizData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('o conteúdo não é um objeto JSON válido.');
  }
  if (typeof data.quiz !== 'string' || !data.quiz.trim()) {
    throw new Error('campo "quiz" ausente ou inválido.');
  }
  if (typeof data.disciplina !== 'string' || !data.disciplina.trim()) {
    throw new Error('campo "disciplina" ausente ou inválido.');
  }
  if (!Array.isArray(data.questoes) || data.questoes.length === 0) {
    throw new Error('campo "questoes" ausente, vazio ou não é uma lista.');
  }

  data.questoes.forEach((q, i) => {
    const n = i + 1;
    if (typeof q.questao !== 'string') {
      throw new Error(`questão ${n}: campo "questao" ausente ou inválido.`);
    }
    if (typeof q.perg1 !== 'string' || typeof q.perg2 !== 'string' || typeof q.perg3 !== 'string') {
      throw new Error(`questão ${n}: campos "perg1", "perg2" e "perg3" devem ser texto.`);
    }
    if (![1, 2, 3].includes(q.resposta)) {
      throw new Error(`questão ${n}: campo "resposta" deve ser 1, 2 ou 3.`);
    }
  });

  return data;
}

// =========================================================
// RENDERIZAÇÃO DA PILHA DE PROVAS IMPORTADAS
// =========================================================
function renderStack() {
  stackList.innerHTML = '';

  if (state.quizzes.length === 0) {
    quizStackEl.hidden = true;
    startBtn.disabled = true;
    return;
  }

  quizStackEl.hidden = false;
  stackCount.textContent = state.quizzes.length;

  state.quizzes.forEach((q, index) => {
    const li = document.createElement('li');
    li.className = 'stack-item';
    if (state.selectedIndex === index) li.classList.add('selected');

    li.innerHTML = `
      <input type="radio" name="quizSelect" value="${index}" ${state.selectedIndex === index ? 'checked' : ''} aria-label="Selecionar prova ${escapeHTML(q.quiz)}">
      <div class="stack-item-info">
        <p class="stack-item-title">${escapeHTML(q.disciplina)} — ${escapeHTML(q.quiz)}</p>
        <p class="stack-item-meta">${q.questoes.length} questões · ${escapeHTML(q.sourceFile)}</p>
      </div>
      <button class="stack-item-remove" type="button" aria-label="Remover prova ${escapeHTML(q.quiz)}" data-index="${index}">✕</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.closest('.stack-item-remove')) return;
      state.selectedIndex = index;
      renderStack();
    });

    li.querySelector('.stack-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(e.currentTarget.dataset.index);
      state.quizzes.splice(idx, 1);
      if (state.selectedIndex === idx) state.selectedIndex = null;
      else if (state.selectedIndex !== null && state.selectedIndex > idx) state.selectedIndex--;
      renderStack();
    });

    stackList.appendChild(li);
  });

  startBtn.disabled = state.selectedIndex === null;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =========================================================
// INICIAR PROVA
// =========================================================
startBtn.addEventListener('click', () => {
  if (state.selectedIndex === null) return;
  startQuiz(state.quizzes[state.selectedIndex]);
});

function startQuiz(quizData) {
  state.activeQuiz = quizData;
  state.currentQuestion = 0;
  state.answers = new Array(quizData.questoes.length).fill(null);

  disciplinaStamp.textContent = quizData.disciplina;
  quizTitle.textContent = quizData.quiz;
  qTotalEl.textContent = quizData.questoes.length;

  showScreen('quiz');
  renderQuestion();
}

// =========================================================
// RENDERIZAÇÃO DE QUESTÃO
// =========================================================
function renderQuestion() {
  const quiz = state.activeQuiz;
  const idx = state.currentQuestion;
  const question = quiz.questoes[idx];
  const answered = state.answers[idx];

  qCurrentEl.textContent = idx + 1;
  progressFill.style.width = `${((idx + 1) / quiz.questoes.length) * 100}%`;
  questionText.textContent = question.questao;

  optionsList.innerHTML = '';

  [1, 2, 3].forEach((optionNum) => {
    const label = question[`perg${optionNum}`];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.setAttribute('role', 'radio');
    btn.dataset.option = optionNum;

    const isCorrectOption = optionNum === question.resposta;
    const isUserChoice = answered === optionNum;

    if (answered !== null) {
      btn.classList.add('disabled-option');
      btn.disabled = true;
      btn.setAttribute('aria-checked', isUserChoice ? 'true' : 'false');
      if (isCorrectOption) btn.classList.add('correct');
      else if (isUserChoice) btn.classList.add('incorrect');
    } else {
      btn.setAttribute('aria-checked', 'false');
    }

    btn.innerHTML = `<span class="option-marker">${optionNum}</span><span>${escapeHTML(label)}</span>`;

    btn.addEventListener('click', () => selectAnswer(optionNum));
    optionsList.appendChild(btn);
  });

  prevBtn.disabled = idx === 0;
  prevBtn.style.visibility = idx === 0 ? 'hidden' : 'visible';

  const isLast = idx === quiz.questoes.length - 1;
  nextBtn.textContent = isLast ? 'Ver resultado →' : 'Próxima →';
  nextBtn.disabled = answered === null;
}

function selectAnswer(optionNum) {
  const idx = state.currentQuestion;
  if (state.answers[idx] !== null) return; // já respondida, não permite trocar
  state.answers[idx] = optionNum;
  renderQuestion();
}

prevBtn.addEventListener('click', () => {
  if (state.currentQuestion > 0) {
    state.currentQuestion--;
    renderQuestion();
  }
});

nextBtn.addEventListener('click', () => {
  const quiz = state.activeQuiz;
  const isLast = state.currentQuestion === quiz.questoes.length - 1;
  if (isLast) {
    showResult();
  } else {
    state.currentQuestion++;
    renderQuestion();
  }
});

// =========================================================
// RESULTADO
// =========================================================
function showResult() {
  const quiz = state.activeQuiz;
  const total = quiz.questoes.length;
  let correct = 0;

  reviewList.innerHTML = '';

  quiz.questoes.forEach((question, i) => {
    const userAnswer = state.answers[i];
    const isCorrect = userAnswer === question.resposta;
    if (isCorrect) correct++;

    const li = document.createElement('li');
    li.className = `review-item ${isCorrect ? 'is-correct' : 'is-wrong'}`;

    const userLabel = userAnswer ? question[`perg${userAnswer}`] : '(não respondida)';
    const correctLabel = question[`perg${question.resposta}`];

    li.innerHTML = `
      <p class="review-q"><span class="review-icon">${isCorrect ? '✓' : '✗'}</span>${i + 1}. ${escapeHTML(question.questao)}</p>
      <p class="review-answer">
        <span class="label">Sua resposta:</span> <span class="your-answer ${isCorrect ? 'right' : 'wrong'}">${escapeHTML(userLabel)}</span>
        ${!isCorrect ? `<br><span class="label">Resposta correta:</span> <span class="correct-answer">${escapeHTML(correctLabel)}</span>` : ''}
      </p>
    `;
    reviewList.appendChild(li);
  });

  const passed = correct / total >= 0.6;

  gradeStamp.classList.toggle('fail', !passed);
  gradeValue.textContent = `${correct}/${total}`;
  gradeLabel.textContent = passed ? 'APROVADO' : 'REVISAR';

  resultDisciplina.textContent = quiz.disciplina;
  resultTitle.textContent = quiz.quiz;
  resultSummary.textContent = `Você acertou ${correct} de ${total} questões.`;

  showScreen('result');
}

retryBtn.addEventListener('click', () => {
  startQuiz(state.activeQuiz);
});

backBtn.addEventListener('click', () => {
  state.activeQuiz = null;
  showScreen('import');
});
