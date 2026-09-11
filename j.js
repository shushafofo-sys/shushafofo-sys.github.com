console.log("✅ script.js chargé");

const SUPABASE_URL = "https://zxxknrufuzvogsrbrzsu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_25z-HaqU-rdhw1m09CwXEA__F2IIeTs";

// ==========================================
// INITIALISATION SUPABASE AVEC DIAGNOSTIC
// ==========================================
let supabaseClient = null;
let isSupabaseConfigured = false;
let supabaseStatus = 'non configuré'; // 'non configuré' | 'connecté' | 'erreur'

function initSupabase() {
    try {
        // Vérifier que les clés ont été modifiées
        if (!SUPABASE_URL || SUPABASE_URL.includes('VOTRE-PROJET') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('VOTRE-CLE')) {
            supabaseStatus = 'non configuré';
            isSupabaseConfigured = false;
            console.warn("⚠️ Supabase non configuré. Modifiez config.js avec vos vraies clés.");
            updateStatusBadge('⚠ Supabase non configuré (mode local)', 'warning');
            return;
        }
        
        if (!window.supabase) {
            supabaseStatus = 'erreur';
            isSupabaseConfigured = false;
            console.error("❌ La librairie Supabase n'est pas chargée.");
            updateStatusBadge('❌ Librairie Supabase manquante', 'error');
            return;
        }
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isSupabaseConfigured = true;
        supabaseStatus = 'connecté';
        console.log("✅ Client Supabase créé avec succès");
        testSupabaseConnection();
        
    } catch (e) {
        supabaseStatus = 'erreur';
        console.error("❌ Erreur création client Supabase:", e);
        updateStatusBadge('❌ Erreur: ' + e.message, 'error');
    }
}

async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from('canvas')
            .select('id')
            .eq('id', 1)
            .single();
            
        if (error) {
            console.error("❌ Erreur de connexion à Supabase:", error);
            let message = '❌ Erreur Supabase';
            if (error.message.includes('relation') || error.code === '42P01') {
                message = '❌ Table "canvas" introuvable. Exécutez le SQL !';
            } else if (error.message.includes('policy') || error.code === '42501') {
                message = '❌ Politique RLS bloque l\'accès';
            } else if (error.message.includes('JWT') || error.code === 'PGRST301') {
                message = '❌ Clé API invalide';
            }
            updateStatusBadge(message, 'error');
        } else {
            console.log("✅ Connexion Supabase OK - Table accessible");
            updateStatusBadge('✓ Connecté à Supabase', 'success');
        }
    } catch (e) {
        console.error("❌ Exception test connexion:", e);
        updateStatusBadge('❌ ' + e.message, 'error');
    }
}

function updateStatusBadge(message, type) {
    const badge = document.getElementById('save-status');
    const text = document.getElementById('save-status-text');
    if (!badge || !text) return;

    if (!isAdmin) {
        badge.classList.remove('visible');
        return;
    }
    
    text.textContent = message;
    badge.classList.add('visible');
    
    // Couleur selon le type
    badge.style.background = type === 'success' ? '#2E7D32' : 
                              type === 'error' ? '#C62828' : 
                              type === 'warning' ? '#E65100' : '#2E4E9E';
    
    // Ne disparaît que si c'est un succès temporaire
    if (type === 'success' && message.includes('Enregistré')) {
        setTimeout(() => {
            if (isAdmin) badge.classList.remove('visible');
        }, 3000);
    }
}

// ==========================================
// CONSTANTES
// ==========================================
const ADMIN_CODE_B64 = "TWFkYW1lMDAxJA==";
const STORAGE_KEY = 'ghost_canvas_data';
let isAdmin = false;
let saveTimeout = null;
let isInitialLoad = true;

try {
    isAdmin = sessionStorage.getItem('ghost_admin_session') === 'true';
} catch (e) {}

// ==========================================
// FONCTIONS GLOBALES
// ==========================================
window.openLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.add('active');
        const input = document.getElementById('admin-code-input');
        if (input) { input.value = ''; setTimeout(() => input.focus(), 100); }
        const errorMsg = document.getElementById('login-error');
        if (errorMsg) errorMsg.style.display = 'none';
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
};

window.checkLogin = function() {
    const input = document.getElementById('admin-code-input');
    const errorMsg = document.getElementById('login-error');
    if (!input) return;
    
    const code = input.value.trim();
    
    if (btoa(code) === ADMIN_CODE_B64) {
        try { sessionStorage.setItem('ghost_admin_session', 'true'); } catch (e) {}
        isAdmin = true;
        applyAdminState();
        window.closeLoginModal();
        saveData();
        updateStatusBadge('✓ Mode administrateur activé', 'success');
    } else {
        if (errorMsg) {
            errorMsg.style.display = 'block';
            const modalContent = document.querySelector('.modal-content');
            if (modalContent) {
                modalContent.classList.add('shake');
                setTimeout(() => modalContent.classList.remove('shake'), 500);
            }
        }
    }
};

window.lockAdmin = function() {
    isAdmin = false;
    try { sessionStorage.removeItem('ghost_admin_session'); } catch (e) {}
    applyAdminState();
    updateStatusBadge('✓ Mode lecture seule', 'success');
};

window.addListItem = function(containerId) {
    const container = document.querySelector(`[data-save-id="${containerId}"] .dynamic-list`);
    if (!container) return;
    
    const li = document.createElement('li');
    li.contentEditable = true;
    li.textContent = 'Nouvel élément (cliquez pour éditer)';
    container.appendChild(li);
    li.focus();
    triggerSave();
};

window.resetCanvas = async function() {
    if (!confirm('⚠ ATTENTION : Cette action effacera TOUTES les modifications. Continuer ?')) return;
    
    localStorage.removeItem(STORAGE_KEY);
    
    if (isSupabaseConfigured && supabaseClient) {
        try {
            const { error } = await supabaseClient
                .from('canvas')
                .update({ content: {}, logo: null, updated_at: new Date().toISOString() })
                .eq('id', 1);
            if (error) console.error('Erreur reset Supabase:', error);
        } catch (e) {
            console.error('Exception reset:', e);
        }
    }
    
    location.reload();
};

// ==========================================
// ÉTAT ADMIN
// ==========================================
function applyAdminState() {
    const statusBadge = document.getElementById('save-status');

    if (isAdmin) {
        document.body.classList.add('admin-mode');
        if (statusBadge) statusBadge.classList.remove('hidden-by-default');
        enableEditing(true);
    } else {
        document.body.classList.remove('admin-mode');
        if (statusBadge) statusBadge.classList.add('hidden-by-default');
        statusBadge && statusBadge.classList.remove('visible');
        enableEditing(false);
    }
}

function enableEditing(enable) {
    const state = enable ? 'true' : 'false';
    document.querySelectorAll('[data-save-id], .dynamic-list li, .contact-item .value').forEach(el => {
        el.contentEditable = state;
    });
}

// ==========================================
// SAUVEGARDE (Locale + Supabase)
// ==========================================
function triggerSave() {
    if (isInitialLoad) return;
    clearTimeout(saveTimeout);
    updateStatusBadge('💾 Sauvegarde...', 'info');
    saveTimeout = setTimeout(() => saveData(), 800);
}

async function saveData() {
    const content = {};
    document.querySelectorAll('[data-save-id]').forEach(el => {
        content[el.dataset.saveId] = el.innerHTML;
    });
    
    const siteLogo = document.getElementById('site-logo');
    const coverBrandPhoto = document.getElementById('cover-brand-photo');
    const logoUrl = siteLogo ? siteLogo.src : (coverBrandPhoto ? coverBrandPhoto.src : null);
    const dataToSave = { content, logo: logoUrl };
    
    // 1. Sauvegarde locale TOUJOURS
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    
    // 2. Sauvegarde Supabase SEULEMENT si configuré ET admin
    if (isSupabaseConfigured && supabaseClient) {
        if (!isAdmin) {
            updateStatusBadge('⚠ Connectez-vous pour sauvegarder en ligne', 'warning');
            return;
        }
        
        try {
            console.log("📤 Envoi vers Supabase...", { contentKeys: Object.keys(content).length });
            
            const { data, error } = await supabaseClient
                .from('canvas')
                .upsert({ 
                    id: 1, 
                    content: content, 
                    logo: logoUrl, 
                    updated_at: new Date().toISOString() 
                }, { onConflict: 'id' });
            
            if (error) {
                console.error("❌ Erreur Supabase:", error);
                let message = '❌ Erreur: ' + (error.message || 'inconnue');
                if (error.code === '42P01') message = '❌ Table "canvas" introuvable';
                if (error.code === 'PGRST301') message = '❌ Clé API invalide';
                if (error.code === '42501') message = '❌ Politique RLS bloque';
                updateStatusBadge(message, 'error');
            } else {
                console.log("✅ Sauvegardé sur Supabase !");
                updateStatusBadge('✓ Enregistré pour tous les visiteurs', 'success');
            }
        } catch (e) {
            console.error("❌ Exception sauvegarde:", e);
            updateStatusBadge('⚠ Sauvegardé localement (erreur réseau)', 'warning');
        }
    } else {
        updateStatusBadge('⚠ Supabase non configuré - mode local uniquement', 'warning');
    }
}

// ==========================================
// CHARGEMENT DES DONNÉES
// ==========================================
async function loadData() {
    let loaded = false;
    
    // 1. Essayer Supabase d'abord (source de vérité)
    if (isSupabaseConfigured && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('canvas')
                .select('content, logo')
                .eq('id', 1)
                .single();
                
            if (data && !error && data.content && Object.keys(data.content).length > 0) {
                applyData(data.content, data.logo);
                console.log("✅ Données chargées depuis Supabase");
                loaded = true;
            }
        } catch (e) {
            console.warn("Erreur chargement Supabase, fallback local", e);
        }
    }
    
    // 2. Fallback LocalStorage
    if (!loaded) {
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                applyData(parsed.content, parsed.logo);
                console.log("✅ Données chargées depuis le cache local");
            } catch (e) {
                console.error('Erreur parsing local', e);
            }
        }
    }
    
    isInitialLoad = false;
}

function applyData(content, logoUrl) {
    if (content) {
        Object.keys(content).forEach(id => {
            const el = document.querySelector(`[data-save-id="${id}"]`);
            if (el) el.innerHTML = content[id];
        });
    }
    if (logoUrl) {
        const siteLogo = document.getElementById('site-logo');
        if (siteLogo) siteLogo.src = logoUrl;

        const coverBrandPhoto = document.getElementById('cover-brand-photo');
        if (coverBrandPhoto) coverBrandPhoto.src = logoUrl;
    }
    applyAdminState();
}

// ==========================================
// INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Démarrage...");
    
    // Initialiser Supabase
    initSupabase();
    
    // Date
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('fr-FR', options);

    const navLoginBtn = document.getElementById('nav-login-btn');
    if (navLoginBtn) navLoginBtn.addEventListener('click', window.openLoginModal);

    const loginSubmitBtn = document.getElementById('login-submit');
    if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', window.checkLogin);

    const closeLoginBtn = document.querySelector('.modal-close');
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', window.closeLoginModal);

    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) lockBtn.addEventListener('click', window.lockAdmin);

    const resetCanvasBtn = document.getElementById('reset-canvas-btn');
    if (resetCanvasBtn) resetCanvasBtn.addEventListener('click', window.resetCanvas);
    
    applyAdminState();
    loadData();
    
    // Écouteurs
    document.addEventListener('input', (e) => {
        if (e.target.hasAttribute('contenteditable') || e.target.hasAttribute('data-save-id')) {
            triggerSave();
        }
    });
    
    const input = document.getElementById('admin-code-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.checkLogin();
        });
    }
    
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) window.closeLoginModal();
        });
    }
    
    const brandMark = document.querySelector('.brand-mark');
    const brandPhotoInput = document.getElementById('brand-photo-upload');
    const brandPhoto = document.getElementById('cover-brand-photo');

    if (brandMark && brandPhotoInput) {
        brandMark.addEventListener('click', () => {
            if (isAdmin) {
                brandPhotoInput.click();
            }
        });
    }

    if (brandPhotoInput && brandPhoto) {
        brandPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 1.5 * 1024 * 1024) {
                alert('La photo ne doit pas dépasser 1,5 Mo.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                brandPhoto.src = event.target.result;
                triggerSave();
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Ctrl+S
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveData();
        }
    });
    
    window.addEventListener('beforeunload', () => {
        if (!isInitialLoad) saveData();
    });
});