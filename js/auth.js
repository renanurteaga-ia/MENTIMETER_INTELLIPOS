// IntelliPOS Interactive — auth.js
    // ── AUTENTICACIÓN ─────────────────────────────────────────────────────────
    async function checkAuth() {
        showView('view-login'); // Mostrar login por defecto mientras verificamos
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session) { showView('view-login'); return; }
            await onAuthSuccess(session.user.email);
        } catch(e) { showView('view-login'); }
    }

    async function onAuthSuccess(email) {
        // Si la URL es una boleta personal (?results=&pid=), no redirigir al setup
        const _p = new URLSearchParams(location.search);
        if (_p.get('results') && _p.get('pid')) return;

        try {
            const { data } = await sb.from('authorized_users').select('activo, nombre').eq('email', email).single();
            if (!data || !data.activo) {
                await sb.auth.signOut();
                $('login-error').textContent = 'Tu cuenta no está autorizada. Contacta al administrador.';
                $('login-error').classList.remove('hidden');
                showView('view-login');
                return;
            }
            $('user-email-display').textContent = email;
            $('user-info').classList.remove('hidden');
            $('user-info').classList.add('flex');
            showView('view-setup');
            refreshLibrarySelector();
            refreshListSelector();
        } catch(e) {
            await sb.auth.signOut();
            showView('view-login');
        }
    }

    async function loginUser() {
        const email    = $('login-email').value.trim();
        const password = $('login-password').value;
        const btn      = $('login-btn');
        const errEl    = $('login-error');

        if (!email || !password) {
            errEl.textContent = 'Por favor ingresa tu correo y contraseña.';
            errEl.classList.remove('hidden');
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Ingresando…';
        errEl.classList.add('hidden');

        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
            errEl.textContent = 'Correo o contraseña incorrectos.';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = 'Ingresar';
            return;
        }
        btn.disabled = false;
        btn.innerHTML = 'Ingresar';
        await onAuthSuccess(email);
    }

    async function logoutUser() {
        await sb.auth.signOut();
        $('user-info').classList.add('hidden');
        $('user-info').classList.remove('flex');
        showView('view-login');
    }

    // Iniciar verificando sesión
    checkAuth();
