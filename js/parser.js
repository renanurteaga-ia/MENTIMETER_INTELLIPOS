// IntelliPOS Interactive — parser.js
    // ── PARSER GOOGLE SHEETS ──────────────────────────────────────────────────
    // Convierte URL de compartir de Google Drive a URL de visualización directa.
    // Soporta también URLs directas (no-Drive) que se usan tal cual.
    function convertGDriveUrl(url) {
        if (!url) return '';
        url = url.trim();
        // Formato: https://drive.google.com/file/d/FILE_ID/view?...
        const match = url.match(/\/file\/d\/([\w-]+)/);
        if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
        // Formato: https://drive.google.com/open?id=FILE_ID
        const match2 = url.match(/[?&]id=([\w-]+)/);
        if (match2) return `https://drive.google.com/uc?export=view&id=${match2[1]}`;
        return url; // URL externa directa
    }

    function parseSheetText(raw) {
        const lines = raw.split(/\r\n|\n/).filter(l => l.trim());
        const parsed    = [];
        const rangos    = [];
        const rangosDim = {};   // { dimNum: [{min,max,nombre,diagnostico}] }
        const perfiles  = [];   // [{ id:'P1', nombre, simbolo, descripcion }] para tipo PERFIL
        let start = 0;
        if (lines[0] && (lines[0].toLowerCase().includes('pregunta') || lines[0].toLowerCase().includes('question'))) start = 1;
        for (let i = start; i < lines.length; i++) {
            let cols = lines[i].split('\t');
            if (cols.length < 2) cols = lines[i].split(',');
            cols = cols.map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cols.length < 1 || !cols[0]) continue;

            // ── Rnm: exactamente R + dígito 1-9 + dígito 1-9 → rango de dimensión para NIVEL-RANGO
            if (/^R[1-9][1-9]$/i.test(cols[0])) {
                const dimNum = cols[0].charAt(1);
                if (!rangosDim[dimNum]) rangosDim[dimNum] = [];
                rangosDim[dimNum].push({
                    nombre:      (cols[3] || '').trim() || cols[0],
                    min:         parseFloat(cols[1]) || 0,
                    max:         parseFloat(cols[2]) || 0,
                    diagnostico: (cols[4] || '').trim()
                });
                continue;
            }

            // ── Fila de rango diagnóstico ponderada (R1, R2…): R# | min | max | nombre | diagnóstico
            if (/^R\d+$/i.test(cols[0])) {
                rangos.push({
                    nombre:      (cols[3] || '').trim() || cols[0],
                    min:         parseFloat(cols[1]) || 0,
                    max:         parseFloat(cols[2]) || 0,
                    diagnostico: (cols[4] || '').trim()
                });
                continue;
            }

            // ── Fila de perfil (P1…P4): P# | nombre | símbolo | descripción
            if (/^P[1-4]$/i.test(cols[0])) {
                perfiles.push({
                    id:          cols[0].toUpperCase(),
                    nombre:      (cols[1] || '').trim() || cols[0],
                    simbolo:     (cols[2] || '').trim(),
                    descripcion: (cols[3] || '').trim()
                });
                continue;
            }

            const tipoRaw    = (cols[5] || '').trim().toUpperCase();
            const puntajeRaw = parseFloat((cols[7] || '').trim());
            const puntaje    = (!isNaN(puntajeRaw) && puntajeRaw > 0) ? puntajeRaw : 1;
            // v2.9: sesión académica y tópico (cols 8 y 9)
            const sesionRaw  = parseInt((cols[8] || '').trim());
            const sesion     = !isNaN(sesionRaw) && sesionRaw > 0 ? sesionRaw : null;
            const topico     = (cols[9] || '').trim() || null;

            if (tipoRaw === 'ABIERTA') {
                parsed.push({
                    pregunta: cols[0],
                    opcionA: '', opcionB: '', opcionC: '', opcionD: '',
                    correcta: null,
                    tipo: 'abierta',
                    imageUrl: convertGDriveUrl(cols[6] || ''),
                    puntaje, sesion, topico
                });
            } else if (tipoRaw === 'PONDERADA') {
                // Pregunta ponderada: pesos por opción en cols 10-13 (PtjA…PtjD)
                parsed.push({
                    pregunta: cols[0],
                    opcionA:  cols[1] || '',
                    opcionB:  cols[2] || '',
                    opcionC:  cols[3] || '',
                    opcionD:  cols[4] || '',
                    correcta: null,
                    tipo:     'ponderada',
                    imageUrl: convertGDriveUrl(cols[6] || ''),
                    puntajeA: parseFloat(cols[10]) || 0,
                    puntajeB: parseFloat(cols[11]) || 0,
                    puntajeC: parseFloat(cols[12]) || 0,
                    puntajeD: parseFloat(cols[13]) || 0,
                    puntaje, sesion, topico
                });
            } else if (tipoRaw === 'NIVEL-RANGO') {
                // Col 7 = N° de dimensión (1-9), col 8 = nombre de dimensión
                const dimNum    = (cols[7] || '').trim() || '1';
                const dimNombre = (cols[8] || '').trim() || `Dimensión ${dimNum}`;
                parsed.push({
                    pregunta: cols[0],
                    opcionA: '', opcionB: '', opcionC: '', opcionD: '',
                    correcta: null,
                    tipo:     'nivel_rango',
                    imageUrl: convertGDriveUrl(cols[6] || ''),
                    dimension: dimNum,
                    dimensionNombre: dimNombre,
                    puntaje: 1,
                    sesion, topico
                });
            } else if (tipoRaw === 'PERFIL') {
                // Pregunta de perfil: A→P1 B→P2 C→P3 D→P4, sin respuesta correcta
                parsed.push({
                    pregunta: cols[0],
                    opcionA:  cols[1] || '',
                    opcionB:  cols[2] || '',
                    opcionC:  cols[3] || '',
                    opcionD:  cols[4] || '',
                    correcta: null,
                    tipo:     'perfil',
                    imageUrl: convertGDriveUrl(cols[6] || ''),
                    puntaje:  1,
                    sesion, topico
                });
            } else if (cols.length >= 5) {
                parsed.push({
                    pregunta: cols[0],
                    opcionA: cols[1] || '',
                    opcionB: cols[2] || '',
                    opcionC: cols[3] || '',
                    opcionD: cols[4] || '',
                    correcta: (cols[5] || 'A').toUpperCase().charAt(0),
                    tipo: 'multiple_choice',
                    imageUrl: convertGDriveUrl(cols[6] || ''),
                    puntaje, sesion, topico
                });
            }
        }
        parsedRangos    = rangos;
        parsedRangosDim = rangosDim;
        parsedPerfiles  = perfiles;
        return parsed;
    }

    // ── PREPARACIÓN: PREVISUALIZACIÓN Y SUBIDA DE IMÁGENES ───────────────────
    let parsedQuestions = [];
    let parsedRangos    = [];   // rangos diagnósticos para cuestionarios PONDERADA
    let parsedRangosDim = {};   // rangos por dimensión para NIVEL-RANGO: { dimN: [{min,max,nombre,diagnostico}] }
    let parsedPerfiles  = [];   // perfiles para cuestionarios PERFIL: [{ id, nombre, simbolo, descripcion }]

    // ── Biblioteca ────────────────────────────────────────────────────────────
    async function refreshLibrarySelector() {
        const sel = $('library-select');
        sel.innerHTML = '<option value="">Cargando…</option>';
        const { data, error } = await sb.from('quizzes').select('id, nombre, preguntas, rangos').order('creado_en', { ascending: false });
        sel.innerHTML = '<option value="">— Selecciona un cuestionario guardado —</option>';
        if (!error && data && data.length) {
            data.forEach(q => {
                const n = Array.isArray(q.preguntas) ? q.preguntas.length : 0;
                const opt = document.createElement('option');
                opt.value = q.id;
                opt.textContent = `${q.nombre}  (${n} preguntas)`;
                opt.dataset.preguntas = JSON.stringify(q.preguntas);
                opt.dataset.rangos    = JSON.stringify(q.rangos || []);
                sel.appendChild(opt);
            });
        }
    }

    // ── Selector de lista de participantes ────────────────────────────────────
    async function refreshListSelector() {
        const sel = $('list-select');
        sel.innerHTML = '<option value="">Cargando…</option>';
        // Usamos fetch directo con la clave anon (no el cliente autenticado)
        // para que RLS no filtre listas creadas sin autenticación
        let data = null, fetchError = false;
        try {
            const res = await fetch(
                SUPABASE_URL + '/rest/v1/participant_lists?select=id,nombre,lista&order=creado_en.desc',
                { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
            );
            if (res.ok) data = await res.json();
            else fetchError = true;
        } catch(_) { fetchError = true; }
        sel.innerHTML = '<option value="">— Sin lista (acceso abierto por nickname) —</option>';
        if (!fetchError && data && data.length) {
            data.forEach(lst => {
                const n = Array.isArray(lst.lista) ? lst.lista.length : 0;
                const opt = document.createElement('option');
                opt.value = lst.id;
                opt.textContent = `${lst.nombre}  (${n} participantes)`;
                opt.dataset.lista = JSON.stringify(lst.lista);
                opt.dataset.nombre = lst.nombre;
                sel.appendChild(opt);
            });
        }
    }

    function loadFromListLibrary() {
        const sel = $('list-select');
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.value) {
            clearListSelection();
            return;
        }
        selectedParticipantList = {
            id: opt.value,
            nombre: opt.dataset.nombre,
            lista: JSON.parse(opt.dataset.lista)
        };
        $('list-loaded-name').textContent = opt.dataset.nombre;
        $('list-loaded-count').textContent = selectedParticipantList.lista.length;
        $('list-loaded-msg').classList.remove('hidden');
        $('list-no-selection-warn').classList.add('hidden');
        // Cambiar botón a estado "cargado"
        const btn = $('btn-usar-lista');
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Cargada';
        btn.className = 'px-4 py-2.5 bg-slate-600 text-slate-300 text-sm font-bold rounded-xl flex items-center gap-2 cursor-default';
    }

    function clearListSelection() {
        selectedParticipantList = null;
        $('list-select').value = '';
        $('list-loaded-msg').classList.add('hidden');
        $('list-no-selection-warn').classList.remove('hidden');
        // Restaurar botón
        const btn = $('btn-usar-lista');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Usar';
        btn.className = 'px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition flex items-center gap-2';
    }

    function loadFromLibrary() {
        const sel = $('library-select');
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.value) { alert('Selecciona un cuestionario de la lista.'); return; }
        parsedQuestions = normalizarPreguntas(JSON.parse(opt.dataset.preguntas));
        const allRangos = JSON.parse(opt.dataset.rangos || '[]');
        const dimEntry  = allRangos.find(r => r._dim === true);
        const perfEntry = allRangos.find(r => r._perfil === true);
        parsedRangos    = allRangos.filter(r => !r._dim && !r._perfil);
        parsedRangosDim = dimEntry ? dimEntry.data : {};
        parsedPerfiles  = perfEntry ? perfEntry.data : [];
        $('library-loaded-name').textContent = opt.textContent.split('(')[0].trim();
        $('library-loaded-count').textContent = parsedQuestions.length;
        $('library-loaded-msg').classList.remove('hidden');
        // Cambiar botón a estado "cargado"
        const btn = $('btn-usar-quiz');
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Cargado';
        btn.className = 'px-4 py-2.5 bg-slate-600 text-slate-300 text-sm font-bold rounded-xl flex items-center gap-2 cursor-default';
        // Ocultar textarea y separador, mostrar botón de crear sesión
        $('paste-panel').classList.add('hidden');
        $('image-upload-panel').classList.add('hidden');
        $('btn-preview-wrap').classList.add('hidden');
        $('btn-launch-library').classList.remove('hidden');
        updateBancoHint();
    }

    // ── NORMALIZACIÓN DE TIPO DE PREGUNTA ────────────────────────────────────
    // Infiere el campo 'tipo' para preguntas guardadas sin él o con valor incorrecto.
    // Regla: si opcionA está vacía → pregunta abierta (una MC siempre tiene al menos opcionA).
    function normalizarPreguntas(arr) {
        return (arr || []).map(q => {
            if (q.tipo === 'abierta')     return q;                              // ya correcto
            if (q.tipo === 'ponderada')   return q;                              // ya correcto
            if (q.tipo === 'nivel_rango') return q;                              // ya correcto
            if (q.tipo === 'perfil')      return q;                              // ya correcto
            // Si tiene campo 'dimension' es nivel_rango aunque falte el campo 'tipo'
            if (q.dimension !== undefined && q.dimension !== null && q.dimension !== '')
                return { ...q, tipo: 'nivel_rango' };
            if (!q.opcionA) return { ...q, tipo: 'abierta', correcta: '' };     // sin opciones → abierta
            // Detección automática: tiene puntajeA definido y no tiene correcta → ponderada
            if (q.puntajeA !== undefined && q.puntajeA !== null && !q.correcta)
                return { ...q, tipo: 'ponderada' };
            return { ...q, tipo: q.tipo || 'multiple_choice' };                 // MC normal
        });
    }

    // ── SELECCIÓN DE PREGUNTAS PARA EXAMEN (Módulo B) ───────────────────────
    function shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * Aplica la lógica de preselección del banco al conjunto de preguntas.
     * Sólo actúa cuando mode === 'exam'.
     * @param {Array} preguntas  — array completo de preguntas (con marcas)
     * @param {string} examType  — 'parcial' | 'final'
     * @param {number|null} n    — cuántas preguntas usar (null = todas)
     * @returns {Array}          — array final listo para la sesión
     */
    function selectExamQuestions(preguntas, examType, n) {
        if (!n || n <= 0) return preguntas; // sin límite → todas en orden original

        const presel   = preguntas.filter(q => q.marcas && q.marcas[examType]);
        const resto    = preguntas.filter(q => !(q.marcas && q.marcas[examType]));

        let resultado;
        if (presel.length >= n) {
            // Hay suficientes preseleccionadas → elegir N aleatoriamente de ellas
            resultado = shuffleArray(presel).slice(0, n);
        } else {
            // Faltan → todas las preseleccionadas + completar del resto aleatoriamente
            const faltantes = n - presel.length;
            resultado = [...presel, ...shuffleArray(resto).slice(0, faltantes)];
        }
        return resultado;
    }

    /** Actualiza el hint informativo al cambiar tipo de examen o cuestionario cargado */
    function updateBancoHint() {
        const hintDiv  = $('banco-hint');
        const hintText = $('banco-hint-text');
        if (!hintDiv || !hintText) return;
        const mode = document.querySelector('input[name="session-mode"]:checked')?.value;
        if (mode !== 'exam' || !parsedQuestions.length) { hintDiv.classList.add('hidden'); return; }

        const tipo   = document.querySelector('input[name="exam-type"]:checked')?.value || 'parcial';
        const labels = { parcial:'Examen Parcial', final:'Examen Final', practica:'Práctica Calificada' };
        const label  = labels[tipo] || tipo;
        const presel = parsedQuestions.filter(q => q.marcas && q.marcas[tipo]).length;
        const total  = parsedQuestions.length;

        if (presel === 0) {
            hintText.textContent = `Este cuestionario no tiene preguntas marcadas para "${label}". Se usarán todas (${total}) aleatoriamente según el N° indicado.`;
        } else {
            hintText.textContent = `${presel} de ${total} preguntas marcadas para "${label}". Si N° ≤ ${presel}: se eligen aleatoriamente de las marcadas. Si N° > ${presel}: se incluyen las ${presel} marcadas y se completa con preguntas aleatorias.`;
        }
        hintDiv.classList.remove('hidden');
    }

    function clearLibrarySelection() {
        parsedQuestions = [];
        $('library-select').value = '';
        $('library-loaded-msg').classList.add('hidden');
        // Restaurar botón
        const btn = $('btn-usar-quiz');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Usar';
        btn.className = 'px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition flex items-center gap-2';
        $('paste-panel').classList.remove('hidden');
        $('btn-preview-wrap').classList.remove('hidden');
        $('btn-launch-library').classList.add('hidden');
    }

    function previewQuestions() {
        const raw = $('sheet-text-input').value;
        if (!raw.trim()) { alert('Por favor pega el contenido de tus celdas de Google Sheets.'); return; }
        parsedQuestions = parseSheetText(raw);
        if (!parsedQuestions.length) { alert('No se pudieron interpretar las preguntas. Verifica el formato.'); return; }
        renderImageUploadPanel();
        $('image-upload-panel').classList.remove('hidden');
        $('image-upload-panel').scrollIntoView({ behavior: 'smooth' });
    }

    function backToSetup() {
        $('image-upload-panel').classList.add('hidden');
    }

    function renderImageUploadPanel() {
        $('image-upload-list').innerHTML = parsedQuestions.map((q, i) => `
            <div class="bg-slate-900 rounded-xl p-3 space-y-2 border border-slate-700/50">
                <p class="text-sm font-semibold text-white leading-snug">${i + 1}. ${q.pregunta}</p>
                <div class="flex items-center gap-3 flex-wrap">
                    ${q.imageUrl ? `
                        <img src="${q.imageUrl}" alt="" class="w-20 h-14 object-cover rounded-lg border border-slate-600 shrink-0">
                        <span class="text-xs text-emerald-400 font-semibold">✓ Imagen cargada</span>
                        <button onclick="removeImage(${i})" class="text-xs text-red-400 hover:text-red-300 transition">✕ Quitar</button>
                    ` : `<span class="text-xs text-slate-500 italic">Sin imagen</span>`}
                    <label class="cursor-pointer ml-auto px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition flex items-center gap-1.5 shrink-0">
                        <i class="fa-solid fa-upload text-[10px]"></i>
                        <span id="upload-label-${i}">${q.imageUrl ? 'Cambiar' : 'Subir imagen'}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" onchange="handleImageUpload(event, ${i})">
                    </label>
                </div>
            </div>
        `).join('');
    }

    async function handleImageUpload(event, idx) {
        const file = event.target.files[0];
        if (!file) return;
        const label = $(`upload-label-${idx}`);
        label.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo…';
        try {
            const ext  = file.name.split('.').pop().toLowerCase();
            const name = `q_${Date.now()}_${idx}.${ext}`;
            const { error } = await sb.storage.from('quiz-images').upload(name, file, { upsert: true });
            if (error) throw error;
            const { data } = sb.storage.from('quiz-images').getPublicUrl(name);
            parsedQuestions[idx].imageUrl = data.publicUrl;
            renderImageUploadPanel();
        } catch(err) {
            alert('Error al subir imagen: ' + (err.message || err));
            renderImageUploadPanel();
        }
    }

    function removeImage(idx) {
        parsedQuestions[idx].imageUrl = '';
        renderImageUploadPanel();
    }

