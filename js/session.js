// IntelliPOS Interactive — session.js
    // ── CREAR SESIÓN ──────────────────────────────────────────────────────────
    async function createSessionFromLibrary() {
        if (!parsedQuestions.length) { alert('No hay preguntas cargadas.'); return; }
        const mode = document.querySelector('input[name="session-mode"]:checked')?.value || 'quiz';
        const accessType = mode === 'exam' ? 'closed' : (document.querySelector('input[name="access-type"]:checked')?.value || 'open');

        // Validar: examen o sesión cerrada requieren lista
        if (accessType === 'closed' && !selectedParticipantList) {
            alert('Una sesión cerrada o un examen requieren una lista de participantes.\nSelecciona una lista en el selector de participantes.'); return;
        }

        const name = $('session-name-input').value.trim() || (mode === 'exam' ? 'Examen en Línea' : 'Cuestionario en Vivo');
        const timerSeconds   = mode === 'quiz' ? (parseInt($('timer-select').value) || 0) : 0;
        const examMinutes    = mode === 'exam' ? (parseInt($('exam-minutes').value)  || 30) : 0;
        const randomOrder    = mode === 'exam' ? $('random-order').checked : false;
        const examType       = mode === 'exam' ? (document.querySelector('input[name="exam-type"]:checked')?.value || 'parcial') : null;
        const examNRaw       = mode === 'exam' ? parseInt($('exam-n-preguntas').value) : NaN;
        const examN          = !isNaN(examNRaw) && examNRaw > 0 ? examNRaw : null;
        const sesionDefault  = parseInt($('setup-sesion').value) || null;
        const topicoDefault  = $('setup-topico').value.trim() || null;

        // Selección de preguntas según banco de preselección
        const questionsParaUsar = mode === 'exam'
            ? selectExamQuestions(parsedQuestions, examType, examN)
            : parsedQuestions;

        cloudId = genId('s_');
        sessionData = {
            questions: questionsParaUsar, currentIndex:0, votes:{}, voters:{}, participants:{},
            participantVotes:{}, examSubmissions:{}, reveal:false, status:'lobby',
            mode, timerSeconds, examMinutes, randomOrder, name,
            accessType, examType, sesionDefault, topicoDefault,
            rangos: parsedRangos,
            rangosDim: parsedRangosDim,
            perfiles: parsedPerfiles,
            participantList: selectedParticipantList ? selectedParticipantList.lista : null,
            questionChangedAt:0, examStartedAt:0
        };
        try {
            const { error } = await sb.from('quiz_session').insert([{ id: cloudId, data: sessionData }]);
            if (error) throw error;
            isPresenter = true;
            initPresenterLobby();
        } catch(err) {
            console.error(err);
            alert('Error al crear la sesión: ' + (err.message || err));
        }
    }

    async function createCloudSession() {
        const questions = parsedQuestions;
        if (!questions.length) { alert('No hay preguntas cargadas.'); return; }

        const mode       = document.querySelector('input[name="session-mode"]:checked')?.value || 'quiz';
        const accessType = mode === 'exam' ? 'closed' : (document.querySelector('input[name="access-type"]:checked')?.value || 'open');

        // Validar: examen o sesión cerrada requieren lista
        if (accessType === 'closed' && !selectedParticipantList) {
            alert('Una sesión cerrada o un examen requieren una lista de participantes.\nSelecciona una lista en el selector de participantes.'); return;
        }

        const btn = $('btn-create');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando…';
        btn.disabled = true;

        const timerSeconds  = mode === 'quiz' ? (parseInt($('timer-select').value) || 0) : 0;
        const examMinutes   = mode === 'exam' ? (parseInt($('exam-minutes').value)  || 30) : 0;
        const randomOrder   = mode === 'exam' ? $('random-order').checked : false;
        const name          = $('session-name-input').value.trim() || (mode === 'exam' ? 'Examen en Línea' : 'Cuestionario en Vivo');
        const examType      = mode === 'exam' ? (document.querySelector('input[name="exam-type"]:checked')?.value || 'parcial') : null;
        const examNRaw      = mode === 'exam' ? parseInt($('exam-n-preguntas').value) : NaN;
        const examN         = !isNaN(examNRaw) && examNRaw > 0 ? examNRaw : null;
        const sesionDefault = parseInt($('setup-sesion').value) || null;
        const topicoDefault = $('setup-topico').value.trim() || null;
        cloudId = genId('s_');

        // Selección de preguntas según banco de preselección
        const questionsParaUsar = mode === 'exam'
            ? selectExamQuestions(questions, examType, examN)
            : questions;

        // Estado inicial: 'lobby' — los participantes se registran antes de empezar
        sessionData = { questions: questionsParaUsar, currentIndex:0, votes:{}, voters:{}, participants:{}, participantVotes:{}, examSubmissions:{}, reveal:false, status:'lobby', mode, timerSeconds, examMinutes, randomOrder, name, accessType, examType, sesionDefault, topicoDefault, rangos: parsedRangos, rangosDim: parsedRangosDim, perfiles: parsedPerfiles, participantList: selectedParticipantList ? selectedParticipantList.lista : null, questionChangedAt:0, examStartedAt:0 };

        try {
            const { error } = await sb.from('quiz_session').insert([{ id: cloudId, data: sessionData }]);
            if (error) throw error;
            isPresenter = true;
            initPresenterLobby();   // ← va al lobby, no directo al cuestionario
        } catch(err) {
            console.error(err);
            alert('Error al crear la sesión: ' + (err.message || err));
            btn.innerHTML = '<span>🚀 Crear Sesión en Vivo</span>';
            btn.disabled = false;
        }
    }

    // ── LOBBY PRESENTADOR ────────────────────────────────────────────────────
    function initPresenterLobby() {
        $('role-badge').textContent = 'Presentador';
        $('lobby-session-title').textContent = sessionData.name;
        showView('view-lobby-presenter');

        const url = location.origin + location.pathname + '?id=' + cloudId;
        $('lobby-link').value = url;
        $('lobby-qr').src = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=240&margin=2&ecLevel=M`;

        // Polling para actualizar lista de asistencia en tiempo real
        subscribeRealtime(true);
        startPolling(true);
    }

    function renderLobbyList() {
        const parts = sessionData.participants || {};
        const names = Object.values(parts);
        $('lobby-count').textContent = names.length;
        $('lobby-participants-list').innerHTML = names.length === 0
            ? '<p class="text-slate-500 italic">Esperando participantes…</p>'
            : names.map(n => `
                <div class="flex items-center space-x-2 py-1 border-b border-slate-700/40">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 pulse-dot"></span>
                    <span class="truncate">${n}</span>
                </div>`).join('');
    }

    function copyLobbyLink() {
        const val = $('lobby-link').value;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(val).then(() => alert('¡Enlace copiado!')).catch(() => { $('lobby-link').select(); document.execCommand('copy'); alert('¡Enlace copiado!'); });
        } else { $('lobby-link').select(); document.execCommand('copy'); alert('¡Enlace copiado!'); }
    }

    async function startQuiz() {
        if (sessionData.mode === 'exam') {
            sessionData.status       = 'exam-active';
            sessionData.examStartedAt = Date.now();
        } else {
            sessionData.status           = 'active';
            sessionData.currentIndex     = 0;
            sessionData.reveal           = false;
            sessionData.questionChangedAt = Date.now();
        }
        await push();
        if (sessionData.mode === 'exam') {
            initExamPresenter();
        } else {
            initPresenterMode();
        }
    }
