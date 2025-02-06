// Inicialização do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Verificação de autenticação
auth.onAuthStateChanged(function(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    loadDashboardData();
});

// Variáveis globais para armazenar os dados
let dayData = {
    labels: [],
    values: []
};
let weekData = {
    labels: [],
    values: []
};
let monthData = {
    labels: [],
    values: []
};

function loadDashboardData() {
    const user = auth.currentUser;
    if (!user) return;

    // Carregar dados do dia atual
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Buscar consumo do dia
    db.collection('users').doc(user.uid)
        .collection('consumption')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(today))
        .orderBy('timestamp', 'asc')
        .get()
        .then(snapshot => {
            const hourlyData = processHourlyData(snapshot);
            dayData = hourlyData; // Armazenar dados do dia
            updateDailyStats(hourlyData);
            updateChart(hourlyData, 'day');
        });

    // Carregar dados da semana
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 7);
    
    db.collection('users').doc(user.uid)
        .collection('consumption')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(weekStart))
        .orderBy('timestamp', 'asc')
        .get()
        .then(snapshot => {
            const weeklyData = processWeeklyData(snapshot);
            weekData = weeklyData; // Armazenar dados da semana
        });

    // Carregar dados do mês
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    db.collection('users').doc(user.uid)
        .collection('consumption')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(monthStart))
        .orderBy('timestamp', 'asc')
        .get()
        .then(snapshot => {
            const monthlyData = processMonthlyData(snapshot);
            monthData = monthlyData; // Armazenar dados do mês
        });
}

function processHourlyData(snapshot) {
    // Inicializar array com 24 horas, preenchido com zeros
    const hourlyConsumption = new Array(24).fill(0);
    const hourlyLabels = [];

    // Criar labels para cada hora do dia
    for (let i = 0; i < 24; i++) {
        hourlyLabels.push(`${i.toString().padStart(2, '0')}:00`);
    }

    // Processar dados do snapshot
    snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp.toDate();
        const hour = timestamp.getHours();
        hourlyConsumption[hour] += parseFloat(data.kWh) || 0;
    });

    // Encontrar hora de pico
    const peakHour = hourlyConsumption.indexOf(Math.max(...hourlyConsumption));
    const peakUsage = hourlyConsumption[peakHour];

    // Atualizar informação de hora de pico na UI
    const peakTimeElement = document.querySelector('.stat-card:nth-child(3) .stat-info h2');
    const peakUsageElement = document.querySelector('.stat-card:nth-child(3) .stat-info p');
    if (peakTimeElement && peakUsageElement) {
        peakTimeElement.textContent = `${peakHour.toString().padStart(2, '0')}:00`;
        peakUsageElement.textContent = `${peakUsage.toFixed(2)} kWh peak usage`;
    }

    return {
        labels: hourlyLabels,
        values: hourlyConsumption
    };
}

function processWeeklyData(snapshot) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weeklyConsumption = new Array(7).fill(0);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const day = new Date(data.timestamp.toDate()).getDay();
        weeklyConsumption[day] += data.kWh || 0;
    });

    return {
        labels: days,
        values: weeklyConsumption
    };
}

function processMonthlyData(snapshot) {
    const weeklyConsumption = new Array(4).fill(0);
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const date = new Date(data.timestamp.toDate());
        const weekNumber = Math.floor((date - monthStart) / (7 * 24 * 60 * 60 * 1000));
        if (weekNumber < 4) {
            weeklyConsumption[weekNumber] += data.kWh || 0;
        }
    });

    return {
        labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
        values: weeklyConsumption
    };
}

// Constante para o preço por kWh (em euros)
const ENERGY_COST_PER_KWH = 0.1529; // Preço por kWh em euros

function updateDailyStats(hourlyData) {
    // Calcular consumo total do dia
    const totalKWh = hourlyData.values.reduce((sum, value) => sum + value, 0);
    
    // Calcular custo total
    const totalCost = totalKWh * ENERGY_COST_PER_KWH;
    
    // Buscar dados de ontem para comparação
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid)
        .collection('consumption')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(yesterday))
        .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(new Date()))
        .get()
        .then(snapshot => {
            const yesterdayData = processHourlyData(snapshot);
            const yesterdayTotal = yesterdayData.values.reduce((sum, value) => sum + value, 0);
            const yesterdayCost = yesterdayTotal * ENERGY_COST_PER_KWH;
            
            // Calcular variação percentual
            const costDiff = ((totalCost - yesterdayCost) / yesterdayCost) * 100;
            
            // Atualizar UI
            document.querySelector('.stat-card:nth-child(1) .stat-info h2').textContent = 
                `${totalKWh.toFixed(2)} kWh`;
            document.querySelector('.stat-card:nth-child(2) .stat-info h2').textContent = 
                `€${totalCost.toFixed(2)}`;
            
            const trendElement = document.querySelector('.stat-card:nth-child(2) .trend');
            trendElement.textContent = `${Math.abs(costDiff).toFixed(1)}% vs yesterday`;
            trendElement.className = `trend ${costDiff >= 0 ? 'positive' : 'negative'}`;
            trendElement.innerHTML = `${costDiff >= 0 ? '↑' : '↓'} ${Math.abs(costDiff).toFixed(1)}% vs yesterday`;

            // Adicionar análise de consumo e sugestões
            updateConsumptionSuggestions(totalKWh, yesterdayTotal);
        });
}

function updateConsumptionSuggestions(currentConsumption, yesterdayConsumption) {
    const statusBadge = document.querySelector('.status-badge');
    const consumptionStatus = document.querySelector('.consumption-status');
    const suggestionsList = document.querySelector('.suggestions-list');
    const statusIcon = document.querySelector('.status-icon .material-icons');

    // Definir limites de consumo (ajuste conforme necessário)
    const LOW_CONSUMPTION = 5; // kWh
    const HIGH_CONSUMPTION = 15; // kWh

    let status, suggestions;

    if (currentConsumption > HIGH_CONSUMPTION) {
        status = {
            text: 'Alto Consumo',
            class: 'high',
            icon: 'warning',
            message: 'O seu consumo está acima do ideal',
            suggestions: [
                'Verifique se há aparelhos ligados desnecessariamente',
                'Considere trocar equipamentos antigos por modelos mais eficientes',
                'Evite usar múltiplos aparelhos de alto consumo simultaneamente'
            ]
        };
    } else if (currentConsumption < LOW_CONSUMPTION) {
        status = {
            text: 'Baixo Consumo',
            class: 'low',
            icon: 'eco',
            message: 'Parabéns! O seu consumo está muito eficiente',
            suggestions: [
                'Continue mantendo bons hábitos de consumo',
                'Compartilhe suas práticas de economia com outros',
                'Considere investir em energia solar para mais economia'
            ]
        };
    } else {
        status = {
            text: 'Equilibrado',
            class: '',
            icon: 'tips_and_updates',
            message: 'O seu consumo está dentro da média',
            suggestions: [
                'Considere usar mais luz natural durante o dia',
                'Evite usar aparelhos em horários de pico (14:00-17:00)',
                'Sabia que pode economizar 15% de energia ao desligar aparelhos que não estão a ser usados'
            ]
        };
    }

    // Atualizar a UI
    statusBadge.textContent = status.text;
    statusBadge.className = `status-badge ${status.class}`;
    statusIcon.textContent = status.icon;
    consumptionStatus.textContent = status.message;

    // Atualizar lista de sugestões
    suggestionsList.innerHTML = status.suggestions.map(suggestion => `
        <li>
            <span class="material-icons">lightbulb</span>
            <span>${suggestion}</span>
        </li>
    `).join('');
}

// Atualizar o event listener do DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('consumptionChart');
    if (!ctx) return;

    window.consumptionChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Consumo de Energia (kWh)',
                data: [],
                borderColor: '#0EA5E9',
                backgroundColor: 'rgba(14, 165, 233, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#94A3B8'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#94A3B8'
                    }
                }
            }
        }
    });

    // Adicionar event listeners para os filtros
    document.querySelectorAll('.chart-filters button').forEach(button => {
        button.addEventListener('click', function() {
            const period = this.getAttribute('data-period');
            updateChartPeriod(period);
        });
    });
});

function updateChartPeriod(period) {
    // Atualizar classe active nos botões
    document.querySelectorAll('.chart-filters button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.chart-filters button[data-period="${period}"]`).classList.add('active');

    let data;
    switch(period) {
        case 'week':
            data = weekData;
            break;
        case 'month':
            data = monthData;
            break;
        default:
            data = dayData;
    }

    // Verificar se temos dados válidos
    if (data && data.labels && data.values) {
        updateChart(data, period);
    } else {
        // Se não houver dados, recarregar do Firebase
        loadDashboardData();
    }
}

function updateChart(data, period) {
    if (window.consumptionChart) {
        window.consumptionChart.data.labels = data.labels;
        window.consumptionChart.data.datasets[0].data = data.values;
        window.consumptionChart.update();
    } else {
        const ctx = document.getElementById('consumptionChart');
        if (!ctx) return;

        window.consumptionChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Consumo de Energia (kWh)',
                    data: data.values,
                    borderColor: '#0EA5E9',
                    backgroundColor: 'rgba(14, 165, 233, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94A3B8'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94A3B8'
                        }
                    }
                }
            }
        });
    }
} 
