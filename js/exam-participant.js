// IntelliPOS Interactive — exam-participant.js

    // ═══════════════════════════════════════════════════════════════════════════
    //  MODO EXAMEN
    // ═══════════════════════════════════════════════════════════════════════════

    // Estado local del examen (solo para el participante)
    let examOrder    = [];   // array de índices originales en el orden asignado
    let examPos      = 0;    // posición actual dentro de examOrder
    let examAnswers  = {};   // { originalIdx: 'A'|'B'|'C'|'D' }
    let examTimerInt = null;
    let examTotalSecs = 0;
    let examWarned   = false;
    let examSubmitted = false;

    // ── Shuffle (Fisher-Yates) ─────────────────────────────────────────────────
    function shuffleIndices(n) {
        const arr = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ── Formatear mm:ss ───────────────────────────────────────────────────────
    function fmtTime(secs) {
        const m = Math.floor(Math.max(0, secs) / 60).toString().padStart(2, '0');
        const s = (Math.max(0, secs) % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }


    // ── Participante: iniciar examen ──────────────────────────────────────────
    function initExamParticipant() {
        showView('view-exam-participant');
        examSubmitted = false;
        examWarned    = false;
        examAnswers   = {};
        examPos       = 0;
        examTotalSecs = sessionData.examMinutes * 60;

        // Generar orden (aleatorio o secuencial)
        examOrder = sessionData.randomOrder
            ? shuffleIndices(sessionData.questions.length)
            : Array.from({ length: sessionData.questions.length }, (_, i) => i);

        // Iniciar cronómetro sincronizado con examStartedAt
        const startedAt = sessionData.examStartedAt;
        if (examTimerInt) clearInterval(examTimerInt);
        examTimerInt = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const left    = Math.max(0, examTotalSecs - elapsed);
            $('exam-participant-timer').textContent = fmtTime(left);
            // Aviso al minuto final
            if (left <= 60 && !examWarned) {
                examWarned = true;
                $('exam-warning-banner').classList.remove('hidden');
            }
            // Tiempo agotado → entrega automática
            if (left === 0 && !examSubmitted) {
                clearInterval(examTimerInt);
                autoSubmitExam();
            }
        }, 1000);

        renderExamQuestion();
    }

    // ── Renderizar pregunta del examen ────────────────────────────────────────
    function renderExamQuestion() {
        const totalQ   = examOrder.length;
        const origIdx  = examOrder[examPos];
        const q        = sessionData.questions[origIdx];
        if (!q) return;

        $('exam-progress-label').textContent  = `Pregunta ${examPos + 1} / ${totalQ}`;
        $('exam-question-num').textContent    = `Pregunta ${examPos + 1} de ${totalQ}`;
        $('exam-question-text').textContent   = q.pregunta;
        // Badge de puntaje
        const puntaje = q.puntaje || 1;
        const examPtsBadge = $('exam-points-badge');
        if (examPtsBadge) examPtsBadge.textContent = `${puntaje} pt${puntaje !== 1 ? 's' : ''}`;
        // Imagen de la pregunta (examen participante)
        const eqImgWrap = $('exam-question-image');
        const eqImg = $('exam-q-img');
        if (q.imageUrl) { eqImg.src = q.imageUrl; eqImgWrap.classList.remove('hidden'); }
        else { eqImgWrap.classList.add('hidden'); eqImg.src = ''; }

        const esAbierta = (q.tipo || 'multiple_choice') === 'abierta';
        const esNivel   = (q.tipo || 'multiple_choice') === 'nivel_rango';
        const selected  = examAnswers[origIdx];

        if (esAbierta) {
            // Textarea para pregunta abierta
            $('exam-options-container').innerHTML = `
                <div>
                    <p class="text-xs text-amber-400 font-semibold mb-2 uppercase tracking-wide">Pregunta abierta</p>
                    <textarea id="exam-open-text" rows="5" oninput="saveExamOpenAnswer(this.value)"
                        class="w-full p-3 bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Escribe tu respuesta aquí...">${selected || ''}</textarea>
                </div>`;
        } else if (esNivel) {
            // 5 botones de nivel para NIVEL-RANGO
            $('exam-options-container').innerHTML = `
                <div class="space-y-3">
                    <div class="bg-teal-950/40 border border-teal-700/40 rounded-xl p-3 text-center">
                        <p class="text-xs font-semibold text-teal-300 uppercase tracking-wider">${q.dimensionNombre || 'Dimensión ' + q.dimension}</p>
                        <p class="text-xs text-slate-400 mt-1">Elige tu nivel (1 = bajo · 5 = alto)</p>
                    </div>
                    <div class="grid grid-cols-5 gap-2">
                        ${[1,2,3,4,5].map(n => `
                        <button onclick="selectExamLevel(${n})"
                            class="aspect-square rounded-xl font-extrabold text-xl transition ${
                                String(selected) === String(n)
                                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30 ring-2 ring-teal-300'
                                    : 'bg-teal-700 hover:bg-teal-500 active:scale-95 text-white shadow-lg'
                            }">
                            ${n}
                        </button>`).join('')}
                    </div>
                </div>`;
        } else {
            $('exam-options-container').innerHTML = ['A','B','C','D'].map(k => {
                const text = q['opcion' + k];
                if (!text) return '';
                const isSelected = selected === k;
                return `
                <button onclick="selectExamOption('${k}')"
                    class="w-full p-3.5 rounded-xl text-left font-semibold text-sm transition border ${
                        isSelected
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-slate-700/60 border-slate-600 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
                    } flex items-center space-x-3">
                    <span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        isSelected ? 'bg-white/20' : 'bg-slate-600'
                    }">${k}</span>
                    <span>${text}</span>
                </button>`;
            }).join('');
        }


        // Actualizar indicadores de puntos
        $('exam-dot-nav').innerHTML = examOrder.map((oi, pos) => {
            const ans       = examAnswers[oi];
            const isCurrent = pos === examPos;
            const qOi       = sessionData.questions[oi];
            const esAbOi    = (qOi?.tipo || 'multiple_choice') === 'abierta';
            const esNivelOi = (qOi?.tipo || 'multiple_choice') === 'nivel_rango';
            // Dot: azul=actual, ámbar=abierta respondida, verde azulado=nivel respondido, verde=MC respondida, gris=sin respuesta
            const color     = isCurrent
                ? 'bg-indigo-500 ring-2 ring-indigo-300'
                : ans
                    ? (esAbOi ? 'bg-amber-400' : esNivelOi ? 'bg-teal-500' : 'bg-emerald-500')
                    : 'bg-slate-600';
            return `<button onclick="examJumpTo(${pos})"
                class="w-5 h-5 rounded-full ${color} transition hover:opacity-80" title="Pregunta ${pos+1}"></button>`;
        }).join('');
    }

    function saveExamOpenAnswer(text) {
        if (examSubmitted) return;
        const origIdx = examOrder[examPos];
        examAnswers[origIdx] = text;
        // Actualizar solo los dots sin re-renderizar todo (evita perder el foco del textarea)
        $('exam-dot-nav').innerHTML = examOrder.map((oi, pos) => {
            const ans       = examAnswers[oi];
            const isCurrent = pos === examPos;
            const qOi       = sessionData.questions[oi];
            const esAbOi    = (qOi?.tipo || 'multiple_choice') === 'abierta';
            const esNivelOi = (qOi?.tipo || 'multiple_choice') === 'nivel_rango';
            const color     = isCurrent
                ? 'bg-indigo-500 ring-2 ring-indigo-300'
                : ans
                    ? (esAbOi ? 'bg-amber-400' : esNivelOi ? 'bg-teal-500' : 'bg-emerald-500')
                    : 'bg-slate-600';
            return `<button onclick="examJumpTo(${pos})"
                class="w-5 h-5 rounded-full ${color} transition hover:opacity-80" title="Pregunta ${pos+1}"></button>`;
        }).join('');
    }

    function selectExamOption(k) {
        if (examSubmitted) return;
        const origIdx = examOrder[examPos];
        examAnswers[origIdx] = k;
        renderExamQuestion();
    }

    function selectExamLevel(n) {
        if (examSubmitted) return;
        const origIdx = examOrder[examPos];
        examAnswers[origIdx] = String(n);
        renderExamQuestion();
    }

    function examNav(delta) {
        const newPos = examPos + delta;
        if (newPos < 0 || newPos >= examOrder.length) return;
        examPos = newPos;
        renderExamQuestion();
    }

    function examJumpTo(pos) {
        examPos = pos;
        renderExamQuestion();
    }

    async function submitExam() {
        const total     = sessionData.questions.length;
        // Contar preguntas sin responder: MC sin selección + abiertas sin texto
        const answered  = examOrder.filter(oi => {
            const ans = examAnswers[oi];
            if (!ans) return false;
            const q = sessionData.questions[oi];
            if ((q?.tipo || 'multiple_choice') === 'abierta') return ans.trim().length > 0;
            return true;
        }).length;
        const remaining = total - answered;
        if (remaining > 0) {
            if (!confirm(`Tienes ${remaining} pregunta${remaining > 1 ? 's' : ''} sin responder. ¿Deseas entregar el examen de todas formas?`)) return;
        }
        await doSubmitExam();
    }

    async function autoSubmitExam() {
        if (examSubmitted) return;
        await doSubmitExam();
    }

    async function doSubmitExam() {
        examSubmitted = true;
        if (examTimerInt) { clearInterval(examTimerInt); examTimerInt = null; }

        // Mostrar pantalla de entrega inmediatamente con estado "enviando"
        showView('view-ended');
        const renderSubmitScreen = (state) => {
            if (state === 'sending') {
                $('ended-content').innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-[60vh] space-y-6 fade-in">
                        <div class="text-6xl">📤</div>
                        <h2 class="text-2xl font-extrabold text-white text-center">Enviando examen…</h2>
                        <p id="submit-attempt-msg" class="text-slate-400 text-sm">Guardando tus respuestas, por favor espera.</p>
                        <div class="flex items-center gap-2 text-indigo-400 text-sm">
                            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Conectando…
                        </div>
                    </div>`;
            } else if (state === 'ok') {
                $('ended-content').innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-[60vh] space-y-6 fade-in">
                        <div class="text-6xl">📬</div>
                        <h2 class="text-2xl font-extrabold text-white text-center">¡Examen entregado!</h2>
                        <p class="text-slate-400 text-center text-sm max-w-xs">
                            Tus respuestas han sido registradas correctamente.<br>
                            Espera a que el profesor concluya la sesión para ver tus resultados.
                        </p>
                        <div class="flex items-center gap-2 text-teal-400 text-sm">
                            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Esperando al profesor…
                        </div>
                    </div>`;
            } else {
                // Error: mostrar botón de reintento
                $('ended-content').innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-[60vh] space-y-6 fade-in">
                        <div class="text-6xl">⚠️</div>
                        <h2 class="text-2xl font-extrabold text-red-400 text-center">Error al enviar</h2>
                        <p class="text-slate-400 text-center text-sm max-w-xs">
                            No se pudo registrar tu examen.<br>
                            <strong class="text-white">Avisa de inmediato a tu profesor y no cierres esta ventana.</strong>
                        </p>
                        <button onclick="doSubmitExam()"
                            class="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition">
                            🔄 Reintentar entrega
                        </button>
                    </div>`;
            }
        };

        renderSubmitScreen('sending');

        // Construir el mapa de respuestas del participante
        const myVotes = {};
        Object.entries(examAnswers).forEach(([idx, opt]) => { myVotes[String(idx)] = opt; });

        // ── Reintentos con escritura atómica (RPC) + fallback clásico ───────────
        // Intenta primero la función RPC atómica (submit_exam_answer) que elimina
        // la condición de carrera. Si no está instalada, usa el método clásico
        // fetch→merge→push con verificación post-escritura.
        let success = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const msgEl = document.getElementById('submit-attempt-msg');
            if (msgEl && attempt > 1) msgEl.textContent = `Reintentando… (intento ${attempt} de 3)`;

            try {
                // ── Intento 1: RPC atómica (requiere función en Supabase) ──────
                const { data: rpcData, error: rpcError } = await sb.rpc('submit_exam_answer', {
                    p_session_id:     cloudId,
                    p_participant_id: participantId,
                    p_answers:        myVotes
                });

                if (!rpcError && rpcData?.ok) {
                    // RPC exitosa — actualizar estado local con los datos del servidor
                    const latest = await fetchData();
                    if (latest) sessionData = latest;
                    success = true;
                    console.log('[IPOS] Entrega vía RPC atómica exitosa.');
                    break;
                }

                // ── Fallback: método clásico con fetch→merge→push→verify ───────
                if (rpcError?.code === 'PGRST202' || rpcError?.message?.includes('not exist')) {
                    // La función RPC no está instalada aún — usar método clásico
                    console.warn('[IPOS] RPC submit_exam_answer no encontrada. Usando método clásico.');
                }

                const latest = await fetchData();
                if (latest) sessionData = latest;
                sessionData.participantVotes                = sessionData.participantVotes || {};
                sessionData.participantVotes[participantId] = myVotes;
                sessionData.examSubmissions                 = sessionData.examSubmissions || {};
                sessionData.examSubmissions[participantId]  = { submittedAt: Date.now() };

                const { error: pushError } = await sb.from('quiz_session')
                    .update({ data: sessionData })
                    .eq('id', cloudId);
                if (pushError) console.error(`[IPOS] doSubmitExam push intento ${attempt}:`, pushError.message);

                // Verificar que mis respuestas quedaron escritas
                await new Promise(r => setTimeout(r, 700));
                const verification = await fetchData();
                if (verification?.participantVotes?.[participantId]) {
                    sessionData = verification;
                    success = true;
                    break;
                }
            } catch(e) {
                console.error(`[IPOS] doSubmitExam intento ${attempt} excepción:`, e);
            }
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
        }

        renderSubmitScreen(success ? 'ok' : 'error');
        if (!success) {
            console.error('[IPOS] doSubmitExam: entrega fallida tras 3 intentos. participantId:', participantId);
        }
    }
