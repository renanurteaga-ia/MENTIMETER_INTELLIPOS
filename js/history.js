// IntelliPOS Interactive — history.js

    let bancoQuizId   = null;   // ID del quiz que se está revisando
    let bancoPreguntas = [];    // Copia local con marcas editadas

    // ── HISTORIAL DE SESIONES ─────────────────────────────────────────────────
    async function initHistorial() {
        showView('view-historial');
        // Cargar opciones de filtro de quizzes
        const { data: quizzes } = await sb.from('quizzes').select('id, nombre').order('nombre');
        const sel = $('historial-quiz-filter');
        if (sel && quizzes) {
            sel.innerHTML = '<option value="">— Todos los cuestionarios —</option>' +
                quizzes.map(q => `<option value="${q.id}">${q.nombre}</option>`).join('');
        }
        await loadHistorial();
    }

    async function loadHistorial() {
        $('historial-loading').classList.remove('hidden');
        $('historial-empty').classList.add('hidden');
        $('historial-list').classList.add('hidden');
        $('historial-list').innerHTML = '';

        const quizId = $('historial-quiz-filter')?.value || '';
        let query = sb.from('session_results')
            .select('quiz_session_id, quiz_id, participante_identificador, participante_codigo, nota, puntaje_total, rango_obtenido, completado_en, puntaje_obtenido, puntaje_posible')
            .order('completado_en', { ascending: false });
        if (quizId) query = query.eq('quiz_id', quizId);

        const { data, error } = await query.limit(500);
        $('historial-loading').classList.add('hidden');

        if (error || !data || data.length === 0) {
            $('historial-empty').classList.remove('hidden');
            return;
        }

        // Agrupar por quiz_session_id
        const sesiones = {};
        data.forEach(r => {
            if (!sesiones[r.quiz_session_id]) {
                sesiones[r.quiz_session_id] = {
                    id: r.quiz_session_id,
                    quiz_id: r.quiz_id,
                    fecha: r.completado_en,
                    participantes: []
                };
            }
            sesiones[r.quiz_session_id].participantes.push(r);
            // fecha más reciente del grupo
            if (r.completado_en > sesiones[r.quiz_session_id].fecha)
                sesiones[r.quiz_session_id].fecha = r.completado_en;
        });

        // Obtener nombres de quizzes
        const qIds = [...new Set(Object.values(sesiones).map(s => s.quiz_id).filter(Boolean))];
        let quizNombres = {};
        if (qIds.length) {
            const { data: qData } = await sb.from('quizzes').select('id, nombre').in('id', qIds);
            if (qData) qData.forEach(q => { quizNombres[q.id] = q.nombre; });
        }

        const sesArr = Object.values(sesiones).sort((a, b) => b.fecha.localeCompare(a.fecha));

        $('historial-list').classList.remove('hidden');
        $('historial-list').innerHTML = sesArr.map((ses, idx) => {
            const nPartic = ses.participantes.length;
            const nombre  = quizNombres[ses.quiz_id] || 'Cuestionario';
            const fecha   = new Date(ses.fecha).toLocaleDateString('es', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
            const esPonderada = ses.participantes.some(p => p.puntaje_total !== null && p.puntaje_total !== undefined);

            // Filas de participantes
            const filasHTML = ses.participantes.map(p => {
                if (esPonderada) {
                    const rango = p.rango_obtenido;
                    return `<tr class="border-t border-slate-700/50">
                        <td class="py-2 px-3 text-sm text-white">${p.participante_identificador || p.participante_codigo}</td>
                        <td class="py-2 px-3 text-sm text-center font-bold text-violet-300">${p.puntaje_total ?? '—'} pts</td>
                        <td class="py-2 px-3 text-xs text-slate-300">${rango ? rango.nombre : '—'}</td>
                    </tr>`;
                } else {
                    const nota = p.nota !== null && p.nota !== undefined ? p.nota.toFixed(1) : '—';
                    const color = p.nota >= 14 ? 'text-emerald-300' : p.nota >= 11 ? 'text-amber-300' : 'text-red-400';
                    return `<tr class="border-t border-slate-700/50">
                        <td class="py-2 px-3 text-sm text-white">${p.participante_identificador || p.participante_codigo}</td>
                        <td class="py-2 px-3 text-sm text-center font-bold ${color}">${nota}</td>
                        <td class="py-2 px-3 text-xs text-slate-400">${p.puntaje_obtenido ?? 0} / ${p.puntaje_posible ?? 0} pts</td>
                    </tr>`;
                }
            }).join('');

            const colHead2 = esPonderada ? 'Puntaje' : 'Nota';
            const colHead3 = esPonderada ? 'Rango' : 'Puntaje';

            return `
            <div class="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <button onclick="toggleHistorialSesion('hses-${idx}')"
                    class="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition text-left">
                    <div>
                        <p class="font-bold text-white text-sm">${nombre}</p>
                        <p class="text-xs text-slate-500 mt-0.5">${fecha} · ${nPartic} participante${nPartic !== 1 ? 's' : ''}
                            ${esPonderada ? '<span class="ml-2 px-1.5 py-0.5 bg-violet-900/50 text-violet-300 rounded text-xs">PONDERADA</span>' : ''}
                        </p>
                    </div>
                    <i id="hses-ico-${idx}" class="fa-solid fa-chevron-down text-slate-500 transition-transform"></i>
                </button>
                <div id="hses-${idx}" class="hidden border-t border-slate-700">
                    <table class="w-full">
                        <thead>
                            <tr class="bg-slate-800">
                                <th class="py-2 px-3 text-xs text-slate-400 text-left font-semibold">Participante</th>
                                <th class="py-2 px-3 text-xs text-slate-400 text-center font-semibold">${colHead2}</th>
                                <th class="py-2 px-3 text-xs text-slate-400 text-left font-semibold">${colHead3}</th>
                            </tr>
                        </thead>
                        <tbody>${filasHTML}</tbody>
                    </table>
                </div>
            </div>`;
        }).join('');
    }

    function toggleHistorialSesion(id) {
        const el  = $(id);
        const ico = $(id.replace('hses-', 'hses-ico-'));
        if (!el) return;
        el.classList.toggle('hidden');
        if (ico) ico.style.transform = el.classList.contains('hidden') ? '' : 'rotate(180deg)';
    }

    async function initBanco() {
        showView('view-banco');
        $('banco-content').innerHTML = '';
        $('banco-counters').classList.add('hidden');
        bancoQuizId   = null;
        bancoPreguntas = [];

        // Cargar lista de quizzes
        const sel = $('banco-quiz-select');
        sel.innerHTML = '<option value="">— Cargando cuestionarios… —</option>';
        const { data, error } = await sb.from('quizzes').select('id, nombre, preguntas').order('creado_en', { ascending: false });
        sel.innerHTML = '<option value="">— Selecciona un cuestionario —</option>';
        if (error || !data || data.length === 0) {
            sel.innerHTML += '<option disabled>No hay cuestionarios en el banco</option>';
            return;
        }
        data.forEach(q => {
            const opt = document.createElement('option');
            opt.value = q.id;
            const n = Array.isArray(q.preguntas) ? q.preguntas.length : 0;
            opt.textContent = `${q.nombre}  (${n} preguntas)`;
            opt.dataset.preguntas = JSON.stringify(q.preguntas || []);
            sel.appendChild(opt);
        });
    }

    function loadBancoQuiz() {
        const sel = $('banco-quiz-select');
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.value) {
            $('banco-content').innerHTML = '';
            $('banco-counters').classList.add('hidden');
            return;
        }
        bancoQuizId    = opt.value;
        bancoPreguntas = JSON.parse(opt.dataset.preguntas || '[]');
        renderBanco();
    }

    function renderBanco() {
        const qs = bancoPreguntas;
        updateBancoCounters();

        const html = qs.map((q, idx) => {
            const tipo     = (q.tipo || 'multiple_choice') === 'abierta' ? 'Abierta' : 'Opción múltiple';
            const tipoIcon = tipo === 'Abierta' ? '📝' : '🔘';
            const mParcial  = q.marcas?.parcial   || false;
            const mFinal    = q.marcas?.final     || false;
            const mPractica = q.marcas?.practica  || false;
            const sesLabel = q.sesion ? `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">Ses. ${q.sesion}</span>` : '';
            const topLabel = q.topico ? `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">${q.topico}</span>` : '';

            return `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div class="flex items-start gap-3">
                    <span class="text-slate-500 font-bold text-sm shrink-0 mt-0.5">${idx+1}.</span>
                    <div class="flex-1 space-y-1">
                        <p class="text-sm text-white leading-snug">${q.pregunta}</p>
                        <div class="flex flex-wrap gap-1.5 items-center">
                            <span class="text-xs text-slate-500">${tipoIcon} ${tipo} · ${q.puntaje || 1} pts</span>
                            ${sesLabel}${topLabel}
                        </div>
                    </div>
                </div>
                <!-- Sesión y Tópico editables -->
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sesión N°</label>
                        <input type="number" min="1" value="${q.sesion || ''}" placeholder="—"
                            onchange="setBancoSesion(${idx}, this.value)"
                            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 transition">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tópico</label>
                        <input type="text" value="${(q.topico || '').replace(/"/g,'&quot;')}" placeholder="Ej: Costos variables"
                            onchange="setBancoTopico(${idx}, this.value)"
                            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 transition">
                    </div>
                </div>
                <div class="flex gap-2 pt-1">
                    <button onclick="toggleMarca(${idx},'parcial')" id="btn-parcial-${idx}"
                        class="flex-1 py-2 rounded-xl text-xs font-bold border transition ${mParcial
                            ? 'bg-amber-700/60 border-amber-500 text-amber-200'
                            : 'bg-slate-700/60 border-slate-600 text-slate-400 hover:border-amber-600 hover:text-amber-300'}">
                        <i class="fa-solid fa-p mr-1"></i>Parcial
                    </button>
                    <button onclick="toggleMarca(${idx},'final')" id="btn-final-${idx}"
                        class="flex-1 py-2 rounded-xl text-xs font-bold border transition ${mFinal
                            ? 'bg-purple-700/60 border-purple-500 text-purple-200'
                            : 'bg-slate-700/60 border-slate-600 text-slate-400 hover:border-purple-600 hover:text-purple-300'}">
                        <i class="fa-solid fa-f mr-1"></i>Final
                    </button>
                    <button onclick="toggleMarca(${idx},'practica')" id="btn-practica-${idx}"
                        class="flex-1 py-2 rounded-xl text-xs font-bold border transition ${mPractica
                            ? 'bg-emerald-700/60 border-emerald-500 text-emerald-200'
                            : 'bg-slate-700/60 border-slate-600 text-slate-400 hover:border-emerald-600 hover:text-emerald-300'}">
                        <i class="fa-solid fa-pencil mr-1"></i>Práctica
                    </button>
                </div>
            </div>`;
        }).join('');

        $('banco-content').innerHTML = html || '<p class="text-slate-500 text-sm text-center">Este cuestionario no tiene preguntas.</p>';
        $('banco-counters').classList.remove('hidden');
    }

    function setBancoSesion(idx, val) {
        if (!bancoPreguntas[idx]) return;
        const n = parseInt(val);
        bancoPreguntas[idx].sesion = (!isNaN(n) && n > 0) ? n : null;
    }

    function setBancoTopico(idx, val) {
        if (!bancoPreguntas[idx]) return;
        bancoPreguntas[idx].topico = val.trim() || null;
    }

    function toggleMarca(idx, tipo) {
        if (!bancoPreguntas[idx]) return;
        bancoPreguntas[idx].marcas = bancoPreguntas[idx].marcas || {};
        bancoPreguntas[idx].marcas[tipo] = !bancoPreguntas[idx].marcas[tipo];

        // Actualizar botón visualmente sin re-renderizar todo
        const btn = $(`btn-${tipo}-${idx}`);
        const activo = bancoPreguntas[idx].marcas[tipo];
        const clases = {
            parcial:  [' bg-amber-700/60 border-amber-500 text-amber-200',   ' bg-slate-700/60 border-slate-600 text-slate-400 hover:border-amber-600 hover:text-amber-300'],
            final:    [' bg-purple-700/60 border-purple-500 text-purple-200', ' bg-slate-700/60 border-slate-600 text-slate-400 hover:border-purple-600 hover:text-purple-300'],
            practica: [' bg-emerald-700/60 border-emerald-500 text-emerald-200', ' bg-slate-700/60 border-slate-600 text-slate-400 hover:border-emerald-600 hover:text-emerald-300']
        };
        const [on, off] = clases[tipo] || clases.parcial;
        btn.className = `flex-1 py-2 rounded-xl text-xs font-bold border transition${activo ? on : off}`;
        updateBancoCounters();
    }

    function updateBancoCounters() {
        const cP = bancoPreguntas.filter(q => q.marcas?.parcial).length;
        const cF = bancoPreguntas.filter(q => q.marcas?.final).length;
        const cPr = bancoPreguntas.filter(q => q.marcas?.practica).length;
        $('cnt-parcial').textContent  = cP;
        $('cnt-final').textContent    = cF;
        $('cnt-practica').textContent = cPr;
        $('cnt-total').textContent    = bancoPreguntas.length;
    }

    async function saveBancoMarks() {
        if (!bancoQuizId) return;
        const statusEl = $('banco-save-status');
        const btn      = $('btn-banco-save');
        btn.disabled   = true;
        statusEl.textContent = '⏳ Guardando…';

        const { error } = await sb.from('quizzes')
            .update({ preguntas: bancoPreguntas })
            .eq('id', bancoQuizId);

        btn.disabled = false;
        if (error) {
            statusEl.textContent = `⚠️ Error: ${error.message}`;
            statusEl.style.color = '#f87171';
        } else {
            statusEl.textContent = '✅ Marcas guardadas';
            statusEl.style.color = '';
            // Actualizar también el option del selector para reflejar los nuevos datos
            const sel = $('banco-quiz-select');
            const opt = sel.options[sel.selectedIndex];
            if (opt) opt.dataset.preguntas = JSON.stringify(bancoPreguntas);
            setTimeout(() => { statusEl.textContent = ''; }, 3000);
        }
    }

