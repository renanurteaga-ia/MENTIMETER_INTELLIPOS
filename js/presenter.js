// IntelliPOS Interactive — presenter.js

    // ── MODO PRESENTADOR ──────────────────────────────────────────────────────
    function initPresenterMode() {
        $('role-badge').textContent = 'Presentador';
        $('session-title-display').textContent = sessionData.name;
        showView('view-presenter');
        initChart();
        renderPresenterQuestion();

        const url = location.origin + location.pathname + '?id=' + cloudId;
        $('participant-link-input').value = url;
        $('qr-image-tag').src = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=240&margin=2&ecLevel=M`;

        // Realtime + polling ya pueden estar corriendo desde el lobby; no duplicar
        if (!fallbackInt) {
            subscribeRealtime(true);
            startPolling(true);
        }
        if (sessionData.timerSeconds > 0) startTimer(sessionData.timerSeconds, true);
    }

    function renderPresenterQuestion() {
        const q = sessionData.questions[sessionData.currentIndex];
        if (!q) return;

        $('presenter-question-text').textContent = q.pregunta;
        $('presenter-counter').textContent = `Pregunta ${sessionData.currentIndex + 1} / ${sessionData.questions.length}`;
        // Imagen de la pregunta (quiz presentador)
        const pqImgWrap = $('presenter-question-image');
        const pqImg = $('presenter-q-img');
        if (q.imageUrl) { pqImg.src = q.imageUrl; pqImgWrap.classList.remove('hidden'); }
        else { pqImgWrap.classList.add('hidden'); pqImg.src = ''; }
        updateRevealBtn();

        const tipoQ         = q.tipo || 'multiple_choice';
        const esAbiertaPres = tipoQ === 'abierta';
        const esPonderada   = tipoQ === 'ponderada';
        const esNivelPres   = tipoQ === 'nivel_rango';

        if (esNivelPres) {
            // ── Nivel-Rango: mostrar distribución de niveles 1-5 ──────────────
            const chartWrap = $('resultsChart');
            if (chartWrap) chartWrap.parentElement.parentElement.classList.add('hidden');

            const totalPart  = Object.keys(sessionData.participants || {}).length;
            const voterList  = (sessionData.voters || {})[String(sessionData.currentIndex)] || [];
            const respondido = voterList.length;
            const pct        = totalPart > 0 ? Math.round(respondido / totalPart * 100) : 0;

            const counts = [1,2,3,4,5].map(n => ({
                n,
                count: sessionData.votes[sessionData.currentIndex+'_'+n] || 0
            }));
            const maxCount = Math.max(...counts.map(c => c.count), 1);

            $('presenter-options-grid').innerHTML = `
                <div class="lg:col-span-2 p-5 bg-slate-800 rounded-2xl border border-teal-700/50 shadow-xl space-y-4">
                    <div class="flex items-center justify-between">
                        <p class="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                            <i class="fa-solid fa-layer-group mr-1"></i>${q.dimensionNombre || 'Dimensión '+q.dimension}
                        </p>
                        <p class="text-xs text-slate-400">${respondido}/${totalPart} respondieron (${pct}%)</p>
                    </div>
                    <div class="grid grid-cols-5 gap-3">
                        ${counts.map(({n, count}) => `
                        <div class="flex flex-col items-center gap-1">
                            <span class="text-sm font-bold text-slate-300">${count}</span>
                            <div class="w-full bg-slate-700 rounded-full overflow-hidden" style="height:64px">
                                <div class="w-full rounded-full bg-teal-500 transition-all duration-700"
                                     style="height:${Math.round(count/maxCount*100)}%;margin-top:${100-Math.round(count/maxCount*100)}%"></div>
                            </div>
                            <span class="text-lg font-extrabold text-teal-300">${n}</span>
                        </div>`).join('')}
                    </div>
                    <div class="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-teal-500 transition-all duration-500" style="width:${pct}%"></div>
                    </div>
                </div>`;

        } else if (esPonderada) {
            // ── Pregunta ponderada ─────────────────────────────────────────────
            const chartWrap = $('resultsChart');
            if (chartWrap) chartWrap.parentElement.parentElement.classList.remove('hidden');

            const total = ['A','B','C','D'].reduce((s,k) => s + (sessionData.votes[sessionData.currentIndex+'_'+k] || 0), 0);
            $('presenter-options-grid').innerHTML = ['A','B','C','D'].map(k => {
                const text = q['opcion'+k];
                if (!text) return '';
                const pts    = q['puntaje'+k] !== undefined ? q['puntaje'+k] : 0;
                const count  = sessionData.votes[sessionData.currentIndex+'_'+k] || 0;
                const pct    = total > 0 ? Math.round(count/total*100) : 0;
                return `
                <div class="p-4 rounded-xl border transition shadow-md bg-slate-800/90 border-slate-700">
                    <div class="flex justify-between items-center mb-2 gap-2">
                        <p class="font-bold text-sm leading-snug"><span class="text-violet-400">${k}:</span> ${text}</p>
                        ${sessionData.reveal
                            ? `<span class="text-xs bg-violet-900/60 border border-violet-700/60 text-violet-300 font-bold px-2 py-0.5 rounded shrink-0">${pts} pts</span>`
                            : ''}
                    </div>
                    <div class="flex items-center space-x-2">
                        <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-500 bg-violet-500" style="width:${pct}%"></div>
                        </div>
                        <span class="text-xs text-slate-400 font-semibold shrink-0">${count} (${pct}%)</span>
                    </div>
                </div>`;
            }).join('');

            if (chartInst) updateChart();

        } else if (esAbiertaPres) {
            // ── Pregunta abierta: mostrar conteo de respuestas ────────────────
            const totalPart  = Object.keys(sessionData.participants || {}).length;
            const voterList  = (sessionData.voters || {})[String(sessionData.currentIndex)] || [];
            const respondido = voterList.length;
            const pct        = totalPart > 0 ? Math.round(respondido / totalPart * 100) : 0;

            $('presenter-options-grid').innerHTML = `
                <div class="lg:col-span-2 p-5 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl space-y-3">
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Respuestas recibidas</p>
                    <div class="flex items-end gap-4">
                        <p class="text-5xl font-extrabold text-indigo-300">${respondido}</p>
                        <p class="text-slate-400 text-sm mb-1">de ${totalPart} participante${totalPart !== 1 ? 's' : ''} (${pct}%)</p>
                    </div>
                    <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-indigo-500 transition-all duration-500" style="width:${pct}%"></div>
                    </div>
                    <p class="text-xs text-amber-400 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>Las respuestas escritas se mostrarán en la pantalla de resultados finales.</p>
                </div>`;

            // Ocultar el chart para preguntas abiertas
            const chartWrap = $('resultsChart');
            if (chartWrap) chartWrap.parentElement.parentElement.classList.add('hidden');
        } else {
            // ── Pregunta MC ────────────────────────────────────────────────────
            const chartWrap = $('resultsChart');
            if (chartWrap) chartWrap.parentElement.parentElement.classList.remove('hidden');

            const total = ['A','B','C','D'].reduce((s,k) => s + (sessionData.votes[sessionData.currentIndex+'_'+k] || 0), 0);
            $('presenter-options-grid').innerHTML = ['A','B','C','D'].map(k => {
                const text = q['opcion'+k];
                if (!text) return '';
                const isOk   = sessionData.reveal && k === q.correcta;
                const count  = sessionData.votes[sessionData.currentIndex+'_'+k] || 0;
                const pct    = total > 0 ? Math.round(count/total*100) : 0;
                return `
                <div class="p-4 rounded-xl border transition shadow-md ${isOk ? 'bg-emerald-950/40 border-emerald-500' : 'bg-slate-800/90 border-slate-700'}">
                    <div class="flex justify-between items-center mb-2 gap-2">
                        <p class="font-bold text-sm leading-snug"><span class="text-indigo-400">${k}:</span> ${text}</p>
                        ${isOk ? '<span class="text-xs bg-emerald-500 text-slate-950 font-extrabold px-2 py-0.5 rounded shrink-0">CORRECTA</span>' : ''}
                    </div>
                    <div class="flex items-center space-x-2">
                        <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-500 ${isOk ? 'bg-emerald-400' : 'bg-indigo-500'}" style="width:${pct}%"></div>
                        </div>
                        <span class="text-xs text-slate-400 font-semibold shrink-0">${count} (${pct}%)</span>
                    </div>
                </div>`;
            }).join('');

            if (chartInst) updateChart();
        }

        updateParticipantsList();
    }

    function updateParticipantsList() {
        const parts = sessionData.participants || {};
        const names = Object.values(parts);
        $('participants-count').textContent = names.length;
        $('participants-list').innerHTML = names.length === 0
            ? '<p class="text-slate-500 italic">Esperando participantes…</p>'
            : names.map(n => `
                <div class="flex items-center space-x-2 py-1 border-b border-slate-700/40">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 pulse-dot"></span>
                    <span class="truncate">${n}</span>
                </div>`).join('');
    }

    function updateRevealBtn() {
        const btn = $('btn-reveal');
        if (sessionData.reveal) {
            btn.className = 'shrink-0 px-3 py-1.5 bg-amber-500 text-slate-900 rounded-xl text-xs font-semibold transition whitespace-nowrap';
            btn.innerHTML = '<i class="fa-solid fa-eye-slash mr-1"></i>Ocultar';
        } else {
            btn.className = 'shrink-0 px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/50 rounded-xl text-xs font-semibold transition whitespace-nowrap';
            btn.innerHTML = '<i class="fa-solid fa-eye mr-1"></i>Ver Respuesta';
        }
    }

    async function toggleReveal() {
        sessionData.reveal = !sessionData.reveal;
        updateRevealBtn();
        renderPresenterQuestion();
        await push();
    }

    async function nextQuestion() {
        if (sessionData.currentIndex < sessionData.questions.length - 1) {
            sessionData.currentIndex++;
            sessionData.reveal = false;
            sessionData.questionChangedAt = Date.now();
            renderPresenterQuestion();
            await push();
            if (sessionData.timerSeconds > 0) startTimer(sessionData.timerSeconds, true);
        }
    }

    async function prevQuestion() {
        if (sessionData.currentIndex > 0) {
            sessionData.currentIndex--;
            sessionData.reveal = false;
            sessionData.questionChangedAt = Date.now();
            renderPresenterQuestion();
            await push();
            if (sessionData.timerSeconds > 0) startTimer(sessionData.timerSeconds, true);
        }
    }

    async function endSession() {
        if (!confirm('¿Deseas finalizar la sesión? Los participantes verán sus resultados.')) return;
        sessionData.status = 'ended';

        // Refrescar participantVotes desde Supabase (por si hubo votos tardíos)
        try {
            const { data: freshRow } = await sb.from('quiz_session')
                .select('data').eq('id', cloudId).single();
            if (freshRow?.data) {
                const f = freshRow.data;
                if (f.participants    && Object.keys(f.participants).length > 0)
                    sessionData.participants    = f.participants;
                if (f.participantVotes && Object.keys(f.participantVotes).length > 0)
                    sessionData.participantVotes = f.participantVotes;
            }
        } catch(e) {
            console.warn('[IPOS] endSession: no se pudo refrescar datos de Supabase:', e);
        }

        await saveSessionResults();
        await push();
        // Limpiar registro de Supabase después de 5 minutos
        setTimeout(async () => {
            try { await sb.from('quiz_session').delete().eq('id', cloudId); } catch(_) {}
        }, 300000);
        // Parar polling
        if (fallbackInt) { clearInterval(fallbackInt); fallbackInt = null; }
        renderEndPresenter();
    }

    // ── GUARDAR RESULTADOS EN SUPABASE ────────────────────────────────────────
    async function saveSessionResults() {
        if (!cloudId) return;
        const questions        = sessionData.questions        || [];
        const participants     = sessionData.participants     || {};
        const participantVotes = sessionData.participantVotes || {};
        const quizId           = sessionData.quizId           || null;
        const listId           = sessionData.participantListId || null;
        const rangos           = sessionData.rangos           || [];

        if (Object.keys(participants).length === 0) return;

        const hasPonderada  = questions.some(q => q.tipo === 'ponderada');
        const hasNivelRango = questions.some(q => q.tipo === 'nivel_rango');
        const pondQuestions = questions.filter(q => q.tipo === 'ponderada');
        const rangosDim     = sessionData.rangosDim || {};

        // Puntaje posible: solo preguntas MC (no abiertas, no ponderadas, no nivel_rango)
        const puntajePosible = (hasPonderada || hasNivelRango) ? 0 : questions.reduce((s, q) =>
            (q.tipo || 'multiple_choice') === 'multiple_choice' ? s + (q.puntaje || 1) : s, 0);

        const rows = Object.entries(participants).map(([pid, nick]) => {
            const pvotes = participantVotes[pid] || {};
            let puntajeObtenido = 0;

            const respuestas = questions.map((q, idx) => {
                const tipo          = q.tipo || 'multiple_choice';
                const respuestaDada = pvotes[String(idx)] || null;

                if (tipo === 'abierta') {
                    return {
                        question_id:            q.id || null,
                        tipo:                   'abierta',
                        respuesta_dada:         respuestaDada,
                        correcta:               null,
                        puntaje_obtenido:       0,
                        puntaje_maximo:         q.puntaje || 1,
                        pendiente_calificacion: true
                    };
                }

                if (tipo === 'ponderada') {
                    const pts = respuestaDada ? (q['puntaje' + respuestaDada] || 0) : 0;
                    puntajeObtenido += pts;
                    return {
                        question_id:      q.id || null,
                        tipo:             'ponderada',
                        respuesta_dada:   respuestaDada,
                        correcta:         null,
                        puntaje_obtenido: pts,
                        puntaje_maximo:   Math.max(q.puntajeA||0, q.puntajeB||0, q.puntajeC||0, q.puntajeD||0)
                    };
                }

                if (tipo === 'nivel_rango') {
                    const nivel = parseInt(respuestaDada) || 0;
                    return {
                        question_id:      q.id || null,
                        tipo:             'nivel_rango',
                        respuesta_dada:   respuestaDada,
                        correcta:         null,
                        puntaje_obtenido: nivel,
                        puntaje_maximo:   5,
                        dimension:        q.dimension,
                        dimensionNombre:  q.dimensionNombre
                    };
                }

                // MC
                const esCorrecta = respuestaDada !== null && respuestaDada === q.correcta;
                const puntajeQ   = q.puntaje || 1;
                const pts        = esCorrecta ? puntajeQ : 0;
                puntajeObtenido += pts;
                return {
                    question_id:      q.id || null,
                    tipo:             'multiple_choice',
                    respuesta_dada:   respuestaDada,
                    correcta:         esCorrecta,
                    puntaje_obtenido: pts,
                    puntaje_maximo:   puntajeQ
                };
            });

            // Para NIVEL-RANGO: calcular promedio por dimensión y el rango obtenido
            let rangos_dim_obtenidos = null;
            if (hasNivelRango) {
                rangos_dim_obtenidos = {};
                const nivelResps = respuestas.filter(r => r.tipo === 'nivel_rango');
                // Agrupar suma y conteo por dimensión
                const sumaPorDim  = {};
                const countPorDim = {};
                nivelResps.forEach(r => {
                    const d = r.dimension || '1';
                    sumaPorDim[d]  = (sumaPorDim[d]  || 0) + (r.puntaje_obtenido || 0);
                    countPorDim[d] = (countPorDim[d] || 0) + 1;
                });
                Object.entries(sumaPorDim).forEach(([d, suma]) => {
                    const count    = countPorDim[d] || 1;
                    const promedio = Math.round((suma / count) * 100) / 100;   // 2 decimales
                    const rangosD  = rangosDim[d] || [];
                    const rango    = rangosD.find(r => promedio >= r.min && promedio <= r.max) || null;
                    rangos_dim_obtenidos[d] = { promedio, rango };
                });
            }

            // Para ponderada: puntaje_total y rango; para MC: nota 0-20
            let nota = null, puntaje_total = null, rango_obtenido = null;
            if (hasPonderada) {
                puntaje_total  = puntajeObtenido;
                rango_obtenido = rangos.find(r => puntaje_total >= r.min && puntaje_total <= r.max) || null;
            } else if (!hasNivelRango) {
                nota = puntajePosible > 0
                    ? Math.round((puntajeObtenido / puntajePosible) * 20 * 10) / 10
                    : null;
            }

            return {
                quiz_session_id:            cloudId,
                quiz_id:                    quizId,
                participant_list_id:        listId,
                alcance:                    sessionData.alcance      || 'sesion',
                sesion_numero:              sessionData.sesionNumero || null,
                participante_codigo:        pid,
                participante_identificador: nick,
                respuestas,
                puntaje_obtenido:           puntajeObtenido,
                puntaje_posible:            puntajePosible,
                nota,
                puntaje_total,
                rango_obtenido,
                rangos_dim_obtenidos,
                completado_en:              new Date().toISOString()
            };
        });

        // Reintentos con backoff (hasta 3 intentos)
        let saved = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const { error } = await sb.from('session_results')
                    .upsert(rows, { onConflict: 'quiz_session_id,participante_codigo' });
                if (!error) {
                    console.log(`[IPOS] Resultados guardados (intento ${attempt}):`, rows.length, 'participantes');
                    saved = true;
                    break;
                }
                console.error(`[IPOS] saveSessionResults intento ${attempt}:`, error.message);
            } catch(e) {
                console.error(`[IPOS] saveSessionResults intento ${attempt} excepción:`, e);
            }
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
        if (!saved) {
            // Aviso visible al instructor — los datos en memoria siguen disponibles para el Excel
            showToast('⚠️ No se pudo guardar en la nube tras 3 intentos. Descarga el Excel ahora para conservar los resultados.', 'error', 12000);
            console.error('[IPOS] saveSessionResults falló definitivamente. Datos disponibles en memoria.');
        }
        return saved;
    }

    // ── Presentador: iniciar vista del examen ─────────────────────────────────
    function initExamPresenter() {
        $('role-badge').textContent = 'Presentador';
        $('exam-session-title').textContent = sessionData.name;
        showView('view-exam-presenter');
        subscribeRealtime(true);
        startPolling(true);

        examTotalSecs = sessionData.examMinutes * 60;
        const startedAt = sessionData.examStartedAt;

        if (examTimerInt) clearInterval(examTimerInt);
        examTimerInt = setInterval(() => {
            const elapsed  = Math.floor((Date.now() - startedAt) / 1000);
            const left     = Math.max(0, examTotalSecs - elapsed);
            $('exam-timer-display').textContent = fmtTime(left);
            const pct = left / examTotalSecs * 100;
            const bar = $('exam-timer-bar');
            if (bar) bar.style.width = pct + '%';
            if (bar) bar.className = `h-full rounded-full transition-all duration-1000 ${pct > 30 ? 'bg-indigo-500' : pct > 10 ? 'bg-amber-500' : 'bg-red-500'}`;
            // Actualizar conteo de entregas
            const subs  = Object.keys(sessionData.examSubmissions || {}).length;
            const total = Object.keys(sessionData.participants     || {}).length;
            $('exam-submitted-count').textContent = subs;
            $('exam-total-count').textContent     = total;
            // Finalizar automáticamente cuando el tiempo llega a 0
            if (left === 0) {
                clearInterval(examTimerInt);
                endExamEarly();
            }
        }, 1000);
    }

    async function endExamEarly() {
        if (sessionData.status === 'ended') return;
        sessionData.status = 'ended';

        // ── Refrescar desde Supabase antes de guardar ─────────────────────────
        // En modo examen los participantes envían directamente via RPC; la copia
        // en memoria del presentador puede estar incompleta si Realtime llegó tarde.
        try {
            const { data: freshRow } = await sb.from('quiz_session')
                .select('data').eq('id', cloudId).single();
            if (freshRow?.data) {
                const f = freshRow.data;
                if (f.participants    && Object.keys(f.participants).length > 0)
                    sessionData.participants    = f.participants;
                if (f.participantVotes && Object.keys(f.participantVotes).length > 0)
                    sessionData.participantVotes = f.participantVotes;
                if (f.examSubmissions  && Object.keys(f.examSubmissions).length > 0)
                    sessionData.examSubmissions  = f.examSubmissions;
            }
        } catch(e) {
            console.warn('[IPOS] endExamEarly: no se pudo refrescar datos de Supabase:', e);
        }

        await saveSessionResults();
        await push();
        clearInterval(examTimerInt);
        clearInterval(fallbackInt); fallbackInt = null;
        renderEndPresenter();
    }
