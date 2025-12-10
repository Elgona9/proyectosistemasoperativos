// Variables globales
let currentAlgorithm = '';
let processCounter = 1;
const processes = [];

// Elementos del DOM
const selectionView = document.getElementById('selectionView');
const simulationView = document.getElementById('simulationView');
const algorithmCards = document.querySelectorAll('.algorithm-card');
const backBtn = document.getElementById('backBtn');
const algorithmTitle = document.getElementById('algorithmTitle');
const addProcessBtn = document.getElementById('addProcessBtn');
const simulateBtn = document.getElementById('simulateBtn');
const processTableBody = document.getElementById('processTableBody');
const quantumContainer = document.getElementById('quantumContainer');
const quantumInput = document.getElementById('quantum');

// Event listeners
algorithmCards.forEach(card => {
    card.addEventListener('click', () => {
        const algorithm = card.dataset.algorithm;
        selectAlgorithm(algorithm);
    });
});

backBtn.addEventListener('click', () => {
    showSelectionView();
});

addProcessBtn.addEventListener('click', () => {
    addProcess();
});

simulateBtn.addEventListener('click', () => {
    simulate();
});

// Funciones de navegación
function selectAlgorithm(algorithm) {
    currentAlgorithm = algorithm;
    
    // Actualizar título
    const titles = {
        'fcfs': 'FCFS - First Come, First Served',
        'sjf': 'SJF - Shortest Job First',
        'srtf': 'SRTF - Shortest Remaining Time First',
        'rr': 'RR - Round Robin'
    };
    
    algorithmTitle.textContent = titles[algorithm];
    
    // Mostrar campo de quantum solo para Round Robin
    if (algorithm === 'rr') {
        quantumContainer.style.display = 'flex';
    } else {
        quantumContainer.style.display = 'none';
    }
    
    // Mostrar vista de simulación
    selectionView.classList.remove('active');
    simulationView.classList.add('active');
    
    // Resetear procesos
    resetProcesses();
}

function showSelectionView() {
    simulationView.classList.remove('active');
    selectionView.classList.add('active');
    currentAlgorithm = '';
}

// Funciones de gestión de procesos
function resetProcesses() {
    processCounter = 1;
    processes.length = 0;
    processTableBody.innerHTML = `
        <tr data-process="A">
            <td>A</td>
            <td><input type="number" class="arrival-time" min="0" value="0"></td>
            <td><input type="number" class="burst-time" min="1" value="3"></td>
            <td><button class="btn-remove" onclick="removeProcess(this)">✕</button></td>
        </tr>
    `;
    clearResults();
}

function addProcess() {
    const processNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    const currentProcesses = processTableBody.querySelectorAll('tr').length;
    
    if (currentProcesses >= processNames.length) {
        alert('Número máximo de procesos alcanzado');
        return;
    }
    
    const processName = processNames[currentProcesses];
    const row = document.createElement('tr');
    row.dataset.process = processName;
    row.innerHTML = `
        <td>${processName}</td>
        <td><input type="number" class="arrival-time" min="0" value="0"></td>
        <td><input type="number" class="burst-time" min="1" value="1"></td>
        <td><button class="btn-remove" onclick="removeProcess(this)">✕</button></td>
    `;
    
    processTableBody.appendChild(row);
}

function removeProcess(button) {
    const rows = processTableBody.querySelectorAll('tr');
    if (rows.length > 1) {
        button.closest('tr').remove();
    } else {
        alert('Debe haber al menos un proceso');
    }
}

// Función de simulación (estructura para implementación futura)
function simulate() {
    // Recolectar datos de entrada
    const rows = processTableBody.querySelectorAll('tr');
    processes.length = 0;
    
    rows.forEach(row => {
        const processName = row.dataset.process;
        const arrivalTime = parseInt(row.querySelector('.arrival-time').value) || 0;
        const burstTime = parseInt(row.querySelector('.burst-time').value) || 1;
        
        processes.push({
            name: processName,
            arrival: arrivalTime,
            burst: burstTime
        });
    });
    
    // Obtener quantum si es Round Robin
    const quantum = currentAlgorithm === 'rr' ? parseInt(quantumInput.value) || 2 : null;
    
    // Aquí se implementará la lógica del algoritmo
    console.log('Algoritmo:', currentAlgorithm);
    console.log('Procesos:', processes);
    console.log('Quantum:', quantum);
    
    // Por ahora, mostrar datos de ejemplo
    displayExampleResults();
}

// Función para mostrar resultados de ejemplo (para visualizar la estructura)
function displayExampleResults() {
    // Ejemplo de datos para visualización
    const exampleSchedule = [
        { process: 'A', start: 0, end: 3 },
        { process: 'B', start: 3, end: 8 },
        { process: 'C', start: 8, end: 11 },
        { process: 'D', start: 11, end: 15 }
    ];
    
    const exampleMetrics = [
        { process: 'A', arrival: 0, burst: 3, completion: 3, turnaround: 3, waiting: 0, response: 0, penalty: 1.0 },
        { process: 'B', arrival: 1, burst: 5, completion: 8, turnaround: 7, waiting: 2, response: 2, penalty: 1.4 },
        { process: 'C', arrival: 2, burst: 3, completion: 11, turnaround: 9, waiting: 6, response: 6, penalty: 3.0 },
        { process: 'D', arrival: 3, burst: 4, completion: 15, turnaround: 12, waiting: 8, response: 8, penalty: 3.0 }
    ];
    
    renderGanttChart(exampleSchedule);
    renderMetricsTable(exampleMetrics);
}

// Renderizar diagrama de Gantt
function renderGanttChart(schedule) {
    const ganttChart = document.getElementById('ganttChart');
    const ganttYAxis = document.getElementById('ganttYAxis');
    const ganttXAxis = document.getElementById('ganttXAxis');
    
    // Limpiar contenido previo
    ganttChart.innerHTML = '';
    ganttYAxis.innerHTML = '';
    ganttXAxis.innerHTML = '';
    
    // Obtener procesos únicos y tiempo máximo
    const uniqueProcesses = [...new Set(schedule.map(s => s.process))];
    const maxTime = Math.max(...schedule.map(s => s.end));
    const pixelsPerUnit = 30; // Pixeles por unidad de tiempo
    
    // Crear etiquetas del eje Y
    uniqueProcesses.forEach(processName => {
        const label = document.createElement('div');
        label.className = 'gantt-y-label';
        label.textContent = processName;
        ganttYAxis.appendChild(label);
    });
    
    // Crear filas del diagrama de Gantt
    uniqueProcesses.forEach(processName => {
        const row = document.createElement('div');
        row.className = 'gantt-row';
        row.style.width = `${maxTime * pixelsPerUnit}px`;
        
        // Agregar barras para este proceso
        schedule
            .filter(s => s.process === processName)
            .forEach(segment => {
                const bar = document.createElement('div');
                bar.className = `gantt-bar process-${processName.toLowerCase()}`;
                bar.style.left = `${segment.start * pixelsPerUnit}px`;
                bar.style.width = `${(segment.end - segment.start) * pixelsPerUnit}px`;
                bar.textContent = processName;
                bar.title = `${processName}: ${segment.start}-${segment.end}`;
                row.appendChild(bar);
            });
        
        ganttChart.appendChild(row);
    });
    
    // Crear etiquetas del eje X
    ganttXAxis.style.width = `${maxTime * pixelsPerUnit}px`;
    for (let i = 0; i <= maxTime; i++) {
        const label = document.createElement('div');
        label.className = 'gantt-x-label';
        label.style.left = `${i * pixelsPerUnit}px`;
        label.textContent = i;
        ganttXAxis.appendChild(label);
    }
}

// Renderizar tabla de métricas
function renderMetricsTable(metrics) {
    const metricsTableBody = document.getElementById('metricsTableBody');
    metricsTableBody.innerHTML = '';
    
    let totalTurnaround = 0;
    let totalWaiting = 0;
    let totalResponse = 0;
    let totalPenalty = 0;
    
    metrics.forEach(metric => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${metric.process}</td>
            <td>${metric.arrival}</td>
            <td>${metric.burst}</td>
            <td>${metric.completion}</td>
            <td>${metric.turnaround}</td>
            <td>${metric.waiting}</td>
            <td>${metric.response}</td>
            <td>${metric.penalty.toFixed(2)}</td>
        `;
        metricsTableBody.appendChild(row);
        
        totalTurnaround += metric.turnaround;
        totalWaiting += metric.waiting;
        totalResponse += metric.response;
        totalPenalty += metric.penalty;
    });
    
    // Calcular promedios
    const count = metrics.length;
    document.getElementById('avgTurnaround').textContent = (totalTurnaround / count).toFixed(2);
    document.getElementById('avgWaiting').textContent = (totalWaiting / count).toFixed(2);
    document.getElementById('avgResponse').textContent = (totalResponse / count).toFixed(2);
    document.getElementById('avgPenalty').textContent = (totalPenalty / count).toFixed(2);
}

// Limpiar resultados
function clearResults() {
    document.getElementById('ganttChart').innerHTML = '';
    document.getElementById('ganttYAxis').innerHTML = '';
    document.getElementById('ganttXAxis').innerHTML = '';
    document.getElementById('metricsTableBody').innerHTML = '';
    document.getElementById('avgTurnaround').textContent = '-';
    document.getElementById('avgWaiting').textContent = '-';
    document.getElementById('avgResponse').textContent = '-';
    document.getElementById('avgPenalty').textContent = '-';
}

// Funciones para implementar algoritmos (estructura preparada)
// Estas funciones serán implementadas posteriormente

function runFCFS(processes) {
    // TODO: Implementar FCFS
    // Retornar: { schedule: [...], metrics: [...] }
}

function runSJF(processes) {
    // TODO: Implementar SJF
    // Retornar: { schedule: [...], metrics: [...] }
}

function runSRTF(processes) {
    // TODO: Implementar SRTF
    // Retornar: { schedule: [...], metrics: [...] }
}

function runRR(processes, quantum) {
    // TODO: Implementar Round Robin
    // Retornar: { schedule: [...], metrics: [...] }
}
