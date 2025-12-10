// Variables globales
const processes = [];

// Elementos del DOM
const addProcessBtn = document.getElementById('addProcessBtn');
const simulateBtn = document.getElementById('simulateBtn');
const processTableBody = document.getElementById('processTableBody');

// Event listeners
addProcessBtn.addEventListener('click', () => {
    addProcess();
});

simulateBtn.addEventListener('click', () => {
    simulate();
});

// Funciones de gestión de procesos
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
        <td><input type="number" class="block-start" min="0" value="0"></td>
        <td><input type="number" class="block-duration" min="0" value="0"></td>
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

// Función de simulación SJF
function simulate() {
    // Recolectar datos de entrada
    const rows = processTableBody.querySelectorAll('tr');
    processes.length = 0;
    
    rows.forEach(row => {
        const processName = row.dataset.process;
        const arrivalTime = parseInt(row.querySelector('.arrival-time').value) || 0;
        const burstTime = parseInt(row.querySelector('.burst-time').value) || 1;
        const blockStart = parseInt(row.querySelector('.block-start').value) || 0;
        const blockDuration = parseInt(row.querySelector('.block-duration').value) || 0;
        
        processes.push({
            name: processName,
            arrival: arrivalTime,
            burst: burstTime,
            blockStart: blockStart,
            blockDuration: blockDuration
        });
    });
    
    // Ejecutar algoritmo SJF
    const result = runSJF(processes);
    
    // Mostrar resultados
    renderGanttChart(result.schedule);
    renderMetricsTable(result.metrics);
}

// Implementación del algoritmo SJF (no preemptive) con bloqueos
function runSJF(processes) {
    const schedule = [];
    const metrics = [];
    const n = processes.length;
    const processInfo = processes.map(p => ({
        ...p,
        executedTime: 0,
        startTime: -1,
        completionTime: 0,
        completed: false,
        blocked: false,
        blockEndTime: 0
    }));
    let currentTime = 0;
    let completed = 0;
    const blockedQueue = [];
    
    while (completed < n || blockedQueue.length > 0) {
        // Verificar procesos bloqueados que ya pueden volver
        for (let i = blockedQueue.length - 1; i >= 0; i--) {
            if (currentTime >= blockedQueue[i].blockEndTime) {
                const unblockedProcess = blockedQueue.splice(i, 1)[0];
                unblockedProcess.blocked = false;
            }
        }
        
        // Encontrar procesos disponibles
        const available = processInfo.filter(p => 
            !p.completed && 
            !p.blocked && 
            p.arrival <= currentTime
        );
        
        if (available.length === 0) {
            // Avanzar al siguiente evento
            const nextEvents = [];
            const notCompleted = processInfo.filter(p => !p.completed);
            if (notCompleted.length > 0) {
                const nextArrival = Math.min(...notCompleted.filter(p => p.executedTime === 0).map(p => p.arrival));
                if (isFinite(nextArrival)) nextEvents.push(nextArrival);
            }
            if (blockedQueue.length > 0) {
                nextEvents.push(Math.min(...blockedQueue.map(p => p.blockEndTime)));
            }
            if (nextEvents.length === 0) break;
            currentTime = Math.min(...nextEvents);
            continue;
        }
        
        // Seleccionar proceso con menor burst time restante
        available.sort((a, b) => {
            const remainingA = a.burst - a.executedTime;
            const remainingB = b.burst - b.executedTime;
            if (remainingA !== remainingB) {
                return remainingA - remainingB;
            }
            return a.name.localeCompare(b.name);
        });
        
        const currentProcess = available[0];
        
        // Registrar tiempo de inicio
        if (currentProcess.startTime === -1) {
            currentProcess.startTime = currentTime;
        }
        
        // Ejecutar proceso hasta completar o hasta bloqueo
        const remainingTime = currentProcess.burst - currentProcess.executedTime;
        const hasBlock = currentProcess.blockDuration > 0 && 
                        currentProcess.blockStart > currentProcess.executedTime &&
                        currentProcess.blockStart <= currentProcess.burst;
        
        let executeTime;
        if (hasBlock) {
            executeTime = currentProcess.blockStart - currentProcess.executedTime;
        } else {
            executeTime = remainingTime;
        }
        
        const startTime = currentTime;
        const endTime = currentTime + executeTime;
        
        // Agregar al schedule
        schedule.push({
            process: currentProcess.name,
            start: startTime,
            end: endTime
        });
        
        currentProcess.executedTime += executeTime;
        currentTime = endTime;
        
        // Verificar si se bloqueó
        if (hasBlock && currentProcess.executedTime === currentProcess.blockStart) {
            currentProcess.blocked = true;
            currentProcess.blockEndTime = currentTime + currentProcess.blockDuration;
            blockedQueue.push(currentProcess);
        }
        
        // Verificar si se completó
        if (currentProcess.executedTime >= currentProcess.burst) {
            currentProcess.completionTime = currentTime;
            currentProcess.completed = true;
            completed++;
        }
    }
    
    // Calcular métricas
    processInfo.forEach(p => {
        const turnaroundTime = p.completionTime - p.arrival;
        const waitingTime = turnaroundTime - p.burst - (p.blockDuration || 0);
        const responseTime = p.startTime - p.arrival;
        const penalty = turnaroundTime / p.burst;
        
        metrics.push({
            process: p.name,
            arrival: p.arrival,
            burst: p.burst,
            completion: p.completionTime,
            turnaround: turnaroundTime,
            waiting: waitingTime,
            response: responseTime,
            penalty: penalty
        });
    });
    
    return { schedule, metrics };
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
    const pixelsPerUnit = 30;
    
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
    let totalLostTime = 0;
    
    metrics.forEach(metric => {
        const lostTime = metric.turnaround - metric.burst;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${metric.process}</td>
            <td>${metric.burst}</td>
            <td>${metric.waiting}</td>
            <td>${metric.completion}</td>
            <td>${metric.turnaround}</td>
            <td>${lostTime}</td>
            <td>${metric.penalty.toFixed(2)}</td>
            <td>${metric.response}</td>
        `;
        metricsTableBody.appendChild(row);
        
        totalTurnaround += metric.turnaround;
        totalWaiting += metric.waiting;
        totalResponse += metric.response;
        totalPenalty += metric.penalty;
        totalLostTime += lostTime;
    });
    
    // Calcular promedios
    const count = metrics.length;
    document.getElementById('avgWaiting').textContent = (totalWaiting / count).toFixed(2);
    document.getElementById('avgTurnaround').textContent = (totalTurnaround / count).toFixed(2);
    document.getElementById('avgLostTime').textContent = (totalLostTime / count).toFixed(2);
    document.getElementById('avgPenalty').textContent = (totalPenalty / count).toFixed(2);
    document.getElementById('avgResponse').textContent = (totalResponse / count).toFixed(2);
}
