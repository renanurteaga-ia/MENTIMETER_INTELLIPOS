// IntelliPOS Interactive — utils.js
    // ── UTILIDADES ────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    function genId(prefix = '') {
        return prefix + Math.random().toString(36).substring(2, 9);
    }

    /** Obtiene o crea un UUID persistente para este dispositivo/navegador */
    function getParticipantId() {
        let pid = localStorage.getItem('ipos_pid');
        if (!pid) { pid = genId('p_'); localStorage.setItem('ipos_pid', pid); }
        return pid;
    }

    function showView(id) {
        ['view-login','view-setup','view-lobby-presenter','view-lobby-participant','view-presenter','view-nickname','view-participant','view-exam-presenter','view-exam-participant','view-ended','view-boleta','view-grading','view-ai-config','view-banco','view-historial'].forEach(v => {
            $(v)?.classList.add('hidden');
            $(v)?.classList.remove('flex');
        });
        $(id)?.classList.remove('hidden');
        $(id)?.classList.add('flex');
    }

    // Advertencia HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        $('https-warning').classList.remove('hidden');
    }

    function resetApp() { location.href = location.pathname; }

    // ── TOAST NOTIFICATIONS ──────────────────────────────────────────────────
    (function() {
        const container = document.createElement('div');
        container.id = 'ipos-toast-container';
        document.body.appendChild(container);
    })();

    /**
     * showToast(msg, type, duration)
     * type: 'success' | 'error' | 'warn' | 'info'   (default: 'info')
     * duration: ms antes de ocultarse                 (default: 5000)
     */
    function showToast(msg, type = 'info', duration = 5000) {
        const c = document.getElementById('ipos-toast-container');
        if (!c) return;
        const t = document.createElement('div');
        t.className = `ipos-toast ${type}`;
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            t.style.transition = 'opacity .3s';
            setTimeout(() => t.remove(), 320);
        }, duration);
    }

