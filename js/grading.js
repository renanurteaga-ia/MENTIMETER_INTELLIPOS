// IntelliPOS Interactive — grading.js
    // ════════════════════════════════════════════════════════════════════════════
    // v2.7 — CALIFICACIÓN DE PREGUNTAS ABIERTAS (PROFESOR)
    // ════════════════════════════════════════════════════════════════════════════

    // Almacena las calificaciones pendientes: { pid: { qIdx: { pts, anotacion } } }
    let gradingData = {};
    // Resultados cargados desde Supabase para calificar
    let gradingResults = [];

    // ════════════════════════════════════════════════════════════════════════════
    // v2.8 — GESTIÓN DE IAs
    // ════════════════════════════════════════════════════════════════════════════

    let aiProviders = [];   // cargados desde Supabase
    let selectedAiId = null;

    const AI_TEMPLATES = {
        deepseek: { nombre: 'DeepSeek Chat', api_url: 'https://api.deepseek.com/chat/completions', modelo: 'deepseek-chat' },
        openai:   { nombre: 'OpenAI GPT-4o Mini', api_url: 'https://api.openai.com/v1/chat/completions', modelo: 'gpt-4o-mini' },
        custom:   { nombre: '', api_url: '', modelo: '' }
    };

    function onAiProveedorChange() {
        const prov = $('ai-new-proveedor')?.value || 'deepseek';
        const tpl  = AI_TEMPLATES[prov] || AI_TEMPLATES.custom;
        if ($('ai-new-nombre') && !$('ai-new-nombre').value) $('ai-new-nombre').value = tpl.nombre;
        if ($('ai-new-url'))    $('ai-new-url').value    = tpl.api_url;
        if ($('ai-new-modelo')) $('ai-new-modelo').value = tpl.modelo;
    }

    function toggleNewKeyVisibility() {
        const inp = $('ai-new-key');
        const ico = $('new-key-eye');
        if (!inp) return;
        if (inp.type === 'password') { inp.type = 'text';     ico?.classList.replace('fa-eye','fa-eye-slash'); }
        else                         { inp.type = 'password'; ico?.classList.replace('fa-eye-slash','fa-eye'); }
    }

    async function loadAiProviders() {
        const { data, error } = await sb.from('ai_providers').select('*').order('creado_en');
        if (error) return [];
        return data || [];
    }

    async function initAiConfig() {
        showView('view-ai-config');
        $('ai-save-status').textContent = '';
        // Pre-rellenar plantilla por defecto
        onAiProveedorChange();
        // Cargar lista
        const container = $('ai-list-container');
        container.innerHTML = '<div class="text-slate-400 text-sm text-center py-6">⏳ Cargando…</div>';
        aiProviders = await loadAiProviders();
        renderAiList();
    }

    function renderAiList() {
        const container = $('ai-list-container');
        if (!aiProviders.length) {
            container.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">No hay IAs registradas. Agrega una abajo.</p>';
            return;
        }
        container.innerHTML = aiProviders.map(p => {
            const estadoBadge = {
                ok:          '<span class="text-xs bg-emerald-900/60 border border-emerald-700/40 text-emerald-300 px-2 py-0.5 rounded-full">✅ Disponible</span>',
                sin_saldo:   '<span class="text-xs bg-red-900/60 border border-red-700/40 text-red-300 px-2 py-0.5 rounded-full">❌ Sin saldo</span>',
                key_invalida:'<span class="text-xs bg-red-900/60 border border-red-700/40 text-red-300 px-2 py-0.5 rounded-full">❌ Key inválida</span>',
                rate_limit:  '<span class="text-xs bg-amber-900/60 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full">⚠️ Rate limit</span>',
                error:       '<span class="text-xs bg-slate-700 border border-slate-600 text-slate-400 px-2 py-0.5 rounded-full">⚠️ Error</span>'
            }[p.ultimo_estado] || '<span class="text-xs text-slate-500">— Sin verificar</span>';

            const verificadoStr = p.verificado_en
                ? `<span class="text-slate-600 text-xs">Verificado: ${new Date(p.verificado_en).toLocaleString()}</span>`
                : '';

            return `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2" id="ai-row-${p.id}">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="text-sm font-bold text-white">${p.nombre}</p>
                            ${p.activo ? '' : '<span class="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Inactiva</span>'}
                            ${estadoBadge}
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5 truncate">${p.api_url} · <span class="text-indigo-400">${p.modelo}</span></p>
                        ${verificadoStr}
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="probeAiById('${p.id}')"
                            class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 transition">
                            <i class="fa-solid fa-plug mr-1"></i>Probar
                        </button>
                        <button onclick="toggleAiActive('${p.id}', ${p.activo})"
                            class="text-xs px-2 py-1 ${p.activo ? 'bg-amber-900/40 hover:bg-amber-900/60 border-amber-700/40 text-amber-300' : 'bg-emerald-900/40 hover:bg-emerald-900/60 border-emerald-700/40 text-emerald-300'} border rounded-lg transition">
                            ${p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onclick="deleteAiProvider('${p.id}')"
                            class="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 text-red-300 rounded-lg transition">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    async function probeAiById(id) {
        const p = aiProviders.find(x => x.id === id);
        if (!p) return;
        const row = $(`ai-row-${id}`);
        if (row) row.style.opacity = '0.6';

        const estado = await probeAiProvider(p);

        // Guardar estado en Supabase
        await sb.from('ai_providers').update({
            ultimo_estado: estado,
            verificado_en: new Date().toISOString()
        }).eq('id', id);

        // Actualizar local
        const idx = aiProviders.findIndex(x => x.id === id);
        if (idx >= 0) { aiProviders[idx].ultimo_estado = estado; aiProviders[idx].verificado_en = new Date().toISOString(); }
        if (row) row.style.opacity = '1';
        renderAiList();
    }

    async function probeAiProvider(p) {
        try {
            const res = await fetch(p.api_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.api_key}` },
                body: JSON.stringify({
                    model: p.modelo,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });
            if (res.status === 200) return 'ok';
            if (res.status === 401 || res.status === 403) return 'key_invalida';
            if (res.status === 402) return 'sin_saldo';
            if (res.status === 429) return 'rate_limit';
            // Algunos proveedores devuelven 200 con error en body
            const json = await res.json().catch(() => ({}));
            if (json.error?.code === 'insufficient_quota') return 'sin_saldo';
            return 'error';
        } catch(e) {
            return 'error';
        }
    }

    async function saveNewAiProvider() {
        const statusEl = $('ai-save-status');
        const nombre   = ($('ai-new-nombre')?.value || '').trim();
        const api_url  = ($('ai-new-url')?.value    || '').trim();
        const api_key  = ($('ai-new-key')?.value    || '').trim();
        const modelo   = ($('ai-new-modelo')?.value || '').trim();
        const prov     = $('ai-new-proveedor')?.value || 'custom';

        if (!nombre || !api_url || !api_key || !modelo) {
            statusEl.textContent = '⚠️ Completa todos los campos.'; return;
        }
        statusEl.textContent = '⏳ Guardando…';

        const { data, error } = await sb.from('ai_providers').insert([{
            nombre, proveedor: prov, api_url, api_key, modelo, activo: true
        }]).select().single();

        if (error) {
            statusEl.textContent = '⚠️ Error al guardar: ' + error.message; return;
        }

        statusEl.textContent = '✅ IA registrada correctamente';
        aiProviders.push(data);
        renderAiList();

        // Limpiar formulario
        ['ai-new-nombre','ai-new-key'].forEach(id => { if ($(id)) $(id).value = ''; });
        onAiProveedorChange();

        // Probar automáticamente
        if (data?.id) probeAiById(data.id);
    }

    async function toggleAiActive(id, activo) {
        await sb.from('ai_providers').update({ activo: !activo }).eq('id', id);
        const idx = aiProviders.findIndex(x => x.id === id);
        if (idx >= 0) aiProviders[idx].activo = !activo;
        renderAiList();
    }

    async function deleteAiProvider(id) {
        if (!confirm('¿Eliminar esta IA? Esta acción no se puede deshacer.')) return;
        await sb.from('ai_providers').delete().eq('id', id);
        aiProviders = aiProviders.filter(x => x.id !== id);
        renderAiList();
    }

    // ── SELECTOR DE IA EN PANTALLA DE CALIFICACIÓN ────────────────────────────

    function populateGradingAiSelect() {
        const sel = $('grading-ai-select');
        if (!sel) return;
        const activas = aiProviders.filter(p => p.activo);
        if (!activas.length) {
            sel.innerHTML = '<option value="">— Sin IAs registradas. Registra una primero. —</option>';
            return;
        }
        sel.innerHTML = '<option value="">— Selecciona una IA —</option>' +
            activas.map(p => {
                const badge = p.ultimo_estado === 'ok' ? '✅' : p.ultimo_estado ? '⚠️' : '○';
                return `<option value="${p.id}">${badge} ${p.nombre} (${p.modelo})</option>`;
            }).join('');
        // Preseleccionar el último usado
        const lastId = localStorage.getItem('last_ai_id');
        if (lastId && activas.find(p => p.id === lastId)) sel.value = lastId;
        onGradingAiSelect();
    }

    function onGradingAiSelect() {
        const sel = $('grading-ai-select');
        if (!sel) return;
        selectedAiId = sel.value || null;
        if (selectedAiId) localStorage.setItem('last_ai_id', selectedAiId);
        const p = aiProviders.find(x => x.id === selectedAiId);
        const statusEl = $('grading-ai-status');
        if (!statusEl) return;
        if (!p) { statusEl.textContent = 'Selecciona una IA para activar las sugerencias.'; statusEl.className = 'text-xs text-slate-500'; return; }
        const msgs = {
            ok:          ['✅ Disponible — lista para sugerir calificaciones.', 'text-xs text-emerald-400'],
            sin_saldo:   ['❌ Sin saldo. Verifica los créditos del proveedor.', 'text-xs text-red-400'],
            key_invalida:['❌ API Key inválida. Regístrala nuevamente.', 'text-xs text-red-400'],
            rate_limit:  ['⚠️ Rate limit activo. Espera unos minutos.', 'text-xs text-amber-400'],
            error:       ['⚠️ Error de conexión. Prueba con "Verificar".', 'text-xs text-amber-400']
        };
        const [msg, cls] = msgs[p.ultimo_estado] || ['○ Sin verificar. Presiona "Verificar" para probarla.', 'text-xs text-slate-400'];
        statusEl.textContent = msg; statusEl.className = cls;
    }

    async function probeSelectedGradingAi() {
        if (!selectedAiId) { alert('Selecciona primero una IA.'); return; }
        const btn = $('btn-probe-grading-ai');
        if (btn) btn.disabled = true;
        const p = aiProviders.find(x => x.id === selectedAiId);
        if (!p) return;
        const estado = await probeAiProvider(p);
        await sb.from('ai_providers').update({ ultimo_estado: estado, verificado_en: new Date().toISOString() }).eq('id', selectedAiId);
        const idx = aiProviders.findIndex(x => x.id === selectedAiId);
        if (idx >= 0) { aiProviders[idx].ultimo_estado = estado; aiProviders[idx].verificado_en = new Date().toISOString(); }
        populateGradingAiSelect();
        if (btn) btn.disabled = false;
    }

    async function initGradingMode() {
        showView('view-grading');
        $('grading-session-name').textContent = sessionData.name || '';
        $('grading-save-status').textContent = '';
        gradingData = {};
        gradingResults = [];

        // Cargar IAs disponibles
        const sel = $('grading-ai-select');
        if (sel) sel.innerHTML = '<option value="">— Cargando IAs… —</option>';
        aiProviders = await loadAiProviders();
        populateGradingAiSelect();

        // Cargar resultados de Supabase
        const { data, error } = await sb.from('session_results')
            .select('*')
            .eq('quiz_session_id', cloudId);

        if (error) {
            $('grading-content').innerHTML = `<p class="text-red-400 text-sm">⚠️ Error al cargar resultados: ${error.message}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            // Intentar guardar ahora mismo si hay datos en memoria
            const participants = sessionData.participants || {};
            if (Object.keys(participants).length > 0) {
                $('grading-content').innerHTML = `<p class="text-amber-400 text-sm">⏳ Guardando resultados… por favor espera.</p>`;
                const saved = await saveSessionResults();
                if (saved) {
                    // Reintentar la carga
                    const { data: data2 } = await sb.from('session_results')
                        .select('*').eq('quiz_session_id', cloudId);
                    if (data2 && data2.length > 0) {
                        gradingResults = data2;
                        renderGradingPanel();
                        return;
                    }
                }
            }
            $('grading-content').innerHTML = `
                <div class="text-center space-y-3 py-6">
                    <p class="text-amber-400 text-sm font-semibold">⚠️ No se encontraron resultados guardados.</p>
                    <p class="text-slate-400 text-xs max-w-xs mx-auto">
                        Es posible que los participantes no hayan enviado sus exámenes,
                        o que la sesión se haya cerrado antes de que sus respuestas sincronizaran.
                        Descarga el Excel para conservar los datos en memoria.
                    </p>
                    <button onclick="downloadReportExcel()"
                        class="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition">
                        <i class="fa-solid fa-file-excel mr-2"></i>Descargar Excel
                    </button>
                </div>`;
            return;
        }

        gradingResults = data;
        renderGradingPanel();
    }

    function renderGradingPanel() {
        const questions = sessionData.questions || [];
        const openQs    = questions.map((q, idx) => ({ q, idx }))
            .filter(({ q }) => (q.tipo || 'multiple_choice') === 'abierta');
        const mcQs      = questions.map((q, idx) => ({ q, idx }))
            .filter(({ q }) => (q.tipo || 'multiple_choice') !== 'abierta');

        let html = '';

        // ── Preguntas MC (solo lectura) ──────────────────────────────────────
        if (mcQs.length > 0) {
            html += `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preguntas de opción múltiple (solo lectura)</p>`;
            mcQs.forEach(({ q, idx }) => {
                const total = ['A','B','C','D'].reduce((s,k) => s + (sessionData.votes[idx+'_'+k] || 0), 0);
                const opts  = ['A','B','C','D'].map(k => {
                    const c = sessionData.votes[idx+'_'+k] || 0;
                    return `<span class="${k === q.correcta ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${k}:${c}${k===q.correcta?'✓':''}</span>`;
                }).join(' ');
                html += `<div class="border-b border-slate-700/40 pb-2 text-xs">
                    <p class="text-slate-300 font-medium mb-0.5">${idx+1}. ${q.pregunta}</p>
                    <p class="text-slate-400">${opts} — <span class="text-slate-500">${total} voto(s) total</span></p>
                </div>`;
            });
            html += `</div>`;
        }

        // ── Preguntas abiertas (calificables) ────────────────────────────────
        openQs.forEach(({ q, idx }) => {
            const maxPts = q.puntaje || 1;
            html += `<div class="bg-slate-800 border border-indigo-800/40 rounded-2xl p-5 space-y-4">
                <div>
                    <span class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Pregunta abierta · ${maxPts} pt${maxPts!==1?'s':''} máx.</span>
                    <p class="text-white font-bold mt-1">${idx+1}. ${q.pregunta}</p>
                </div>
                <div class="space-y-3">`;

            gradingResults.forEach(row => {
                const pid   = row.participante_codigo;
                const nick  = row.participante_identificador;
                const resp  = row.respuestas?.[idx];
                const texto = resp?.respuesta_dada || null;
                const yaCalif = resp && !resp.pendiente_calificacion && resp.puntaje_obtenido !== undefined;

                // Inicializar gradingData
                if (!gradingData[pid]) gradingData[pid] = {};
                if (!gradingData[pid][idx]) {
                    gradingData[pid][idx] = {
                        pts:       yaCalif ? resp.puntaje_obtenido : 0,
                        anotacion: resp?.anotacion || ''
                    };
                }

                const curPts  = gradingData[pid][idx].pts;
                const curAnot = gradingData[pid][idx].anotacion;

                html += `<div class="bg-slate-700/50 rounded-xl p-4 space-y-2 border border-slate-600/40">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold text-white">${nick}</p>
                        <div class="flex items-center gap-2 shrink-0">
                            <button onclick="suggestGrade('${pid}',${idx},${maxPts})"
                                class="text-xs px-2 py-1 bg-slate-600 hover:bg-amber-700/60 border border-slate-500 hover:border-amber-600 text-slate-300 hover:text-amber-300 rounded-lg transition whitespace-nowrap">
                                <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>IA
                            </button>
                            <input type="number" id="pts-${pid}-${idx}" min="0" max="${maxPts}" step="0.5"
                                value="${curPts}"
                                onchange="updateGrading('${pid}',${idx},'pts',this.value)"
                                class="w-16 text-center bg-slate-800 border border-slate-600 rounded-lg text-white text-sm p-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <span class="text-xs text-slate-400">/${maxPts}</span>
                        </div>
                    </div>
                    ${texto
                        ? `<p class="text-xs text-slate-300 italic bg-slate-800/60 rounded-lg p-2">"${texto}"</p>`
                        : `<p class="text-xs text-slate-500 italic">Sin respuesta</p>`}
                    <textarea id="anot-${pid}-${idx}" rows="2" placeholder="Anotación para el estudiante (opcional)…"
                        oninput="updateGrading('${pid}',${idx},'anotacion',this.value)"
                        class="w-full text-xs p-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500">${curAnot}</textarea>
                    <p id="suggest-status-${pid}-${idx}" class="text-xs text-amber-400 hidden"></p>
                </div>`;
            });

            html += `</div></div>`;
        });

        $('grading-content').innerHTML = html;
    }

    function updateGrading(pid, idx, field, val) {
        if (!gradingData[pid]) gradingData[pid] = {};
        if (!gradingData[pid][idx]) gradingData[pid][idx] = { pts: 0, anotacion: '' };
        if (field === 'pts') gradingData[pid][idx].pts = Math.max(0, parseFloat(val) || 0);
        else gradingData[pid][idx].anotacion = val;
    }

    async function suggestGrade(pid, idx, maxPts) {
        const statusEl = $(`suggest-status-${pid}-${idx}`);
        if (!statusEl) return;

        // Obtener proveedor de IA seleccionado
        if (!selectedAiId) {
            statusEl.textContent = '⚠️ Selecciona una IA en el selector de arriba.';
            statusEl.classList.remove('hidden');
            return;
        }
        const p = aiProviders.find(x => x.id === selectedAiId);
        if (!p) {
            statusEl.textContent = '⚠️ IA no encontrada. Recarga la pantalla.';
            statusEl.classList.remove('hidden');
            return;
        }

        statusEl.textContent = '⏳ Consultando IA…';
        statusEl.classList.remove('hidden');

        const q     = sessionData.questions[idx];
        const row   = gradingResults.find(r => r.participante_codigo === pid);
        const texto = row?.respuestas?.[idx]?.respuesta_dada || '(sin respuesta)';

        const prompt = `Eres un profesor evaluando la calidad de una respuesta de un estudiante.
Pregunta: "${q.pregunta}"
Respuesta del estudiante: "${texto}"
Puntaje máximo de la pregunta: ${maxPts}

Evalúa la calidad de la respuesta y sugiere un RANGO de calificación (mínimo y máximo) considerando posibles variaciones en el criterio del profesor. Usa decimales de 0.5 si aplica.
Responde SOLO en formato JSON exacto: {"puntaje_min": <número>, "puntaje_max": <número>, "justificacion": "<máximo 2 oraciones>"}`;

        try {
            const res = await fetch(p.api_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.api_key}` },
                body: JSON.stringify({
                    model: p.modelo,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 250,
                    temperature: 0.3
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json  = await res.json();
            const raw   = json.choices?.[0]?.message?.content || '';
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('Respuesta inesperada del modelo');
            const parsed  = JSON.parse(match[0]);
            const pMin    = Math.min(maxPts, Math.max(0, parseFloat(parsed.puntaje_min) || 0));
            const pMax    = Math.min(maxPts, Math.max(pMin, parseFloat(parsed.puntaje_max) || pMin));
            const justif  = parsed.justificacion || '';

            // Mostrar rango como sugerencia — no auto-rellena el campo numérico
            statusEl.innerHTML = `<span class="font-semibold text-amber-300">💡 ${p.nombre} sugiere: ${pMin}–${pMax} / ${maxPts} pts</span>
                <br><span class="text-slate-400">${justif}</span>`;

            // Pre-rellenar anotación con la justificación si está vacía
            const anotInput = $(`anot-${pid}-${idx}`);
            if (anotInput && !anotInput.value.trim()) {
                anotInput.value = justif;
                updateGrading(pid, idx, 'anotacion', justif);
            }
        } catch(e) {
            statusEl.textContent = `⚠️ Error: ${e.message}. Verifica la IA seleccionada.`;
            console.error('AI grading error:', e);
        }
    }

    async function saveGrades() {
        const statusEl = $('grading-save-status');
        statusEl.textContent = '⏳ Guardando…';

        const questions        = sessionData.questions || [];
        const puntajePosibleMC = questions.reduce((s, q) =>
            (q.tipo || 'multiple_choice') !== 'abierta' ? s + (q.puntaje || 1) : s, 0);
        const puntajePosibleAb = questions.reduce((s, q) =>
            (q.tipo || 'multiple_choice') === 'abierta' ? s + (q.puntaje || 1) : s, 0);
        const puntajePosibleTotal = puntajePosibleMC + puntajePosibleAb;

        const updates = gradingResults.map(row => {
            const pid        = row.participante_codigo;
            const respuestas = (row.respuestas || []).map((resp, idx) => {
                if ((resp.tipo || 'multiple_choice') !== 'abierta') return resp;
                const g = gradingData[pid]?.[idx];
                return {
                    ...resp,
                    puntaje_obtenido:       g ? g.pts : 0,
                    anotacion:              g ? g.anotacion : '',
                    pendiente_calificacion: false
                };
            });

            const ptsAb = respuestas.filter(r => r.tipo === 'abierta')
                .reduce((s, r) => s + (r.puntaje_obtenido || 0), 0);
            const ptsMC = row.puntaje_obtenido || 0;
            const totalPts = ptsMC + ptsAb;
            const notaFinal = puntajePosibleTotal > 0
                ? Math.round((totalPts / puntajePosibleTotal) * 20 * 10) / 10
                : null;

            return sb.from('session_results').update({
                respuestas,
                nota: notaFinal,
                puntaje_obtenido: totalPts,
                puntaje_posible:  puntajePosibleTotal,
                calificado_en:    new Date().toISOString()
            }).eq('quiz_session_id', cloudId).eq('participante_codigo', pid);
        });

        try {
            const results = await Promise.all(updates);
            const failures = results.filter(r => r && r.error);
            if (failures.length > 0) {
                const msg = failures[0].error?.message || 'Sin permisos de escritura';
                console.error('Errores al guardar calificaciones:', failures.map(r => r.error));
                statusEl.textContent = `⚠️ Error al guardar: ${msg}`;
                statusEl.style.color = '#f87171';
            } else {
                statusEl.textContent = '✅ Calificaciones guardadas correctamente';
                statusEl.style.color = '';
            }
        } catch(e) {
            statusEl.textContent = '⚠️ Error inesperado al guardar. Revisa la consola.';
            statusEl.style.color = '#f87171';
            console.error('Error guardando calificaciones:', e);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // v2.7 — BOLETA PERSONAL (acceso por link ?results=&pid=)
    // ════════════════════════════════════════════════════════════════════════════

    // Ids stored for refresh
    let _boletaSessionId = null;
    let _boletaPid       = null;

    function refreshBoleta() {
        if (_boletaSessionId && _boletaPid) loadBoleta(_boletaSessionId, _boletaPid);
    }

    async function loadBoleta(sessionId, pid) {
        _boletaSessionId = sessionId;
        _boletaPid       = pid;
        showView('view-boleta');
        $('role-badge').textContent = 'Boleta';
        const refreshBtn = $('btn-refresh-boleta');
        if (refreshBtn) refreshBtn.classList.remove('hidden');

        // Cargar resultado del participante
        const { data, error } = await sb.from('session_results')
            .select('*')
            .eq('quiz_session_id', sessionId)
            .eq('participante_codigo', pid)
            .single();

        if (error || !data) {
            $('boleta-content').innerHTML = `
                <div class="text-center space-y-3">
                    <div class="text-5xl">📋</div>
                    <h2 class="text-xl font-bold text-white">Boleta no encontrada</h2>
                    <p class="text-slate-400 text-sm">Verifica el enlace o pide uno nuevo a tu profesor.</p>
                </div>`;
            return;
        }

        // Cargar info de la sesión para mostrar nombre del quiz
        const { data: sesData } = await sb.from('quiz_session').select('data').eq('id', sessionId).single();
        const sesName    = sesData?.data?.name || 'Cuestionario';
        const tipoLabels = { parcial:'Examen Parcial', final:'Examen Final', practica:'Práctica Calificada' };
        const tipoPrueba = sesData?.data?.mode === 'exam'
            ? (tipoLabels[sesData?.data?.examType] || 'Examen')
            : 'Cuestionario';

        const respuestas         = data.respuestas || [];
        const hayPendientes      = respuestas.some(r => r.pendiente_calificacion);
        const nota               = data.nota;
        const esPonderada        = respuestas.length > 0 && respuestas.some(r => r.tipo === 'ponderada');
        const esNivelRango       = respuestas.length > 0 && respuestas.some(r => r.tipo === 'nivel_rango');
        const puntajeTotal       = data.puntaje_total;
        const rangoObtenido      = data.rango_obtenido;
        const rangosDimObtenidos = data.rangos_dim_obtenidos || null;

        const respHtml = respuestas.map((r, idx) => {
            if ((r.tipo || 'multiple_choice') === 'ponderada') {
                return `<div class="border-b border-slate-700/40 pb-2">
                    <p class="text-xs font-semibold text-slate-300 mb-0.5">📊 Pregunta ${idx+1}</p>
                    <p class="text-xs text-slate-400">Respuesta: <strong class="text-white">${r.respuesta_dada || '—'}</strong>
                        <span class="text-violet-300 font-semibold ml-2">${r.puntaje_obtenido} pts</span>
                        <span class="text-slate-500 text-[10px] ml-1">/ máx ${r.puntaje_maximo}</span>
                    </p>
                </div>`;
            }
            if ((r.tipo || 'multiple_choice') === 'nivel_rango') {
                return `<div class="border-b border-slate-700/40 pb-2">
                    <p class="text-xs font-semibold text-teal-300 mb-0.5">🔢 Pregunta ${idx+1} <span class="text-slate-500 font-normal">· ${r.dimensionNombre || 'Dim '+r.dimension}</span></p>
                    <p class="text-xs text-slate-400">Nivel elegido: <strong class="text-white">${r.respuesta_dada || '—'}</strong>
                        <span class="text-teal-400 font-semibold ml-2">/ 5</span>
                    </p>
                </div>`;
            }
            if ((r.tipo || 'multiple_choice') === 'abierta') {
                const calificado = !r.pendiente_calificacion;
                return `<div class="border-b border-slate-700/40 pb-3 space-y-1">
                    <p class="text-xs font-semibold text-slate-300">📝 Pregunta ${idx+1}</p>
                    <p class="text-xs text-slate-400 italic">"${r.respuesta_dada || '(sin respuesta)'}"</p>
                    ${calificado
                        ? `<div class="flex items-center gap-2 flex-wrap">
                               <span class="text-xs bg-emerald-900/60 border border-emerald-700/40 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                                   ${r.puntaje_obtenido}/${r.puntaje_maximo} pts
                               </span>
                               ${r.anotacion ? `<p class="text-xs text-indigo-300 italic w-full mt-1">💬 ${r.anotacion}</p>` : ''}
                           </div>`
                        : `<span class="text-xs text-amber-400">⏳ Pendiente de calificación</span>`}
                </div>`;
            }
            // MC
            const icon = !r.respuesta_dada ? '⬜' : r.correcta ? '✅' : '❌';
            return `<div class="border-b border-slate-700/40 pb-2">
                <p class="text-xs font-semibold text-slate-300">${icon} Pregunta ${idx+1}
                    <span class="font-normal text-slate-500 ml-1">· Tu resp.: ${r.respuesta_dada || '—'} · ${r.puntaje_obtenido}/${r.puntaje_maximo} pts</span>
                </p>
            </div>`;
        }).join('');

        // ── Bloque de resultado principal (varía según tipo) ──────────────────
        let resultadoHtml = '';
        if (esNivelRango && rangosDimObtenidos) {
            // ── NIVEL-RANGO: un diagnóstico por dimensión ──────────────────────
            const dimsHtml = Object.entries(rangosDimObtenidos).map(([d, info]) => {
                const rango    = info.rango;
                // soporte tanto para datos nuevos (promedio) como datos anteriores (suma)
                const valorMostrado = info.promedio !== undefined
                    ? `Promedio: ${parseFloat(info.promedio).toFixed(2)}`
                    : (info.suma !== undefined ? `Suma: ${info.suma}` : '');
                return `
                <div class="bg-teal-950/60 border border-teal-700/50 rounded-2xl p-4 shadow-xl space-y-1">
                    <div class="flex items-center justify-between">
                        <p class="text-xs text-teal-300 uppercase tracking-wider font-semibold">Dimensión ${d}</p>
                        <span class="text-xs text-slate-400">${valorMostrado}</span>
                    </div>
                    ${rango
                        ? `<p class="text-xl font-extrabold text-teal-200">${rango.nombre}</p>
                           ${rango.diagnostico ? `<p class="text-sm text-slate-300">${rango.diagnostico}</p>` : ''}`
                        : `<p class="text-sm text-slate-400 italic">Sin diagnóstico disponible para este puntaje.</p>`}
                </div>`;
            }).join('');
            resultadoHtml = `
            <div class="space-y-3">
                <p class="text-xs font-semibold text-teal-300 uppercase tracking-wider text-center">
                    <i class="fa-solid fa-layer-group mr-1"></i>Diagnóstico por dimensión
                </p>
                ${dimsHtml}
            </div>`;
        } else if (esPonderada) {
            const ptMax = rangoObtenido ? rangoObtenido.max : '?';
            resultadoHtml = `
            <div class="bg-slate-800 border border-violet-700/50 rounded-2xl p-6 text-center shadow-xl space-y-1">
                <p class="text-xs text-violet-300 uppercase tracking-wider font-semibold">Puntaje total</p>
                <p class="text-7xl font-extrabold text-violet-300">${puntajeTotal !== null ? puntajeTotal : '—'}</p>
                <p class="text-xs text-slate-500">puntos</p>
            </div>
            ${rangoObtenido ? `
            <div class="bg-violet-950/60 border border-violet-600/50 rounded-2xl p-5 text-center shadow-xl space-y-1">
                <p class="text-xs text-violet-300 uppercase tracking-wider font-semibold">Diagnóstico</p>
                <p class="text-2xl font-extrabold text-violet-200">${rangoObtenido.nombre}</p>
                ${rangoObtenido.diagnostico ? `<p class="text-sm text-slate-300 mt-1">${rangoObtenido.diagnostico}</p>` : ''}
            </div>` : ''}`;
        } else {
            const notaDisp  = nota !== null && nota !== undefined ? nota.toFixed(1) : '—';
            const notaColor = nota === null || nota === undefined ? 'text-slate-400'
                : nota >= 14 ? 'text-emerald-400' : nota >= 11 ? 'text-amber-400' : 'text-red-400';
            resultadoHtml = `
            ${hayPendientes ? `
            <div class="bg-amber-900/30 border border-amber-700/40 rounded-2xl p-4 text-center">
                <p class="text-sm font-semibold text-amber-300">⏳ Tu profesor aún no ha calificado todas las preguntas abiertas.</p>
                <p class="text-xs text-amber-500 mt-1">Vuelve más tarde para ver tu nota final.</p>
            </div>` : ''}
            <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-xl space-y-1">
                <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Nota final</p>
                <p class="text-7xl font-extrabold ${notaColor}">${notaDisp}</p>
                <p class="text-xs text-slate-500">escala de 20</p>
            </div>`;
        }

        $('boleta-content').innerHTML = `
            <div class="text-center space-y-1 pb-2">
                <div class="text-4xl">${esNivelRango ? '🔢' : esPonderada ? '📊' : '📋'}</div>
                <h2 class="text-xl font-extrabold text-white">${sesName}</h2>
                <p class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">${tipoPrueba}</p>
                <p class="text-xs text-slate-400">${data.participante_identificador}</p>
            </div>

            ${resultadoHtml}

            <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revisión de respuestas</p>
                ${respHtml}
            </div>

            <p class="text-center text-xs text-slate-600">Sesión: ${sessionId}</p>`;
    }

