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
    
    // Ejecutar algoritmo SRTF
    const result = runSRTFEngine(processes, 0); // context_switch = 0
    
    console.log('Resultado de simulación SRTF:', result);
    console.log('Logs de ejecución:', result.logs);
    
    // Mostrar segmentos de cada proceso
    result.processes.forEach(p => {
        console.log(`\nProceso ${p.pid}:`);
        console.log(`  Segments:`, p.segments);
    });
    
    // Mostrar resultados
    renderGanttChart(result.gantt, result.processes);
    renderMetricsTable(result.processes, result);
}

// Motor de simulación SRTF completo (Shortest Remaining Time First - Preemptive)
function runSRTFEngine(processes, context_switch = 0, max_time = 10000) {
    // Validar entradas
    const validatedProcesses = validateProcesses(processes);
    if (validatedProcesses.errors.length > 0) {
        console.error('Errores de validación:', validatedProcesses.errors);
    }
    
    // Estado de la simulación
    let currentTime = 0;
    const gantt = [];
    const logs = [];
    const processStates = validatedProcesses.processes.map(p => ({
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
    
    logs.push({ time: 0, event: 'Simulation started', details: `${validatedProcesses.processes.length} processes` });
    
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
                
                // Agregar a la cola de listos y marcar inicio de espera
                pState.waitingStart = currentTime;
                readyQueue.push(pState);
                
                logs.push({
                    time: currentTime,
                    event: 'Process unblocked',
                    pid: pState.pid,
                    remainingBurst: pState.remainingBurst
                });
            }
        }
        
        // 2. Procesar llegadas de nuevos procesos
        processStates.forEach(pState => {
            if (!pState.hasArrived && pState.arrival <= currentTime) {
                pState.hasArrived = true;
                pState.waitingStart = currentTime; // Marcar inicio de espera
                readyQueue.push(pState);
                logs.push({ time: currentTime, event: 'Process arrived', pid: pState.pid });
            }
        });
        
        // 3. Si no hay proceso en ejecución, seleccionar uno de la cola (con SRTF)
        if (!currentProcess) {
            const availableProcesses = readyQueue.filter(p => !p.isBlocked && p.remainingBurst > 0);
            
            if (availableProcesses.length > 0) {
                // SRTF: Seleccionar el proceso con menor tiempo restante
                availableProcesses.sort((a, b) => {
                    if (a.remainingBurst !== b.remainingBurst) {
                        return a.remainingBurst - b.remainingBurst;
                    }
                    // Desempate FIFO: el que llegó primero
                    return a.arrival - b.arrival;
                });
                
                currentProcess = availableProcesses[0];
                const idx = readyQueue.indexOf(currentProcess);
                if (idx !== -1) readyQueue.splice(idx, 1);
                
                // Cerrar segmento de espera si existía
                if (currentProcess.waitingStart !== null) {
                    currentProcess.segments.push({
                        type: 'waiting',
                        start: currentProcess.waitingStart,
                        end: currentTime
                    });
                    currentProcess.waitingStart = null;
                }
                
                // Registrar primer inicio (response time)
                if (currentProcess.startTime === null) {
                    currentProcess.startTime = currentTime;
                }
                
                // Iniciar segmento de ejecución
                currentProcess.segments.push({
                    type: 'executing',
                    start: currentTime,
                    end: null // Se cerrará después
                });
                
                gantt.push({
                    type: 'cpu',
                    pid: currentProcess.pid,
                    start: currentTime,
                    end: null
                });
                
                logs.push({
                    time: currentTime,
                    event: 'Process selected (SRTF)',
                    pid: currentProcess.pid,
                    remainingBurst: currentProcess.remainingBurst
                });
            }
        }
        
        // 4. Si no hay ningún proceso listo, avanzar al próximo evento
        if (!currentProcess) {
            const nextEvents = [];
            
            // Próxima llegada
            const notArrived = processStates.filter(p => !p.hasArrived);
            if (notArrived.length > 0) {
                nextEvents.push(Math.min(...notArrived.map(p => p.arrival)));
            }
            
            // Próximo desbloqueo
            if (blockedQueue.length > 0) {
                nextEvents.push(Math.min(...blockedQueue.map(p => p.blockedUntil)));
            }
            
            if (nextEvents.length === 0) {
                // No hay más eventos, terminar
                break;
            }
            
            const nextTime = Math.min(...nextEvents);
            
            // Extender segmentos de espera para procesos en ready queue durante idle
            readyQueue.forEach(p => {
                if (p.waitingStart !== null && p.waitingStart < nextTime) {
                    // El segmento de espera continuará hasta el próximo evento
                    // No cerramos aquí, se cerrará cuando el proceso sea seleccionado o termine
                }
            });
            
            logs.push({ time: currentTime, event: 'CPU idle', until: nextTime });
            currentTime = nextTime;
            continue;
        }
        
        // 5. Ejecutar el proceso actual por 1 unidad de tiempo
        currentTime += 1;
        currentProcess.executedTime += 1;
        currentProcess.remainingBurst -= 1;
        
        // Log de ejecución
        logs.push({
            time: currentTime,
            event: 'Process executed',
            pid: currentProcess.pid,
            executedTime: currentProcess.executedTime,
            remainingBurst: currentProcess.remainingBurst
        });
        
        // Actualizar fin del segmento de gantt actual
        if (gantt.length > 0 && gantt[gantt.length - 1].type === 'cpu' && gantt[gantt.length - 1].pid === currentProcess.pid) {
            gantt[gantt.length - 1].end = currentTime;
        }
        
        // 6. Verificar si el proceso debe bloquearse
        const pendingBlocks = currentProcess.blocks.filter(block => 
            !currentProcess.appliedBlocks.find(ab => ab.start === block.start) &&
            currentProcess.executedTime === block.start
        );
        
        if (pendingBlocks.length > 0) {
            const blockInfo = pendingBlocks[0];
            currentProcess.appliedBlocks.push(blockInfo);
            
            logs.push({ 
                time: currentTime, 
                event: 'Process blocked (I/O)', 
                pid: currentProcess.pid,
                executedTime: currentProcess.executedTime,
                blockStart: blockInfo.start,
                until: currentProcess.blockedUntil,
                duration: blockInfo.duration
            });
            
            // Cerrar segmento de ejecución
            const lastSeg = currentProcess.segments[currentProcess.segments.length - 1];
            if (lastSeg && lastSeg.type === 'executing') {
                lastSeg.end = currentTime;
            }
            
            // Iniciar segmento de bloqueo
            currentProcess.segments.push({
                type: 'blocked',
                start: currentTime,
                end: null
            });
            
            currentProcess.isBlocked = true;
            currentProcess.blockedUntil = currentTime + blockInfo.duration;
            blockedQueue.push(currentProcess);
            
            // Liberar CPU
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
        // 7. Verificar si terminó
        else if (currentProcess.remainingBurst <= 0) {
            currentProcess.isCompleted = true;
            currentProcess.finishTime = currentTime;
            
            // Cerrar segmento de ejecución
            const lastSeg = currentProcess.segments[currentProcess.segments.length - 1];
            if (lastSeg && lastSeg.type === 'executing') {
                lastSeg.end = currentTime;
            }
            
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
        if (p.waitingStart !== null) {
            p.segments.push({
                type: 'waiting',
                start: p.waitingStart,
                end: currentTime
            });
            p.waitingStart = null;
        }
        
        // Cerrar cualquier segmento que quedó abierto
        p.segments.forEach(seg => {
            if (seg.end === null) {
                seg.end = currentTime;
            }
        });
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
    
    // Calcular tiempo máximo desde los segmentos de los procesos
    let maxTime = 0;
    processesData.forEach(p => {
        if (p.segments && p.segments.length > 0) {
            p.segments.forEach(seg => {
                if (seg.end > maxTime) maxTime = seg.end;
            });
        }
    });
    if (maxTime === 0) maxTime = Math.max(...gantt.map(g => g.end));
    
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
                const duration = segment.end - segment.start;
                
                // Ignorar segmentos de duración 0
                if (duration <= 0) return;
                
                const bar = document.createElement('div');
                
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
