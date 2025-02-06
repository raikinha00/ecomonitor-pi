// Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Verificação de autenticação
auth.onAuthStateChanged(function(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    loadUserData();
});

// Carregar dados do usuário
function loadUserData() {
    const user = auth.currentUser;
    if (!user) return;

    // Preencher informações básicas
    document.getElementById('userName').textContent = user.displayName || 'Usuário';
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('nameInput').value = user.displayName || '';
    document.getElementById('emailInput').value = user.email;

    // Carregar foto do perfil
    const profileImage = document.getElementById('profileImage');
    if (user.photoURL) {
        profileImage.src = user.photoURL;
    } else {
        profileImage.src = 'https://via.placeholder.com/150?text=Profile';
    }

    // Carregar preferências do usuário
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('currencySelect').value = data.currency || 'EUR';
                document.getElementById('emailNotifications').checked = data.emailNotifications || false;
                document.getElementById('pushNotifications').checked = data.pushNotifications || false;
            }
        })
        .catch(error => console.error('Erro ao carregar preferências:', error));
}

// Funções para o modal de foto
function openPhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.style.display = 'none';
        // Limpar o input
        document.getElementById('photoUrlInput').value = '';
    }
}

// Substituir a função changeProfileImage existente
document.addEventListener('DOMContentLoaded', function() {
    // ... existing event listeners ...

    // Adicionar listener para o botão de mudar foto
    document.getElementById('changePhotoBtn').addEventListener('click', function() {
        openPhotoModal();
    });

    // Adicionar listener para o formulário de foto
    document.getElementById('photoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const imageUrl = document.getElementById('photoUrlInput').value;
        const user = auth.currentUser;
        if (!user) return;

        // Validar se o URL é válido
        const isValidUrl = (url) => {
            try {
                new URL(url);
                return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
            } catch (e) {
                return false;
            }
        };

        if (!isValidUrl(imageUrl)) {
            showErrorMessage('Por favor, insira um URL válido de imagem (jpeg, jpg, gif, png)');
            return;
        }

        // Atualizar foto no perfil do usuário
        user.updateProfile({
            photoURL: imageUrl
        }).then(() => {
            document.getElementById('profileImage').src = imageUrl;
            showSuccessMessage('Foto de perfil atualizada com sucesso!');
            closePhotoModal();
        }).catch(error => {
            console.error('Erro ao atualizar foto:', error);
            showErrorMessage('Erro ao atualizar foto de perfil');
        });
    });

    // Fechar modal ao clicar fora
    window.onclick = function(event) {
        const modal = document.getElementById('photoModal');
        if (event.target == modal) {
            closePhotoModal();
        }
    }
});

// Atualizar informações do perfil
document.getElementById('profileForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const newName = document.getElementById('nameInput').value;

    user.updateProfile({
        displayName: newName
    }).then(() => {
        document.getElementById('userName').textContent = newName;
        showSuccessMessage('Perfil atualizado com sucesso!');
    }).catch(error => {
        console.error('Erro ao atualizar perfil:', error);
        showErrorMessage('Erro ao atualizar perfil');
    });
});

// Atualizar senha
document.getElementById('passwordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    // Enviar email de redefinição de senha
    auth.sendPasswordResetEmail(user.email)
        .then(() => {
            showSuccessMessage(`
                Email de redefinição de senha enviado para:<br>
                <strong>${user.email}</strong><br><br>
                Por favor, verifique sua caixa de entrada.
            `);
        })
        .catch(error => {
            console.error('Erro ao enviar email de redefinição:', error);
            let errorMessage = 'Erro ao enviar email de redefinição';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Usuário não encontrado';
                    break;
                default:
                    errorMessage = error.message;
            }
            showErrorMessage(errorMessage);
        });
});

// Salvar preferências
document.getElementById('preferencesForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const preferences = {
        currency: document.getElementById('currencySelect').value,
        emailNotifications: document.getElementById('emailNotifications').checked,
        pushNotifications: document.getElementById('pushNotifications').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('users').doc(user.uid).update(preferences)
        .then(() => {
            showSuccessMessage('Preferências salvas com sucesso!');
        })
        .catch(error => {
            console.error('Erro ao salvar preferências:', error);
            showErrorMessage('Erro ao salvar preferências');
        });
});

// Excluir conta
function confirmDeleteAccount() {
    if (confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
        const user = auth.currentUser;
        if (!user) return;

        // Deletar dados do usuário no Firestore
        db.collection('users').doc(user.uid).delete()
            .then(() => {
                // Deletar o usuário
                return user.delete();
            })
            .then(() => {
                window.location.href = 'index.html';
            })
            .catch(error => {
                console.error('Erro ao deletar conta:', error);
                showErrorMessage('Erro ao deletar conta. Tente fazer login novamente.');
            });
    }
}

// Funções auxiliares para mensagens
function showSuccessMessage(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block'; // Importante: definir display como block
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal(this)">&times;</span>
            <h2>Sucesso</h2>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(modal);
}

function showErrorMessage(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block'; // Importante: definir display como block
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal(this)">&times;</span>
            <h2>Erro</h2>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(modal);
}

// Função para fechar o modal
function closeModal(element) {
    const modal = element.closest('.modal');
    modal.remove();
}

// Atualizar link ativo no menu
function updateActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Adicionar event listeners para navegação
document.addEventListener('DOMContentLoaded', function() {
    // Atualizar link ativo
    updateActiveNavLink();
    
    // Adicionar listeners para links da navegação
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') {
                e.preventDefault();
                return;
            }
            
            if (!auth.currentUser && href !== 'index.html') {
                e.preventDefault();
                window.location.href = 'index.html';
            }
        });
    });
}); 