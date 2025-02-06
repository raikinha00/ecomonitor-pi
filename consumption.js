// Verificação de autenticação
firebase.auth().onAuthStateChanged(function(user) {
    if (!user) {
        showAuthAlert();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 100);
    }
});

// Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Configurações
const ENERGY_COST_PER_KWH = 0.1529; // Preço por kWh em euros
const BASE_CONSUMPTION = 65; // Consumo base em Watts
const MAX_VARIATION = 35; // Variação máxima em Watts

// Variáveis globais
let currentWatts = 0;
let isSimulating = false;
let simulationInterval;
let selectedOutlet = null;
let deleteDocId = null; // Variável para armazenar o ID do documento a ser excluído

// Função para mostrar o modal de aviso
function showWarningModal() {
    const warningModal = document.getElementById('warningModal');
    warningModal.style.display = 'flex';
}

// Função para fechar o modal de aviso
function closeWarningModal() {
    const warningModal = document.getElementById('warningModal');
    warningModal.style.display = 'none';
}

// Função para mostrar o alerta inicial
function showInitialAlert() {
    const initialAlertModal = document.getElementById('initialAlertModal');
    initialAlertModal.style.display = 'flex';
}

// Função para fechar o alerta inicial
function closeInitialAlert() {
    const initialAlertModal = document.getElementById('initialAlertModal');
    initialAlertModal.style.display = 'none';
}

// Função para mostrar o modal de confirmação de exclusão
function showDeleteConfirmModal(docId) {
    deleteDocId = docId;
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'flex';
}

// Função para fechar o modal de confirmação de exclusão
function closeDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'none';
    deleteDocId = null;
}

// Função para confirmar a exclusão
function confirmDelete() {
    if (deleteDocId) {
        const user = auth.currentUser;
        if (!user) return;

        db.collection('users').doc(user.uid)
            .collection('consumptionHistory')
            .doc(deleteDocId)
            .delete()
            .then(() => {
                console.log('Registro deletado com sucesso');
                updateConsumptionTable();
                updateConsumptionHistory();
                closeDeleteConfirmModal();
            })
            .catch(error => {
                console.error('Erro ao deletar registro:', error);
                showErrorMessage('Erro ao deletar registro');
            });
    }
}

// Carregar tomadas do usuário
function loadOutlets() {
    const user = auth.currentUser;
    if (!user) return;

    const outletSelect = document.getElementById('outletSelect');
    outletSelect.innerHTML = '<option value="">Escolha uma tomada...</option>';

    db.collection('users').doc(user.uid)
        .collection('outlets')
        .orderBy('name')
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const outlet = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${outlet.name} (${outlet.room})`;
                outletSelect.appendChild(option);
            });
            
            // Mostra o alerta inicial após carregar as tomadas
            showInitialAlert();
        })
        .catch(error => {
            console.error('Erro ao carregar tomadas:', error);
            showErrorMessage('Erro ao carregar tomadas');
        });
}

// Função para simular consumo mais realista
function simulateConsumption() {
    if (!selectedOutlet) return;

    const timeOfDay = new Date().getHours();
    let baseMultiplier = 1;

    // Ajusta consumo baseado na hora do dia
    if (timeOfDay >= 9 && timeOfDay <= 18) {
        baseMultiplier = 1.2; // Maior consumo durante horário comercial
    } else if (timeOfDay >= 19 && timeOfDay <= 23) {
        baseMultiplier = 1.1; // Consumo moderado à noite
    } else {
        baseMultiplier = 0.8; // Menor consumo de madrugada
    }

    // Calcula consumo com variação aleatória
    const variation = Math.random() * MAX_VARIATION;
    currentWatts = (BASE_CONSUMPTION + variation) * baseMultiplier;
    
    // Calcula custo por hora
    const kW = currentWatts / 1000;
    const costPerHour = kW * ENERGY_COST_PER_KWH;

    // Atualiza interface
    document.getElementById('currentWatts').textContent = currentWatts.toFixed(1);
    document.getElementById('currentCost').textContent = costPerHour.toFixed(3);

    // Salva os dados no Firestore
    saveConsumptionData();
}

// Função para iniciar simulação
function startSimulation() {
    const outletSelect = document.getElementById('outletSelect');
    if (!outletSelect.value) {
        showWarningModal();
        return;
    }

    if (!isSimulating) {
        selectedOutlet = outletSelect.value;
        isSimulating = true;
        outletSelect.disabled = true;
        document.getElementById('startSimulation').disabled = true;
        document.getElementById('stopSimulation').disabled = false;
        
        // Inicia simulação imediatamente
        simulateConsumption();
        
        // Configura intervalo de atualização
        simulationInterval = setInterval(simulateConsumption, 5000);
    }
}

// Atualiza valores na tela
function updateCurrentConsumption() {
    const kW = currentWatts / 1000;
    const costPerHour = kW * ENERGY_COST_PER_KWH;

    document.getElementById('currentWatts').textContent = currentWatts.toFixed(1);
    document.getElementById('currentCost').textContent = costPerHour.toFixed(2);
}

// Salva dados no Firestore
function saveConsumptionData() {
    const user = auth.currentUser;
    if (!user || !selectedOutlet) return;

    const timestamp = new Date();
    const consumption = {
        timestamp: firebase.firestore.Timestamp.fromDate(timestamp),
        watts: currentWatts,
        kWh: currentWatts / 1000,
        cost: (currentWatts / 1000) * ENERGY_COST_PER_KWH,
        outletId: selectedOutlet
    };

    db.collection('users').doc(user.uid)
        .collection('consumption')
        .add(consumption)
        .then(() => {
            console.log('Consumo registrado');
            updateStatistics();
        })
        .catch(error => console.error('Erro ao salvar consumo:', error));
}

// Atualiza estatísticas
function updateStatistics() {
    const user = auth.currentUser;
    if (!user) return;

    // Calcula início do dia e do mês
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Busca consumo do dia
    db.collection('users').doc(user.uid)
        .collection('consumption')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(today))
        .get()
        .then(snapshot => {
            let totalKWh = 0;
            snapshot.forEach(doc => {
                totalKWh += doc.data().kWh;
            });
            
            const totalCost = totalKWh * ENERGY_COST_PER_KWH;
            document.getElementById('todayConsumption').textContent = totalKWh.toFixed(2);
            document.getElementById('todayCost').textContent = totalCost.toFixed(2);
        });

    // Busca consumo do mês
    db.collection('users').doc(user.uid)
        .collection('consumption')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startOfMonth))
        .get()
        .then(snapshot => {
            let totalKWh = 0;
            snapshot.forEach(doc => {
                totalKWh += doc.data().kWh;
            });
            
            const totalCost = totalKWh * ENERGY_COST_PER_KWH;
            document.getElementById('monthConsumption').textContent = totalKWh.toFixed(2);
            document.getElementById('monthCost').textContent = totalCost.toFixed(2);
        });
}

// Função para atualizar o link ativo na navegação
function updateActiveNavLink() {
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === 'consumption.html') {
            link.classList.add('active');
        }
    });
}

// Função para parar simulação
function stopSimulation() {
    if (isSimulating) {
        isSimulating = false;
        clearInterval(simulationInterval);
        currentWatts = 0;
        selectedOutlet = null;
        
        const outletSelect = document.getElementById('outletSelect');
        outletSelect.disabled = false;
        
        updateCurrentConsumption();
        document.getElementById('startSimulation').disabled = false;
        document.getElementById('stopSimulation').disabled = true;
    }
}

// Função para salvar o histórico de consumo
function saveConsumptionHistory() {
    const user = auth.currentUser;
    if (!user) return;

    const timestamp = new Date();
    const monthlyConsumption = {
        timestamp: firebase.firestore.Timestamp.fromDate(timestamp),
        totalKWh: parseFloat(document.getElementById('monthConsumption').textContent),
        totalCost: parseFloat(document.getElementById('monthCost').textContent),
        period: `${timestamp.getMonth() + 1}/${timestamp.getFullYear()}`
    };

    db.collection('users').doc(user.uid)
        .collection('consumptionHistory')
        .add(monthlyConsumption)
        .then(() => {
            console.log('Histórico de consumo salvo');
            updateConsumptionHistory();
            updateConsumptionTable();
        })
        .catch(error => console.error('Erro ao salvar histórico:', error));
}

// Função para verificar e agendar salvamento automático
function scheduleAutoSave() {
    const now = new Date();
    const user = auth.currentUser;
    if (!user) return;

    // Verifica último salvamento
    db.collection('users').doc(user.uid)
        .collection('consumptionHistory')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then(snapshot => {
            let shouldSave = false;
            
            if (snapshot.empty) {
                shouldSave = true;
            } else {
                const lastSave = snapshot.docs[0].data().timestamp.toDate();
                const daysSinceLastSave = (now - lastSave) / (1000 * 60 * 60 * 24);
                if (daysSinceLastSave >= 30) {
                    shouldSave = true;
                }
            }

            if (shouldSave) {
                saveConsumptionHistory();
            }
        });
}

// Função para atualizar o histórico na interface
function updateConsumptionHistory() {
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid)
        .collection('consumptionHistory')
        .orderBy('timestamp', 'desc')
        .limit(12) // Últimos 12 meses
        .get()
        .then(snapshot => {
            const labels = [];
            const consumptionData = [];
            const costData = [];
            
            snapshot.forEach(doc => {
                const history = doc.data();
                labels.unshift(history.period);
                consumptionData.unshift(history.totalKWh);
                costData.unshift(history.totalCost);
            });

            // Atualiza o gráfico
            const ctx = document.getElementById('consumptionHistory').getContext('2d');
            if (window.consumptionChart) {
                window.consumptionChart.destroy();
            }
            
            window.consumptionChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Consumo (kWh)',
                            data: consumptionData,
                            backgroundColor: 'rgba(14, 165, 233, 0.7)',
                            borderColor: 'rgba(14, 165, 233, 1)',
                            borderWidth: 1,
                            borderRadius: 5,
                            barThickness: 25
                        },
                        {
                            label: 'Custo (€)',
                            data: costData,
                            backgroundColor: 'rgba(34, 197, 94, 0.7)',
                            borderColor: 'rgba(34, 197, 94, 1)',
                            borderWidth: 1,
                            borderRadius: 5,
                            barThickness: 25
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: '#F1F5F9'
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#94A3B8'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(148, 163, 184, 0.1)'
                            },
                            ticks: {
                                color: '#94A3B8'
                            }
                        }
                    }
                }
            });
        });
}

// Função para atualizar a tabela de consumo
function updateConsumptionTable() {
    const user = auth.currentUser;
    if (!user) return;

    const tableBody = document.getElementById('consumptionTableBody');
    tableBody.innerHTML = ''; // Limpa a tabela

    db.collection('users').doc(user.uid)
        .collection('consumptionHistory')
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const data = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${data.period}</td>
                    <td>${data.totalKWh.toFixed(2)}</td>
                    <td>${data.totalCost.toFixed(2)}</td>
                    <td>
                        <button class="delete-btn" data-id="${doc.id}">
                            <span class="material-icons">delete</span>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);

                // Adiciona evento de clique no botão de deletar
                const deleteBtn = row.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => deleteConsumption(doc.id));
            });
        });
}

// Função para deletar um registro de consumo
function deleteConsumption(docId) {
    showDeleteConfirmModal(docId);
}

// Função para mostrar mensagem de erro
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// Fechar modais quando clicar fora
window.onclick = function(event) {
    const warningModal = document.getElementById('warningModal');
    const initialAlertModal = document.getElementById('initialAlertModal');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    
    if (event.target === warningModal) {
        closeWarningModal();
    }
    if (event.target === initialAlertModal) {
        closeInitialAlert();
    }
    if (event.target === deleteConfirmModal) {
        closeDeleteConfirmModal();
    }
}

// Modifique a função de inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Atualiza o link ativo
    updateActiveNavLink();

    // Adiciona event listeners aos botões
    document.getElementById('startSimulation').addEventListener('click', startSimulation);
    document.getElementById('stopSimulation').addEventListener('click', stopSimulation);
    document.getElementById('saveConsumption').addEventListener('click', saveConsumptionHistory);

    // Observer de autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            loadOutlets(); // Carrega as tomadas disponíveis
            updateStatistics();
            updateConsumptionHistory();
            updateConsumptionTable();
            scheduleAutoSave();
            
            setInterval(scheduleAutoSave, 24 * 60 * 60 * 1000);
        } else {
            window.location.href = 'index.html';
        }
    });
}); 