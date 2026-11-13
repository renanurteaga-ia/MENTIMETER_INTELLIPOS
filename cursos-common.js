// IntelliPOS — cursos-common.js
// Utilidades compartidas para cursos, dictados, tipo de prueba e importación de Excel.
// Se carga ANTES del script de cada página y usa el cliente global `sb` que cada página define.
// Si la migración supabase_cursos.sql aún no se ejecutó, IPC.enabled = false y las páginas
// funcionan exactamente como antes (sin selectores de curso).

const IPC = {
  enabled: false,
  cursos: [],
  dictados: [],

  TIPOS: { parcial: 'Examen parcial', final: 'Examen final', practica: 'Práctica' },

  async init() {
    try {
      const [c, d] = await Promise.all([
        sb.from('cursos').select('*').order('nombre'),
        sb.from('dictados').select('*').order('creado_en', { ascending: false })
      ]);
      if (c.error || d.error) throw (c.error || d.error);
      this.cursos = c.data || [];
      this.dictados = d.data || [];
      this.enabled = true;
    } catch (e) {
      console.warn('[cursos] No disponible (¿falta ejecutar supabase_cursos.sql?):', e && e.message);
      this.enabled = false;
    }
    return this.enabled;
  },

  curso(id)   { return this.cursos.find(c => c.id === id) || null; },
  dictado(id) { return this.dictados.find(d => d.id === id) || null; },
  dictadosDe(cursoId) { return this.dictados.filter(d => d.curso_id === cursoId); },

  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // Llena un <select> de cursos. opts.first = texto de la primera opción (valor '').
  // opts.sinCurso = agrega la opción "Sin curso asignado" (valor '__none').
  fillCursos(sel, opts = {}) {
    const prev = sel.value;
    sel.innerHTML = '';
    sel.add(new Option(opts.first || '— Sin curso —', ''));
    if (opts.sinCurso) sel.add(new Option('Sin curso asignado', '__none'));
    this.cursos.forEach(c => sel.add(new Option(c.nombre, c.id)));
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  },

  // Llena un <select> de dictados del curso indicado.
  fillDictados(sel, cursoId, opts = {}) {
    const prev = sel.value;
    sel.innerHTML = '';
    sel.add(new Option(opts.first || '— Todos los dictados —', ''));
    if (cursoId && cursoId !== '__none') {
      this.dictadosDe(cursoId).forEach(d => sel.add(new Option(this.dictadoLabel(d), d.id)));
    }
    sel.disabled = !cursoId || cursoId === '__none';
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  },

  dictadoLabel(d) {
    if (!d) return '';
    const f = d.fecha_inicio ? ` (${new Date(d.fecha_inicio + 'T00:00:00').toLocaleDateString('es', { month: 'short', year: 'numeric' })})` : '';
    return d.nombre + f;
  },

  // ¿El registro (quiz o lista) coincide con el filtro curso/dictado/tipo?
  // Un cuestionario sin dictado (dictado_id null) sirve para todos los dictados de su curso.
  matches(rec, cursoId, dictadoId, tipo, opts = {}) {
    if (cursoId === '__none') { if (rec.curso_id) return false; }
    else if (cursoId && rec.curso_id !== cursoId) return false;
    if (dictadoId) {
      if (opts.dictadoOpcional) { if (rec.dictado_id && rec.dictado_id !== dictadoId) return false; }
      else if (rec.dictado_id !== dictadoId) return false;
    }
    if (tipo && rec.tipo_prueba !== tipo) return false;
    return true;
  },

  // Etiquetas HTML (badges) de curso · dictado · tipo para un registro.
  badges(rec) {
    if (!this.enabled) return '';
    const out = [];
    const c = this.curso(rec.curso_id);
    const d = this.dictado(rec.dictado_id);
    if (c) out.push(`<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-900/50 border border-sky-700/50 text-sky-300"><i class="fa-solid fa-graduation-cap"></i>${this.esc(c.nombre)}</span>`);
    else   out.push(`<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500">Sin curso</span>`);
    if (d) out.push(`<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-slate-300"><i class="fa-regular fa-calendar"></i>${this.esc(d.nombre)}</span>`);
    else if (c && 'tipo_prueba' in rec) out.push(`<span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">Todos los dictados</span>`);
    if (rec.tipo_prueba && this.TIPOS[rec.tipo_prueba]) {
      const col = { parcial: 'amber', final: 'purple', practica: 'emerald' }[rec.tipo_prueba];
      out.push(`<span class="text-xs px-2 py-0.5 rounded-full bg-${col}-900/50 border border-${col}-700/50 text-${col}-300">${this.TIPOS[rec.tipo_prueba]}</span>`);
    }
    return `<div class="flex flex-wrap gap-1.5 mt-1.5">${out.join('')}</div>`;
  },

  // ── Excel → texto separado por tabulaciones ───────────────────────────────
  // Lee un .xlsx/.xls/.csv con SheetJS y devuelve el TSV de la hoja preferida.
  // preferidas: nombres de hoja a buscar primero (ej. ['Cuestionario']).
  // Los números se escriben con punto decimal sin importar el idioma del Excel.
  async excelToTSV(file, preferidas = []) {
    if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const lower = wb.SheetNames.map(n => n.toLowerCase());
    let name = wb.SheetNames[0];
    for (const p of preferidas) {
      const i = lower.indexOf(p.toLowerCase());
      if (i >= 0) { name = wb.SheetNames[i]; break; }
    }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
    const clean = v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
      return String(v).replace(/[\t\r\n]+/g, ' ').trim();
    };
    return rows
      .map(r => r.map(clean))
      .filter(r => r.some(c => c !== ''))
      .map(r => r.join('\t'))
      .join('\n');
  }
};
