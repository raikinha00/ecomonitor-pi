// Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Verificação de autenticação
auth.onAuthStateChanged(function(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    loadOutlets();
});

// Carregar tomadas do usuário
function loadOutlets() {
    const user = auth.currentUser;
    if (!user) return;

    const outletsGrid = document.getElementById('outletsGrid');
    outletsGrid.innerHTML = ''; // Limpa o grid

    db.collection('users').doc(user.uid)
        .collection('outlets')
        .orderBy('name')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                outletsGrid.innerHTML = `
                    <div class="no-outlets">
                        <p>Você ainda não tem tomadas cadastradas.</p>
                    </div>
                `;
                return;
            }

            snapshot.forEach(doc => {
                const outlet = doc.data();
                const outletCard = createOutletCard(doc.id, outlet);
                outletsGrid.appendChild(outletCard);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar tomadas:', error);
            showErrorMessage('Erro ao carregar tomadas');
        });
}

// Criar card de tomada
function createOutletCard(id, outlet) {
    const card = document.createElement('div');
    card.className = 'outlet-card';
    card.innerHTML = `
        <div class="outlet-header">
            <div class="outlet-icon">
                <span class="material-icons">${outlet.icon}</span>
            </div>
            <div class="outlet-actions">
                <button class="action-btn" onclick="editOutlet('${id}')">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn delete" onclick="deleteOutlet('${id}')">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
        <div class="outlet-info">
            <h3>${outlet.name}</h3>
            <div class="outlet-room">
                <span class="material-icons">room</span>
                ${outlet.room}
            </div>
        </div>
    `;
    return card;
}

// Funções do Modal
function openAddOutletModal() {
    const modal = document.getElementById('outletModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('outletForm');
    
    modalTitle.textContent = 'Adicionar Nova Tomada';
    form.reset();
    clearSelectedIcon();
    
    modal.style.display = 'block';
    form.dataset.mode = 'add';
}

function closeOutletModal() {
    const modal = document.getElementById('outletModal');
    const saveButton = document.getElementById('saveButton');
    
    modal.style.display = 'none';
    saveButton.disabled = false;
    saveButton.classList.remove('loading');
    
    document.getElementById('outletForm').reset();
    clearSelectedIcon();
}

// Seleção de ícone
document.addEventListener('DOMContentLoaded', function() {
    const iconGrid = document.getElementById('iconGrid');
    const iconOptions = iconGrid.querySelectorAll('.icon-option');
    
    iconOptions.forEach(option => {
        option.addEventListener('click', function() {
            const icon = this.getAttribute('data-icon');
            clearSelectedIcon();
            this.classList.add('selected');
            document.getElementById('selectedIcon').value = icon;
        });
    });

    // Form submission
    document.getElementById('outletForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const mode = this.dataset.mode;
        
        if (mode === 'add') {
            addOutlet();
        } else if (mode === 'edit') {
            const outletId = this.dataset.outletId;
            updateOutlet(outletId);
        }
    });
});

function clearSelectedIcon() {
    document.querySelectorAll('.icon-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.getElementById('selectedIcon').value = '';
}

// Adicionar nova tomada
function addOutlet() {
    const user = auth.currentUser;
    if (!user) return;

    const saveButton = document.getElementById('saveButton');
    if (saveButton.disabled) return; // Previne múltiplos envios

    const name = document.getElementById('outletName').value;
    const room = document.getElementById('outletRoom').value;
    const icon = document.getElementById('selectedIcon').value;

    if (!name || !room || !icon) {
        showErrorMessage('Por favor, preencha todos os campos');
        return;
    }

    // Ativa estado de loading
    saveButton.disabled = true;
    saveButton.classList.add('loading');

    const outlet = {
        name: name,
        room: room,
        icon: icon,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('users').doc(user.uid)
        .collection('outlets')
        .add(outlet)
        .then(() => {
            closeOutletModal();
            loadOutlets();
            showSuccessMessage('Tomada adicionada com sucesso!');
        })
        .catch(error => {
            console.error('Erro ao adicionar tomada:', error);
            showErrorMessage('Erro ao adicionar tomada');
        })
        .finally(() => {
            // Desativa estado de loading
            saveButton.disabled = false;
            saveButton.classList.remove('loading');
        });
}

// Editar tomada
function editOutlet(outletId) {
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid)
        .collection('outlets')
        .doc(outletId)
        .get()
        .then(doc => {
            if (!doc.exists) {
                showErrorMessage('Tomada não encontrada');
                return;
            }

            const outlet = doc.data();
            const modal = document.getElementById('outletModal');
            const form = document.getElementById('outletForm');
            const modalTitle = document.getElementById('modalTitle');

            modalTitle.textContent = 'Editar Tomada';
            document.getElementById('outletName').value = outlet.name;
            document.getElementById('outletRoom').value = outlet.room;
            
            clearSelectedIcon();
            const iconOption = document.querySelector(`.icon-option[data-icon="${outlet.icon}"]`);
            if (iconOption) {
                iconOption.classList.add('selected');
                document.getElementById('selectedIcon').value = outlet.icon;
            }

            form.dataset.mode = 'edit';
            form.dataset.outletId = outletId;
            modal.style.display = 'block';
        })
        .catch(error => {
            console.error('Erro ao carregar tomada:', error);
            showErrorMessage('Erro ao carregar tomada');
        });
}

// Atualizar tomada
function updateOutlet(outletId) {
    const user = auth.currentUser;
    if (!user) return;

    const saveButton = document.getElementById('saveButton');
    if (saveButton.disabled) return; // Previne múltiplos envios

    const name = document.getElementById('outletName').value;
    const room = document.getElementById('outletRoom').value;
    const icon = document.getElementById('selectedIcon').value;

    if (!name || !room || !icon) {
        showErrorMessage('Por favor, preencha todos os campos');
        return;
    }

    // Ativa estado de loading
    saveButton.disabled = true;
    saveButton.classList.add('loading');

    const outlet = {
        name: name,
        room: room,
        icon: icon,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('users').doc(user.uid)
        .collection('outlets')
        .doc(outletId)
        .update(outlet)
        .then(() => {
            closeOutletModal();
            loadOutlets();
            showSuccessMessage('Tomada atualizada com sucesso!');
        })
        .catch(error => {
            console.error('Erro ao atualizar tomada:', error);
            showErrorMessage('Erro ao atualizar tomada');
        })
        .finally(() => {
            // Desativa estado de loading
            saveButton.disabled = false;
            saveButton.classList.remove('loading');
        });
}

// Variável global para armazenar o ID da tomada a ser excluída
let currentOutletToDelete = null;

// Deletar tomada - Mostrar modal de confirmação
function deleteOutlet(outletId) {
    currentOutletToDelete = outletId;
    const deleteModal = document.getElementById('deleteConfirmModal');
    deleteModal.style.display = 'block';
}

// Fechar modal de confirmação de exclusão
function closeDeleteModal() {
    const deleteModal = document.getElementById('deleteConfirmModal');
    deleteModal.style.display = 'none';
    currentOutletToDelete = null;
}

// Confirmar e executar a exclusão
function confirmDelete() {
    if (!currentOutletToDelete) return;

    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid)
        .collection('outlets')
        .doc(currentOutletToDelete)
        .delete()
        .then(() => {
            closeDeleteModal();
            loadOutlets();
            showSuccessMessage('Tomada excluída com sucesso!');
        })
        .catch(error => {
            console.error('Erro ao excluir tomada:', error);
            showErrorMessage('Erro ao excluir tomada');
            closeDeleteModal();
        });
}

// Fechar modais quando clicar fora
window.onclick = function(event) {
    const deleteModal = document.getElementById('deleteConfirmModal');
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
}

// Funções auxiliares para mensagens
function showSuccessMessage(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
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
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal(this)">&times;</span>
            <h2>Erro</h2>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeModal(element) {
    const modal = element.closest('.modal');
    modal.remove();
}

// Atualizar link ativo no menu
function updateActiveNavLink() {
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === 'outlets.html') {
            link.classList.add('active');
        }
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    updateActiveNavLink();
}); 