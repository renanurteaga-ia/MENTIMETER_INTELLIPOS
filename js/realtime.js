// IntelliPOS Interactive — realtime.js
    // ── GRÁFICO ───────────────────────────────────────────────────────────────
    function initChart() {
        const ctx = $('resultsChart').getContext('2d');
        chartInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['A','B','C','D'],
                datasets: [{ data:[0,0,0,0], backgroundColor:['#6366f1','#8b5cf6','#ec4899','#3b82f6'], borderRadius:8 }]
            },
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins: { legend:{ display:false } },
                scales: {
                    y: { beginAtZero:true, ticks:{ color:'#94a3b8', stepSize:1 }, grid:{ color:'#334155' } },
                    x: { ticks:{ color:'#94a3b8' }, grid:{ display:false } }
                }
            }
        });
    }

    function updateChart() {
        chartInst.data.datasets[0].data = ['A','B','C','D'].map(k => sessionData.votes[sessionData.currentIndex+'_'+k] || 0);
        chartInst.update('active');
    }

    // ── TIMER ─────────────────────────────────────────────────────────────────
    function startTimer(totalSecs, presenterSide) {
        if (timerInt) clearInterval(timerInt);
        let left = totalSecs;
        const barId  = presenterSide ? 'p-timer-bar'  : 'pt-timer-bar';
        const wrapId = presenterSide ? 'p-timer-wrap'  : 'pt-timer-wrap';
        const lblId  = 'p-timer-label';

        $(wrapId).classList.remove('hidden');
        if (presenterSide && $(lblId)) $(lblId).textContent = left;

        timerInt = setInterval(() => {
            left = Math.max(0, left - 1);
            const pct = left / totalSecs * 100;
            const bar = $(barId);
            if (bar) {
                bar.style.width = pct + '%';
                bar.className = `h-full timer-bar rounded-full ${pct > 50 ? 'bg-indigo-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`;
            }
            if (presenterSide && $(lblId)) $(lblId).textContent = left;
            if (left === 0) {
                clearInterval(timerInt);
                // El timer del presentador es solo de referencia: NO revela automáticamente.
                // El presentador decide manualmente cuándo revelar o avanzar.
                // El timer del participante sí deshabilita su votación personal al agotarse.
                if (!presenterSide) participantTimeUp();
            }
        }, 1000);
    }

    /** Se llama cuando el timer personal del participante llega a cero. */
    function participantTimeUp() {
        const voteKey = `voted_${cloudId}_${sessionData.currentIndex}`;
        if (localStorage.getItem(voteKey)) return; // ya votó, nada que hacer
        const container = $('mobile-options-container');
        if (!container) return;
        container.innerHTML = `
            <div class="p-5 bg-slate-800 rounded-2xl border border-red-800/60 text-center fade-in space-y-1">
                <p class="text-2xl">⏱</p>
                <p class="text-red-400 font-bold">¡Tiempo agotado!</p>
                <p class="text-xs text-slate-400">No alcanzaste a registrar tu respuesta en esta pregunta.</p>
            </div>`;
    }

    /** Inicia el timer del participante con el tiempo SINCRONIZADO al servidor.
     *  Como todos los participantes están en el lobby antes de que empiece el cuestionario,
     *  el elapsed es mínimo y el timer es prácticamente igual para todos. */
    function startParticipantTimer(totalSecs, changedAt) {
        if (!totalSecs || !changedAt) return;
        const elapsed   = Math.floor((Date.now() - changedAt) / 1000);
        const remaining = Math.max(0, totalSecs - elapsed);
        if (remaining > 0) startTimer(remaining, false);
        else participantTimeUp();
    }

    // ── SUPABASE PUSH / FETCH ─────────────────────────────────────────────────
    async function push() {
        try {
            const { error } = await sb.from('quiz_session').update({ data: sessionData }).eq('id', cloudId);
            if (error) console.warn('[IPOS] push error:', error.message, '| code:', error.code, '| hint:', error.hint);
        } catch(e) { console.warn('[IPOS] push exception', e); }
    }

    async function fetchData() {
        try {
            const { data, error } = await sb.from('quiz_session').select('data').eq('id', cloudId).single();
            if (error) { console.warn('[IPOS] fetch error:', error.message, '| code:', error.code); return null; }
            if (data?.data) return data.data;
        } catch(e) { console.warn('[IPOS] fetch exception', e); }
        return null;
    }

    // ── FUSIÓN INTELIGENTE PARA EL PRESENTADOR ────────────────────────────────
    // El presentador NUNCA debe perder su propio estado (currentIndex, reveal,
    // status, timerSeconds) por una actualización remota de un participante.
    // Solo se fusionan los campos que los participantes pueden modificar.
    function mergeForPresenter(incoming) {
        sessionData.votes            = incoming.votes            || {};
        sessionData.voters           = incoming.voters           || {};
        sessionData.participants     = incoming.participants     || {};
        sessionData.participantVotes = incoming.participantVotes || {};
        sessionData.examSubmissions  = incoming.examSubmissions  || {};
    }

    // ── SUPABASE REALTIME ─────────────────────────────────────────────────────
    function subscribeRealtime(presenterSide) {
        if (rtChannel) sb.removeChannel(rtChannel);

        rtChannel = sb
            .channel('ipos_' + cloudId)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'quiz_session',
                filter: `id=eq.${cloudId}`
            }, payload => {
                if (!payload.new?.data) return;
                if (!rtConnected) {
                    rtConnected = true;
                    $('rt-indicator').classList.remove('hidden');
                    $('rt-indicator').classList.add('flex');
                }
                const incoming = payload.new.data;
                if (presenterSide) {
                    mergeForPresenter(incoming);   // fusión selectiva
                    renderPresenterQuestion();
                } else {
                    handleParticipantUpdate(incoming);
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    rtConnected = true;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    rtConnected = false;
                    $('rt-indicator').classList.add('hidden');
                    $('rt-indicator').classList.remove('flex');
                    // Reconexión automática tras 3 s si la sesión sigue activa
                    if (sessionData.status !== 'ended') {
                        setTimeout(() => {
                            if (sessionData.status !== 'ended') subscribeRealtime(presenterSide);
                        }, 3000);
                    }
                }
            });
    }

    // ── POLLING PRINCIPAL (siempre activo) ────────────────────────────────────
    function startPolling(presenterSide) {
        if (fallbackInt) clearInterval(fallbackInt);

        $('poll-indicator').classList.remove('hidden');
        $('poll-indicator').classList.add('flex');

        fallbackInt = setInterval(async () => {
            const data = await fetchData();
            if (!data) return;
            if (presenterSide) {
                mergeForPresenter(data);           // fusión selectiva — no sobreescribe currentIndex ni reveal
                // Si seguimos en el lobby, actualizar lista de asistencia; si ya en quiz, renderizar pregunta
                if (sessionData.status === 'lobby') {
                    renderLobbyList();
                } else {
                    renderPresenterQuestion();
                }
            } else {
                handleParticipantUpdate(data);
            }
        }, 1500); // Consulta Supabase cada 1.5 segundos
    }
