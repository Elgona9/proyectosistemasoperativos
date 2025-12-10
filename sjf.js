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
    
    console.log('Procesos de entrada:', processes);
    
    // Ejecutar algoritmo SJF con motor completo
    const result = runSJFEngine(processes, 0); // context_switch = 0
    
    console.log('Resultado de simulación SJF:', result);
    
    // Mostrar resultados
    renderGanttChart(result.gantt, result.processes);
    renderMetricsTable(result.processes, result);
}

// Motor de simulación SJF completo (no expulsivo)
function runSJFEngine(processes, context_switch = 0, max_time = 10000) {
    // Validar entradas
    const validatedProcesses = validateProcesses(processes);
    if (validatedProcesses.errors.length > 0) {
        console.error('Errores de validación:', validatedProcesses.errors);
    }
    
    // No ordenamos por llegada aquí - SJF selecciona por duración
    const allProcesses = [...validatedProcesses.processes];
    
    // Estado de la simulación
    let currentTime = 0;
    const gantt = [];
    const logs = [];
    const processStates = allProcesses.map(p => ({
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
    
    logs.push({ time: 0, event: 'Simulation started', details: `${allProcesses.length} processes - SJF Algorithm` });
    
    while (currentTime < max_time) {
        // 1. Desbloquear procesos cuyo bloqueo terminó PRIMERO
        for (let i = blockedQueue.length - 1; i >= 0; i--) {
            const pState = blockedQueue[i];
            if (currentTime >= pState.blockedUntil) {
                pState.isBlocked = false;
                const unblockTime = pState.blockedUntil; // Guardar antes de anular
                pState.blockedUntil = null;
                blockedQueue.splice(i, 1);
                
                // El segmento de bloqueo ya tiene el end correcto establecido cuando se creó
                // NO necesitamos modificarlo aquí porque ya se estableció como blockedUntil
                
                // Insertar en cola ordenado por BURST TIME TOTAL (SJF no expulsivo), con desempate FIFO
                let insertIndex = readyQueue.findIndex(p => {
                    if (p.burst > pState.burst) return true;
                    if (p.burst === pState.burst && p.arrival > pState.arrival) return true;
                    return false;
                });
                if (insertIndex === -1) {
                    readyQueue.push(pState);
                } else {
                    readyQueue.splice(insertIndex, 0, pState);
                }
                
                // El proceso empieza a esperar desde que termina su bloqueo, no desde currentTime
                pState.waitingStart = unblockTime;
                logs.push({ time: unblockTime, event: 'Process unblocked', pid: pState.pid });
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
                    // Insertar ordenado por BURST TIME (SJF), con desempate FIFO (arrival time)
                    let insertIndex = readyQueue.findIndex(p => {
                        if (p.burst > pState.burst) return true;
                        if (p.burst === pState.burst && p.arrival > pState.arrival) return true;
                        return false;
                    });
                    if (insertIndex === -1) {
                        readyQueue.push(pState);
                    } else {
                        readyQueue.splice(insertIndex, 0, pState);
                    }
                    pState.waitingStart = pState.arrival; // Espera desde su llegada
                    logs.push({ time: currentTime, event: 'Process arrived', pid: pState.pid });
                }
            }
        });
        
        // 3. Si no hay proceso ejecutando, tomar uno de la cola (ya ordenada por SJF)
        if (currentProcess === null && readyQueue.length > 0) {
            // La cola ya está ordenada por burst time, tomamos el primero (shortest)
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
        
        // 5. Ejecutar el proceso actual (SJF es NO EXPULSIVO - ejecuta hasta bloqueo o completar)
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
            
            const blockSegment = {
                type: 'blocked',
                start: currentTime,
                end: currentProcess.blockedUntil
            };
            currentProcess.segments.push(blockSegment);
            
            console.log(`${currentProcess.pid} bloqueado:`, {
                start: currentTime,
                end: currentProcess.blockedUntil,
                duration: blockInfo.duration,
                calculatedDuration: currentProcess.blockedUntil - currentTime
            });
            
            logs.push({ 
                time: currentTime, 
                event: 'Process blocked (I/O)', 
                pid: currentProcess.pid,
                until: currentProcess.blockedUntil,
                duration: blockInfo.duration
            });
            
            // Liberar CPU - el proceso bloqueado cede la CPU (SJF puede elegir otro)
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
    processStates.forEach(p => {
        // Calcular tiempos de espera y bloqueo desde segmentos
        let waitingTime = 0;
        let blockedTime = 0;
        
        p.segments.forEach(seg => {
            if (seg.type === 'waiting') {
                waitingTime += (seg.end - seg.start);
            } else if (seg.type === 'blocked') {
                blockedTime += (seg.end - seg.start);
            }
        });
        
        // Tiempo de retorno (turnaround)
        p.turnaround = p.finishTime !== null ? p.finishTime - p.arrival : 0;
        
        // Tiempo de respuesta
        p.response = p.startTime !== null ? p.startTime - p.arrival : 0;
        
        // Tiempo de espera
        p.waiting = waitingTime;
        
        // Tiempo bloqueado
        p.blocked_time = blockedTime;
        
        // Tiempo perdido
        p.lost_time = p.turnaround - p.burst;
        
        // Penalización
        p.penalty = p.burst > 0 ? p.turnaround / p.burst : 0;
    });
    
    // Calcular promedios
    const completedProcesses = processStates.filter(p => p.isCompleted);
    const n = completedProcesses.length;
    
    const avgTurnaround = n > 0 ? completedProcesses.reduce((sum, p) => sum + p.turnaround, 0) / n : 0;
    const avgWaiting = n > 0 ? completedProcesses.reduce((sum, p) => sum + p.waiting, 0) / n : 0;
    const avgResponse = n > 0 ? completedProcesses.reduce((sum, p) => sum + p.response, 0) / n : 0;
    const avgPenalty = n > 0 ? completedProcesses.reduce((sum, p) => sum + p.penalty, 0) / n : 0;
    const avgLostTime = n > 0 ? completedProcesses.reduce((sum, p) => sum + p.lost_time, 0) / n : 0;
    
    return {
        processes: processStates,
        gantt: gantt,
        logs: logs,
        metrics: {
            avgTurnaround,
            avgWaiting,
            avgResponse,
            avgPenalty,
            avgLostTime,
            totalTime: currentTime
        }
    };
}

// Función de validación de procesos
function validateProcesses(processes) {
    const errors = [];
    const validatedProcesses = [];
    
    processes.forEach((p, index) => {
        const vp = { ...p };
        
        // Validar campos requeridos
        if (!vp.pid) vp.pid = `P${index}`;
        if (typeof vp.arrival !== 'number' || vp.arrival < 0) {
            errors.push(`Proceso ${vp.pid}: arrival time inválido`);
            vp.arrival = 0;
        }
        if (typeof vp.burst !== 'number' || vp.burst <= 0) {
            errors.push(`Proceso ${vp.pid}: burst time inválido`);
            vp.burst = 1;
        }
        if (!Array.isArray(vp.blocks)) vp.blocks = [];
        
        validatedProcesses.push(vp);
    });
    
    return { processes: validatedProcesses, errors };
}

// Renderizar diagrama de Gantt
function renderGanttChart(gantt, processes) {
    const ganttChart = document.getElementById('ganttChart');
    const ganttYAxis = document.getElementById('ganttYAxis');
    const ganttXAxis = document.getElementById('ganttXAxis');
    
    // Limpiar contenido previo
    ganttChart.innerHTML = '';
    ganttYAxis.innerHTML = '';
    ganttXAxis.innerHTML = '';
    
    if (!gantt || gantt.length === 0) {
        ganttChart.innerHTML = '<p>No hay datos para mostrar</p>';
        return;
    }
    
    // Obtener procesos únicos del gantt
    const uniqueProcesses = [...new Set(gantt.filter(g => g.type === 'cpu').map(g => g.pid))];
    uniqueProcesses.sort();
    
    const maxTime = Math.max(...gantt.map(g => g.end));
    const pixelsPerUnit = 30;
    
    // Crear etiquetas del eje Y (nombres de procesos)
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
        
        const processState = processes.find(p => p.pid === pid);
        
        // Agregar todos los segmentos de este proceso
        if (processState) {
            processState.segments.forEach(seg => {
                const bar = document.createElement('div');
                const duration = seg.end - seg.start;
                
                if (seg.type === 'executing') {
                    bar.className = `gantt-bar process-${pid.toLowerCase()}`;
                    bar.textContent = pid;
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
                bar.title = `${pid} - ${seg.type}: ${seg.start}-${seg.end}`;
                row.appendChild(bar);
            });
        }
        
        ganttChart.appendChild(row);
    });
    
    // Crear etiquetas del eje X (tiempo)
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
function renderMetricsTable(processes, result) {
    const metricsTableBody = document.getElementById('metricsTableBody');
    metricsTableBody.innerHTML = '';
    
    // Filtrar solo procesos completados
    const completedProcesses = processes.filter(p => p.isCompleted);
    
    completedProcesses.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.pid}</td>
            <td>${p.burst}</td>
            <td>${p.waiting.toFixed(2)}</td>
            <td>${p.finishTime}</td>
            <td>${p.turnaround}</td>
            <td>${p.lost_time}</td>
            <td>${p.penalty.toFixed(2)}</td>
            <td>${p.response}</td>
        `;
        metricsTableBody.appendChild(row);
    });
    
    // Mostrar promedios
    if (result.metrics) {
        document.getElementById('avgWaiting').textContent = result.metrics.avgWaiting.toFixed(2);
        document.getElementById('avgTurnaround').textContent = result.metrics.avgTurnaround.toFixed(2);
        document.getElementById('avgLostTime').textContent = result.metrics.avgLostTime.toFixed(2);
        document.getElementById('avgPenalty').textContent = result.metrics.avgPenalty.toFixed(2);
        document.getElementById('avgResponse').textContent = result.metrics.avgResponse.toFixed(2);
    }
}
