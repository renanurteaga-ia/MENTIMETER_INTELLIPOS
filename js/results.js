// IntelliPOS Interactive — results.js
    // ── Alternar opciones en setup ────────────────────────────────────────────
    function toggleModeOptions() {
        const mode = document.querySelector('input[name="session-mode"]:checked')?.value;
        $('quiz-options').classList.toggle('hidden', mode !== 'quiz');
        $('exam-options').classList.toggle('hidden', mode !== 'exam');
        updateBancoHint();
    }

    // ── PANTALLA FINAL: PRESENTADOR ───────────────────────────────────────────
    function renderEndPresenter() {
        showView('view-ended');
        const { scores, avg, hasPerfil, hasPonderada, hasNivelRango } = calculateScores();
        const hasOpenQ    = sessionData.questions.some(q => (q.tipo || 'multiple_choice') === 'abierta');
        const bestScore   = scores.find(s => s.nota !== null);
        const bestNota    = bestScore ? bestScore.nota : null;

        // ── Sesión PERFIL: distribución de perfiles ───────────────────────────
        if (hasPerfil) {
            const perfiles     = sessionData.perfiles || [];
            const perfilIds    = ['P1','P2','P3','P4'];
            const totalPart    = scores.length;
            const perfilIds4   = perfiles.length > 0 ? perfiles.map(p => p.id) : perfilIds;

            // Conteo de participantes por perfil dominante
            const conteo = { P1:0, P2:0, P3:0, P4:0, empate:0 };
            scores.forEach(s => {
                if (s.empate)        conteo.empate++;
                else if (s.perfilDom) conteo[s.perfilDom] = (conteo[s.perfilDom] || 0) + 1;
            });

            // Barras por perfil
            const perfilBarsHtml = perfilIds4.map(pid => {
                const info  = perfiles.find(p => p.id === pid) || { id: pid, nombre: pid, simbolo: '', descripcion: '' };
                const cnt   = conteo[pid] || 0;
                const pct   = totalPart > 0 ? Math.round(cnt / totalPart * 100) : 0;
                return `<div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-rose-300">${info.simbolo ? info.simbolo + ' ' : ''}${info.nombre}</span>
                        <span class="text-white font-bold">${cnt} <span class="text-slate-400 font-normal">(${pct}%)</span></span>
                    </div>
                    <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-rose-500 transition-all duration-700" style="width:${pct}%"></div>
                    </div>
                </div>`;
            }).join('');

            // Tabla de participantes
            const MAPANOMBRE = { P1:'A', P2:'B', P3:'C', P4:'D' };
            const partRows = scores.map((s, i) => {
                const medal    = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
                const info     = s.perfilDom ? (perfiles.find(p => p.id === s.perfilDom) || {nombre: s.perfilDom}) : null;
                const tag      = s.empate
                    ? `<span class="text-amber-400 text-xs">Empate (${s.dominantes.join('/')})</span>`
                    : info
                        ? `<span class="text-rose-300 text-xs font-semibold">${info.simbolo ? info.simbolo+' ' : ''}${info.nombre}</span>`
                        : '<span class="text-slate-500 text-xs">Sin voto</span>';
                return `<tr class="border-b border-slate-700/50 text-xs">
                    <td class="py-2 pr-2 text-slate-400 w-8 text-center">${medal}</td>
                    <td class="py-2 pr-2 text-sm font-medium text-white">${s.nick}</td>
                    <td class="py-2">${tag}</td>
                    <td class="py-2 pl-2 text-right text-slate-400">${s.respondidas}/${sessionData.questions.filter(q=>q.tipo==='perfil').length}</td>
                </tr>`;
            }).join('');

            $('ended-content').innerHTML = `
                <div class="space-y-6 w-full fade-in">
                    <div class="text-center space-y-1">
                        <div class="text-4xl">🎯</div>
                        <h2 class="text-2xl font-extrabold text-white">Resultados — Perfil</h2>
                        <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                            <p class="text-3xl font-extrabold text-indigo-400">${totalPart}</p>
                            <p class="text-xs text-slate-400 mt-1">Participantes</p>
                        </div>
                        <div class="bg-slate-800 border border-rose-700/40 rounded-2xl p-4 text-center">
                            <p class="text-3xl font-extrabold text-rose-400">${conteo.empate}</p>
                            <p class="text-xs text-slate-400 mt-1">Con empate</p>
                        </div>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución por perfil</p>
                        ${perfilBarsHtml}
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Perfil por participante</p>
                        <table class="w-full"><tbody>${partRows}</tbody></table>
                    </div>
                    <button onclick="downloadReportExcel()" class="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition text-sm">
                        <i class="fa-solid fa-file-excel mr-2"></i>Descargar Reporte Excel
                    </button>
                    <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">Volver al inicio</button>
                </div>`;
            return;
        }

        // ── Sesión NIVEL-RANGO: promedios por dimensión ───────────────────────
        if (hasNivelRango) {
            const nivelQs = sessionData.questions.filter(q => q.tipo === 'nivel_rango');
            // Dimensiones únicas
            const dims = [...new Set(nivelQs.map(q => q.dimension || '1'))];
            // Promedio global por dimensión a partir de todos los scores
            const dimAvgs = {};
            dims.forEach(d => {
                const vals = scores.map(s => s.rangosPorDim?.[d]?.promedio).filter(v => v > 0);
                dimAvgs[d] = vals.length > 0 ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : null;
            });
            // Distribución 1-5 por pregunta
            const qRows = nivelQs.map(q => {
                const origIdx = sessionData.questions.indexOf(q);
                const counts  = [1,2,3,4,5].map(n => {
                    return Object.values(sessionData.participantVotes || {})
                        .filter(pv => parseInt(pv[String(origIdx)]) === n).length;
                });
                const total   = counts.reduce((a,b)=>a+b,0);
                const bars    = counts.map((c,i) => {
                    const pct = total > 0 ? Math.round(c/total*100) : 0;
                    return `<span class="text-teal-300 font-bold">${i+1}:</span><span class="text-slate-300">${c}</span>`;
                }).join(' ');
                return `<tr class="border-b border-slate-700/30 text-xs">
                    <td class="py-1.5 pr-2 text-slate-300">${origIdx+1}. ${q.pregunta.length>50?q.pregunta.substring(0,50)+'…':q.pregunta}</td>
                    <td class="py-1.5 text-right text-xs">${bars}</td>
                </tr>`;
            }).join('');
            const rankRows = scores.map((s,i) => {
                const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
                const dimStr = dims.map(d => {
                    const p = s.rangosPorDim?.[d]?.promedio;
                    const nombre = nivelQs.find(q=>(q.dimension||'1')===d)?.dimensionNombre || 'Dim '+d;
                    return `<span class="text-teal-300">${nombre}:</span><span class="text-white font-bold"> ${p??'—'}</span>`;
                }).join(' · ');
                return `<tr class="border-b border-slate-700/50 text-xs">
                    <td class="py-2 pr-2 text-slate-400 w-8 text-center">${medal}</td>
                    <td class="py-2 pr-2 text-sm font-medium text-white">${s.nick}</td>
                    <td class="py-2 text-xs text-slate-300">${dimStr}</td>
                </tr>`;
            }).join('');
            $('ended-content').innerHTML = `
                <div class="space-y-6 w-full fade-in">
                    <div class="text-center space-y-1">
                        <div class="text-4xl">📊</div>
                        <h2 class="text-2xl font-extrabold text-white">Resultados — Nivel/Rango</h2>
                        <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    </div>
                    <div class="grid grid-cols-${dims.length+1} gap-3">
                        <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                            <p class="text-3xl font-extrabold text-indigo-400">${scores.length}</p>
                            <p class="text-xs text-slate-400 mt-1">Participantes</p>
                        </div>
                        ${dims.map(d => {
                            const nombre    = nivelQs.find(q=>(q.dimension||'1')===d)?.dimensionNombre || 'Dim '+d;
                            const avg       = dimAvgs[d];
                            const rangosD   = sessionData.rangosDim?.[d] || [];
                            const rangoD    = avg !== null ? rangosD.find(r => avg >= r.min && avg <= r.max) : null;
                            return `<div class="bg-slate-800 border border-teal-700/40 rounded-2xl p-4 text-center">
                                <p class="text-3xl font-extrabold text-teal-400">${avg??'—'}</p>
                                <p class="text-xs text-teal-300 mt-1">${nombre}</p>
                                ${rangoD ? `<p class="text-xs text-teal-200 font-semibold mt-1">${rangoD.nombre}</p>
                                ${rangoD.diagnostico ? `<p class="text-[10px] text-slate-400 mt-0.5 leading-tight">${rangoD.diagnostico}</p>` : ''}` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ranking de participantes</p>
                        <table class="w-full"><tbody>${rankRows}</tbody></table>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución de respuestas por pregunta</p>
                        <table class="w-full"><tbody>${qRows}</tbody></table>
                    </div>
                    <button onclick="downloadReportExcel()" class="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition text-sm">
                        <i class="fa-solid fa-file-excel mr-2"></i>Descargar Reporte Excel
                    </button>
                    <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">Volver al inicio</button>
                </div>`;
            return;
        }

        // ── Sesión PONDERADA: distribución por rango ──────────────────────────
        if (hasPonderada) {
            const rangos = sessionData.rangos || [];
            // Contar participantes en cada rango
            const rangoDist = rangos.map(r => ({
                ...r,
                count: scores.filter(s => s.puntaje_total >= r.min && s.puntaje_total <= r.max).length
            }));
            const totalPart = scores.length;
            const maxPt     = scores.length > 0 ? Math.max(...scores.map(s => s.puntaje_total || 0)) : 0;
            const avgPt     = scores.length > 0 ? Math.round(scores.reduce((s, x) => s + (x.puntaje_total || 0), 0) / scores.length * 10) / 10 : 0;

            const rangoDistHtml = rangoDist.map(r => {
                const pct = totalPart > 0 ? Math.round(r.count / totalPart * 100) : 0;
                return `<div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-violet-300">${r.nombre} <span class="font-normal text-slate-500">(${r.min}–${r.max} pts)</span></span>
                        <span class="text-white font-bold">${r.count} <span class="text-slate-400 font-normal">(${pct}%)</span></span>
                    </div>
                    <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-violet-500 transition-all duration-500" style="width:${pct}%"></div>
                    </div>
                    ${r.diagnostico ? `<p class="text-xs text-slate-500 italic">${r.diagnostico}</p>` : ''}
                </div>`;
            }).join('');

            const scoreRows = scores.map((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                const ptMax  = rangos.length > 0 ? Math.max(...rangos.map(r => r.max)) : '?';
                const barW   = ptMax > 0 ? Math.round((s.puntaje_total || 0) / ptMax * 100) : 0;
                const rangoNombre = s.rango ? s.rango.nombre : '—';
                return `<tr class="border-b border-slate-700/50">
                    <td class="py-2 pr-3 text-slate-400 w-8 text-center text-sm">${medal}</td>
                    <td class="py-2 pr-2 text-sm font-medium text-white">${s.nick}</td>
                    <td class="py-2 pr-2 text-xs text-violet-300 hidden sm:table-cell">${rangoNombre}</td>
                    <td class="py-2 w-28">
                        <div class="flex items-center space-x-2">
                            <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div class="h-full rounded-full bg-violet-500" style="width:${barW}%"></div>
                            </div>
                            <span class="text-sm font-bold text-white w-8 text-right">${s.puntaje_total ?? '—'}</span>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            // Preguntas: distribución de opciones elegidas
            const qRows = sessionData.questions.filter(q => q.tipo === 'ponderada').map((q, qi) => {
                const origIdx = sessionData.questions.indexOf(q);
                const total   = ['A','B','C','D'].reduce((s,k) => s + (sessionData.votes[origIdx+'_'+k] || 0), 0);
                const opts    = ['A','B','C','D'].map(k => {
                    const c   = sessionData.votes[origIdx+'_'+k] || 0;
                    const pts = q['puntaje'+k] !== undefined ? q['puntaje'+k] : 0;
                    return `<span class="text-slate-400">${k}:${c}(${pts}pts)</span>`;
                }).join(' ');
                return `<tr class="border-b border-slate-700/30 text-xs">
                    <td class="py-1.5 pr-2 text-slate-300">${origIdx+1}. ${q.pregunta.length > 50 ? q.pregunta.substring(0,50)+'…' : q.pregunta}</td>
                    <td class="py-1.5 text-right">${opts}</td>
                </tr>`;
            }).join('');

            $('ended-content').innerHTML = `
                <div class="space-y-6 w-full fade-in">
                    <div class="text-center space-y-1">
                        <div class="text-4xl">📊</div>
                        <h2 class="text-2xl font-extrabold text-white">Resultados — Prueba Ponderada</h2>
                        <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    </div>

                    <!-- Stats -->
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                            <p class="text-3xl font-extrabold text-indigo-400">${totalPart}</p>
                            <p class="text-xs text-slate-400 mt-1">Participantes</p>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                            <p class="text-3xl font-extrabold text-violet-400">${avgPt}</p>
                            <p class="text-xs text-slate-400 mt-1">Puntaje promedio</p>
                        </div>
                        <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                            <p class="text-3xl font-extrabold text-amber-400">${maxPt}</p>
                            <p class="text-xs text-slate-400 mt-1">Puntaje más alto</p>
                        </div>
                    </div>

                    <!-- Distribución por rango -->
                    ${rangoDist.length > 0 ? `
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Distribución por rango</p>
                        ${rangoDistHtml}
                    </div>` : ''}

                    <!-- Ranking -->
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ranking de participantes</p>
                            <label class="flex items-center space-x-2 cursor-pointer text-xs text-slate-400">
                                <input type="checkbox" checked
                                    onchange="document.getElementById('public-scores-table').classList.toggle('hidden', !this.checked)"
                                    class="accent-violet-500 w-3.5 h-3.5">
                                <span>Mostrar ranking</span>
                            </label>
                        </div>
                        <div id="public-scores-table">
                            ${scores.length === 0
                                ? '<p class="text-slate-500 italic text-sm">No hubo participantes.</p>'
                                : `<table class="w-full"><tbody>${scoreRows}</tbody></table>`}
                        </div>
                    </div>

                    <!-- Preguntas -->
                    ${qRows ? `
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución por pregunta</p>
                        <table class="w-full"><tbody>${qRows}</tbody></table>
                    </div>` : ''}

                    <button onclick="downloadReportExcel()"
                        class="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition text-sm">
                        <i class="fa-solid fa-file-excel mr-2"></i>Descargar Reporte Excel
                    </button>
                    <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">
                        Volver al inicio
                    </button>
                </div>`;
            return;
        }

        const rows = scores.map((s, i) => {
            const medal    = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
            const notaStr  = s.nota !== null ? s.nota.toFixed(1) : '—';
            const barW     = s.nota !== null ? Math.round(s.nota / 20 * 100) : 0;
            const color    = s.nota === null ? 'bg-slate-600' : s.nota >= 14 ? 'bg-emerald-500' : s.nota >= 11 ? 'bg-amber-400' : 'bg-red-500';
            return `
            <tr class="border-b border-slate-700/50">
                <td class="py-2 pr-3 text-slate-400 w-8 text-center text-sm">${medal}</td>
                <td class="py-2 pr-3 text-sm font-medium text-white">${s.nick}</td>
                <td class="py-2 pr-3 text-xs text-slate-400">${s.correct}/${s.total} MC correctas</td>
                <td class="py-2 w-32">
                    <div class="flex items-center space-x-2">
                        <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div class="h-full rounded-full ${color}" style="width:${barW}%"></div>
                        </div>
                        <span class="text-sm font-bold text-white w-8 text-right">${notaStr}</span>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Resumen por pregunta
        const qRows = sessionData.questions.map((q, idx) => {
            const esAb = (q.tipo || 'multiple_choice') === 'abierta';
            if (esAb) {
                // Contar cuántos respondieron
                const respondidos = Object.values(sessionData.participantVotes || {})
                    .filter(pv => pv[String(idx)] && String(pv[String(idx)]).trim()).length;
                return `<tr class="border-b border-slate-700/30 text-xs">
                    <td class="py-1.5 pr-2 text-slate-300">${idx+1}. ${q.pregunta.length > 50 ? q.pregunta.substring(0,50)+'…' : q.pregunta}</td>
                    <td class="py-1.5 text-right text-amber-400">Abierta · ${respondidos} resp.</td>
                </tr>`;
            }
            // En modo examen los votos llegan por participantVotes, no por sessionData.votes
            const _pvAll = sessionData.participantVotes || {};
            const _getC  = k => {
                const fromVotes = sessionData.votes[idx+'_'+k] || 0;
                if (fromVotes > 0) return fromVotes;
                return Object.values(_pvAll).filter(pv => pv[String(idx)] === k).length;
            };
            const total = ['A','B','C','D'].reduce((s,k) => s + _getC(k), 0);
            const opts  = ['A','B','C','D'].map(k => {
                const c  = _getC(k);
                const ok = k === q.correcta;
                return `<span class="${ok ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${k}:${c}${ok ? '✓' : ''}</span>`;
            }).join(' ');
            return `<tr class="border-b border-slate-700/30 text-xs">
                <td class="py-1.5 pr-2 text-slate-300">${idx+1}. ${q.pregunta.length > 50 ? q.pregunta.substring(0,50)+'…' : q.pregunta}</td>
                <td class="py-1.5 text-right">${opts}</td>
            </tr>`;
        }).join('');

        const avgStr  = avg  !== null ? avg.toFixed(1)      : '—';
        const bestStr = bestNota !== null ? bestNota.toFixed(1) : '—';

        $('ended-content').innerHTML = `
            <div class="space-y-6 w-full fade-in">
                <div class="text-center space-y-1">
                    <div class="text-4xl">🏁</div>
                    <h2 class="text-2xl font-extrabold text-white">Resultados de la Sesión</h2>
                    <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    ${hasOpenQ ? '<p class="text-xs text-amber-400 mt-1">⚠️ Hay preguntas abiertas pendientes de calificación</p>' : ''}
                </div>

                <!-- Stat cards -->
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                        <p class="text-3xl font-extrabold text-indigo-400">${Object.keys(sessionData.participants||{}).length}</p>
                        <p class="text-xs text-slate-400 mt-1">Participantes</p>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                        <p class="text-3xl font-extrabold text-emerald-400">${avgStr}</p>
                        <p class="text-xs text-slate-400 mt-1">Nota promedio${hasOpenQ ? ' (MC)' : ''}</p>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                        <p class="text-3xl font-extrabold text-amber-400">${bestStr}</p>
                        <p class="text-xs text-slate-400 mt-1">Nota más alta${hasOpenQ ? ' (MC)' : ''}</p>
                    </div>
                </div>

                <!-- Ranking participantes -->
                <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                    <div class="flex items-center justify-between mb-3">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ranking de participantes</p>
                        <label class="flex items-center space-x-2 cursor-pointer text-xs text-slate-400">
                            <input type="checkbox" id="toggle-public-scores" checked
                                onchange="document.getElementById('public-scores-table').classList.toggle('hidden', !this.checked)"
                                class="accent-indigo-500 w-3.5 h-3.5">
                            <span>Mostrar ranking (pantalla proyectada)</span>
                        </label>
                    </div>
                    <div id="public-scores-table">
                    ${scores.length === 0
                        ? '<p class="text-slate-500 italic text-sm">No hubo participantes registrados.</p>'
                        : `<table class="w-full"><tbody>${rows}</tbody></table>`}
                    </div><!-- /public-scores-table -->
                </div>

                <!-- Resumen por pregunta -->
                <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución de respuestas por pregunta</p>
                    <table class="w-full"><tbody>${qRows}</tbody></table>
                </div>

                ${hasOpenQ ? `
                <button onclick="initGradingMode()"
                    class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition text-sm">
                    <i class="fa-solid fa-pen-to-square mr-2"></i>Calificar respuestas abiertas
                </button>` : ''}

                <button onclick="downloadReportExcel()"
                    class="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition text-sm">
                    <i class="fa-solid fa-file-excel mr-2"></i>Descargar Reporte Excel
                </button>

                <div class="flex gap-3">
                    <button onclick="resetApp()" class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">
                        Volver al inicio
                    </button>
                    <button onclick="initAiConfig()" title="Gestionar IAs para calificación"
                        class="px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-indigo-600 rounded-xl text-slate-300 hover:text-indigo-300 transition text-sm">
                        <i class="fa-solid fa-robot mr-1"></i>IAs
                    </button>
                </div>
            </div>`;
    }

    // ── PANTALLA FINAL: PARTICIPANTE ──────────────────────────────────────────
    function renderEndParticipant() {
        showView('view-ended');
        const { scores, avg, hasPerfil, hasPonderada, hasNivelRango } = calculateScores();
        const myScore   = scores.find(s => s.pid === participantId);
        const hasOpenQ  = sessionData.questions.some(q => (q.tipo || 'multiple_choice') === 'abierta');
        const hasNivelQ = hasNivelRango;
        const onlyNivel = hasNivelQ && !hasOpenQ && (myScore?.total === null || myScore?.total === 0);
        const bestScore = scores.find(s => s.nota !== null);
        const bestNota  = bestScore ? bestScore.nota : null;

        // ── Sesión PERFIL: tarjeta de perfil personal ─────────────────────────
        if (hasPerfil) {
            const perfiles    = sessionData.perfiles || [];
            const perfilDom   = myScore?.perfilDom   || null;
            const perfilInfo  = myScore?.perfilInfo   || (perfilDom ? perfiles.find(p => p.id === perfilDom) : null);
            const empate      = myScore?.empate       || false;
            const votos       = myScore?.votosPorPerfil || { P1:0, P2:0, P3:0, P4:0 };
            const respondidas = myScore?.respondidas  || 0;
            const totalPerfil = sessionData.questions.filter(q => q.tipo === 'perfil').length;

            // Conteo grupo: cuántos participantes tienen cada perfil dominante
            const grupoConteo = { P1:0, P2:0, P3:0, P4:0 };
            scores.forEach(s => { if (!s.empate && s.perfilDom) grupoConteo[s.perfilDom] = (grupoConteo[s.perfilDom]||0)+1; });

            const perfilCardsHtml = (perfiles.length > 0 ? perfiles : ['P1','P2','P3','P4'].map(id => ({id, nombre:id, simbolo:'', descripcion:''})))
                .map(p => {
                    const esMio = p.id === perfilDom && !empate;
                    return `<div class="p-3 rounded-xl border ${esMio
                        ? 'bg-rose-900/50 border-rose-500 ring-2 ring-rose-500/50'
                        : 'bg-slate-800/50 border-slate-700/40'}">
                        <p class="text-sm font-bold ${esMio ? 'text-rose-200' : 'text-slate-300'}">${esMio ? '▶ ' : ''}${p.simbolo ? p.simbolo+' ' : ''}${p.nombre} <span class="text-xs font-normal text-slate-500">(${votos[p.id]||0} voto${(votos[p.id]||0)!==1?'s':''})</span></p>
                        ${p.descripcion && esMio ? `<p class="text-xs text-slate-400 mt-0.5">${p.descripcion}</p>` : ''}
                    </div>`;
                }).join('');

            $('ended-content').innerHTML = `
                <div class="space-y-5 w-full max-w-sm mx-auto fade-in">
                    <div class="text-center space-y-1">
                        <div class="text-4xl">🎯</div>
                        <h2 class="text-2xl font-extrabold text-white">¡Tu Perfil!</h2>
                        <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    </div>

                    ${empate
                        ? `<div class="bg-amber-900/40 border border-amber-600/50 rounded-2xl p-6 text-center shadow-xl space-y-2">
                            <p class="text-xs text-amber-300 uppercase tracking-wider font-semibold">Empate entre perfiles</p>
                            <p class="text-4xl font-extrabold text-amber-300">${(myScore?.dominantes||[]).join(' / ')}</p>
                            <p class="text-xs text-slate-400">Respondiste con igual número de votos para varios perfiles.</p>
                          </div>`
                        : perfilInfo
                            ? `<div class="bg-rose-950/60 border border-rose-600/50 rounded-2xl p-6 text-center shadow-xl space-y-2">
                                <p class="text-xs text-rose-300 uppercase tracking-wider font-semibold">Tu perfil dominante</p>
                                ${perfilInfo.simbolo ? `<p class="text-5xl">${perfilInfo.simbolo}</p>` : ''}
                                <p class="text-3xl font-extrabold text-rose-200">${perfilInfo.nombre}</p>
                                ${perfilInfo.descripcion ? `<p class="text-sm text-slate-300 mt-2">${perfilInfo.descripcion}</p>` : ''}
                              </div>`
                            : `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
                                <p class="text-slate-400">Sin datos de perfil disponibles.</p>
                              </div>`
                    }

                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-2">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Comparativa del grupo</p>
                        ${(perfiles.length > 0 ? perfiles : ['P1','P2','P3','P4'].map(id=>({id,nombre:id}))).map(p => {
                            const cnt = grupoConteo[p.id] || 0;
                            const pct = scores.length > 0 ? Math.round(cnt / scores.length * 100) : 0;
                            return `<div class="flex items-center gap-2 text-xs">
                                <span class="w-24 truncate text-slate-300">${p.nombre}</span>
                                <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full ${p.id === perfilDom && !empate ? 'bg-rose-500' : 'bg-slate-500'} transition-all" style="width:${pct}%"></div>
                                </div>
                                <span class="text-slate-400 w-8 text-right">${cnt}</span>
                            </div>`;
                        }).join('')}
                    </div>

                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-2">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Todos los perfiles</p>
                        ${perfilCardsHtml}
                    </div>

                    <p class="text-xs text-slate-500 text-center">Respondiste ${respondidas} de ${totalPerfil} preguntas</p>
                    <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">
                        Volver al inicio
                    </button>
                </div>`;
            return;
        }

        // ── Sesión PONDERADA: mostrar puntaje + rango ─────────────────────────
        if (hasPonderada) {
            const pt    = myScore ? myScore.puntaje_total : null;
            const rango = myScore ? myScore.rango : null;
            const rangos = sessionData.rangos || [];
            const ptMax  = rangos.length > 0 ? Math.max(...rangos.map(r => r.max)) : '?';

            const rangosHtml = rangos.map(r => {
                const esElMio = rango && rango.nombre === r.nombre;
                return `<div class="p-3 rounded-xl border ${esElMio
                    ? 'bg-violet-900/50 border-violet-500 ring-2 ring-violet-500/50'
                    : 'bg-slate-800/50 border-slate-700/40'}">
                    <p class="text-sm font-bold ${esElMio ? 'text-violet-200' : 'text-slate-300'}">${esElMio ? '▶ ' : ''}${r.nombre} <span class="font-normal text-xs text-slate-500">(${r.min}–${r.max} pts)</span></p>
                    ${r.diagnostico ? `<p class="text-xs text-slate-400 mt-0.5">${r.diagnostico}</p>` : ''}
                </div>`;
            }).join('');

            $('ended-content').innerHTML = `
                <div class="space-y-5 w-full max-w-sm mx-auto fade-in">
                    <div class="text-center space-y-1">
                        <div class="text-4xl">📊</div>
                        <h2 class="text-2xl font-extrabold text-white">¡Sesión finalizada!</h2>
                        <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    </div>

                    <!-- Puntaje personal -->
                    <div class="bg-slate-800 border border-violet-700/50 rounded-2xl p-6 text-center shadow-xl space-y-2">
                        <p class="text-xs text-violet-300 uppercase tracking-wider font-semibold">Tu puntaje total</p>
                        <p class="text-7xl font-extrabold text-violet-300">${pt !== null ? pt : '—'}</p>
                        <p class="text-xs text-slate-400">de ${ptMax} puntos máximos</p>
                    </div>

                    <!-- Estadísticas del grupo -->
                    ${(() => {
                        const validSc = scores.filter(s => s.puntaje_total !== null && s.puntaje_total !== undefined);
                        const ptBest  = validSc.length > 0 ? Math.max(...validSc.map(s => s.puntaje_total || 0)) : null;
                        const ptAvg   = validSc.length > 0 ? Math.round(validSc.reduce((a,s) => a+(s.puntaje_total||0),0)/validSc.length*10)/10 : null;
                        let grpMsg = '', grpColor = 'text-slate-300';
                        if (pt !== null && ptBest !== null && pt === ptBest && validSc.filter(s=>(s.puntaje_total||0)===ptBest).length===1) { grpMsg='🏆 ¡Obtuviste el puntaje más alto del grupo!'; grpColor='text-amber-400'; }
                        else if (ptAvg !== null && pt !== null && pt > ptAvg) { grpMsg='🌟 Tu puntaje está por encima del promedio.'; grpColor='text-emerald-400'; }
                        else if (ptAvg !== null && pt !== null && Math.abs(pt-ptAvg)<0.5) { grpMsg='👍 Obtuviste el puntaje promedio del grupo.'; grpColor='text-indigo-300'; }
                        else if (pt !== null) { grpMsg='📚 Tu puntaje está por debajo del promedio.'; grpColor='text-amber-300'; }
                        return `<div class="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                            <div class="flex justify-between">
                                <div class="text-center flex-1">
                                    <p class="text-xs text-slate-500 uppercase tracking-wider">Más alto</p>
                                    <p class="text-xl font-extrabold text-amber-400">${ptBest !== null ? ptBest : '—'}</p>
                                </div>
                                <div class="text-center flex-1">
                                    <p class="text-xs text-slate-500 uppercase tracking-wider">Promedio</p>
                                    <p class="text-xl font-extrabold text-indigo-300">${ptAvg !== null ? ptAvg : '—'}</p>
                                </div>
                                <div class="text-center flex-1">
                                    <p class="text-xs text-slate-500 uppercase tracking-wider">Participantes</p>
                                    <p class="text-xl font-extrabold text-slate-300">${validSc.length}</p>
                                </div>
                            </div>
                            ${grpMsg ? `<p class="text-xs text-center font-semibold ${grpColor}">${grpMsg}</p>` : ''}
                        </div>`;
                    })()}

                    <!-- Rango obtenido -->
                    ${rango ? `
                    <div class="bg-violet-950/60 border border-violet-600/50 rounded-2xl p-5 text-center shadow-xl space-y-1">
                        <p class="text-xs text-violet-300 uppercase tracking-wider font-semibold">Tu diagnóstico</p>
                        <p class="text-2xl font-extrabold text-violet-200">${rango.nombre}</p>
                        ${rango.diagnostico ? `<p class="text-sm text-slate-300 mt-2">${rango.diagnostico}</p>` : ''}
                        ${rango.tu_realidad ? `<div class="text-left mt-3 p-3 bg-slate-800/60 rounded-xl border-l-4 border-violet-500"><p class="text-xs font-bold text-violet-400 uppercase mb-1">Tu realidad</p><p class="text-xs text-slate-300">${rango.tu_realidad}</p></div>` : ''}
                        ${rango.tu_reto ? `<div class="text-left mt-2 p-3 bg-slate-800/60 rounded-xl border-l-4 border-amber-500"><p class="text-xs font-bold text-amber-400 uppercase mb-1">Tu reto</p><p class="text-xs text-slate-300">${rango.tu_reto}</p></div>` : ''}
                        ${rango.recuerda ? `<div class="text-left mt-2 p-3 bg-slate-800/60 rounded-xl border-l-4 border-emerald-500"><p class="text-xs font-bold text-emerald-400 uppercase mb-1">Recuerda</p><p class="text-xs text-slate-300">${rango.recuerda}</p></div>` : ''}
                    </div>` : (pt !== null ? `
                    <div class="bg-amber-900/30 border border-amber-700/40 rounded-2xl p-4 text-center">
                        <p class="text-sm text-amber-300">Tu puntaje (${pt}) no coincide con ningún rango definido.</p>
                    </div>` : '')}

                    <!-- Todos los rangos -->
                    ${rangos.length > 0 ? `
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-2">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Rangos diagnósticos</p>
                        ${rangosHtml}
                    </div>` : ''}

                    <!-- Revisión por pregunta -->
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revisión de respuestas</p>
                        ${sessionData.questions.map((q, idx) => {
                            if (q.tipo !== 'ponderada') return '';
                            const myVote = myScore ? (sessionData.participantVotes?.[participantId]?.[String(idx)] || null) : null;
                            const pts    = myVote ? (q['puntaje' + myVote] || 0) : 0;
                            return `<div class="border-b border-slate-700/40 pb-2">
                                <p class="text-xs font-semibold text-slate-300 mb-1">${idx+1}. ${q.pregunta}</p>
                                ${myVote
                                    ? `<p class="text-xs text-slate-400">Tu respuesta: <strong class="text-white">${myVote}</strong> — ${q['opcion'+myVote] || ''} <span class="text-violet-300 font-semibold">(${pts} pts)</span></p>`
                                    : '<p class="text-xs text-slate-500 italic">Sin respuesta</p>'}
                            </div>`;
                        }).join('')}
                    </div>

                    <button onclick="printParticipantResult()"
                        class="w-full py-3 bg-violet-700 hover:bg-violet-600 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-file-pdf"></i> Descargar mi resultado (PDF)
                    </button>
                    <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">
                        Volver al inicio
                    </button>
                </div>`;
            return; // no ejecutar el flujo MC
        }

        // ── Sesión NIVEL-RANGO: resultado por dimensión para participante ─────
        if (hasNivelRango) {
            const nivelQs  = sessionData.questions.filter(q => q.tipo === 'nivel_rango');
            const dims     = [...new Set(nivelQs.map(q => q.dimension || '1'))];
            const myScoreNR = scores.find(s => s.pid === participantId);

            // Promedio del salón por dimensión
            const dimAvgSalon = {};
            dims.forEach(d => {
                const vals = scores.map(s => s.rangosPorDim?.[d]?.promedio).filter(v => v > 0);
                dimAvgSalon[d] = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : null;
            });

            const dimCards = dims.map(d => {
                const nombre     = nivelQs.find(q=>(q.dimension||'1')===d)?.dimensionNombre || 'Dimensión '+d;
                const miProm     = myScoreNR?.rangosPorDim?.[d]?.promedio ?? null;
                const salonProm  = dimAvgSalon[d];
                const rangosD    = sessionData.rangosDim?.[d] || [];
                const rangoD     = miProm !== null ? rangosD.find(r => miProm >= r.min && miProm <= r.max) : null;
                let comparMsg = '', comparColor = 'text-slate-400';
                if (miProm !== null && salonProm !== null) {
                    if (miProm > salonProm)          { comparMsg = '↑ Por encima del promedio del salón'; comparColor = 'text-emerald-400'; }
                    else if (miProm < salonProm)     { comparMsg = '↓ Por debajo del promedio del salón'; comparColor = 'text-amber-400'; }
                    else                             { comparMsg = '= Igual al promedio del salón';        comparColor = 'text-indigo-300'; }
                }
                return `<div class="bg-teal-950/60 border border-teal-700/50 rounded-2xl p-4 space-y-2">
                    <div class="flex items-start justify-between">
                        <div>
                            <p class="text-xs text-teal-300 uppercase tracking-wider font-semibold">${nombre}</p>
                            <p class="text-3xl font-extrabold text-teal-200 mt-1">${miProm !== null ? miProm.toFixed(1) : '—'}<span class="text-xs text-slate-500 font-normal ml-1">/ 5</span></p>
                            ${rangoD ? `<p class="text-sm font-bold text-teal-300 mt-0.5">${rangoD.nombre}</p>` : ''}
                            ${rangoD?.diagnostico ? `<p class="text-xs text-slate-400 mt-1 leading-snug">${rangoD.diagnostico}</p>` : ''}
                        </div>
                        ${salonProm !== null ? `<div class="text-right text-xs text-slate-500 mt-1">
                            <p>Prom. salón</p>
                            <p class="text-base font-bold text-slate-400">${salonProm.toFixed(1)}</p>
                        </div>` : ''}
                    </div>
                    ${comparMsg ? `<p class="text-xs font-semibold ${comparColor}">${comparMsg}</p>` : ''}
                </div>`;
            }).join('');

            const revHtml = sessionData.questions.map((q, idx) => {
                if (q.tipo !== 'nivel_rango') return '';
                const myVote   = myScoreNR
                    ? (sessionData.participantVotes?.[participantId]?.[String(idx)] || examAnswers?.[String(idx)] || null)
                    : (examAnswers?.[String(idx)] || null);
                const dimNombre = q.dimensionNombre || (q.dimension ? 'Dimensión ' + q.dimension : '');
                const answered  = myVote !== null && myVote !== undefined;
                return `<div class="border-b border-slate-700/40 pb-2">
                    <p class="text-xs font-semibold text-slate-300 mb-1">${answered ? '✅' : '⬜'} ${idx+1}. ${q.pregunta}</p>
                    ${dimNombre ? `<p class="text-xs text-teal-400 mb-1">${dimNombre}</p>` : ''}
                    ${answered
                        ? `<div class="flex gap-1">${[1,2,3,4,5].map(n => `<span class="inline-flex w-7 h-7 rounded-lg text-xs font-bold items-center justify-center ${String(myVote)===String(n) ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-500'}">${n}</span>`).join('')}</div>`
                        : '<p class="text-xs text-slate-500 italic">Sin respuesta</p>'}
                </div>`;
            }).join('');

            $('ended-content').innerHTML = `
                <div class="space-y-5 w-full max-w-sm mx-auto fade-in">
                    <div class="text-center space-y-1">
                        <div class="text-4xl">📊</div>
                        <h2 class="text-2xl font-extrabold text-white">¡Sesión finalizada!</h2>
                        <p class="text-slate-400 text-sm">${sessionData.name}</p>
                    </div>
                    <div class="space-y-3">
                        <p class="text-xs font-semibold text-teal-300 uppercase tracking-wider">Tu resultado por dimensión</p>
                        ${dimCards}
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
                        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revisión de respuestas</p>
                        ${revHtml}
                    </div>
                    <button onclick="printParticipantResult()"
                        class="w-full py-3 bg-teal-700 hover:bg-teal-600 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-file-pdf"></i> Descargar mi resultado (PDF)
                    </button>
                    <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">
                        Volver al inicio
                    </button>
                </div>`;
            return;
        }

        let msg = '', msgColor = '';
        if (!myScore) {
            msg = 'No hay datos de tu participación registrados.';
            msgColor = 'text-slate-400';
        } else if (myScore.nota === null && onlyNivel) {
            msg = '✅ Tus respuestas han sido registradas. El profesor revisará los resultados.';
            msgColor = 'text-emerald-400';
        } else if (myScore.nota === null) {
            msg = '⏳ Tu nota final se calculará cuando el profesor califique las preguntas abiertas.';
            msgColor = 'text-amber-300';
        } else if (myScore.nota === bestNota && bestNota !== null && scores.filter(s => s.nota === bestNota).length === 1) {
            msg = '🏆 ¡Felicitaciones! ¡Obtuviste la mejor nota del salón!';
            msgColor = 'text-amber-400';
        } else if (avg !== null && myScore.nota > avg) {
            msg = '🌟 ¡Felicitaciones! Tu nota está por encima del promedio del salón.';
            msgColor = 'text-emerald-400';
        } else if (avg !== null && Math.abs(myScore.nota - avg) < 0.05) {
            msg = '👍 Obtuviste exactamente la nota promedio del salón.';
            msgColor = 'text-indigo-300';
        } else {
            msg = '📚 Tu nota está por debajo del promedio. ¡No te desanimes! Con un poco más de estudio y atención lo lograrás.';
            msgColor = 'text-amber-300';
        }

        const myNota    = myScore?.nota ?? null;
        const notaColor = myNota === null ? 'text-slate-400'
            : myNota >= 14 ? 'text-emerald-400' : myNota >= 11 ? 'text-amber-400' : 'text-red-400';
        const notaDisp  = myNota !== null ? myNota.toFixed(1) : '—';
        const avgDisp   = avg    !== null ? avg.toFixed(1)    : '—';
        const bestDisp  = bestNota !== null ? bestNota.toFixed(1) : '—';

        $('ended-content').innerHTML = `
            <div class="space-y-5 w-full max-w-sm mx-auto fade-in">
                <div class="text-center space-y-1">
                    <div class="text-4xl">🏁</div>
                    <h2 class="text-2xl font-extrabold text-white">¡Sesión finalizada!</h2>
                    <p class="text-slate-400 text-sm">${sessionData.name}</p>
                </div>

                <!-- Nota personal -->
                <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-xl space-y-2">
                    <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">${onlyNivel ? 'Respuestas registradas' : `Tu calificación${hasOpenQ ? ' (MC)' : ''}`}</p>
                    <p class="text-7xl font-extrabold ${notaColor}">${onlyNivel ? '✓' : notaDisp}</p>
                    <p class="text-sm text-slate-400">${onlyNivel ? `${Object.keys(examAnswers).length} de ${sessionData.questions.length} preguntas respondidas` : myScore && myScore.total ? `${myScore.correct} de ${myScore.total} correctas (opción múltiple)` : ''}</p>
                    ${hasOpenQ ? '<p class="text-xs text-amber-400 mt-1" id="open-q-status">⏳ Esperando calificación del profesor…</p>' : ''}
                </div>

                ${hasOpenQ ? `
                <!-- Botón Ver nota final -->
                <div id="nota-final-section" class="bg-indigo-950/60 border border-indigo-700/50 rounded-2xl p-4 space-y-3 text-center">
                    <p class="text-xs text-indigo-300 uppercase tracking-wider font-semibold"><i class="fa-solid fa-star mr-1"></i>Nota final con preguntas abiertas</p>
                    <p class="text-xs text-slate-400" id="nota-final-hint">Cuando el profesor califique las preguntas abiertas, tu nota final estará disponible aquí.</p>
                    <button onclick="loadBoleta('${cloudId}','${participantId}')"
                        class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-file-lines"></i> Ver mi nota final
                    </button>
                </div>` : ''}

                <!-- Nota promedio -->
                <div class="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Promedio del salón</p>
                        <p class="text-2xl font-extrabold text-indigo-300">${avgDisp}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Mejor nota</p>
                        <p class="text-2xl font-extrabold text-amber-400">${bestDisp}</p>
                    </div>
                </div>

                <!-- Mensaje personalizado -->
                <div class="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 text-center">
                    <p class="text-sm font-semibold ${msgColor}">${msg}</p>
                </div>

                <!-- Revisión pregunta a pregunta -->
                <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revisión de respuestas</p>
                    ${sessionData.questions.map((q, idx) => {
                        const esAb     = (q.tipo || 'multiple_choice') === 'abierta';
                        const esNivelR = (q.tipo || 'multiple_choice') === 'nivel_rango';
                        const myVote   = myScore ? (sessionData.participantVotes?.[participantId]?.[String(idx)] || examAnswers?.[String(idx)] || null) : (examAnswers?.[String(idx)] || null);
                        if (esAb) {
                            const answered = myVote && String(myVote).trim().length > 0;
                            return `<div class="border-b border-slate-700/40 pb-2">
                                <p class="text-xs font-semibold text-slate-300 mb-1">📝 ${idx+1}. ${q.pregunta}</p>
                                ${answered
                                    ? `<p class="text-xs text-slate-400 italic">"${String(myVote).length > 80 ? String(myVote).substring(0,80)+'…' : myVote}"</p>
                                       <p class="text-xs text-amber-400">Pendiente de calificación</p>`
                                    : '<p class="text-xs text-slate-500 italic">Sin respuesta</p>'}
                            </div>`;
                        }
                        if (esNivelR) {
                            const answered = myVote !== null && myVote !== undefined;
                            const dimNombre = q.dimensionNombre || (q.dimension ? 'Dimensión ' + q.dimension : '');
                            return `<div class="border-b border-slate-700/40 pb-2">
                                <p class="text-xs font-semibold text-slate-300 mb-1">${answered ? '✅' : '⬜'} ${idx+1}. ${q.pregunta}</p>
                                ${dimNombre ? `<p class="text-xs text-teal-400 mb-1">${dimNombre}</p>` : ''}
                                ${answered
                                    ? `<div class="flex gap-1">${[1,2,3,4,5].map(n => `<span class="inline-block w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${String(myVote)===String(n) ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-500'}">${n}</span>`).join('')}</div>`
                                    : '<p class="text-xs text-slate-500 italic">Sin respuesta</p>'}
                            </div>`;
                        }
                        const correct  = q.correcta;
                        const answered = myVote !== null;
                        const isOk     = myVote === correct;
                        const icon     = !answered ? '⬜' : isOk ? '✅' : '❌';
                        const opts     = ['A','B','C','D'].map(k => {
                            const text = q['opcion'+k]; if (!text) return '';
                            const isMine = k === myVote;
                            const isCorr = k === correct;
                            return `<span class="inline-block px-2 py-0.5 rounded text-xs mr-1 mb-1 ${
                                isCorr ? 'bg-emerald-700 text-emerald-100 font-bold'
                                : isMine ? 'bg-red-800 text-red-200'
                                : 'bg-slate-700 text-slate-400'
                            }">${k}: ${text.length > 25 ? text.substring(0,25)+'…' : text}</span>`;
                        }).join('');
                        return `<div class="border-b border-slate-700/40 pb-2">
                            <p class="text-xs font-semibold text-slate-300 mb-1">${icon} ${idx+1}. ${q.pregunta}</p>
                            <div>${opts}</div>
                            ${!answered ? '<p class="text-xs text-slate-500 italic">Sin respuesta</p>' : ''}
                        </div>`;
                    }).join('')}
                </div>

                ${hasOpenQ ? `
                <!-- Enlace copiable como respaldo -->
                <div class="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3 space-y-1">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider"><i class="fa-solid fa-link mr-1"></i>Enlace de respaldo</p>
                    <div class="flex items-center gap-2 bg-slate-900 rounded-xl border border-slate-700 p-2">
                        <input type="text" id="boleta-link-input" readonly value="${location.origin + location.pathname}?results=${cloudId}&pid=${participantId}"
                            class="bg-transparent text-[9px] text-slate-500 w-full outline-none font-mono truncate">
                        <button onclick="copyBoleta()" class="shrink-0 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition" title="Copiar enlace">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </div>` : ''}

                <button onclick="printParticipantResult()"
                    class="w-full py-3 bg-violet-700 hover:bg-violet-600 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-file-pdf"></i> Descargar mi resultado (PDF)
                </button>
                <button onclick="resetApp()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition">
                    Volver al inicio
                </button>
            </div>`;

        // Auto-poll: cuando hay preguntas abiertas, verificar si el profesor ya calificó
        if (hasOpenQ && cloudId && participantId) {
            _startNotaFinalPolling(cloudId, participantId);
        }
    }

    let _notaFinalPollInterval = null;
    function _startNotaFinalPolling(sessionId, pid) {
        // Limpiar intervalo anterior si existe
        if (_notaFinalPollInterval) clearInterval(_notaFinalPollInterval);

        _notaFinalPollInterval = setInterval(async () => {
            try {
                const { data, error } = await sb.from('session_results')
                    .select('nota, respuestas')
                    .eq('quiz_session_id', sessionId)
                    .eq('participante_codigo', pid)
                    .single();

                if (error || !data) return;

                const pendientes = (data.respuestas || []).some(r => r.pendiente_calificacion);
                const notaFinal  = data.nota;

                if (!pendientes && notaFinal !== null && notaFinal !== undefined) {
                    // ¡El profesor ya calificó! Actualizar UI
                    clearInterval(_notaFinalPollInterval);
                    _notaFinalPollInterval = null;

                    const statusEl = document.getElementById('open-q-status');
                    if (statusEl) statusEl.textContent = '✅ ¡El profesor ya calificó tus respuestas!';

                    const hintEl = document.getElementById('nota-final-hint');
                    if (hintEl) {
                        const color = notaFinal >= 14 ? 'text-emerald-400' : notaFinal >= 11 ? 'text-amber-400' : 'text-red-400';
                        hintEl.innerHTML = `Tu nota final es <span class="text-2xl font-extrabold ${color}">${notaFinal.toFixed(1)}</span> — haz clic para ver el detalle.`;
                    }
                }
            } catch(e) { /* silencioso */ }
        }, 6000); // cada 6 segundos
    }

    function copyBoleta() {
        const val = $('boleta-link-input')?.value;
        if (!val) return;
        if (navigator.clipboard) navigator.clipboard.writeText(val).then(() => alert('¡Enlace copiado!')).catch(() => fallbackCopy(val));
        else fallbackCopy(val);
    }

    function copyLink() {
        const val = $('participant-link-input').value;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(val).then(() => alert('¡Enlace copiado!')).catch(() => fallbackCopy(val));
        } else fallbackCopy(val);
    }
    function fallbackCopy(val) {
        const el = $('participant-link-input');
        el.select(); el.setSelectionRange(0, 99999);
        document.execCommand('copy');
        alert('¡Enlace copiado!');
    }



    // ── DESCARGAR RESULTADO PDF ───────────────────────────────────────────────
    function printParticipantResult() {
        const { scores, avg, hasPonderada, hasNivelRango } = calculateScores();
        const myScore  = scores.find(s => s.pid === participantId);
        const questions = sessionData.questions || [];
        const myVotes  = sessionData.participantVotes?.[participantId] || {};
        const rangos   = sessionData.rangos || [];
        const fecha    = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const sesNombre = sessionData.name || 'Sesión';
        const participanteLabel = (sessionData.participantNick || participantId || '');

        // ── estilos comunes ────────────────────────────────────────────────
        const baseCSS = `
            @page { margin: 1.8cm 2cm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; max-width: 760px; margin: 0 auto; padding: 24px; font-size: 13px; }
            .header { text-align: center; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 3px solid #7c3aed; }
            .brand { font-size: 11px; font-weight: 800; color: #7c3aed; letter-spacing: 3px; text-transform: uppercase; }
            .sesion-name { font-size: 20px; font-weight: 900; color: #111827; margin: 6px 0 2px; }
            .participante { font-size: 13px; color: #6b7280; }
            .score-box { background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 14px; padding: 20px; text-align: center; margin: 16px 0; }
            .score-num { font-size: 60px; font-weight: 900; color: #6d28d9; line-height: 1; }
            .score-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
            .nota-box { background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 14px; padding: 20px; text-align: center; margin: 16px 0; }
            .nota-num { font-size: 60px; font-weight: 900; line-height: 1; }
            .nota-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
            .nota-verde { color: #059669; }
            .nota-ambar { color: #d97706; }
            .nota-roja  { color: #dc2626; }
            .stats-row { display: flex; gap: 12px; margin: 12px 0; }
            .stat-card { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; text-align: center; }
            .stat-val { font-size: 22px; font-weight: 800; color: #374151; }
            .stat-lbl { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
            .msg-box { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 10px; padding: 12px; text-align: center; font-weight: 600; color: #92400e; margin: 12px 0; font-size: 13px; }
            .diag-box { background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 14px; padding: 18px; margin: 14px 0; }
            .diag-label { font-size: 10px; color: #7c3aed; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; margin-bottom: 4px; }
            .diag-nombre { font-size: 20px; font-weight: 900; color: #4c1d95; margin-bottom: 8px; }
            .diag-text { color: #374151; font-size: 13px; line-height: 1.6; }
            .field-box { border-left: 4px solid #7c3aed; background: #fafafa; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0; }
            .field-label { font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
            .field-text { color: #374151; font-size: 13px; line-height: 1.5; }
            .section-title { font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
            th { background: #6d28d9; color: white; padding: 7px 10px; text-align: left; font-size: 11px; }
            td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
            tr:nth-child(even) td { background: #fafafa; }
            .pts-cell { text-align: center; font-weight: 700; color: #6d28d9; }
            .ok-cell { text-align: center; }
            .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
            .print-btn { display: block; margin: 20px auto 0; padding: 10px 28px; background: #7c3aed; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
            @media print { .print-btn { display: none !important; } }
        `;

        let bodyHTML = '';

        if (hasPonderada) {
            const pt    = myScore?.puntaje_total ?? 0;
            const rango = myScore?.rango || null;
            const ptMax = rangos.length > 0 ? Math.max(...rangos.map(r => r.max)) : '?';
            const validScores = scores.filter(s => s.puntaje_total !== null && s.puntaje_total !== undefined);
            const ptBest = validScores.length > 0 ? Math.max(...validScores.map(s => s.puntaje_total || 0)) : null;
            const ptAvg  = validScores.length > 0
                ? Math.round(validScores.reduce((a, s) => a + (s.puntaje_total || 0), 0) / validScores.length * 10) / 10 : null;

            let msg = '';
            if (ptBest !== null && pt === ptBest && validScores.filter(s => (s.puntaje_total||0) === ptBest).length === 1) {
                msg = '🏆 ¡Obtuviste el puntaje más alto del grupo!';
            } else if (ptAvg !== null && pt > ptAvg) {
                msg = '🌟 Tu puntaje está por encima del promedio del grupo.';
            } else if (ptAvg !== null && Math.abs(pt - ptAvg) < 0.5) {
                msg = '👍 Obtuviste el puntaje promedio del grupo.';
            } else if (ptBest !== null && pt === ptBest && validScores.filter(s => (s.puntaje_total||0) === ptBest).length > 1) {
                msg = '🏆 ¡Estás entre los que obtuvieron el puntaje más alto!';
            } else {
                msg = '📚 Tu puntaje está por debajo del promedio del grupo.';
            }

            // Revisión de respuestas PONDERADA
            const qRows = questions.map((q, idx) => {
                if ((q.tipo || '') !== 'ponderada') return '';
                const myVote = myVotes[String(idx)] || null;
                const pts    = myVote ? (q['puntaje' + myVote] || 0) : 0;
                const optTxt = myVote ? `${myVote}: ${q['opcion' + myVote] || ''}` : '—';
                return `<tr>
                    <td>${idx+1}. ${q.pregunta}</td>
                    <td>${optTxt}</td>
                    <td class="pts-cell">${myVote ? pts : '—'}</td>
                </tr>`;
            }).join('');

            bodyHTML = `
            <div class="header">
                <div class="brand">IntelliPOS Quiz</div>
                <div class="sesion-name">${sesNombre}</div>
                <div class="participante">${participanteLabel}</div>
            </div>

            <div class="score-box">
                <div class="diag-label">Tu puntaje total</div>
                <div class="score-num">${pt}</div>
                <div class="score-sub">de ${ptMax} puntos máximos</div>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-val">${ptBest !== null ? ptBest : '—'}</div>
                    <div class="stat-lbl">Puntaje más alto</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${ptAvg !== null ? ptAvg : '—'}</div>
                    <div class="stat-lbl">Promedio del grupo</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${validScores.length}</div>
                    <div class="stat-lbl">Participantes</div>
                </div>
            </div>

            <div class="msg-box">${msg}</div>

            ${rango ? `
            <div class="diag-box">
                <div class="diag-label">Tu diagnóstico</div>
                <div class="diag-nombre">${rango.nombre}</div>
                ${rango.diagnostico ? `<div class="diag-text">${rango.diagnostico}</div>` : ''}
                ${rango.tu_realidad ? `<div class="field-box" style="margin-top:12px"><div class="field-label">Tu realidad</div><div class="field-text">${rango.tu_realidad}</div></div>` : ''}
                ${rango.tu_reto ? `<div class="field-box"><div class="field-label">Tu reto</div><div class="field-text">${rango.tu_reto}</div></div>` : ''}
                ${rango.recuerda ? `<div class="field-box"><div class="field-label">Recuerda</div><div class="field-text">${rango.recuerda}</div></div>` : ''}
            </div>` : ''}

            <div class="section-title">Detalle de respuestas</div>
            <table>
                <thead><tr>
                    <th style="width:60%">Pregunta</th>
                    <th>Tu respuesta</th>
                    <th style="width:70px;text-align:center">Pts</th>
                </tr></thead>
                <tbody>${qRows}</tbody>
            </table>

            <div class="footer">
                <span>IntelliPOS Quiz · ${sesNombre}</span>
                <span>${fecha}</span>
            </div>
            <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>`;

        } else if (hasNivelRango) {
            // ── NIVEL-RANGO: resultado por dimensión ────────────────────────
            const nivelQs   = questions.filter(q => q.tipo === 'nivel_rango');
            const dims      = [...new Set(nivelQs.map(q => q.dimension || '1'))];
            const rangosDim = sessionData.rangosDim || {};

            // Promedio del salón por dimensión
            const dimAvgSalon = {};
            dims.forEach(d => {
                const vals = scores.map(s => s.rangosPorDim?.[d]?.promedio).filter(v => v > 0);
                dimAvgSalon[d] = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : null;
            });

            const dimCardsHTML = dims.map(d => {
                const nombre    = nivelQs.find(q=>(q.dimension||'1')===d)?.dimensionNombre || 'Dimensión '+d;
                const miProm    = myScore?.rangosPorDim?.[d]?.promedio ?? null;
                const salonProm = dimAvgSalon[d];
                const rangosD   = rangosDim[d] || [];
                const rangoD    = miProm !== null ? rangosD.find(r => miProm >= r.min && miProm <= r.max) : null;
                let comparMsg = '', comparColor = '#6b7280';
                if (miProm !== null && salonProm !== null) {
                    if (miProm > salonProm)      { comparMsg = '↑ Por encima del promedio del salón'; comparColor = '#059669'; }
                    else if (miProm < salonProm) { comparMsg = '↓ Por debajo del promedio del salón'; comparColor = '#d97706'; }
                    else                         { comparMsg = '= Igual al promedio del salón';       comparColor = '#6366f1'; }
                }
                return `<div class="diag-box" style="border-color:#0d9488;background:#f0fdfa;">
                    <div class="diag-label" style="color:#0d9488">${nombre}</div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                        <div>
                            <div style="font-size:48px;font-weight:900;color:#0f766e;line-height:1">${miProm !== null ? miProm.toFixed(1) : '—'}<span style="font-size:14px;color:#6b7280;font-weight:400"> / 5</span></div>
                            ${rangoD ? `<div class="diag-nombre" style="color:#0f766e;font-size:16px;margin-top:4px">${rangoD.nombre}</div>` : ''}
                        </div>
                        ${salonProm !== null ? `<div style="text-align:right;font-size:11px;color:#6b7280">
                            <div>Prom. salón</div>
                            <div style="font-size:18px;font-weight:800;color:#374151">${salonProm.toFixed(1)}</div>
                        </div>` : ''}
                    </div>
                    ${rangoD?.diagnostico ? `<div class="diag-text" style="margin-top:8px">${rangoD.diagnostico}</div>` : ''}
                    ${comparMsg ? `<div style="font-size:11px;font-weight:700;color:${comparColor};margin-top:6px">${comparMsg}</div>` : ''}
                </div>`;
            }).join('');

            const qRowsNR = nivelQs.map((q, i) => {
                const origIdx  = questions.indexOf(q);
                const myVote   = myVotes[String(origIdx)] || (examAnswers?.[String(origIdx)] ?? null);
                const dimNombre = q.dimensionNombre || 'Dim '+(q.dimension||'');
                const nivBtns  = [1,2,3,4,5].map(n =>
                    `<span style="display:inline-flex;width:26px;height:26px;border-radius:6px;font-size:11px;font-weight:700;align-items:center;justify-content:center;${String(myVote)===String(n)?'background:#0d9488;color:white':'background:#f3f4f6;color:#9ca3af'}">${n}</span>`
                ).join(' ');
                return `<tr>
                    <td>${myVote ? '✅' : '⬜'} ${origIdx+1}. ${q.pregunta}${dimNombre ? `<br><span style="font-size:10px;color:#0d9488">${dimNombre}</span>` : ''}</td>
                    <td>${myVote ? nivBtns : '<span style="color:#9ca3af;font-style:italic">Sin respuesta</span>'}</td>
                </tr>`;
            }).join('');

            bodyHTML = `
            <div class="header">
                <div class="brand">IntelliPOS Quiz</div>
                <div class="sesion-name">${sesNombre}</div>
                <div class="participante">${participanteLabel}</div>
            </div>

            <p class="section-title" style="color:#0d9488">Resultados por dimensión</p>
            ${dimCardsHTML}

            <p class="section-title">Detalle de respuestas</p>
            <table>
                <thead><tr>
                    <th style="width:65%;background:#0f766e">Pregunta / Dimensión</th>
                    <th style="background:#0f766e">Nivel elegido</th>
                </tr></thead>
                <tbody>${qRowsNR}</tbody>
            </table>

            <div class="footer">
                <span>IntelliPOS Quiz · ${sesNombre}</span>
                <span>${fecha}</span>
            </div>
            <button class="print-btn" style="background:#0d9488" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>`;

        } else {
            // ── MC ──────────────────────────────────────────────────────────
            const nota     = myScore?.nota ?? null;
            const correct  = myScore?.correct ?? 0;
            const total    = myScore?.total ?? 0;
            const bestNota = scores.filter(s => s.nota !== null).length > 0
                ? Math.max(...scores.filter(s => s.nota !== null).map(s => s.nota)) : null;
            const notaColor = nota === null ? 'nota-roja'
                : nota >= 14 ? 'nota-verde' : nota >= 11 ? 'nota-ambar' : 'nota-roja';

            let msg = '';
            if (nota === null) {
                msg = '⏳ Tu nota final se calculará cuando el profesor califique las preguntas abiertas.';
            } else if (bestNota !== null && nota === bestNota && scores.filter(s => s.nota === bestNota).length === 1) {
                msg = '🏆 ¡Felicitaciones! ¡Obtuviste la mejor nota del salón!';
            } else if (avg !== null && nota > avg) {
                msg = '🌟 ¡Felicitaciones! Tu nota está por encima del promedio del salón.';
            } else if (avg !== null && Math.abs(nota - avg) < 0.05) {
                msg = '👍 Obtuviste exactamente la nota promedio del salón.';
            } else {
                msg = '📚 Tu nota está por debajo del promedio. ¡No te desanimes!';
            }

            const qRows = questions.map((q, idx) => {
                const esAb   = (q.tipo || 'multiple_choice') === 'abierta';
                const myVote = myVotes[String(idx)] || null;
                if (esAb) {
                    const ans = myVote && String(myVote).trim() ? String(myVote).substring(0, 120) : '—';
                    return `<tr>
                        <td>📝 ${idx+1}. ${q.pregunta}</td>
                        <td colspan="2" style="font-style:italic;color:#6b7280">${ans}<br><span style="color:#d97706;font-size:11px">Pendiente de calificación</span></td>
                    </tr>`;
                }
                const isOk = myVote === q.correcta;
                const icon = !myVote ? '⬜' : isOk ? '✅' : '❌';
                const myOptTxt = myVote ? `${myVote}: ${q['opcion' + myVote] || ''}` : '—';
                const corrTxt  = `${q.correcta}: ${q['opcion' + q.correcta] || ''}`;
                return `<tr>
                    <td>${icon} ${idx+1}. ${q.pregunta}</td>
                    <td>${myOptTxt}${!isOk && myVote ? `<br><span style="color:#059669;font-size:11px">✓ ${corrTxt}</span>` : ''}</td>
                    <td class="ok-cell">${!myVote ? '—' : isOk ? '✅' : '❌'}</td>
                </tr>`;
            }).join('');

            bodyHTML = `
            <div class="header">
                <div class="brand">IntelliPOS Quiz</div>
                <div class="sesion-name">${sesNombre}</div>
                <div class="participante">${participanteLabel}</div>
            </div>

            <div class="nota-box">
                <div class="diag-label">Tu calificación</div>
                <div class="nota-num ${notaColor}">${nota !== null ? nota.toFixed(1) : '—'}</div>
                <div class="score-sub">${correct} de ${total} correctas · escala 0–20</div>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-val">${bestNota !== null ? bestNota.toFixed(1) : '—'}</div>
                    <div class="stat-lbl">Mejor nota</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${avg !== null ? avg.toFixed(1) : '—'}</div>
                    <div class="stat-lbl">Promedio del salón</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">${scores.length}</div>
                    <div class="stat-lbl">Participantes</div>
                </div>
            </div>

            <div class="msg-box">${msg}</div>

            <div class="section-title">Detalle de respuestas</div>
            <table>
                <thead><tr>
                    <th style="width:55%">Pregunta</th>
                    <th>Tu respuesta / Correcta</th>
                    <th style="width:50px;text-align:center">Res.</th>
                </tr></thead>
                <tbody>${qRows}</tbody>
            </table>

            <div class="footer">
                <span>IntelliPOS Quiz · ${sesNombre}</span>
                <span>${fecha}</span>
            </div>
            <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>`;
        }

        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { alert('Permite ventanas emergentes para descargar tu resultado.'); return; }
        win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
            <title>Resultado – ${sesNombre}</title>
            <style>${baseCSS}</style></head><body>${bodyHTML}</body></html>`);
        win.document.close();
        setTimeout(() => win.print(), 600);
    }

