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

// Función de simulación SRTF
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
    
    // Ejecutar algoritmo SRTF
    const result = runSRTF(processes);
    
    // Mostrar resultados
    renderGanttChart(result.schedule);
    renderMetricsTable(result.metrics);
}

// Implementación del algoritmo SRTF (Shortest Remaining Time First - preemptive) con bloqueos
function runSRTF(processes) {
    const schedule = [];
    const n = processes.length;
    const remaining = processes.map(p => ({
        ...p,
        remainingTime: p.burst,
        startTime: -1,
        completionTime: 0,
        executedTime: 0,
        blocked: false,
        blockEndTime: 0,
        hasBlocked: false
    }));
    
    let currentTime = 0;
    let completed = 0;
    let lastProcess = null;
    const maxTime = Math.max(...processes.map(p => p.arrival)) + processes.reduce((sum, p) => sum + p.burst + p.blockDuration, 0);
    const blockedQueue = [];
    
    while (completed < n && currentTime < maxTime) {
        // Verificar procesos bloqueados que pueden volver
        for (let i = blockedQueue.length - 1; i >= 0; i--) {
            if (currentTime >= blockedQueue[i].blockEndTime) {
                const unblockedProcess = blockedQueue.splice(i, 1)[0];
                unblockedProcess.blocked = false;
            }
        }
        
        // Encontrar procesos disponibles
        const available = remaining.filter(p => 
            p.arrival <= currentTime && 
            p.remainingTime > 0 && 
            !p.blocked
        );
        
        if (available.length === 0) {
            // Avanzar al siguiente evento
            const nextEvents = [];
            const notCompleted = remaining.filter(p => p.remainingTime > 0);
            if (notCompleted.length > 0) {
                const arrivals = notCompleted.filter(p => p.arrival > currentTime).map(p => p.arrival);
                if (arrivals.length > 0) nextEvents.push(Math.min(...arrivals));
            }
            if (blockedQueue.length > 0) {
                nextEvents.push(Math.min(...blockedQueue.map(p => p.blockEndTime)));
            }
            if (nextEvents.length === 0) break;
            currentTime = Math.min(...nextEvents);
            lastProcess = null;
            continue;
        }
        
        // Seleccionar el proceso con menor tiempo restante
        available.sort((a, b) => {
            if (a.remainingTime !== b.remainingTime) {
                return a.remainingTime - b.remainingTime;
            }
            if (a.arrival !== b.arrival) {
                return a.arrival - b.arrival;
            }
            return a.name.localeCompare(b.name);
        });
        
        const selectedProcess = available[0];
        const processIndex = remaining.findIndex(p => p.name === selectedProcess.name);
        
        // Registrar el primer tiempo de ejecución (para response time)
        if (remaining[processIndex].startTime === -1) {
            remaining[processIndex].startTime = currentTime;
        }
        
        // Verificar si tiene bloqueo pendiente
        const hasBlockPending = remaining[processIndex].blockDuration > 0 && 
                               !remaining[processIndex].hasBlocked &&
                               remaining[processIndex].executedTime < remaining[processIndex].blockStart;
        
        let executeTime = 1;
        if (hasBlockPending) {
            const timeUntilBlock = remaining[processIndex].blockStart - remaining[processIndex].executedTime;
            if (timeUntilBlock <= 1) {
                executeTime = timeUntilBlock;
            }
        }
        
        // Si es un proceso diferente o es el primero, crear un nuevo segmento
        if (lastProcess !== selectedProcess.name) {
            schedule.push({
                process: selectedProcess.name,
                start: currentTime,
                end: currentTime + executeTime
            });
            lastProcess = selectedProcess.name;
        } else {
            // Extender el segmento actual
            schedule[schedule.length - 1].end = currentTime + executeTime;
        }
        
        // Ejecutar
        remaining[processIndex].remainingTime -= executeTime;
        remaining[processIndex].executedTime += executeTime;
        currentTime += executeTime;
        
        // Verificar si se bloqueó
        if (hasBlockPending && remaining[processIndex].executedTime === remaining[processIndex].blockStart) {
            remaining[processIndex].blocked = true;
            remaining[processIndex].hasBlocked = true;
            remaining[processIndex].blockEndTime = currentTime + remaining[processIndex].blockDuration;
            blockedQueue.push(remaining[processIndex]);
            lastProcess = null;
        }
        
        // Si el proceso se completó
        if (remaining[processIndex].remainingTime === 0) {
            remaining[processIndex].completionTime = currentTime;
            completed++;
            lastProcess = null;
        }
    }
    
    // Calcular métricas
    const metrics = remaining.map(p => {
        const turnaroundTime = p.completionTime - p.arrival;
        const waitingTime = turnaroundTime - p.burst - (p.blockDuration || 0);
        const responseTime = p.startTime - p.arrival;
        const penalty = turnaroundTime / p.burst;
        
        return {
            process: p.name,
            arrival: p.arrival,
            burst: p.burst,
            completion: p.completionTime,
            turnaround: turnaroundTime,
            waiting: waitingTime,
            response: responseTime,
            penalty: penalty
        };
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
