// IntelliPOS Interactive — config.js
    // ── CONFIGURACIÓN DE SUPABASE ─────────────────────────────────────────────
    // NOTA DE SEGURIDAD: Active Row Level Security (RLS) en Supabase para
    // proteger sus datos. Esta clave pública (publishable key) solo debe tener
    // permisos de lectura/escritura sobre la tabla 'quiz_session'.
    const SUPABASE_URL = 'https://syshosukdpsiudelwuqz.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_vQPvDpmWTZCH0O6xfQcBlA_ig91xeUf';

    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        realtime: { params: { eventsPerSecond: 20 } }
    });

    // ── ESTADO GLOBAL ─────────────────────────────────────────────────────────
    let sessionData  = { questions:[], currentIndex:0, votes:{}, voters:{}, participants:{}, participantVotes:{}, reveal:false, status:'active', timerSeconds:0, name:'', questionChangedAt:0 };
    let cloudId      = '';
    let chartInst    = null;
    let rtChannel    = null;
    let rtConnected  = false;
    let fallbackInt  = null;
    let timerInt     = null;
    let participantId   = '';
    let participantNick = '';
    let isPresenter     = false;
    let lastRenderedIdx = -1;    // Para detectar cambio de pregunta en participante
    let selectedParticipantList = null;  // lista cargada {id, nombre, lista:[]}

