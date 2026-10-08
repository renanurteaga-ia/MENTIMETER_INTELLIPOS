// IntelliPOS Interactive — participant.js

    // ── MODO PARTICIPANTE ─────────────────────────────────────────────────────
    window.onload = async () => {
        const params = new URLSearchParams(location.search);

        // v2.7: Boleta personal via ?results=<sid>&pid=<pid>
        const resultsId = params.get('results');
        const boletaPid = params.get('pid');
        if (resultsId && boletaPid) {
            await loadBoleta(resultsId, boletaPid);
            return;
        }

        cloudId = params.get('id');
        if (!cloudId) return; // Modo presentador: espera en pantalla de configuración

        participantId = getParticipantId();
        $('role-badge').textContent = 'Participante';

        // Pre-cargar datos de la sesión
        const data = await fetchData();
        if (!data) {
            showView('view-nickname');
            $('nickname-session-name').textContent = 'Sesión no encontrada. Pide al presentador el enlace correcto.';
            $('view-nickname').querySelector('button')?.setAttribute('disabled','true');
            return;
        }
        sessionData = data;
        if (sessionData.questions) sessionData.questions = normalizarPreguntas(sessionData.questions);

        if (sessionData.status === 'ended') { renderEndParticipant(); return; }

        // Mostrar el nombre de la sesión en la pantalla de apodo
        if (sessionData.name) $('nickname-session-name').textContent = `Únete a: ${sessionData.name}`;

        // Determinar si la sesión es cerrada o examen
        const isClosed = sessionData.accessType === 'closed' || sessionData.mode === 'exam';
        if (isClosed && sessionData.participantList) {
            // Modo cerrado: mostrar campo de código
            $('join-open').classList.add('hidden');
            $('join-closed').classList.remove('hidden');
            $('join-icon').textContent = '🔒';
            $('join-title').textContent = '¡Bienvenido!';
            $('nickname-session-name').textContent = `Sesión: ${sessionData.name}. Ingresa tu código de alumno para unirte.`;
            $('code-input').value = '';
            $('code-error').classList.add('hidden');
        } else {
            // Modo abierto: mostrar campo de nickname
            $('join-open').classList.remove('hidden');
            $('join-closed').classList.add('hidden');
            $('join-icon').textContent = '👋';
            $('join-title').textContent = '¡Bienvenido!';
            $('nickname-session-name').textContent = `Sesión: ${sessionData.name}. Ingresa tu nombre para unirte.`;
            // Auto-completar apodo si ya se había registrado
            const savedNick = localStorage.getItem('ipos_nick_' + cloudId);
            if (savedNick) $('nickname-input').value = savedNick;
        }

        showView('view-nickname');
    };

    async function joinSession() {
        const nick = $('nickname-input').value.trim();
        if (!nick) { alert('Por favor ingresa tu nombre o apodo.'); return; }
        participantNick = nick;
        localStorage.setItem('ipos_nick_' + cloudId, nick);

        // Registrar participante en Supabase
        const latest = await fetchData();
        if (!latest) { alert('Error al conectar con la sesión.'); return; }
        sessionData = latest;
        // Normalizar tipo de preguntas (compatibilidad con quizzes guardados sin campo 'tipo')
        if (sessionData.questions) sessionData.questions = normalizarPreguntas(sessionData.questions);

        if (sessionData.status === 'ended') { renderEndParticipant(); return; }

        sessionData.participants = sessionData.participants || {};
        sessionData.participants[participantId] = nick;
        await push();

        subscribeRealtime(false);
        startPolling(false);

        if (sessionData.status === 'lobby') {
            // Cuestionario todavía no ha empezado — ir al lobby de espera
            $('lobby-wait-name').textContent = `Hola, ${nick}! El presentador iniciará el cuestionario en breve.`;
            showView('view-lobby-participant');
            updateLobbyPeersList();
        } else {
            // El cuestionario ya está en marcha — entrar directamente
            $('nickname-badge').textContent = '👤 ' + nick;
            showView('view-participant');
            renderParticipantQuestion();
            startParticipantTimer(sessionData.timerSeconds, sessionData.questionChangedAt);
        }
    }

    async function joinSessionWithCode() {
        const code = $('code-input').value.trim().toUpperCase();
        const errEl = $('code-error');
        errEl.classList.add('hidden');

        if (!code) { errEl.textContent = 'Por favor ingresa tu código de alumno.'; errEl.classList.remove('hidden'); return; }

        // Buscar en la lista de participantes de la sesión
        const lista = sessionData.participantList || [];
        const participante = lista.find(p => p.codigo && p.codigo.toUpperCase() === code);

        if (!participante) {
            errEl.textContent = `Código "${code}" no encontrado en la lista de participantes. Verifica tu código e intenta de nuevo.`;
            errEl.classList.remove('hidden');
            return;
        }

        // Usar el identificador generado como nick
        participantNick = participante.identificador;

        // Registrar participante
        const latest = await fetchData();
        if (!latest) { errEl.textContent = 'Error al conectar con la sesión.'; errEl.classList.remove('hidden'); return; }
        sessionData = latest;
        // Normalizar tipo de preguntas (compatibilidad con quizzes guardados sin campo 'tipo')
        if (sessionData.questions) sessionData.questions = normalizarPreguntas(sessionData.questions);

        if (sessionData.status === 'ended') { renderEndParticipant(); return; }

        // Verificar que el código no esté ya en uso (anti-suplantación básica)
        const yaUsado = Object.values(sessionData.participants || {}).includes(participantNick);
        if (yaUsado) {
            errEl.textContent = `Este código ya fue registrado en esta sesión. Si eres tú, recarga la página con el mismo enlace.`;
            errEl.classList.remove('hidden');
            return;
        }

        sessionData.participants = sessionData.participants || {};
        sessionData.participants[participantId] = participantNick;
        await push();

        subscribeRealtime(false);
        startPolling(false);

        if (sessionData.status === 'lobby') {
            $('lobby-wait-name').textContent = `Hola, ${participantNick}! El presentador iniciará en breve.`;
            showView('view-lobby-participant');
            updateLobbyPeersList();
        } else if (sessionData.mode === 'exam' || sessionData.status === 'exam-active') {
            $('nickname-badge').textContent = '👤 ' + participantNick;
            initExamParticipant();
        } else {
            $('nickname-badge').textContent = '👤 ' + participantNick;
            showView('view-participant');
            renderParticipantQuestion();
            startParticipantTimer(sessionData.timerSeconds, sessionData.questionChangedAt);
        }
    }

    function updateLobbyPeersList() {
        const names = Object.values(sessionData.participants || {});
        $('lobby-peers-list').innerHTML = names.length === 0
            ? '<p class="text-slate-500 italic">Solo tú por ahora…</p>'
            : names.map(n => `<div class="py-0.5">👤 ${n}</div>`).join('');
    }

    function handleParticipantUpdate(incoming) {
        const prevStatus = sessionData.status;
        const prevIndex  = sessionData.currentIndex;
        const prevReveal = sessionData.reveal;
        sessionData = incoming;
        // Normalizar tipo de preguntas en cada actualización (compat. con quizzes sin campo 'tipo')
        if (sessionData.questions) sessionData.questions = normalizarPreguntas(sessionData.questions);

        if (sessionData.status === 'ended') { renderEndParticipant(); return; }

        // Transición lobby → activo (cuestionario) o exam-active (examen)
        if (prevStatus === 'lobby') {
            if (sessionData.status === 'active') {
                $('nickname-badge').textContent = '👤 ' + participantNick;
                showView('view-participant');
                renderParticipantQuestion();
                startParticipantTimer(sessionData.timerSeconds, sessionData.questionChangedAt);
                return;
            }
            if (sessionData.status === 'exam-active') {
                initExamParticipant();
                return;
            }
        }

        // Examen finalizado anticipadamente por el presentador
        if (prevStatus === 'exam-active' && sessionData.status === 'ended') {
            autoSubmitExam();
            return;
        }

        // Si el participante ya entregó el examen, solo esperar que el profesor lo concluya
        if (examSubmitted && sessionData.status === 'exam-active') return;

        // Si seguimos en lobby, actualizar la lista de pares
        if (sessionData.status === 'lobby') {
            updateLobbyPeersList();
            return;
        }

        // Si cambió la pregunta, reiniciar timer (sincronizado con questionChangedAt del servidor)
        if (incoming.currentIndex !== prevIndex) {
            lastRenderedIdx = -1;
            if (timerInt) clearInterval(timerInt);
            $('pt-timer-wrap').classList.add('hidden');
            startParticipantTimer(sessionData.timerSeconds, sessionData.questionChangedAt);
        }

        renderParticipantQuestion();

        // Si el presentador reveló la respuesta, actualizar resultados/feedback
        const voteKey = `voted_${cloudId}_${sessionData.currentIndex}`;
        if (localStorage.getItem(voteKey)) {
            renderVoteResults();
        }
    }

    function renderParticipantQuestion() {
        const q = sessionData.questions[sessionData.currentIndex];
        if (!q) return;

        $('participant-counter').textContent = `Pregunta ${sessionData.currentIndex + 1} / ${sessionData.questions.length}`;
        $('mobile-question-text').textContent = q.pregunta;
        // Badge de puntaje (solo visible si hay puntajes distintos a 1 en el quiz)
        const pBadge = $('participant-points-badge');
        const puntajeQ = q.puntaje || 1;
        const hayVariedadPuntajes = sessionData.questions.some(x => (x.puntaje || 1) !== 1);
        if (pBadge) {
            pBadge.textContent = `${puntajeQ} pt${puntajeQ !== 1 ? 's' : ''}`;
            pBadge.classList.toggle('hidden', !hayVariedadPuntajes);
        }
        // Imagen de la pregunta (quiz participante)
        const mqImgWrap = $('mobile-question-image');
        const mqImg = $('participant-q-img');
        if (q.imageUrl) { mqImg.src = q.imageUrl; mqImgWrap.classList.remove('hidden'); }
        else { mqImgWrap.classList.add('hidden'); mqImg.src = ''; }

        const voteKey     = `voted_${cloudId}_${sessionData.currentIndex}`;
        const votedOption = localStorage.getItem(voteKey);
        const container   = $('mobile-options-container');

        const tipoQ     = q.tipo || 'multiple_choice';
        const esAbierta = tipoQ === 'abierta';
        const esPond    = tipoQ === 'ponderada';
        const esNivel   = tipoQ === 'nivel_rango';
        const esPerfil  = tipoQ === 'perfil';

        if (esAbierta) {
            // ── Pregunta abierta ──────────────────────────────────────────────
            $('vote-results').classList.add('hidden');
            const openKey       = `open_${cloudId}_${sessionData.currentIndex}`;
            const yaRespondio   = localStorage.getItem(openKey);

            if (yaRespondio) {
                container.innerHTML = `
                    <div class="p-5 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl text-center fade-in">
                        <p class="text-emerald-400 font-bold">✅ Respuesta enviada</p>
                        <p class="text-slate-400 text-sm mt-1">Esperando al presentador.</p>
                    </div>`;
            } else if ($('open-answer-text')) {
                // El textarea ya existe (el participante está escribiendo) — no recrearlo
                return;
            } else {
                container.innerHTML = `
                    <div class="fade-in">
                        <textarea id="open-answer-text" rows="4"
                            class="w-full p-3 bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Escribe tu respuesta aquí..."></textarea>
                        <button onclick="submitOpenAnswer()"
                            class="mt-3 w-full p-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl font-bold text-white shadow-lg transition">
                            Enviar respuesta
                        </button>
                    </div>`;
            }
        } else if (esPond && votedOption) {
            // ── Ponderada: ya respondió ───────────────────────────────────────
            const ptsObtenidos = q['puntaje' + votedOption] || 0;
            let feedback = '';
            if (sessionData.reveal) {
                feedback = `<p class="text-violet-300 font-semibold mt-1">📊 Tu respuesta vale <strong class="text-2xl text-violet-200">${ptsObtenidos}</strong> puntos</p>`;
            } else {
                feedback = '<p class="text-xs text-slate-400 mt-1">Esperando a que el presentador avance.</p>';
            }
            container.innerHTML = `
                <div class="p-5 bg-slate-800 rounded-2xl border border-violet-700/50 shadow-xl text-center fade-in">
                    <p class="text-violet-300 font-bold">¡Elegiste la opción ${votedOption}!</p>
                    ${feedback}
                </div>`;
            $('vote-results').classList.remove('hidden');
            renderVoteResults();

        } else if (esPond) {
            // ── Ponderada: mostrar opciones ───────────────────────────────────
            $('vote-results').classList.add('hidden');
            container.innerHTML = ['A','B','C','D'].map(k => {
                const text = q['opcion'+k];
                if (!text) return '';
                return `
                <button onclick="submitVote('${k}')"
                    class="w-full p-4 bg-violet-700 hover:bg-violet-600 active:scale-95 rounded-xl font-bold text-white shadow-lg transition text-left flex items-center justify-between fade-in">
                    <span><strong class="text-violet-200 mr-2">${k}:</strong>${text}</span>
                    <i class="fa-solid fa-chevron-right text-xs opacity-60"></i>
                </button>`;
            }).join('');

        } else if (esNivel && votedOption) {
            // ── Nivel-Rango: ya respondió ─────────────────────────────────────
            container.innerHTML = `
                <div class="p-5 bg-slate-800 rounded-2xl border border-teal-700/50 shadow-xl text-center fade-in">
                    <p class="text-teal-300 font-bold">✅ Nivel enviado: <strong class="text-3xl text-teal-200">${votedOption}</strong></p>
                    <p class="text-xs text-slate-400 mt-2">Dimensión: ${q.dimensionNombre || 'Dim '+q.dimension}</p>
                    <p class="text-xs text-slate-500 mt-1">Esperando al presentador.</p>
                </div>`;
            $('vote-results').classList.add('hidden');

        } else if (esNivel) {
            // ── Nivel-Rango: seleccionar nivel 1-5 ───────────────────────────
            $('vote-results').classList.add('hidden');
            container.innerHTML = `
                <div class="fade-in space-y-3">
                    <div class="bg-teal-950/40 border border-teal-700/40 rounded-xl p-3 text-center">
                        <p class="text-xs font-semibold text-teal-300 uppercase tracking-wider">${q.dimensionNombre || 'Dimensión '+q.dimension}</p>
                        <p class="text-xs text-slate-400 mt-1">Elige tu nivel (1 = bajo · 5 = alto)</p>
                    </div>
                    <div class="grid grid-cols-5 gap-2">
                        ${[1,2,3,4,5].map(n => `
                        <button onclick="submitLevelVote(${n})"
                            class="aspect-square rounded-xl font-extrabold text-xl bg-teal-700 hover:bg-teal-500 active:scale-95 text-white shadow-lg transition">
                            ${n}
                        </button>`).join('')}
                    </div>
                </div>`;

        } else if (esPerfil && votedOption) {
            // ── Perfil: ya respondió — mostrar opción elegida sin revelar perfil
            const textoElegido = q['opcion' + votedOption] || '';
            container.innerHTML = `
                <div class="p-5 bg-slate-800 rounded-2xl border border-rose-700/50 shadow-xl text-center fade-in">
                    <p class="text-rose-300 font-bold">✅ Elegiste la opción <strong>${votedOption}</strong></p>
                    ${textoElegido ? `<p class="text-sm text-slate-300 mt-2 italic">"${textoElegido}"</p>` : ''}
                    <p class="text-xs text-slate-400 mt-2">Esperando al presentador para la siguiente pregunta.</p>
                </div>`;
            $('vote-results').classList.add('hidden');

        } else if (esPerfil) {
            // ── Perfil: mostrar opciones con texto real de la opción ──────────
            $('vote-results').classList.add('hidden');
            container.innerHTML = ['A','B','C','D'].map(k => {
                const text = q['opcion'+k];
                if (!text) return '';
                return `
                <button onclick="submitVote('${k}')"
                    class="w-full p-4 bg-rose-700 hover:bg-rose-600 active:scale-95 rounded-xl font-bold text-white shadow-lg transition text-left flex items-center justify-between fade-in">
                    <span><strong class="text-rose-200 mr-2">${k}:</strong>${text}</span>
                    <i class="fa-solid fa-chevron-right text-xs opacity-60"></i>
                </button>`;
            }).join('');

        } else if (votedOption) {
            // ── MC: ya respondió ─────────────────────────────────────────────
            const isCorrect = sessionData.reveal && votedOption === q.correcta;
            let feedback = '';
            if (sessionData.reveal) {
                feedback = isCorrect
                    ? '<p class="text-emerald-400 font-bold mt-1">✅ ¡Respuesta correcta!</p>'
                    : `<p class="text-red-400 font-semibold mt-1">❌ La respuesta correcta era: <strong>${q.correcta}</strong></p>`;
            } else {
                feedback = '<p class="text-xs text-slate-400 mt-1">Esperando a que el presentador avance.</p>';
            }

            container.innerHTML = `
                <div class="p-5 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl text-center fade-in">
                    <p class="text-indigo-300 font-bold">¡Votaste por la opción ${votedOption}!</p>
                    ${feedback}
                </div>`;

            $('vote-results').classList.remove('hidden');
            renderVoteResults();
        } else {
            // ── MC: mostrar opciones ─────────────────────────────────────────
            $('vote-results').classList.add('hidden');
            container.innerHTML = ['A','B','C','D'].map(k => {
                const text = q['opcion'+k];
                if (!text) return '';
                return `
                <button onclick="submitVote('${k}')"
                    class="w-full p-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl font-bold text-white shadow-lg transition text-left flex items-center justify-between fade-in">
                    <span><strong class="text-indigo-200 mr-2">${k}:</strong>${text}</span>
                    <i class="fa-solid fa-chevron-right text-xs opacity-60"></i>
                </button>`;
            }).join('');
        }

        lastRenderedIdx = sessionData.currentIndex;
    }

    function renderVoteResults() {
        const q = sessionData.questions[sessionData.currentIndex];
        if (!q) return;

        const tipoQ = q.tipo || 'multiple_choice';

        // Preguntas abiertas y nivel_rango no tienen barras A/B/C/D
        if (tipoQ === 'abierta') {
            $('vote-results-bars').innerHTML = `
                <p class="text-slate-400 text-sm text-center py-2">Pregunta abierta — las respuestas serán calificadas por el presentador.</p>`;
            return;
        }
        if (tipoQ === 'nivel_rango') {
            $('vote-results-bars').innerHTML = '';
            return;
        }

        // Perfil: ocultar resultados parciales durante la sesión
        if (tipoQ === 'perfil') {
            $('vote-results-bars').innerHTML = '';
            $('vote-results').classList.add('hidden');
            return;
        }

        const total = ['A','B','C','D'].reduce((s,k) => s + (sessionData.votes[sessionData.currentIndex+'_'+k] || 0), 0);
        $('vote-results-bars').innerHTML = ['A','B','C','D'].map(k => {
            const text  = q['opcion'+k];
            if (!text) return '';
            const count = sessionData.votes[sessionData.currentIndex+'_'+k] || 0;
            const pct   = total > 0 ? Math.round(count/total*100) : 0;
            // Ponderada: mostrar puntaje del opción cuando se revela; MC: marcar correcta
            const isOk  = tipoQ === 'ponderada' ? false : (sessionData.reveal && k === q.correcta);
            const badge = tipoQ === 'ponderada' && sessionData.reveal
                ? `<span class="text-violet-300 font-bold ml-1">(${q['puntaje'+k]||0}pts)</span>`
                : '';
            return `
            <div>
                <div class="flex justify-between text-xs mb-1">
                    <span class="${isOk ? 'text-emerald-400 font-bold' : 'text-slate-300'} truncate mr-2">
                        ${k}: ${text.length > 35 ? text.substring(0,35)+'…' : text}${badge}
                    </span>
                    <span class="text-slate-400 shrink-0">${count} voto${count!==1?'s':''} (${pct}%)</span>
                </div>
                <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700 ${isOk ? 'bg-emerald-400' : tipoQ === 'ponderada' ? 'bg-violet-500' : 'bg-indigo-500'}"
                        style="width:${pct}%"></div>
                </div>
            </div>`;
        }).join('');
    }

    // ── ENVIAR VOTO ───────────────────────────────────────────────────────────
    async function submitVote(k) {
        const voteKey = `voted_${cloudId}_${sessionData.currentIndex}`;
        if (localStorage.getItem(voteKey)) { alert('¡Ya has registrado tu voto en esta pregunta!'); return; }

        // ── Deduplicación server-side ─────────────────────────────────────────
        // Obtenemos el estado más reciente antes de votar
        const latest = await fetchData();
        if (!latest) { alert('Error de conexión. Intenta de nuevo.'); return; }
        sessionData = latest;

        const qIdx    = String(sessionData.currentIndex);
        const voters  = sessionData.voters || {};
        const voterList = voters[qIdx] || [];

        // Verificar si este participantId ya registró voto en el servidor
        if (voterList.includes(participantId)) {
            // Ya votó en el servidor pero no en localStorage → sincronizar
            localStorage.setItem(voteKey, k);
            renderParticipantQuestion();
            return;
        }

        // Registrar voto
        const vk = sessionData.currentIndex + '_' + k;
        sessionData.votes[vk]  = (sessionData.votes[vk] || 0) + 1;
        sessionData.voters[qIdx] = [...voterList, participantId];

        // Guardar qué opción eligió este participante (para calcular calificaciones al final)
        sessionData.participantVotes = sessionData.participantVotes || {};
        sessionData.participantVotes[participantId] = sessionData.participantVotes[participantId] || {};
        sessionData.participantVotes[participantId][qIdx] = k;

        await push();
        localStorage.setItem(voteKey, k); // Guardar localmente

        renderParticipantQuestion();
        renderVoteResults();
    }

    // ── ENVIAR NIVEL (NIVEL-RANGO) ────────────────────────────────────────────
    async function submitLevelVote(level) {
        const voteKey = `voted_${cloudId}_${sessionData.currentIndex}`;
        if (localStorage.getItem(voteKey)) { return; }

        const latest = await fetchData();
        if (!latest) { alert('Error de conexión. Intenta de nuevo.'); return; }
        sessionData = latest;

        const qIdx      = String(sessionData.currentIndex);
        const voters    = sessionData.voters || {};
        const voterList = voters[qIdx] || [];

        if (voterList.includes(participantId)) {
            localStorage.setItem(voteKey, String(level));
            renderParticipantQuestion();
            return;
        }

        // Registrar en votes como conteo de niveles: key = qIdx_1..5
        const vk = sessionData.currentIndex + '_' + level;
        sessionData.votes[vk] = (sessionData.votes[vk] || 0) + 1;
        sessionData.voters[qIdx] = [...voterList, participantId];

        // Guardar nivel elegido para cálculo de dimensión
        sessionData.participantVotes = sessionData.participantVotes || {};
        sessionData.participantVotes[participantId] = sessionData.participantVotes[participantId] || {};
        sessionData.participantVotes[participantId][qIdx] = String(level);

        await push();
        localStorage.setItem(voteKey, String(level));
        renderParticipantQuestion();
    }

    // ── ENVIAR RESPUESTA ABIERTA (modo sesión) ────────────────────────────────
    async function submitOpenAnswer() {
        const openKey = `open_${cloudId}_${sessionData.currentIndex}`;
        if (localStorage.getItem(openKey)) { return; }

        const text = ($('open-answer-text') || {}).value || '';

        // Recuperar estado fresco antes de escribir
        const latest = await fetchData();
        if (!latest) { alert('Error de conexión. Intenta de nuevo.'); return; }
        sessionData = latest;

        const qIdx = String(sessionData.currentIndex);

        // Guardar respuesta en participantVotes (texto para preguntas abiertas)
        sessionData.participantVotes = sessionData.participantVotes || {};
        sessionData.participantVotes[participantId] = sessionData.participantVotes[participantId] || {};
        sessionData.participantVotes[participantId][qIdx] = text || '(sin respuesta)';

        // Registrar en voters para deduplicación (misma lógica que MC)
        sessionData.voters = sessionData.voters || {};
        const voterList = sessionData.voters[qIdx] || [];
        if (!voterList.includes(participantId)) {
            sessionData.voters[qIdx] = [...voterList, participantId];
        }

        await push();
        localStorage.setItem(openKey, text || '(sin respuesta)');

        renderParticipantQuestion();
    }

