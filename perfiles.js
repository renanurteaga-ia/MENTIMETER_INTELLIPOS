// IntelliPOS — perfiles.js
// Cuestionario de PERFILES: lectura de la plantilla, validación, orden aleatorio de respuestas,
// calificación (perfil dominante y secundario, mixtos en caso de empate) y bloques de resultado.
//
// Formato (hoja «Cuestionario» de la Plantilla 5, copiada como texto separado por tabulaciones):
//   Perfil | Nombre del perfil | Símbolo | Características | Reto        ← encabezado de perfiles
//   P1     | Analítico         | 🔍      | …               | …           ← una fila por perfil
//   Pregunta | URL imagen | Perfil 1 | Respuesta 1 | Perfil 2 | Respuesta 2 | …   ← encabezado
//   ¿…?      |            | P3       | texto       | P1       | texto       | …   ← una fila por pregunta
//
// Modelo de pregunta guardada:
//   { tipo:'perfil', pregunta, imageUrl, opciones:[{key:'A', perfil:'P3', texto}], correcta:null, puntaje:1,
//     opcionA…opcionH (copia del texto, por compatibilidad) }
// La respuesta del participante se guarda como la clave de la opción (A, B, C…).
// Los perfiles se guardan en sessionData.perfiles y, en la biblioteca, en quizzes.rangos como
//   { _perfil: true, data: [{ id:'P1', nombre, simbolo, caracteristicas, reto }] }.

const IPP = {
  KEYS: 'ABCDEFGH'.split(''),
  MAX_PERFILES: 8,

  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _cols(line) {
    return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
  },

  _driveUrl(url) {
    if (!url) return '';
    url = url.trim();
    const m = url.match(/\/file\/d\/([\w-]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    const m2 = url.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);
    if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
    return url;
  },

  // ¿El texto pegado/importado es un cuestionario de perfiles? (tiene al menos una fila P# con nombre)
  detect(raw) {
    return String(raw || '').split(/\r\n|\n/).some(l => {
      const c = this._cols(l);
      return /^P[1-9]\d*$/i.test(c[0] || '') && (c[1] || '') !== '';
    });
  },

  // Lee el texto y devuelve { perfiles, preguntas, errores[], advertencias[] }.
  parse(raw) {
    const perfiles = [], preguntas = [], errores = [], advertencias = [];
    const lines = String(raw || '').split(/\r\n|\n/);
    const qLines = [];

    lines.forEach((line, i) => {
      if (!line.trim()) return;
      const c = this._cols(line);
      const a = (c[0] || '');
      if (!a) return;
      const al = a.toLowerCase();
      if (al === 'perfil' || al === 'pregunta' || al === 'question') return;   // encabezados
      if (/^P[1-9]\d*$/i.test(a)) {
        if (!(c[1] || '')) return;                                            // fila P sin nombre: se ignora
        const id = a.toUpperCase();
        if (perfiles.some(p => p.id === id)) { errores.push(`El perfil ${id} está definido dos veces.`); return; }
        // Se quitan rótulos que la app ya muestra («Características: …», «Tu reto: …»)
        const sinRotulo = (t, re) => String(t || '').replace(re, '').trim();
        perfiles.push({ id, nombre: c[1], simbolo: c[2] || '',
          caracteristicas: sinRotulo(c[3], /^\s*caracter[ií]sticas\s*:\s*/i),
          reto: sinRotulo(c[4], /^\s*(tu\s+)?reto\s*:\s*/i) });
        return;
      }
      qLines.push({ c, fila: i + 1 });
    });

    perfiles.sort((x, y) => parseInt(x.id.slice(1)) - parseInt(y.id.slice(1)));
    if (perfiles.length < 2) errores.push('Define al menos 2 perfiles en la sección de perfiles (filas P1, P2…).');
    if (perfiles.length > this.MAX_PERFILES) errores.push(`Se admiten hasta ${this.MAX_PERFILES} perfiles; hay ${perfiles.length}.`);
    const ids = perfiles.map(p => p.id);

    const esCodigo = v => /^P[1-9]\d*$/i.test(v || '');
    qLines.forEach(({ c, fila }, n) => {
      const num = n + 1;
      const opciones = [];
      // Formato de la plantilla: B = URL de imagen y pares desde C.
      // También se acepta el formato sin columna de imagen (pares desde B).
      const inicio = esCodigo(c[1]) ? 1 : 2;
      const imagen = inicio === 2 ? (c[1] || '') : '';
      for (let j = inicio; j < c.length; j += 2) {
        const code = (c[j] || '').toUpperCase();
        const texto = c[j + 1] || '';
        if (!code && !texto) continue;
        if (code === 'PERFIL' && !texto) continue;               // marca de tipo al final de la fila
        if (!code) { errores.push(`Pregunta ${num}: la respuesta «${texto.slice(0, 40)}» no indica su perfil.`); continue; }
        if (!texto) { errores.push(`Pregunta ${num}: el perfil ${code} no tiene texto de respuesta.`); continue; }
        if (!ids.includes(code)) { errores.push(`Pregunta ${num}: el perfil ${code} no está definido en la sección de perfiles.`); continue; }
        if (opciones.some(o => o.perfil === code)) { errores.push(`Pregunta ${num}: el perfil ${code} aparece más de una vez.`); continue; }
        opciones.push({ key: this.KEYS[opciones.length], perfil: code, texto });
      }
      const faltan = ids.filter(id => !opciones.some(o => o.perfil === id));
      if (faltan.length && perfiles.length >= 2) errores.push(`Pregunta ${num}: falta la respuesta del perfil ${faltan.join(', ')}.`);
      if (!opciones.length) return;
      // Orden aleatorio al crear el cuestionario: el orden guardado nunca es el del archivo.
      this._mezclar(opciones, this.KEYS);
      const q = { tipo: 'perfil', pregunta: c[0], imageUrl: this._driveUrl(imagen), opciones, correcta: null, puntaje: 1 };
      opciones.forEach(o => { q['opcion' + o.key] = o.texto; });
      preguntas.push(q);
    });

    if (!preguntas.length) errores.push('No se encontraron preguntas.');
    return { perfiles, preguntas, errores, advertencias };
  },

  // Mezcla las opciones al azar (distinto del orden del archivo y del orden P1, P2, P3…) y reasigna las claves A, B, C…
  _mezclar(opciones, keys) {
    const orig = opciones.map(o => o.perfil).join(',');
    for (let intento = 0; intento < 10; intento++) {
      for (let i = opciones.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opciones[i], opciones[j]] = [opciones[j], opciones[i]]; }
      const ahora = opciones.map(o => o.perfil).join(',');
      const natural = [...opciones].sort((x, y) => parseInt(x.perfil.slice(1)) - parseInt(y.perfil.slice(1))).map(o => o.perfil).join(',');
      if (opciones.length < 2 || (ahora !== orig && ahora !== natural)) break;
    }
    opciones.forEach((o, i) => { o.key = keys[i]; });
  },

  // Reconstruye el texto (para editar un cuestionario guardado).
  toTSV(perfiles, preguntas) {
    const n = perfiles.length;
    const head = ['Pregunta', 'URL imagen'];
    for (let k = 1; k <= n; k++) head.push('Perfil ' + k, 'Respuesta ' + k);
    return [
      ['Perfil', 'Nombre del perfil', 'Símbolo', 'Características', 'Reto'].join('\t'),
      ...perfiles.map(p => [p.id, p.nombre, p.simbolo, p.caracteristicas, p.reto].join('\t')),
      head.join('\t'),
      ...preguntas.map(q => [q.pregunta, q.imageUrl || '', ...(q.opciones || []).flatMap(o => [o.perfil, o.texto])].join('\t'))
    ].join('\n');
  },

  // Extrae los perfiles del campo rangos de la biblioteca.
  fromRangos(rangos) {
    const e = (rangos || []).find(r => r && r._perfil === true);
    return e ? (e.data || []) : [];
  },

  // ── Orden aleatorio estable por participante y pregunta ──────────────────
  _seed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  },
  shuffledOptions(q, pid, idx) {
    const arr = [...(q.opciones || [])];
    const rnd = this._seed(`${pid}|${idx}`);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  },

  // ── Calificación ─────────────────────────────────────────────────────────
  // Devuelve { conteo:{P1:n…}, respondidas, dominante:{perfiles[],respuestas,mixto}|null, secundario:{…}|null }
  score(questions, pvotes, perfiles) {
    const ids = (perfiles || []).map(p => p.id);
    const conteo = {}; ids.forEach(id => { conteo[id] = 0; });
    let respondidas = 0;
    (questions || []).forEach((q, idx) => {
      if (q.tipo !== 'perfil') return;
      const ans = (pvotes || {})[String(idx)];
      const opt = (q.opciones || []).find(o => o.key === ans);
      if (!opt) return;
      respondidas++;
      if (opt.perfil in conteo) conteo[opt.perfil]++;
    });
    const niveles = [...new Set(Object.values(conteo).filter(v => v > 0))].sort((a, b) => b - a);
    const grupo = v => {
      if (v === undefined) return null;
      const ps = ids.filter(id => conteo[id] === v);
      return { perfiles: ps, respuestas: v, mixto: ps.length > 1 };
    };
    return { conteo, respondidas, dominante: grupo(niveles[0]), secundario: grupo(niveles[1]) };
  },

  info(perfiles, id) {
    return (perfiles || []).find(p => p.id === id) || { id, nombre: id, simbolo: '', caracteristicas: '', reto: '' };
  },

  // Texto corto: «🔍 Analítico» o «Mixto: 🔍 Analítico + 🎯 Controlador»
  label(grupo, perfiles) {
    if (!grupo) return '—';
    const t = grupo.perfiles.map(id => { const p = this.info(perfiles, id); return `${p.simbolo ? p.simbolo + ' ' : ''}${p.nombre}`; }).join(' + ');
    return grupo.mixto ? `Mixto: ${t}` : t;
  },

  // Objeto para session_results.rango_obtenido
  toResult(r, perfiles) {
    return {
      tipo: 'perfil',
      nombre: r.dominante ? this.label(r.dominante, perfiles) : 'Sin respuestas',
      dominante: r.dominante, secundario: r.secundario, conteo: r.conteo, respondidas: r.respondidas
    };
  },

  // ── Bloques HTML (tema oscuro de la app) ─────────────────────────────────
  _card(p, color) {
    const e = this.esc.bind(this);
    return `
      <div class="bg-slate-900/70 border border-${color}-700/50 rounded-xl p-4 space-y-2 text-left">
        <div class="flex items-center gap-3">
          <span class="w-11 h-11 rounded-xl bg-${color}-900/60 flex items-center justify-center text-2xl shrink-0">${e(p.simbolo) || '◆'}</span>
          <div><p class="text-lg font-extrabold text-white leading-tight">${e(p.nombre)}</p><p class="text-xs text-slate-500">${e(p.id)}</p></div>
        </div>
        ${p.caracteristicas ? `<div><p class="text-[11px] font-semibold uppercase tracking-wider text-${color}-300">Características</p><p class="text-sm text-slate-300 leading-relaxed">${e(p.caracteristicas)}</p></div>` : ''}
        ${p.reto ? `<div><p class="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Tu reto</p><p class="text-sm text-slate-300 leading-relaxed">${e(p.reto)}</p></div>` : ''}
      </div>`;
  },

  _nivelHtml(titulo, grupo, perfiles, color) {
    if (!grupo) return '';
    const n = grupo.respuestas;
    return `
      <div class="bg-slate-800 border border-${color}-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-${color}-300">${titulo}${grupo.mixto ? ' · <span class="text-white">Mixto</span>' : ''}</p>
          <p class="text-sm text-slate-400"><strong class="text-white text-lg">${n}</strong> respuesta${n !== 1 ? 's' : ''}${grupo.mixto ? ' cada uno' : ''}</p>
        </div>
        ${grupo.mixto ? `<p class="text-sm text-slate-300">Tienes la misma cantidad de respuestas en ${grupo.perfiles.length} perfiles:</p>` : ''}
        <div class="space-y-3">${grupo.perfiles.map(id => this._card(this.info(perfiles, id), color)).join('')}</div>
      </div>`;
  },

  conteoHtml(r, perfiles) {
    const max = Math.max(1, ...Object.values(r.conteo));
    return `
      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-2 shadow-xl">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Respuestas por perfil</p>
        ${(perfiles || []).map(p => {
          const v = r.conteo[p.id] || 0;
          const dom = r.dominante && r.dominante.perfiles.includes(p.id);
          const sec = r.secundario && r.secundario.perfiles.includes(p.id);
          return `<div>
            <div class="flex justify-between text-xs mb-1"><span class="text-slate-300">${this.esc(p.simbolo)} ${this.esc(p.nombre)}${dom ? ' <span class="text-indigo-300 font-semibold">· dominante</span>' : sec ? ' <span class="text-teal-300 font-semibold">· secundario</span>' : ''}</span><span class="text-slate-400">${v}</span></div>
            <div class="h-2 bg-slate-700 rounded-full overflow-hidden"><div class="h-full rounded-full ${dom ? 'bg-indigo-500' : sec ? 'bg-teal-500' : 'bg-slate-500'}" style="width:${Math.round(v / max * 100)}%"></div></div>
          </div>`;
        }).join('')}
      </div>`;
  },

  // Resultado completo del participante (pantalla final y boleta)
  resultHtml(r, perfiles) {
    if (!r || !r.dominante) {
      return `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center"><p class="text-slate-400">No se registraron respuestas para calcular tu perfil.</p></div>`;
    }
    return `
      <div class="space-y-4">
        ${this._nivelHtml('Perfil dominante', r.dominante, perfiles, 'indigo')}
        ${r.secundario ? this._nivelHtml('Perfil secundario', r.secundario, perfiles, 'teal')
          : `<div class="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-center text-sm text-slate-400">No hay perfil secundario: ${r.dominante.mixto ? 'todos tus perfiles con respuestas quedaron empatados' : 'todas tus respuestas corresponden a un solo perfil'}.</div>`}
        ${this.conteoHtml(r, perfiles)}
      </div>`;
  },

  // Etiqueta del perfil de una respuesta: «△ Controlador»
  tag(perfiles, id) {
    const p = this.info(perfiles, id);
    return `<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-fuchsia-900/50 border border-fuchsia-700/50 text-fuchsia-200 whitespace-nowrap">${this.esc(p.simbolo)} ${this.esc(p.nombre)}</span>`;
  },

  // Revisión de las respuestas del participante con el perfil de cada una
  reviewHtml(questions, pvotes, perfiles) {
    const rows = (questions || []).map((q, idx) => {
      if (q.tipo !== 'perfil') return '';
      const opt = (q.opciones || []).find(o => o.key === (pvotes || {})[String(idx)]);
      return `<div class="border-b border-slate-700/40 pb-2 space-y-1">
        <p class="text-xs font-semibold text-slate-300">${idx + 1}. ${this.esc(q.pregunta)}</p>
        ${opt ? `<div class="flex flex-wrap items-start gap-2"><p class="text-xs text-slate-400 flex-1 min-w-[12rem]">${this.esc(opt.texto)}</p>${this.tag(perfiles, opt.perfil)}</div>`
              : '<p class="text-xs text-slate-500 italic">Sin respuesta</p>'}
      </div>`;
    }).join('');
    return `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Tus respuestas y su perfil</p>${rows}</div>`;
  },

  // Tabla del presentador: cuántos participantes eligieron cada perfil en cada pregunta
  questionTableHtml(questions, votes, perfiles) {
    const e = this.esc.bind(this);
    const head = (perfiles || []).map(p => `<th class="pb-2 px-2 font-semibold text-center whitespace-nowrap">${e(p.simbolo)} ${e(p.nombre)}</th>`).join('');
    const body = (questions || []).map((q, idx) => q.tipo !== 'perfil' ? '' : `<tr class="border-t border-slate-700/40">
        <td class="py-1.5 pr-2 text-xs text-slate-300">${idx + 1}. ${e(q.pregunta.length > 70 ? q.pregunta.slice(0, 70) + '…' : q.pregunta)}</td>
        ${(perfiles || []).map(p => { const o = (q.opciones || []).find(x => x.perfil === p.id); return `<td class="py-1.5 px-2 text-xs text-center text-slate-200">${o ? ((votes || {})[idx + '_' + o.key] || 0) : 0}</td>`; }).join('')}
      </tr>`).join('');
    return `<div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Respuestas por pregunta y perfil</p>
      <div class="overflow-x-auto"><table class="w-full min-w-[560px]"><thead><tr class="text-left text-xs text-slate-500"><th class="pb-2 pr-2 font-semibold">Pregunta</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  },

  // ── Versión imprimible (PDF, fondo claro) ────────────────────────────────
  printHtml(r, perfiles, questions, pvotes) {
    const e = this.esc.bind(this);
    if (!r || !r.dominante) return '<div class="msg-box">No se registraron respuestas para calcular tu perfil.</div>';
    const nivel = (titulo, g) => !g ? '' : `
      <div class="diag-box">
        <div class="diag-label">${titulo}${g.mixto ? ' · Mixto' : ''} — ${g.respuestas} respuesta${g.respuestas !== 1 ? 's' : ''}${g.mixto ? ' cada uno' : ''}</div>
        ${g.perfiles.map(id => { const p = this.info(perfiles, id); return `
          <div class="diag-nombre">${e(p.simbolo)} ${e(p.nombre)}</div>
          ${p.caracteristicas ? `<div class="field-box"><div class="field-label">Características</div><div class="field-text">${e(p.caracteristicas)}</div></div>` : ''}
          ${p.reto ? `<div class="field-box"><div class="field-label">Tu reto</div><div class="field-text">${e(p.reto)}</div></div>` : ''}`; }).join('')}
      </div>`;
    return `
      ${nivel('Perfil dominante', r.dominante)}
      ${r.secundario ? nivel('Perfil secundario', r.secundario) : '<div class="msg-box">Sin perfil secundario.</div>'}
      <div class="section-title">Respuestas por perfil</div>
      <table><thead><tr><th>Perfil</th><th style="width:90px;text-align:center">Respuestas</th></tr></thead><tbody>
        ${(perfiles || []).map(p => `<tr><td>${e(p.simbolo)} ${e(p.nombre)}</td><td class="pts-cell">${r.conteo[p.id] || 0}</td></tr>`).join('')}
      </tbody></table>
      ${questions ? `<div class="section-title">Tus respuestas y su perfil</div>
      <table><thead><tr><th style="width:42%">Pregunta</th><th>Tu respuesta</th><th style="width:120px">Perfil</th></tr></thead><tbody>
        ${questions.map((q, idx) => { if (q.tipo !== 'perfil') return '';
          const o = (q.opciones || []).find(x => x.key === (pvotes || {})[String(idx)]);
          const p = o ? this.info(perfiles, o.perfil) : null;
          return `<tr><td>${idx + 1}. ${e(q.pregunta)}</td><td>${o ? e(o.texto) : '—'}</td><td>${p ? e(p.simbolo) + ' ' + e(p.nombre) : '—'}</td></tr>`; }).join('')}
      </tbody></table>` : ''}`;
  }
};
