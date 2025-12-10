// Variables globales
const processes = [];

// Elementos del DOM
const addProcessBtn = document.getElementById('addProcessBtn');
const simulateBtn = document.getElementById('simulateBtn');
const processTableBody = document.getElementById('processTableBody');
const quantumInput = document.getElementById('quantum');

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

// Función de simulación Round Robin
function simulate() {
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
    
    const quantum = parseInt(quantumInput.value) || 3;
    const result = runRR(processes, quantum);
    
    console.log('Resultado de simulación RR:', result);
    
    renderGanttChart(result.processStates, result.dispatcherSegments);
    renderMetricsTable(result.metrics);
}

/**
 * Algoritmo Round Robin - Implementación estricta
 * 
 * Reglas:
 * 1. Cola FIFO de procesos listos
 * 2. Dispatcher (1 unidad) antes de cada ejecución
 * 3. Proceso ejecuta por quantum o hasta bloquearse/terminar
 * 4. Bloqueo ocurre cuando cpuTimeExecuted alcanza exactamente blockStart
 * 5. Proceso bloqueado va a cola de bloqueados
 * 6. Proceso con quantum expirado regresa al final de la cola de listos
 */
function runRR(processes, quantum) {
    const DISPATCHER_TIME = 1;
    const MAX_TIME = 1000;
    const n = processes.length;
    
    // Inicializar estados
    const processStates = processes.map(p => ({
        name: p.name,
        arrival: p.arrival,
        burst: p.burst,
        blockStart: p.blockStart,
        blockDuration: p.blockDuration,
        remainingBurst: p.burst,
        cpuTimeExecuted: 0,
        startTime: null,
        finishTime: null,
        segments: [],
        waitingStart: null,
        isBlocked: false,
        blockedUntil: null,
        isCompleted: false,
        hasBlocked: false,
        inReadyQueue: false,
        readyTime: null
    }));
    
    let currentTime = 0;
    let completed = 0;
    const readyQueue = [];
    const blockedQueue = [];
    const dispatcherSegments = [];

    // Inserta manteniendo el orden por instante en que el proceso quedó listo
    function enqueueReady(proc, readyTime) {
        proc.inReadyQueue = true;
        proc.readyTime = readyTime;
        if (proc.waitingStart === null) {
            proc.waitingStart = readyTime;
        }

        let inserted = false;
        for (let i = 0; i < readyQueue.length; i++) {
            if (readyQueue[i].readyTime > readyTime) {
                readyQueue.splice(i, 0, proc);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            readyQueue.push(proc);
        }
    }
    
    // Agregar procesos que llegaron
    function checkArrivals() {
        for (const p of processStates) {
            if (p.arrival <= currentTime && !p.inReadyQueue && !p.isCompleted && !p.isBlocked) {
                enqueueReady(p, p.arrival);
            }
        }
    }
    
    // Desbloquear procesos
    function checkUnblocked() {
        for (let i = blockedQueue.length - 1; i >= 0; i--) {
            const p = blockedQueue[i];
            if (p.blockedUntil <= currentTime) {
                p.isBlocked = false;
                const unblockTime = p.blockedUntil;
                p.blockedUntil = null;
                blockedQueue.splice(i, 1);
                
                enqueueReady(p, unblockTime);
            }
        }
    }
    
    // Obtener próximo evento
    function getNextEventTime() {
        const events = [];
        for (const p of processStates) {
            if (p.arrival > currentTime && !p.isCompleted && !p.isBlocked) {
                events.push(p.arrival);
            }
        }
        for (const p of blockedQueue) {
            events.push(p.blockedUntil);
        }
        return events.length > 0 ? Math.min(...events) : null;
    }
    
    // Bucle principal
    while (completed < n && currentTime < MAX_TIME) {
        // Procesar llegadas y desbloqueos
        checkArrivals();
        checkUnblocked();
        
        // Si no hay procesos listos, avanzar
        if (readyQueue.length === 0) {
            const nextEvent = getNextEventTime();
            if (nextEvent === null) break;
            currentTime = nextEvent;
            continue;
        }
        
        // DISPATCHER
        dispatcherSegments.push({
            start: currentTime,
            end: currentTime + DISPATCHER_TIME
        });
        currentTime += DISPATCHER_TIME;
        
        // Revisar eventos durante dispatcher
        checkArrivals();
        checkUnblocked();
        
        // Tomar proceso (FIFO)
        const proc = readyQueue.shift();
        proc.inReadyQueue = false;
        
        // Cerrar segmento de espera
        if (proc.waitingStart !== null && proc.waitingStart < currentTime) {
            proc.segments.push({
                type: 'waiting',
                start: proc.waitingStart,
                end: currentTime
            });
            proc.waitingStart = null;
        }
        
        // Tiempo de respuesta
        if (proc.startTime === null) {
            proc.startTime = currentTime;
        }
        
        // Calcular tiempo de ejecución
        let execTime = Math.min(quantum, proc.remainingBurst);
        let willBlock = false;

        // Bloqueo sólo si ocurre dentro de este turno (no acumulativo entre cuantums)
        if (proc.blockDuration > 0 && !proc.hasBlocked && proc.blockStart > 0) {
            if (proc.blockStart <= execTime) {
                execTime = proc.blockStart;
                willBlock = true;
            }
        }
        
        // Ejecutar
        const execStart = currentTime;
        const execEnd = currentTime + execTime;
        
        proc.segments.push({
            type: 'executing',
            start: execStart,
            end: execEnd
        });
        
        proc.remainingBurst -= execTime;
        proc.cpuTimeExecuted += execTime;
        currentTime = execEnd;
        
        // Determinar siguiente estado
        if (willBlock) {
            // Bloquear
            proc.isBlocked = true;
            proc.hasBlocked = true;
            proc.blockedUntil = currentTime + proc.blockDuration;
            blockedQueue.push(proc);
            
            proc.segments.push({
                type: 'blocked',
                start: currentTime,
                end: proc.blockedUntil
            });
            
        } else if (proc.remainingBurst <= 0) {
            // Terminó
            proc.isCompleted = true;
            proc.finishTime = currentTime;
            completed++;
            
        } else {
            // Quantum expirado
            enqueueReady(proc, currentTime);
        }
    }

    // Dispatcher final para representar el retorno a inactivo (alineado con ejemplos)
    if (dispatcherSegments.length > 0) {
        dispatcherSegments.push({
            start: currentTime,
            end: currentTime + DISPATCHER_TIME
        });
    }
    
    // Calcular métricas
    const metrics = processStates.map(p => {
        const waitingTime = p.segments
            .filter(seg => seg.type === 'waiting')
            .reduce((sum, seg) => sum + (seg.end - seg.start), 0);
        
        const turnaroundTime = p.finishTime - p.arrival;
        const responseTime = p.startTime - p.arrival;
        const penalty = p.burst > 0 ? turnaroundTime / p.burst : 0;
        const lostTime = turnaroundTime - p.burst;
        
        return {
            process: p.name,
            arrival: p.arrival,
            burst: p.burst,
            completion: p.finishTime,
            turnaround: turnaroundTime,
            waiting: waitingTime,
            response: responseTime,
            penalty: penalty,
            lostTime: lostTime
        };
    });
    
    console.log('Tiempos de finalización:', processStates.map(p => `${p.name}=${p.finishTime}`).join(', '));
    console.log('Dispatcher:', dispatcherSegments.map(s => `{${s.start}-${s.end}}`).join(', '));
    
    return { processStates, metrics, dispatcherSegments };
}

// Renderizar diagrama de Gantt
function renderGanttChart(processStates, dispatcherSegments = []) {
    const ganttChart = document.getElementById('ganttChart');
    const ganttYAxis = document.getElementById('ganttYAxis');
    const ganttXAxis = document.getElementById('ganttXAxis');
    
    ganttChart.innerHTML = '';
    ganttYAxis.innerHTML = '';
    ganttXAxis.innerHTML = '';
    
    if (!processStates || processStates.length === 0) {
        ganttChart.innerHTML = '<p>No hay datos para mostrar</p>';
        return;
    }
    
    const processMax = Math.max(...processStates.map(p => 
        p.segments.length > 0 ? Math.max(...p.segments.map(s => s.end)) : 0
    ));
    const dispatcherMax = dispatcherSegments.length > 0
        ? Math.max(...dispatcherSegments.map(s => s.end))
        : 0;
    const maxTime = Math.max(processMax, dispatcherMax);
    const pixelsPerUnit = 30;
    
    // Etiquetas eje Y
    for (let i = processStates.length - 1; i >= 0; i--) {
        const label = document.createElement('div');
        label.className = 'gantt-y-label';
        label.textContent = processStates[i].name;
        ganttYAxis.appendChild(label);
    }
    
    const dispatcherLabel = document.createElement('div');
    dispatcherLabel.className = 'gantt-y-label';
    dispatcherLabel.textContent = 'Dispatcher';
    dispatcherLabel.style.fontStyle = 'italic';
    dispatcherLabel.style.color = '#666';
    ganttYAxis.appendChild(dispatcherLabel);
    
    // Filas de procesos
    for (let i = processStates.length - 1; i >= 0; i--) {
        const pState = processStates[i];
        const row = document.createElement('div');
        row.className = 'gantt-row';
        row.style.width = `${maxTime * pixelsPerUnit}px`;
        
        pState.segments.forEach(seg => {
            const bar = document.createElement('div');
            const duration = seg.end - seg.start;
            
            if (seg.type === 'executing') {
                bar.className = `gantt-bar process-${pState.name.toLowerCase()}`;
                bar.textContent = pState.name;
            } else if (seg.type === 'blocked') {
                bar.className = `gantt-bar gantt-blocked`;
                bar.textContent = 'I/O';
                bar.style.opacity = '0.8';
                bar.style.background = 'repeating-linear-gradient(45deg, #f44336, #f44336 5px, #ff6b6b 5px, #ff6b6b 10px)';
                bar.style.color = 'white';
                bar.style.fontWeight = 'bold';
            } else if (seg.type === 'waiting') {
                bar.className = `gantt-bar gantt-waiting`;
                bar.textContent = 'Espera';
                bar.style.opacity = '0.7';
                bar.style.background = '#e0e0e0';
                bar.style.border = '1px dashed #999';
                bar.style.color = '#666';
                bar.style.fontSize = '10px';
            }
            
            bar.style.left = `${seg.start * pixelsPerUnit}px`;
            bar.style.width = `${duration * pixelsPerUnit}px`;
            bar.title = `${pState.name} - ${seg.type}: ${seg.start}-${seg.end}`;
            row.appendChild(bar);
        });
        
        ganttChart.appendChild(row);
    }
    
    // Fila dispatcher
    const dispatcherRow = document.createElement('div');
    dispatcherRow.className = 'gantt-row';
    dispatcherRow.style.width = `${maxTime * pixelsPerUnit}px`;
    dispatcherRow.style.background = '#f9f9f9';
    dispatcherRow.style.position = 'relative';
    
    dispatcherSegments.forEach(seg => {
        const bar = document.createElement('div');
        bar.className = 'gantt-bar gantt-dispatcher';
        bar.style.position = 'absolute';
        bar.style.left = `${seg.start * pixelsPerUnit}px`;
        bar.style.width = `${(seg.end - seg.start) * pixelsPerUnit}px`;
        bar.style.height = '100%';
        bar.style.display = 'flex';
        bar.style.alignItems = 'center';
        bar.style.justifyContent = 'center';
        bar.style.fontSize = '13px';
        bar.textContent = 'D';
        bar.title = `Dispatcher: ${seg.start}-${seg.end}`;
        dispatcherRow.appendChild(bar);
    });
    
    ganttChart.appendChild(dispatcherRow);
    
    // Eje X
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${metric.process}</td>
            <td>${metric.burst}</td>
            <td>${metric.waiting.toFixed(2)}</td>
            <td>${metric.completion}</td>
            <td>${metric.turnaround}</td>
            <td>${metric.lostTime}</td>
            <td>${metric.penalty.toFixed(2)}</td>
            <td>${metric.response}</td>
        `;
        metricsTableBody.appendChild(row);
        
        totalTurnaround += metric.turnaround;
        totalWaiting += metric.waiting;
        totalResponse += metric.response;
        totalPenalty += metric.penalty;
        totalLostTime += metric.lostTime;
    });
    
    const count = metrics.length;
    document.getElementById('avgWaiting').textContent = (totalWaiting / count).toFixed(2);
    document.getElementById('avgTurnaround').textContent = (totalTurnaround / count).toFixed(2);
    document.getElementById('avgLostTime').textContent = (totalLostTime / count).toFixed(2);
    document.getElementById('avgPenalty').textContent = (totalPenalty / count).toFixed(2);
    document.getElementById('avgResponse').textContent = (totalResponse / count).toFixed(2);
}
