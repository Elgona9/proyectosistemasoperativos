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

// Función de simulación FCFS
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
        
        // Preparar estructura de bloqueos
        const blocks = [];
        if (blockDuration > 0 && blockStart > 0) {
            blocks.push({
                start: blockStart,
                duration: blockDuration
            });
        }
        
        processes.push({
            pid: processName,
            arrival: arrivalTime,
            burst: burstTime,
            blocks: blocks
        });
    });
    
    // Ejecutar algoritmo FCFS con motor completo
    const result = runFCFSEngine(processes, 0); // context_switch = 0
    
    console.log('Resultado de simulación:', result);
    
    // Mostrar resultados
    renderGanttChart(result.gantt, result.processes);
    renderMetricsTable(result.processes, result);
}

// Motor de simulación FCFS completo
function runFCFSEngine(processes, context_switch = 0, max_time = 10000) {
    // Validar entradas
    const validatedProcesses = validateProcesses(processes);
    if (validatedProcesses.errors.length > 0) {
        console.error('Errores de validación:', validatedProcesses.errors);
    }
    
    // Ordenar por tiempo de llegada (FCFS)
    const sortedProcesses = [...validatedProcesses.processes].sort((a, b) => {
        if (a.arrival !== b.arrival) return a.arrival - b.arrival;
        return a.pid.localeCompare(b.pid);
    });
    
    // Estado de la simulación
    let currentTime = 0;
    const gantt = [];
    const logs = [];
    const processStates = sortedProcesses.map(p => ({
        ...p,
        remainingBurst: p.burst,
        executedTime: 0, // Tiempo de CPU ejecutado (sin contar bloqueos)
        startTime: null,
        finishTime: null,
        segments: [],
        waitingStart: null, // Marca inicio de espera
        blockedUntil: null,
        isBlocked: false,
        isCompleted: false,
        appliedBlocks: [],
        hasArrived: false
    }));
    
    const readyQueue = [];
    const blockedQueue = [];
    let currentProcess = null;
    
    logs.push({ time: 0, event: 'Simulation started', details: `${sortedProcesses.length} processes` });
    
    while (currentTime < max_time) {
        // 1. Desbloquear procesos cuyo bloqueo terminó PRIMERO
        for (let i = blockedQueue.length - 1; i >= 0; i--) {
            const pState = blockedQueue[i];
            if (currentTime >= pState.blockedUntil) {
                pState.isBlocked = false;
                pState.blockedUntil = null;
                blockedQueue.splice(i, 1);
                
                // Cerrar segmento de bloqueo
                const lastSeg = pState.segments[pState.segments.length - 1];
                if (lastSeg && lastSeg.type === 'blocked') {
                    lastSeg.end = currentTime;
                }
                
                // Insertar en cola según orden FCFS (arrival time)
                // Los procesos que llegaron primero van primero
                let insertIndex = readyQueue.findIndex(p => p.arrival > pState.arrival);
                if (insertIndex === -1) {
                    readyQueue.push(pState);
                } else {
                    readyQueue.splice(insertIndex, 0, pState);
                }
                
                pState.waitingStart = currentTime;
                logs.push({ time: currentTime, event: 'Process unblocked', pid: pState.pid });
            }
        }
        
        // 2. Agregar procesos que llegaron a la cola de listos
        processStates.forEach(pState => {
            if (pState.arrival <= currentTime && 
                !pState.hasArrived &&
                !pState.isCompleted && 
                !pState.isBlocked) {
                
                pState.hasArrived = true;
                
                // Si no es el proceso actual, agregarlo a la cola
                if (currentProcess !== pState) {
                    readyQueue.push(pState);
                    pState.waitingStart = pState.arrival; // Espera desde su llegada
                    logs.push({ time: currentTime, event: 'Process arrived', pid: pState.pid });
                }
            }
        });
        
        // 3. Si no hay proceso ejecutando, tomar uno de la cola
        if (currentProcess === null && readyQueue.length > 0) {
            currentProcess = readyQueue.shift();
            
            // Cerrar segmento de espera si había uno
            if (currentProcess.waitingStart !== null && currentProcess.waitingStart < currentTime) {
                currentProcess.segments.push({
                    type: 'waiting',
                    start: currentProcess.waitingStart,
                    end: currentTime
                });
                currentProcess.waitingStart = null;
            }
            
            // Marcar tiempo de inicio si es la primera vez
            if (currentProcess.startTime === null) {
                currentProcess.startTime = currentTime;
                logs.push({ time: currentTime, event: 'Process first start', pid: currentProcess.pid });
            } else {
                logs.push({ time: currentTime, event: 'Process resumed', pid: currentProcess.pid });
            }
        }
        
        // 4. Si no hay proceso ejecutando ni en cola, avanzar al siguiente evento
        if (currentProcess === null) {
            const nextEvents = [];
            
            // Próximo proceso que llega
            const notArrived = processStates.filter(p => p.arrival > currentTime && !p.isCompleted);
            if (notArrived.length > 0) {
                nextEvents.push(Math.min(...notArrived.map(p => p.arrival)));
            }
            
            // Próximo desbloqueo
            if (blockedQueue.length > 0) {
                nextEvents.push(Math.min(...blockedQueue.map(p => p.blockedUntil)));
            }
            
            if (nextEvents.length === 0) break; // Simulación terminada
            
            const nextTime = Math.min(...nextEvents);
            
            // Agregar tiempo idle al gantt
            if (nextTime > currentTime) {
                gantt.push({
                    type: 'idle',
                    start: currentTime,
                    end: nextTime
                });
            }
            
            currentTime = nextTime;
            continue;
        }
        
        // 5. Ejecutar el proceso actual
        // Determinar si hay un bloqueo pendiente (en tiempo de CPU ejecutado)
        let willBlock = false;
        let blockInfo = null;
        let executeTime = currentProcess.remainingBurst;
        
        for (const block of currentProcess.blocks) {
            // block.start está en términos de tiempo de CPU ejecutado
            if (block.start > currentProcess.executedTime && 
                block.start <= currentProcess.executedTime + executeTime &&
                !currentProcess.appliedBlocks.includes(block)) {
                
                const timeUntilBlock = block.start - currentProcess.executedTime;
                if (timeUntilBlock < executeTime) {
                    executeTime = timeUntilBlock;
                    willBlock = true;
                    blockInfo = block;
                    break;
                }
            }
        }
        
        // Ejecutar
        const execStart = currentTime;
        const execEnd = currentTime + executeTime;
        
        currentProcess.segments.push({
            type: 'executing',
            start: execStart,
            end: execEnd
        });
        
        gantt.push({
            type: 'cpu',
            start: execStart,
            end: execEnd,
            pid: currentProcess.pid
        });
        
        currentProcess.remainingBurst -= executeTime;
        currentProcess.executedTime += executeTime;
        currentTime = execEnd;
        
        logs.push({ 
            time: execEnd, 
            event: 'Process executed', 
            pid: currentProcess.pid, 
            executed: executeTime,
            remaining: currentProcess.remainingBurst,
            totalExecuted: currentProcess.executedTime
        });
        
        // 6. Verificar estado del proceso después de ejecutar
        
        // 6a. Se bloqueó
        if (willBlock && blockInfo) {
            currentProcess.isBlocked = true;
            currentProcess.blockedUntil = currentTime + blockInfo.duration;
            currentProcess.appliedBlocks.push(blockInfo);
            blockedQueue.push(currentProcess);
            
            currentProcess.segments.push({
                type: 'blocked',
                start: currentTime,
                end: currentProcess.blockedUntil
            });
            
            logs.push({ 
                time: currentTime, 
                event: 'Process blocked (I/O)', 
                pid: currentProcess.pid,
                until: currentProcess.blockedUntil,
                duration: blockInfo.duration
            });
            
            // Liberar CPU - el proceso bloqueado cede la CPU
            currentProcess = null;
            
            if (context_switch > 0) {
                gantt.push({
                    type: 'context_switch',
                    start: currentTime,
                    end: currentTime + context_switch
                });
                currentTime += context_switch;
            }
        }
        // 6b. Terminó
        else if (currentProcess.remainingBurst <= 0) {
            currentProcess.isCompleted = true;
            currentProcess.finishTime = currentTime;
            logs.push({ time: currentTime, event: 'Process completed', pid: currentProcess.pid });
            
            // Liberar CPU
            currentProcess = null;
            
            if (context_switch > 0 && (readyQueue.length > 0 || blockedQueue.length > 0)) {
                gantt.push({
                    type: 'context_switch',
                    start: currentTime,
                    end: currentTime + context_switch
                });
                currentTime += context_switch;
            }
        }
        
        // Verificar si todos terminaron
        if (processStates.every(p => p.isCompleted)) {
            logs.push({ time: currentTime, event: 'All processes completed' });
            break;
        }
    }
    
    // Cerrar segmentos de espera abiertos
    processStates.forEach(p => {
        if (p.waitingStart !== null && !p.isCompleted) {
            p.segments.push({
                type: 'waiting',
                start: p.waitingStart,
                end: currentTime
            });
        }
    });
    
    // Calcular métricas finales
    const totalTime = currentTime;
    const results = processStates.map(p => {
        const blockedTime = p.appliedBlocks.reduce((sum, b) => sum + b.duration, 0);
        const turnaround = p.finishTime !== null ? p.finishTime - p.arrival : null;
        const responseTime = p.startTime !== null ? p.startTime - p.arrival : null;
        const waitingTime = turnaround !== null ? Math.max(0, turnaround - p.burst - blockedTime) : null;
        const lostTime = turnaround !== null ? turnaround - p.burst : null;
        const penalty = turnaround !== null && p.burst > 0 ? turnaround / p.burst : null;
        
        return {
            pid: p.pid,
            arrival: p.arrival,
            burst: p.burst,
            blocked_time: blockedTime,
            start_time: p.startTime,
            finish_time: p.finishTime,
            turnaround: turnaround,
            response_time: responseTime,
            waiting_time: waitingTime,
            lost_time: lostTime,
            penalty: penalty,
            segments: p.segments
        };
    });
    
    // Métricas globales
    const completedProcesses = results.filter(p => p.finish_time !== null);
    const avgTurnaround = completedProcesses.length > 0 
        ? completedProcesses.reduce((sum, p) => sum + p.turnaround, 0) / completedProcesses.length 
        : 0;
    const avgWaiting = completedProcesses.length > 0
        ? completedProcesses.reduce((sum, p) => sum + p.waiting_time, 0) / completedProcesses.length
        : 0;
    const avgResponse = completedProcesses.length > 0
        ? completedProcesses.reduce((sum, p) => sum + p.response_time, 0) / completedProcesses.length
        : 0;
    const avgPenalty = completedProcesses.length > 0
        ? completedProcesses.reduce((sum, p) => sum + p.penalty, 0) / completedProcesses.length
        : 0;
    
    const totalCpuTime = gantt.filter(g => g.type === 'cpu').reduce((sum, g) => sum + (g.end - g.start), 0);
    const cpuUtilization = totalTime > 0 ? totalCpuTime / totalTime : 0;
    
    return {
        processes: results,
        gantt: gantt,
        cpu_utilization: cpuUtilization,
        average_turnaround: avgTurnaround,
        average_waiting: avgWaiting,
        average_response: avgResponse,
        average_penalty: avgPenalty,
        total_time: totalTime,
        logs: logs
    };
}

// Validar procesos de entrada
function validateProcesses(processes) {
    const errors = [];
    const validatedProcesses = [];
    
    processes.forEach((p, idx) => {
        const validated = { ...p };
        
        // Validar arrival
        if (typeof p.arrival !== 'number' || p.arrival < 0) {
            errors.push(`Process ${p.pid || idx}: arrival debe ser >= 0`);
            validated.arrival = 0;
        }
        
        // Validar burst
        if (typeof p.burst !== 'number' || p.burst <= 0) {
            errors.push(`Process ${p.pid || idx}: burst debe ser > 0`);
            validated.burst = 1;
        }
        
        // Validar blocks
        if (!validated.blocks) validated.blocks = [];
        validated.blocks = validated.blocks.filter(block => {
            if (typeof block.start !== 'number' || block.start < 0) {
                errors.push(`Process ${p.pid || idx}: block start debe ser >= 0`);
                return false;
            }
            if (typeof block.duration !== 'number' || block.duration < 0) {
                errors.push(`Process ${p.pid || idx}: block duration debe ser >= 0`);
                return false;
            }
            if (block.start >= validated.burst) {
                errors.push(`Process ${p.pid || idx}: block start ${block.start} >= burst ${validated.burst}, ignorado`);
                return false;
            }
            return true;
        });
        
        validatedProcesses.push(validated);
    });
    
    return { processes: validatedProcesses, errors };
}

// Renderizar diagrama de Gantt
function renderGanttChart(gantt, processesData) {
    const ganttChart = document.getElementById('ganttChart');
    const ganttYAxis = document.getElementById('ganttYAxis');
    const ganttXAxis = document.getElementById('ganttXAxis');
    
    // Limpiar contenido previo
    ganttChart.innerHTML = '';
    ganttYAxis.innerHTML = '';
    ganttXAxis.innerHTML = '';
    
    if (gantt.length === 0) return;
    
    // Obtener procesos únicos y tiempo máximo
    const uniqueProcesses = [...new Set(processesData.map(p => p.pid))];
    // INVERTIR ORDEN: mostrar desde F hasta A (A abajo, F arriba)
    uniqueProcesses.sort().reverse();
    
    const maxTime = Math.max(...gantt.map(g => g.end));
    const pixelsPerUnit = 30;
    
    // Crear etiquetas del eje Y
    uniqueProcesses.forEach(pid => {
        const label = document.createElement('div');
        label.className = 'gantt-y-label';
        label.textContent = pid;
        ganttYAxis.appendChild(label);
    });
    
    // Crear filas del diagrama de Gantt
    uniqueProcesses.forEach(pid => {
        const row = document.createElement('div');
        row.className = 'gantt-row';
        row.style.width = `${maxTime * pixelsPerUnit}px`;
        
        // Obtener segmentos del proceso
        const processData = processesData.find(p => p.pid === pid);
        if (processData && processData.segments) {
            processData.segments.forEach(segment => {
                const bar = document.createElement('div');
                const duration = segment.end - segment.start;
                
                // Determinar clase según tipo de segmento
                if (segment.type === 'executing') {
                    bar.className = `gantt-bar process-${pid.toLowerCase()}`;
                    bar.textContent = pid;
                } else if (segment.type === 'blocked') {
                    bar.className = `gantt-bar gantt-blocked`;
                    bar.textContent = 'I/O';
                    bar.style.opacity = '0.8';
                    bar.style.background = 'repeating-linear-gradient(45deg, #f44336, #f44336 5px, #ff6b6b 5px, #ff6b6b 10px)';
                    bar.style.color = 'white';
                    bar.style.fontWeight = 'bold';
                } else if (segment.type === 'waiting') {
                    bar.className = `gantt-bar gantt-waiting`;
                    bar.textContent = 'Espera';
                    bar.style.opacity = '0.7';
                    bar.style.background = '#e0e0e0';
                    bar.style.border = '1px dashed #999';
                    bar.style.color = '#666';
                    bar.style.fontSize = '10px';
                }
                
                bar.style.left = `${segment.start * pixelsPerUnit}px`;
                bar.style.width = `${duration * pixelsPerUnit}px`;
                bar.title = `${pid} - ${segment.type}: ${segment.start}-${segment.end}`;
                row.appendChild(bar);
            });
        }
        
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
function renderMetricsTable(processesData, summaryData) {
    const metricsTableBody = document.getElementById('metricsTableBody');
    metricsTableBody.innerHTML = '';
    
    processesData.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.pid}</td>
            <td>${p.burst}</td>
            <td>${p.waiting_time !== null ? p.waiting_time : '-'}</td>
            <td>${p.finish_time !== null ? p.finish_time : '-'}</td>
            <td>${p.turnaround !== null ? p.turnaround : '-'}</td>
            <td>${p.lost_time !== null ? p.lost_time : '-'}</td>
            <td>${p.penalty !== null ? p.penalty.toFixed(2) : '-'}</td>
            <td>${p.response_time !== null ? p.response_time : '-'}</td>
        `;
        metricsTableBody.appendChild(row);
    });
    
    // Calcular promedios
    const completedProcesses = processesData.filter(p => p.finish_time !== null);
    const avgLostTime = completedProcesses.length > 0
        ? completedProcesses.reduce((sum, p) => sum + p.lost_time, 0) / completedProcesses.length
        : 0;
    
    document.getElementById('avgWaiting').textContent = summaryData.average_waiting.toFixed(2);
    document.getElementById('avgTurnaround').textContent = summaryData.average_turnaround.toFixed(2);
    document.getElementById('avgLostTime').textContent = avgLostTime.toFixed(2);
    document.getElementById('avgPenalty').textContent = summaryData.average_penalty.toFixed(2);
    document.getElementById('avgResponse').textContent = summaryData.average_response.toFixed(2);
}
