// Garantir que o Firebase está inicializado
const auth = firebase.auth();
const db = firebase.firestore();

// Funções de Autenticação
function loginUser(email, password) {
    console.log("Tentando login com:", email);
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            if (!user.emailVerified) {
                // Show verification required modal
                showVerificationRequiredModal(email);
                return auth.signOut().then(() => {
                    throw new Error('Email não verificado');
                });
            }
            
            return db.collection('users').doc(user.uid).get();
        })
        .then((doc) => {
            closeLoginModal();
            updateUIForLoggedInUser(auth.currentUser);
        })
        .catch((error) => {
            console.error("Erro no login:", error);
            let errorMessage = "Erro no login";
            if (error.message === 'Email não verificado') {
                errorMessage = "Por favor, verifique seu email antes de fazer login";
            } else {
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = "Usuário não encontrado";
                        break;
                    case 'auth/wrong-password':
                        errorMessage = "Senha incorreta";
                        break;
                    default:
                        errorMessage = error.message;
                }
            }
            showError('loginForm', errorMessage);
        });
}

function registerUser(email, password, name) {
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // Send verification email
            return user.sendEmailVerification({
                url: window.location.origin + '/index.html', // URL to redirect after verification
                handleCodeInApp: false
            }).then(() => {
                // Create user document in Firestore
                return db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    emailVerified: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }).then(() => {
                return user.updateProfile({
                    displayName: name
                });
            }).then(() => {
                // Show verification email modal
                showVerificationEmailModal(email);
                // Sign out user until email is verified
                return auth.signOut();
            });
        })
        .catch((error) => {
            console.error("Registration error:", error);
            showError('registerForm', error.message);
        });
}

function logoutUser() {
    auth.signOut()
        .then(() => {
            console.log("Logout successful");
            updateUIForLoggedOutUser();
        })
        .catch((error) => {
            console.error("Logout error:", error);
        });
}

// Função para mostrar erros nos formulários
function showError(formId, message) {
    const form = document.getElementById(formId);
    let errorDiv = form.querySelector('.error-message');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        form.insertBefore(errorDiv, form.firstChild);
    }
    
    errorDiv.textContent = message;
}

// Atualizar UI baseado no estado de autenticação
function updateUIForLoggedInUser(user) {
    console.log("Atualizando UI para usuário logado:", user);
    const userInfo = document.querySelector('.user-info');
    const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}`;
    
    userInfo.innerHTML = `
        <span class="material-icons notification-icon">notifications</span>
        <div class="user-profile">
            <img src="${photoURL}" alt="Profile" class="profile-pic">
            <span>${user.displayName || user.email}</span>
            <button onclick="logoutUser()" class="logout-btn">Logout</button>
        </div>
    `;

    // Esconde os botões de CTA (Get Started) quando logado
    const ctaButtons = document.querySelector('.cta-buttons');
    if (ctaButtons) {
        ctaButtons.style.display = 'none';
    }
}

function updateUIForLoggedOutUser() {
    console.log("Atualizando UI para usuário deslogado");
    const userInfo = document.querySelector('.user-info');
    userInfo.innerHTML = `
        <button class="login-btn" onclick="openLoginModal()">Login</button>
    `;

    // Mostra os botões de CTA (Get Started) quando deslogado
    const ctaButtons = document.querySelector('.cta-buttons');
    if (ctaButtons) {
        ctaButtons.style.display = 'flex';
    }
}

// Funções do Modal
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (tab === 'login') {
        if (event && event.target) {
            event.target.classList.add('active');
        }
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('resetForm').style.display = 'none';
    } else if (tab === 'register') {
        if (event && event.target) {
            event.target.classList.add('active');
        }
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'flex';
        document.getElementById('resetForm').style.display = 'none';
    } else if (tab === 'reset') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('resetForm').style.display = 'flex';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Carregado, configurando listeners");
    
    // Login form listener
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;
            loginUser(email, password);
        });
    }

    // Register form listener
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = registerForm.querySelector('input[type="text"]').value;
            const email = registerForm.querySelector('input[type="email"]').value;
            const password = registerForm.querySelector('input[type="password"]').value;
            registerUser(email, password, name);
        });
    }

    // Auth state observer
    auth.onAuthStateChanged((user) => {
        console.log("Estado de autenticação mudou:", user ? "usuário logado" : "usuário deslogado");
        if (user) {
            updateUIForLoggedInUser(user);
        } else {
            updateUIForLoggedOutUser();
        }
    });

    // Click fora do modal para fechar
    window.onclick = function(event) {
        const loginModal = document.getElementById('loginModal');
        const authAlertModal = document.getElementById('authAlertModal');
        if (event.target == loginModal) {
            closeLoginModal();
        }
        if (event.target == authAlertModal) {
            closeAuthAlert();
        }
    }

    // Adiciona proteção aos links do menu
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') {
                e.preventDefault();
                return;
            }
            
            if (href !== 'index.html') {
                e.preventDefault();
                if (!auth.currentUser) {
                    showAuthAlert();
                } else {
                    window.location.href = href;
                }
            }
        });
    });
    
    updateActiveNavLink();

    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = resetForm.querySelector('input[type="email"]').value;
            resetPassword(email);
        });
    }
});

// Função para login com Google
function signInWithGoogle() {
    console.log("Iniciando login com Google");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("Login Google bem sucedido");
            const user = result.user;
            
            // Salvar dados no Firestore
            return db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        })
        .then(() => {
            closeLoginModal();
            updateUIForLoggedInUser(auth.currentUser);
        })
        .catch((error) => {
            console.error("Erro no login Google:", error);
            showError('loginForm', "Erro no login com Google: " + error.message);
        });
}

// Atualizar último login
function updateLastLogin(userId) {
    return db.collection('users').doc(userId).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function showAuthAlert() {
    const modal = document.getElementById('authAlertModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeAuthAlert() {
    const modal = document.getElementById('authAlertModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function checkAuth() {
    const user = auth.currentUser;
    if (!user) {
        showAuthAlert();
        return false;
    }
    return true;
}

function updateActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Add new function to show verification email modal
function showVerificationEmailModal(email) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="closeVerificationModal(event)">&times;</span>
            <div class="verification-alert">
                <span class="material-icons">mail</span>
                <h2>Verifique seu Email</h2>
                <p>Um email de verificação foi enviado para:</p>
                <p><strong>${email}</strong></p>
                <p>Por favor, verifique sua caixa de entrada e clique no link de verificação para ativar sua conta.</p>
                <button class="primary-btn" onclick="closeVerificationModal(event)">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Add new function to show verification required modal
function showVerificationRequiredModal(email) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="closeVerificationModal(event)">&times;</span>
            <div class="verification-alert">
                <span class="material-icons">warning</span>
                <h2>Verificação Necessária</h2>
                <p>Sua conta ainda não foi verificada.</p>
                <p>Por favor, verifique o email enviado para:</p>
                <p><strong>${email}</strong></p>
                <button class="primary-btn" onclick="resendVerificationEmail('${email}')">Reenviar Email</button>
                <button class="secondary-btn" onclick="closeVerificationModal(event)">Fechar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Adicionar nova função para fechar os modais de verificação
function closeVerificationModal(event) {
    const modal = event.target.closest('.modal');
    if (modal) {
        modal.remove();
    }
}

// Atualizar a função resendVerificationEmail para usar o novo closeVerificationModal
function resendVerificationEmail(email) {
    const user = auth.currentUser;
    if (user) {
        user.sendEmailVerification({
            url: window.location.origin + '/index.html',
            handleCodeInApp: false
        }).then(() => {
            // Primeiro remove o modal atual
            const currentModal = document.querySelector('.modal');
            if (currentModal) {
                currentModal.remove();
            }
            
            // Mostra mensagem de sucesso
            const successModal = document.createElement('div');
            successModal.className = 'modal';
            successModal.style.display = 'block';
            successModal.innerHTML = `
                <div class="modal-content">
                    <span class="close-btn" onclick="closeVerificationModal(event)">&times;</span>
                    <div class="verification-alert">
                        <span class="material-icons">check_circle</span>
                        <h2>Email Reenviado</h2>
                        <p>Um novo email de verificação foi enviado para:</p>
                        <p><strong>${email}</strong></p>
                        <button class="primary-btn" onclick="closeVerificationModal(event)">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(successModal);
        }).catch((error) => {
            showError('loginForm', 'Erro ao reenviar email de verificação: ' + error.message);
        });
    }
}

// Adicionar função para reset de senha
function resetPassword(email) {
    auth.sendPasswordResetEmail(email)
        .then(() => {
            // Mostrar mensagem de sucesso
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.innerHTML = `
                <div class="success-icon">
                    <span class="material-icons">check_circle</span>
                </div>
                <h3>Email Enviado!</h3>
                <p>Verifique sua caixa de entrada para redefinir sua senha.</p>
            `;
            
            // Substituir o formulário pela mensagem de sucesso
            const resetForm = document.getElementById('resetForm');
            resetForm.innerHTML = '';
            resetForm.appendChild(successMessage);
            
            // Voltar para o login após alguns segundos
            setTimeout(() => {
                switchTab('login');
            }, 3000);
        })
        .catch((error) => {
            showError('resetForm', error.message);
        });
}
