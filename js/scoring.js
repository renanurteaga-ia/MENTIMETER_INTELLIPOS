// IntelliPOS Interactive — scoring.js
    // ── CÁLCULO DE CALIFICACIONES ─────────────────────────────────────────────
    function calculateScores() {
        const questions        = sessionData.questions;
        const participants     = sessionData.participants     || {};
        const participantVotes = sessionData.participantVotes || {};
        const rangos           = sessionData.rangos           || [];
        const rangosDim        = sessionData.rangosDim        || {};

        const hasPerfil     = questions.some(q => q.tipo === 'perfil');
        const hasPonderada  = questions.some(q => q.tipo === 'ponderada');
        const hasNivelRango = questions.some(q => q.tipo === 'nivel_rango');
        const perfilQuestions = questions.filter(q => q.tipo === 'perfil');
        const pondQuestions = questions.filter(q => q.tipo === 'ponderada');
        const nivelQuestions = questions.filter(q => q.tipo === 'nivel_rango');
        const mcQuestions   = questions.filter(q => (q.tipo || 'multiple_choice') === 'multiple_choice');
        const totalMC       = mcQuestions.length;

        // Mapa opción → perfil (A→P1, B→P2, C→P3, D→P4)
        const MAPA_PERFIL = { A: 'P1', B: 'P2', C: 'P3', D: 'P4' };

        const scores = Object.entries(participants).map(([pid, nick]) => {
            const pvotes = participantVotes[pid] || {};

            if (hasPerfil) {
                // ── Perfil: contar votos por perfil y determinar dominante ─────
                const votosPorPerfil = { P1: 0, P2: 0, P3: 0, P4: 0 };
                perfilQuestions.forEach(q => {
                    const origIdx = questions.indexOf(q);
                    const resp    = pvotes[String(origIdx)];
                    if (resp && MAPA_PERFIL[resp]) votosPorPerfil[MAPA_PERFIL[resp]]++;
                });
                const maxVotos   = Math.max(...Object.values(votosPorPerfil));
                const dominantes = Object.keys(votosPorPerfil).filter(p => votosPorPerfil[p] === maxVotos);
                const empate     = dominantes.length > 1;
                const perfilDom  = empate ? null : dominantes[0];
                const perfiles   = sessionData ? (sessionData.perfiles || []) : [];
                const perfilInfo = perfilDom ? (perfiles.find(p => p.id === perfilDom) || null) : null;
                const respondidas = perfilQuestions.filter(q => {
                    const origIdx = questions.indexOf(q);
                    return !!pvotes[String(origIdx)];
                }).length;
                return { pid, nick, votosPorPerfil, perfilDom, perfilInfo, empate, dominantes, respondidas,
                         nota: null, correct: null, total: null, puntaje_total: null, rango: null };
            } else if (hasPonderada) {
                // ── Ponderada: suma de pesos por respuesta ────────────────────
                let puntaje_total = 0;
                pondQuestions.forEach(q => {
                    const origIdx = questions.indexOf(q);
                    const resp = pvotes[String(origIdx)];
                    if (resp) puntaje_total += (q['puntaje' + resp] || 0);
                });
                const rango = rangos.find(r => puntaje_total >= r.min && puntaje_total <= r.max) || null;
                return { pid, nick, puntaje_total, rango, nota: null, correct: null, total: null };
            } else if (hasNivelRango) {
                // ── Nivel-Rango: promedio de niveles por dimensión ────────────
                const sumaPorDim  = {};
                const countPorDim = {};
                nivelQuestions.forEach(q => {
                    const origIdx = questions.indexOf(q);
                    const nivel   = parseInt(pvotes[String(origIdx)]) || 0;
                    const d       = q.dimension || '1';
                    sumaPorDim[d]  = (sumaPorDim[d]  || 0) + nivel;
                    countPorDim[d] = (countPorDim[d] || 0) + 1;
                });
                const rangosPorDim = {};
                Object.entries(sumaPorDim).forEach(([d, suma]) => {
                    const count    = countPorDim[d] || 1;
                    const promedio = Math.round((suma / count) * 100) / 100;
                    const rangosD  = rangosDim[d] || [];
                    rangosPorDim[d] = { promedio, rango: rangosD.find(r => promedio >= r.min && promedio <= r.max) || null };
                });
                return { pid, nick, rangosPorDim, nota: null, correct: null, total: null, puntaje_total: null, rango: null };
            } else {
                // ── Opción múltiple clásica ───────────────────────────────────
                let correct = 0;
                mcQuestions.forEach(q => {
                    const origIdx = questions.indexOf(q);
                    if (pvotes[String(origIdx)] === q.correcta) correct++;
                });
                const nota = totalMC > 0 ? Math.round((correct / totalMC) * 20 * 10) / 10 : null;
                return { pid, nick, correct, total: totalMC, nota, puntaje_total: null, rango: null };
            }
        });

        if (hasPerfil) {
            return { scores, avg: null, hasPerfil: true };
        } else if (hasPonderada) {
            scores.sort((a, b) => (b.puntaje_total ?? 0) - (a.puntaje_total ?? 0));
            return { scores, avg: null, hasPonderada: true };
        } else if (hasNivelRango) {
            return { scores, avg: null, hasPonderada: false, hasNivelRango: true };
        } else {
            scores.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
            const notasValidas = scores.filter(x => x.nota !== null);
            const avg = notasValidas.length > 0
                ? Math.round(notasValidas.reduce((s, x) => s + x.nota, 0) / notasValidas.length * 10) / 10
                : null;
            return { scores, avg, hasPonderada: false };
        }
    }
