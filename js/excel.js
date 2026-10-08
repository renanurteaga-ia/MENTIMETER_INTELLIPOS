// IntelliPOS Interactive — excel.js
    // ════════════════════════════════════════════════════════════════════════════
    // v2.9 — REPORTE ANALÍTICO EXCEL
    // ════════════════════════════════════════════════════════════════════════════

    async function downloadReportExcel() {
        if (typeof XLSX === 'undefined') {
            alert('La librería Excel aún no cargó. Espera un momento e intenta de nuevo.');
            return;
        }

        // Cargar resultados desde Supabase (usa gradingResults si ya están, si no los carga)
        let results = gradingResults && gradingResults.length > 0 ? gradingResults : null;
        if (!results) {
            const { data } = await sb.from('session_results').select('*').eq('quiz_session_id', cloudId);
            results = data || [];
        }

        // Normalizar preguntas para que tipo esté correctamente asignado (crítico en vista del instructor)
        if (sessionData.questions) sessionData.questions = normalizarPreguntas(sessionData.questions);
        const questions     = sessionData.questions || [];
        const sesName       = sessionData.name || 'Cuestionario';
        const fecha         = new Date().toLocaleDateString('es-PE', { year:'numeric', month:'long', day:'numeric' });
        const wb            = XLSX.utils.book_new();
        const hasPerfil     = questions.some(q => q.tipo === 'perfil');
        const hasNivelRango = questions.some(q => q.tipo === 'nivel_rango');
        const hasPonderada  = questions.some(q => q.tipo === 'ponderada');

        const tipoLabels = { parcial:'Examen Parcial', final:'Examen Final', practica:'Práctica Calificada' };
        const tipoPrueba = sessionData.mode === 'exam'
            ? (tipoLabels[sessionData.examType] || 'Examen')
            : 'Cuestionario';

        // ── FALLBACK DE MEMORIA: si session_results está vacío pero hay datos en vivo ──
        // Para MC/PONDERADA el Excel depende de session_results. Si saveSessionResults()
        // falló silenciosamente o los datos no llegaron a Supabase, reconstruir desde
        // sessionData (misma fuente que usa calculateScores() en la pantalla de resultados).
        if (results.length === 0 && !hasNivelRango) {
            const pvAll  = sessionData.participantVotes || {};
            const parts  = sessionData.participants     || {};
            if (Object.keys(parts).length > 0) {
                const { scores: memScores } = calculateScores();
                const puntajePosibleTotal = questions.reduce((s, q) =>
                    (q.tipo || 'multiple_choice') === 'multiple_choice' ? s + (q.puntaje || 1) : s, 0);
                results = memScores.map(s => {
                    const pvotes = pvAll[s.pid] || {};
                    let puntajeObt = 0;
                    const respuestas = questions.map((q, idx) => {
                        const tipo = q.tipo || 'multiple_choice';
                        const respuestaDada = pvotes[String(idx)] || null;
                        if (tipo === 'abierta') {
                            return { tipo: 'abierta', respuesta_dada: respuestaDada, correcta: null, puntaje_obtenido: 0 };
                        }
                        if (tipo === 'ponderada') {
                            const pts = respuestaDada ? (q['puntaje' + respuestaDada] || 0) : 0;
                            puntajeObt += pts;
                            return { tipo: 'ponderada', respuesta_dada: respuestaDada, correcta: null, puntaje_obtenido: pts };
                        }
                        // MC
                        const esCorrecta = respuestaDada !== null && respuestaDada === q.correcta;
                        const pts = esCorrecta ? (q.puntaje || 1) : 0;
                        puntajeObt += pts;
                        return { tipo: 'multiple_choice', respuesta_dada: respuestaDada, correcta: esCorrecta, puntaje_obtenido: pts };
                    });
                    const notaCalc = hasPonderada ? null
                        : (puntajePosibleTotal > 0 ? Math.round(puntajeObt / puntajePosibleTotal * 20 * 10) / 10 : null);
                    return {
                        participante_codigo:        s.pid,
                        participante_identificador: s.nick,
                        nota:             notaCalc,
                        puntaje_obtenido: puntajeObt,
                        puntaje_posible:  puntajePosibleTotal,
                        puntaje_total:    hasPonderada ? puntajeObt : null,
                        rango_obtenido:   hasPonderada
                            ? ((sessionData.rangos || []).find(r => puntajeObt >= r.min && puntajeObt <= r.max) || null)
                            : null,
                        respuestas,
                        calificado_en: null
                    };
                });
            }
        }

        if (hasPerfil) {
            // ════════════════════════════════════════════════════════
            // REPORTE PERFIL — distribución de estilos/perfiles
            // ════════════════════════════════════════════════════════
            const perfilQs  = questions.filter(q => q.tipo === 'perfil');
            const perfiles  = sessionData.perfiles || [];
            const pvAll     = sessionData.participantVotes || {};
            const participants = sessionData.participants || {};
            const { scores: pScores } = calculateScores();
            const MAPA_P = { A:'P1', B:'P2', C:'P3', D:'P4' };

            // Hoja 1: Resumen del grupo
            const grupoConteo = { P1:0, P2:0, P3:0, P4:0, empate:0 };
            pScores.forEach(s => {
                if (s.empate)         grupoConteo.empate++;
                else if (s.perfilDom) grupoConteo[s.perfilDom] = (grupoConteo[s.perfilDom]||0)+1;
            });

            const ws1Data = [
                ['REPORTE ANALÍTICO — PERFIL'],
                [],
                ['Cuestionario', sesName],
                ['Tipo de prueba', tipoPrueba],
                ['Fecha de reporte', fecha],
                ['Total participantes', pScores.length],
                ['Preguntas de perfil', perfilQs.length],
                [],
                ['DISTRIBUCIÓN DE PERFILES'],
                ['Perfil', 'Nombre', 'Símbolo', 'Descripción', 'N° Participantes', '% del grupo'],
                ...['P1','P2','P3','P4'].map(pid => {
                    const info = perfiles.find(p => p.id === pid) || { nombre: pid, simbolo: '', descripcion: '' };
                    const cnt  = grupoConteo[pid] || 0;
                    const pct  = pScores.length > 0 ? Math.round(cnt/pScores.length*100) : 0;
                    return [pid, info.nombre, info.simbolo, info.descripcion, cnt, `${pct}%`];
                }),
                ['Empate', '—', '—', '—', grupoConteo.empate, pScores.length > 0 ? `${Math.round(grupoConteo.empate/pScores.length*100)}%` : '—'],
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
            ws1['!cols'] = [{wch:10},{wch:28},{wch:12},{wch:40},{wch:20},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws1, 'Resumen perfiles');

            // Hoja 2: Resultados por participante
            const ws2Header = ['Código', 'Participante', 'Perfil Dominante', 'Nombre Perfil', 'Símbolo',
                'Votos P1', 'Votos P2', 'Votos P3', 'Votos P4', 'Total respondidas', 'Empate'];
            const ws2Rows = pScores.map(s => {
                const info = s.perfilDom ? (perfiles.find(p => p.id === s.perfilDom) || {nombre: s.perfilDom, simbolo: ''}) : null;
                return [
                    s.pid,
                    s.nick,
                    s.empate ? 'EMPATE' : (s.perfilDom || '—'),
                    info ? info.nombre : (s.empate ? (s.dominantes||[]).join('/') : '—'),
                    info ? (info.simbolo||'') : '—',
                    s.votosPorPerfil?.P1 ?? 0,
                    s.votosPorPerfil?.P2 ?? 0,
                    s.votosPorPerfil?.P3 ?? 0,
                    s.votosPorPerfil?.P4 ?? 0,
                    s.respondidas ?? 0,
                    s.empate ? 'Sí' : 'No'
                ];
            });
            const ws2 = XLSX.utils.aoa_to_sheet([ws2Header, ...ws2Rows]);
            ws2['!cols'] = [{wch:18},{wch:28},{wch:18},{wch:28},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:20},{wch:10}];
            XLSX.utils.book_append_sheet(wb, ws2, 'Resultados por alumno');

            // Hoja 3: Distribución de respuestas por pregunta
            const ws3Header = ['N°', 'Pregunta', 'Votos A (P1)', 'Votos B (P2)', 'Votos C (P3)', 'Votos D (P4)', 'Sin respuesta', 'Total'];
            const ws3Rows = perfilQs.map(q => {
                const origIdx = questions.indexOf(q);
                const counts  = ['A','B','C','D'].map(k =>
                    Object.values(pvAll).filter(pv => pv[String(origIdx)] === k).length
                );
                const sinResp = Object.values(pvAll).filter(pv => !pv[String(origIdx)]).length;
                const totalQ  = counts.reduce((s,v)=>s+v,0);
                return [origIdx+1, q.pregunta, ...counts, sinResp, totalQ];
            });
            const ws3 = XLSX.utils.aoa_to_sheet([ws3Header, ...ws3Rows]);
            ws3['!cols'] = [{wch:5},{wch:55},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:10}];
            XLSX.utils.book_append_sheet(wb, ws3, 'Distribución por pregunta');

        } else if (hasNivelRango) {
            // ════════════════════════════════════════════════════════
            // REPORTE NIVEL-RANGO — datos desde memoria (más fiable)
            // ════════════════════════════════════════════════════════

            const nivelQs      = questions.filter(q => (q.tipo||'multiple_choice') === 'nivel_rango');
            const dims         = [...new Set(nivelQs.map(q => q.dimension || '1'))];
            const { scores: nrScores } = calculateScores();
            const pvAll        = sessionData.participantVotes || {};
            const participants = sessionData.participants     || {};

            // Hoja 1: Resumen por dimensión
            const dimStats = dims.map(d => {
                const nombre = nivelQs.find(q=>(q.dimension||'1')===d)?.dimensionNombre || 'Dimensión '+d;
                const vals   = nrScores.map(s => s.rangosPorDim?.[d]?.promedio).filter(v => v !== null && v !== undefined && v > 0);
                const avg    = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : null;
                const maxV   = vals.length ? Math.max(...vals) : null;
                const minV   = vals.length ? Math.min(...vals) : null;
                // distribución agrupada por nivel
                const distCounts = [1,2,3,4,5].map(n => {
                    return Object.keys(pvAll).reduce((acc, pid) => {
                        const dimQs = nivelQs.filter(q=>(q.dimension||'1')===d);
                        return acc + dimQs.filter(q => {
                            const idx = questions.indexOf(q);
                            return parseInt(pvAll[pid]?.[String(idx)]) === n;
                        }).length;
                    }, 0);
                });
                return { d, nombre, vals, avg, maxV, minV, distCounts };
            });

            const ws1Data = [
                ['REPORTE ANALÍTICO — NIVEL / RANGO'],
                [],
                ['Cuestionario', sesName],
                ['Tipo de prueba', tipoPrueba],
                ['Fecha de reporte', fecha],
                ['Total participantes', nrScores.length],
                [],
                ['PROMEDIOS POR DIMENSIÓN'],
                ['Dimensión', 'Promedio', 'Máximo', 'Mínimo', 'N° respuestas'],
                ...dimStats.map(({nombre, avg, maxV, minV, vals}) => [
                    nombre,
                    avg ?? '—',
                    maxV ?? '—',
                    minV ?? '—',
                    vals.length
                ]),
                [],
                ['DISTRIBUCIÓN DE NIVELES (1–5) POR DIMENSIÓN'],
                ['Dimensión', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5'],
                ...dimStats.map(({nombre, distCounts}) => [nombre, ...distCounts])
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
            ws1['!cols'] = [{wch:32},{wch:12},{wch:12},{wch:12},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws1, 'Resumen por dimensión');

            // Hoja 2: Resultados por participante (una col por dimensión)
            const ws2Header = ['Código', 'Participante', ...dims.map(d => {
                const nombre = nivelQs.find(q=>(q.dimension||'1')===d)?.dimensionNombre || 'Dim '+d;
                return `Promedio ${nombre}`;
            }), 'Preguntas respondidas'];
            const ws2Rows = nrScores.map(s => {
                const pvotes   = pvAll[s.pid] || {};
                const answered = nivelQs.filter(q => pvotes[String(questions.indexOf(q))]).length;
                return [
                    s.pid,
                    s.nick,
                    ...dims.map(d => s.rangosPorDim?.[d]?.promedio ?? '—'),
                    answered
                ];
            });
            const ws2 = XLSX.utils.aoa_to_sheet([ws2Header, ...ws2Rows]);
            ws2['!cols'] = [{wch:18},{wch:28},...dims.map(()=>({wch:18})),{wch:22}];
            XLSX.utils.book_append_sheet(wb, ws2, 'Resultados por alumno');

            // Hoja 3: Distribución de niveles por pregunta
            const ws3Header = ['N°', 'Dimensión', 'Pregunta', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5', 'Sin respuesta', 'Promedio'];
            const ws3Rows = nivelQs.map(q => {
                const origIdx   = questions.indexOf(q);
                const dimNombre = q.dimensionNombre || 'Dim '+(q.dimension||'1');
                const counts    = [1,2,3,4,5].map(n =>
                    Object.values(pvAll).filter(pv => parseInt(pv[String(origIdx)]) === n).length
                );
                const sinResp   = Object.values(pvAll).filter(pv => !pv[String(origIdx)]).length;
                const vals      = Object.values(pvAll).map(pv => parseInt(pv[String(origIdx)])).filter(v => v > 0);
                const avgQ      = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '—';
                return [origIdx+1, dimNombre, q.pregunta, ...counts, sinResp, avgQ];
            });
            const ws3 = XLSX.utils.aoa_to_sheet([ws3Header, ...ws3Rows]);
            ws3['!cols'] = [{wch:5},{wch:20},{wch:55},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:14},{wch:12}];
            XLSX.utils.book_append_sheet(wb, ws3, 'Distribución por pregunta');

            // Hoja 4: Respuestas individuales
            const ws4Header = ['Participante', 'N° Pregunta', 'Dimensión', 'Pregunta', 'Nivel elegido'];
            const ws4Rows   = [];
            nrScores.forEach(s => {
                const pvotes = pvAll[s.pid] || {};
                nivelQs.forEach(q => {
                    const origIdx = questions.indexOf(q);
                    ws4Rows.push([
                        s.nick,
                        origIdx+1,
                        q.dimensionNombre || 'Dim '+(q.dimension||'1'),
                        q.pregunta,
                        pvotes[String(origIdx)] || '(sin respuesta)'
                    ]);
                });
            });
            const ws4 = XLSX.utils.aoa_to_sheet([ws4Header, ...ws4Rows]);
            ws4['!cols'] = [{wch:28},{wch:12},{wch:22},{wch:55},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws4, 'Respuestas individuales');

        } else {
            // ════════════════════════════════════════════════════════
            // REPORTE MC / PONDERADA / ABIERTA (original)
            // ════════════════════════════════════════════════════════

            // ── Hoja 1: Resumen general ───────────────────────────────────────────
            const notas  = results.map(r => r.nota).filter(n => n !== null && n !== undefined);
            const avg    = notas.length ? (notas.reduce((s,n) => s+n, 0) / notas.length) : null;
            const maxN   = notas.length ? Math.max(...notas) : null;
            const minN   = notas.length ? Math.min(...notas) : null;
            const aprob  = notas.filter(n => n >= 11).length;
            const desapr = notas.filter(n => n < 11).length;

            const ws1Data = [
                ['REPORTE ANALÍTICO DE EVALUACIÓN'],
                [],
                ['Cuestionario', sesName],
                ['Tipo de prueba', tipoPrueba],
                ['Fecha de reporte', fecha],
                ['Total participantes', results.length],
                ['Participantes calificados', notas.length],
                [],
                ['ESTADÍSTICAS DE NOTAS (escala 20)'],
                ['Promedio', avg !== null ? +avg.toFixed(2) : 'Pendiente'],
                ['Nota más alta', maxN ?? 'Pendiente'],
                ['Nota más baja', minN ?? 'Pendiente'],
                ['Aprobados (≥11)', aprob],
                ['Desaprobados (<11)', desapr],
                ['% Aprobación', notas.length ? `${Math.round(aprob/notas.length*100)}%` : '—'],
                [],
                ['DISTRIBUCIÓN DE NOTAS'],
                ['Rango', 'Cantidad'],
                ['18 – 20 (Excelente)', notas.filter(n=>n>=18).length],
                ['15 – 17 (Muy bueno)', notas.filter(n=>n>=15&&n<18).length],
                ['11 – 14 (Bueno)', notas.filter(n=>n>=11&&n<15).length],
                ['0 – 10 (Desaprobado)', notas.filter(n=>n<11).length],
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
            ws1['!cols'] = [{wch:30},{wch:22}];
            XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

            // ── Hoja 2: Resultados por participante ───────────────────────────────
            const ws2Header = ['Código', 'Participante', 'Nota (/20)', 'Puntaje Obtenido', 'Puntaje Posible', '% Logro', 'Estado', 'Calificado en'];
            const ws2Rows   = results.map(r => {
                const logro = r.puntaje_posible > 0 ? Math.round(r.puntaje_obtenido / r.puntaje_posible * 100) : null;
                return [
                    r.participante_codigo,
                    r.participante_identificador,
                    r.nota ?? 'Pendiente',
                    r.puntaje_obtenido ?? 0,
                    r.puntaje_posible ?? 0,
                    logro !== null ? `${logro}%` : '—',
                    r.nota !== null ? (r.nota >= 11 ? 'Aprobado' : 'Desaprobado') : 'Pendiente',
                    r.calificado_en ? new Date(r.calificado_en).toLocaleString('es-PE') : '—'
                ];
            }).sort((a, b) => (b[2] === 'Pendiente' ? -1 : a[2] === 'Pendiente' ? 1 : b[2] - a[2]));
            const ws2 = XLSX.utils.aoa_to_sheet([ws2Header, ...ws2Rows]);
            ws2['!cols'] = [{wch:18},{wch:28},{wch:12},{wch:18},{wch:16},{wch:10},{wch:14},{wch:20}];
            XLSX.utils.book_append_sheet(wb, ws2, 'Resultados por alumno');

            // ── Hoja 3: Análisis por pregunta ─────────────────────────────────────
            const ws3Header = ['N°', 'Sesión', 'Tópico', 'Pregunta', 'Tipo', 'Pts Máx', '% Acierto / Promedio pts', 'Calificación promedio (abiertas)'];
            const ws3Rows   = questions.map((q, idx) => {
                const tipo        = (q.tipo || 'multiple_choice') === 'abierta' ? 'Abierta' : 'Opción múltiple';
                const sesionVal   = q.sesion || sessionData.sesionDefault;
                const topicoVal   = q.topico || sessionData.topicoDefault;
                const sesionLabel = sesionVal ? `Sesión ${sesionVal}` : '—';
                const topicoLabel = topicoVal || '—';

                if ((q.tipo || 'multiple_choice') !== 'abierta') {
                    const total    = results.length;
                    const correctas = results.filter(r => {
                        const resp = (r.respuestas || [])[idx];
                        return resp && resp.correcta;
                    }).length;
                    const pct = total > 0 ? `${Math.round(correctas/total*100)}%` : '—';
                    return [idx+1, sesionLabel, topicoLabel, q.pregunta, tipo, q.puntaje || 1, pct, '—'];
                } else {
                    const ptsList = results
                        .map(r => (r.respuestas || [])[idx]?.puntaje_obtenido)
                        .filter(p => p !== undefined && p !== null);
                    const promPts = ptsList.length ? (ptsList.reduce((s,p)=>s+p,0)/ptsList.length).toFixed(2) : '—';
                    const promPct = (q.puntaje||1) > 0 && ptsList.length
                        ? `${Math.round(ptsList.reduce((s,p)=>s+p,0)/ptsList.length/(q.puntaje||1)*100)}%` : '—';
                    return [idx+1, sesionLabel, topicoLabel, q.pregunta, tipo, q.puntaje || 1, promPct, promPts];
                }
            });
            const ws3 = XLSX.utils.aoa_to_sheet([ws3Header, ...ws3Rows]);
            ws3['!cols'] = [{wch:5},{wch:12},{wch:20},{wch:50},{wch:16},{wch:10},{wch:28},{wch:26}];
            XLSX.utils.book_append_sheet(wb, ws3, 'Análisis por pregunta');

            // ── Hoja 4: Respuestas detalladas (abiertas) ──────────────────────────
            const openQs = questions.map((q,i)=>({q,i})).filter(({q})=>(q.tipo||'multiple_choice')==='abierta');
            if (openQs.length > 0) {
                const ws4Rows = [['Participante', 'Sesión', 'Tópico', 'Pregunta', 'Respuesta del alumno', 'Pts asignados', 'Pts máx', 'Anotación del profesor']];
                results.forEach(r => {
                    openQs.forEach(({q, i}) => {
                        const resp = (r.respuestas || [])[i];
                        ws4Rows.push([
                            r.participante_identificador,
                            (q.sesion || sessionData.sesionDefault) ? `Sesión ${q.sesion || sessionData.sesionDefault}` : '—',
                            q.topico || sessionData.topicoDefault || '—',
                            q.pregunta,
                            resp?.respuesta_dada || '(sin respuesta)',
                            resp?.puntaje_obtenido ?? '—',
                            q.puntaje || 1,
                            resp?.anotacion || '—'
                        ]);
                    });
                });
                const ws4 = XLSX.utils.aoa_to_sheet(ws4Rows);
                ws4['!cols'] = [{wch:28},{wch:12},{wch:20},{wch:40},{wch:60},{wch:14},{wch:10},{wch:40}];
                XLSX.utils.book_append_sheet(wb, ws4, 'Respuestas abiertas');
            }
        }

        // Descargar
        const fileName = `Reporte_${sesName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // v2.9 — BANCO DE PREGUNTAS: REVISIÓN Y PRESELECCIÓN
    // ════════════════════════════════════════════════════════════════════════════
