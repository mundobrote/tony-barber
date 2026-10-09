import { HORARIOS_LABORALES } from "./config.js";

// Inicialización de Supabase con tus credenciales
const SUPABASE_URL = "https://qxyilgtswpvfolavuqde.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eWlsZ3Rzd3B2Zm9sYXZ1cWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjU4MjAsImV4cCI6MjEwNTcwMTgyMH0.qCvuLeJA53O5ykdWTGvZzPKOZs5zWqTg3JgoxsxyiuM";
const mbDb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Conexión directa a Supabase a través de ApiService
class ApiService {
    constructor() {}

    async getTurnos() {
        if (!mbDb) return JSON.parse(localStorage.getItem("turnos_barberia") || "[]");
        const { data, error } = await mbDb.from('turnos').select('*');
        if (error) {
            console.error('Error al obtener turnos de Supabase:', error);
            return [];
        }
        return data.map(t => ({
            id: t.id,
            fechaHora: t.fecha_hora || t.fechaHora,
            cliente: t.cliente || { nombre: t.nombre, apellido: t.apellido, telefono: t.telefono, email: t.email },
            servicio: t.servicio || { tipo: t.servicio_tipo, precio: t.precio },
            estado: t.estado || 'confirmado'
        }));
    }

    async getOccupiedDates() {
        const turnos = await this.getTurnos();
        return turnos.map(t => t.fechaHora);
    }

    async patchTurno(id, partialData) {
        if (!mbDb) return { success: true };
        const payload = {
            fecha_hora: partialData.fechaHora,
            nombre: partialData.cliente?.nombre,
            apellido: partialData.cliente?.apellido,
            telefono: partialData.cliente?.telefono,
            email: partialData.cliente?.email,
            servicio_tipo: partialData.servicio?.tipo,
            precio: partialData.servicio?.precio,
            estado: partialData.estado
        };
        const { error } = await mbDb.from('turnos').update(payload).eq('id', id);
        if (error) throw error;
        return { success: true };
    }

    async deleteTurno(id) {
        if (!mbDb) return { success: true };
        const { error } = await mbDb.from('turnos').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    }
}

// turno.model.js - Modelo y utilidades para turnos
class TurnoModel {
    constructor(data) {
        this.id = data.id;
        this.fechaHora = data.fechaHora;
        this.cliente = data.cliente || {};
        this.servicio = data.servicio || {};
    }

    static fromApiResponse(apiData) {
        return {
            id: apiData.id,
            fecha: this.extractDate(apiData.fechaHora),
            hora: this.extractTime(apiData.fechaHora),
            cliente: this.getClienteName(apiData.cliente),
            nombre: apiData.cliente?.nombre || '',
            apellido: apiData.cliente?.apellido || '',
            telefono: apiData.cliente?.telefono || '',
            email: apiData.cliente?.email || '',
            servicio: apiData.servicio?.tipo || '',
            estado: apiData.estado || 'confirmado',
            precio: apiData.servicio?.precio || 0
        };
    }

    static extractDate(fechaHora) {
        return fechaHora ? fechaHora.split('T')[0] : '';
    }

    static extractTime(fechaHora) {
        if (!fechaHora) return '';
        const time = fechaHora.split('T')[1];
        return time ? time.substring(0, 5) : '';
    }

    static getClienteName(cliente) {
        if (!cliente) return 'Cliente sin nombre';
        const nombre = cliente.nombre || '';
        const apellido = cliente.apellido || '';
        return `${nombre} ${apellido}`.trim() || 'Cliente sin nombre';
    }
}

// Manejo mejorado de notificaciones con toast
class NotificationService {
    static show(message, type = 'success') {
        const toast = document.getElementById('notificationToast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (toast && toastMessage) {
            toastMessage.textContent = message;
            toast.className = `toast ${type === 'success' ? 'bg-success' : 'bg-danger'} text-white show`;
            
            setTimeout(() => {
                toast.className = 'toast d-none';
            }, 3000);
        } else {
            alert(message);
        }
    }

    static showError(message) {
        this.show(message, 'error');
    }
}

if (typeof window !== 'undefined') {
    window.NotificationService = NotificationService;
}

// main.js - Lógica principal de la aplicación
class TurnosManager {
    constructor() {
        this.apiService = new ApiService();
        this.turnosData = [];
        
        this.serviciosDisponibles = [
            { id: 1, nombre: 'Corte Clásico / Tradicional', precio: 10000, tipo: 'Corte Clásico / Tradicional' },
            { id: 2, nombre: 'Perfilado & Afeitado de Barba', precio: 7000, tipo: 'Perfilado & Afeitado de Barba' },
            { id: 3, nombre: 'Combo Corte + Barba Completo', precio: 15000, tipo: 'Combo Corte + Barba Completo' }
        ];
        
        this.horariosDisponibles = HORARIOS_LABORALES;
        this.fechaActualCalendario = new Date();
        this.turnoSeleccionado = null;
        this.vistaActual = 'lista';
        this.sortDirection = 'asc';
        this.sortColumn = 'fecha';

        this.init();
    }

    async init() {
        try {
            await this.cargarTurnosDesdeAPI();
            this.initializeEventListeners();
            this.cargarServicios();
            this.cargarHorarios();
            this.mostrarTurnos();
            this.actualizarMesActual();
        } catch (error) {
            console.error('Error al inicializar la aplicación:', error);
            NotificationService.showError('Error al cargar los datos iniciales');
        }
    }

    async cargarTurnosDesdeAPI() {
        try {
            const apiTurnos = await this.apiService.getTurnos();
            this.turnosData = apiTurnos.map(turno => TurnoModel.fromApiResponse(turno));
        } catch (error) {
            console.error('Error al cargar turnos:', error);
            this.turnosData = [];
            throw error;
        }
    }

    initializeEventListeners() {
        const dateInput = document.getElementById('editarFecha');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                this.actualizarHorariosDisponibles(e.target.value);
            });
        }
        
        const elementos = {
            'filtro-fecha': () => this.aplicarFiltros(),
            'filtro-estado': () => this.aplicarFiltros(),
            'filtro-servicio': () => this.aplicarFiltros(),
            'buscar-turno': () => this.aplicarFiltros()
        };

        Object.entries(elementos).forEach(([id, handler]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                const eventType = id === 'buscar-turno' ? 'input' : 'change';
                elemento.addEventListener(eventType, handler);
            }
        });

        this.exposeGlobalFunctions();
    }

    exposeGlobalFunctions() {
        window.cambiarVista = (vista) => this.cambiarVista(vista);
        window.limpiarFiltros = () => this.limpiarFiltros();
        window.editarTurno = (id) => this.editarTurno(id);
        window.guardarEdicionTurno = () => this.guardarEdicionTurno();
        window.cancelarTurno = (id) => this.cancelarTurno(id);
        window.navegarMes = (direccion) => this.navegarMes(direccion);
        window.seleccionarDia = (fecha) => this.seleccionarDia(fecha);
    }

    cargarServicios() {
        const selectServicio = document.getElementById('editarServicio');
        if (!selectServicio) return;

        selectServicio.innerHTML = '<option value="">Seleccionar servicio</option>';
        this.serviciosDisponibles.forEach(servicio => {
            selectServicio.innerHTML += `<option value="${servicio.id}" data-precio="${servicio.precio}">${servicio.nombre} - $${servicio.precio}</option>`;
        });
    }

    cargarHorarios() {
        const selectHora = document.getElementById('editarHora');
        if (!selectHora) return;
        selectHora.innerHTML = '<option value="">Seleccionar hora</option>';
        this.horariosDisponibles.forEach(hora => {
            selectHora.innerHTML += `<option value="${hora}">${hora}</option>`;
        });
    }

    cambiarVista(vista) {
        this.vistaActual = vista;
        
        const elementos = {
            lista: {
                vista: document.getElementById('vista-lista'),
                btn: document.getElementById('btn-lista'),
                claseVista: 'vista-activa',
                claseBtn: 'btn btn-primario active'
            },
            calendario: {
                vista: document.getElementById('vista-calendario'),
                btn: document.getElementById('btn-calendario'),
                claseVista: 'vista-activa',
                claseBtn: 'btn btn-primario active'
            }
        };

        Object.values(elementos).forEach(el => {
            if (el.vista) el.vista.className = 'vista-oculta d-none';
            if (el.btn) el.btn.className = 'btn btn-secundario';
        });

        if (elementos[vista]) {
            if (elementos[vista].vista) {
                elementos[vista].vista.className = elementos[vista].claseVista;
                elementos[vista].vista.classList.remove('d-none');
            }
            if (elementos[vista].btn) elementos[vista].btn.className = elementos[vista].claseBtn;
        }

        if (vista === 'lista') {
            this.mostrarTurnos();
        } else if (vista === 'calendario') {
            this.generarCalendario();
        }
    }

    mostrarTurnos() {
        const turnosFiltrados = this.aplicarFiltrosData();
        const tbody = document.getElementById('tabla-turnos');
        const totalTurnos = document.getElementById('total-turnos');
        const estadisticasTotalTurnos = document.getElementById('stats-total');
        const statsConfirmados = document.getElementById('stats-confirmados');
        const statsPendientes = document.getElementById('stats-pendientes');
        const statsIngresos = document.getElementById('stats-ingresos');

        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (totalTurnos) {
            totalTurnos.textContent = `${turnosFiltrados.length} turnos`;
            estadisticasTotalTurnos.textContent = `${this.turnosData.length}`;
        }

        const confirmados = this.turnosData.filter(t => t.estado === 'confirmado').length;
        const pendientes = this.turnosData.filter(t => t.estado === 'pendiente').length;
        const ingresosHoy = this.turnosData.reduce((total, t) => total + t.precio, 0);
        
        if (statsConfirmados) statsConfirmados.textContent = confirmados;
        if (statsPendientes) statsPendientes.textContent = pendientes;
        if (statsIngresos) statsIngresos.textContent = `$${ingresosHoy.toLocaleString("es-CL")}`;
        
        turnosFiltrados.forEach(turno => {
            const row = tbody.insertRow();
            const fechaFormateada = turno.fecha ? turno.fecha.split("-").reverse().join("/") : "";
            const estadoBadge = this.getEstadoBadge(turno.estado);
            
            row.innerHTML = `
                <td>${fechaFormateada}</td>
                <td><strong>${turno.hora}</strong></td>
                <td>
                    <div>${turno.cliente}</div>
                    <small class="text-muted">${turno.telefono}</small>
                </td>
                <td>${turno.servicio}</td>
                <td>${estadoBadge}</td>
                <td><strong>$${Number(turno.precio).toLocaleString("es-CL")}</strong></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-warning btn-sm" onclick="editarTurno(${turno.id})" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="cancelarTurno(${turno.id})" title="Cancelar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
        });
    }

    getEstadoBadge(estado) {
        const badges = {
            'confirmado': '<span class="badge bg-success">Confirmado</span>',
            'pendiente': '<span class="badge bg-warning text-dark">Pendiente</span>',
            'cancelado': '<span class="badge bg-danger">Cancelado</span>'
        };
        return badges[estado] || '<span class="badge bg-secondary">Desconocido</span>';
    }

    aplicarFiltros() {
        this.mostrarTurnos();
    }

    aplicarFiltrosData() {
        let turnosFiltrados = [...this.turnosData];
        const filtroEstado = document.getElementById('filtro-estado')?.value;
        const filtroServicio = document.getElementById('filtro-servicio')?.value;
        const busqueda = document.getElementById('buscar-turno')?.value?.toLowerCase();

        if (filtroEstado && filtroEstado !== 'todos') {
            turnosFiltrados = turnosFiltrados.filter(t => t.estado === filtroEstado);
        }
        
        if (filtroServicio && filtroServicio !== 'todos') {
            turnosFiltrados = turnosFiltrados.filter(t => 
                t.servicio.toLowerCase().includes(filtroServicio.toLowerCase())
            );
        }
        
        if (busqueda) {
            turnosFiltrados = turnosFiltrados.filter(t => 
                t.cliente.toLowerCase().includes(busqueda) ||
                t.telefono.includes(busqueda)
            );
        }
        
        return turnosFiltrados;
    }

    advancedSearch(criteria) {
        return this.turnosData.filter(t => {
            if (criteria.cliente && !t.cliente.toLowerCase().includes(criteria.cliente.toLowerCase())) return false;
            if (criteria.estado && criteria.estado !== 'todos' && t.estado !== criteria.estado) return false;
            if (criteria.precioMinimo && t.precio < parseFloat(criteria.precioMinimo)) return false;
            if (criteria.precioMaximo && t.precio > parseFloat(criteria.precioMaximo)) return false;
            return true;
        });
    }

    limpiarFiltros() {
        document.getElementById('filtro-fecha').value = 'todos';
        document.getElementById('filtro-estado').value = 'todos';
        document.getElementById('filtro-servicio').value = 'todos';
        document.getElementById('buscar-turno').value = '';
        this.mostrarTurnos();
        NotificationService.show('Filtros limpiados correctamente');
    }

    async editarTurno(id) {
        this.turnoSeleccionado = this.turnosData.find(t => t.id === id);
        if (!this.turnoSeleccionado) return;
        
        document.getElementById('editarTurnoId').value = this.turnoSeleccionado.id;
        document.getElementById('editarFecha').value = this.turnoSeleccionado.fecha;
        document.getElementById('editarHora').value = this.turnoSeleccionado.hora;
        document.getElementById('editarNombre').value = this.turnoSeleccionado.nombre;
        document.getElementById('editarApellido').value = this.turnoSeleccionado.apellido;
        document.getElementById('editarTelefono').value = this.turnoSeleccionado.telefono;
        document.getElementById('editarEmail').value = this.turnoSeleccionado.email;
        document.getElementById('editarEstado').value = this.turnoSeleccionado.estado;

        const modal = document.getElementById('modalEditarTurno');
        if (modal) {
            new bootstrap.Modal(modal).show();
        }
    }

    async actualizarHorariosDisponibles(fecha) {
        if (!fecha) return;
        const selectHora = document.getElementById('editarHora');
        if (!selectHora) return;
        selectHora.innerHTML = '<option value="">Seleccionar hora</option>';
        this.horariosDisponibles.forEach(hora => {
            selectHora.add(new Option(hora, hora));
        });
    }

    async guardarEdicionTurno() {
        try {
            const id = parseInt(document.getElementById('editarTurnoId')?.value);
            if (!id) return;

            const fecha = document.getElementById('editarFecha')?.value;
            const hora = document.getElementById('editarHora')?.value;
            const nombre = document.getElementById('editarNombre')?.value;
            const apellido = document.getElementById('editarApellido')?.value;
            const telefono = document.getElementById('editarTelefono')?.value;
            const email = document.getElementById('editarEmail')?.value;
            const estado = document.getElementById('editarEstado')?.value;

            const selectServicio = document.getElementById('editarServicio');
            const servicioTipo = selectServicio.selectedOptions[0]?.text.split(' - ')[0] || 'Corte';
            const precio = parseFloat(selectServicio.selectedOptions[0]?.dataset?.precio || 10000);

            const apiData = {
                fechaHora: `${fecha}T${hora}`,
                cliente: { nombre, apellido, email, telefono },
                servicio: { tipo: servicioTipo, precio },
                estado
            };

            await this.apiService.patchTurno(id, apiData);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarTurno'));
            if (modal) modal.hide();
            
            await this.cargarTurnosDesdeAPI();
            this.mostrarTurnos();
            NotificationService.show('Turno actualizado exitosamente');

        } catch (error) {
            console.error('Error al actualizar turno:', error);
            NotificationService.showError('Error al actualizar el turno');
        }
    }

    async cancelarTurno(id) {
        const turno = this.turnosData.find(t => t.id === id);
        if (!turno) return;
        
        const modalTexto = document.getElementById('modalConfirmarTexto');
        if (modalTexto) {
            modalTexto.textContent = `¿Estás seguro de que deseas eliminar el turno de ${turno.cliente}?`;
        }
        
        const btnConfirmar = document.getElementById('btnConfirmarAccion');
        if (btnConfirmar) {
            btnConfirmar.onclick = async () => {
                try {
                    await this.apiService.deleteTurno(id);
                    await this.cargarTurnosDesdeAPI();
                    this.mostrarTurnos();
                    
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmar'));
                    if (modal) modal.hide();
                    
                    NotificationService.show('Turno eliminado exitosamente');
                } catch (error) {
                    console.error('Error al eliminar turno:', error);
                    NotificationService.showError('Error al eliminar el turno');
                }
            };
        }
        
        const modal = document.getElementById('modalConfirmar');
        if (modal) {
            new bootstrap.Modal(modal).show();
        }
    }

    navegarMes(direccion) {
        this.fechaActualCalendario.setMonth(this.fechaActualCalendario.getMonth() + direccion);
        this.actualizarMesActual();
        this.generarCalendario();
    }

    actualizarMesActual() {
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const mesActual = document.getElementById('mes-actual');
        if (mesActual) {
            mesActual.textContent = `${meses[this.fechaActualCalendario.getMonth()]} ${this.fechaActualCalendario.getFullYear()}`;
        }
    }

    generarCalendario() {
        const container = document.getElementById('calendario-container');
        if (!container) return;

        const year = this.fechaActualCalendario.getFullYear();
        const month = this.fechaActualCalendario.getMonth();
        
        const primerDia = new Date(year, month, 1);
        const ultimoDia = new Date(year, month + 1, 0);
        const diasEnMes = ultimoDia.getDate();
        const primerDiaSemana = primerDia.getDay();
        
        let html = '<div class="calendario-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: #333;">';
        
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        diasSemana.forEach(dia => {
            html += `<div class="calendario-header text-center py-2 bg-secondary text-white fw-bold">${dia}</div>`;
        });
        
        for (let i = 0; i < primerDiaSemana; i++) {
            html += '<div class="calendario-dia bg-dark" style="min-height: 80px;"></div>';
        }
        
        for (let dia = 1; dia <= diasEnMes; dia++) {
            const fechaDia = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const turnosDelDia = this.turnosData.filter(t => t.fecha === fechaDia);
            const esHoy = new Date().toDateString() === new Date(year, month, dia).toDateString();
            
            html += `
                <div class="calendario-dia bg-dark p-1 ${esHoy ? 'border border-warning' : ''}" 
                     style="min-height: 80px; cursor: pointer; transition: background-color 0.2s;" 
                     onclick="seleccionarDia('${fechaDia}')">
                    <div class="text-white fw-bold mb-1">${dia}</div>
                    ${turnosDelDia.map(t => 
                        `<div class="small badge me-1 mb-1" style="background-color: ${this.getColorEstado(t.estado)}; font-size: 0.6rem;">
                            ${t.hora}
                        </div>`
                    ).join('')}
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    getColorEstado(estado) {
        const colores = {
            'confirmado': '#28a745',
            'pendiente': '#ffc107',
            'cancelado': '#dc3545'
        };
        return colores[estado] || '#6c757d';
    }

    seleccionarDia(fecha) {
        const turnosDelDia = this.turnosData.filter(t => t.fecha === fecha);
        const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        const fechaSeleccionada = document.getElementById('fecha-seleccionada');
        if (fechaSeleccionada) fechaSeleccionada.textContent = fechaFormateada;
        
        const container = document.getElementById('turnos-dia');
        if (!container) return;

        if (turnosDelDia.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No hay turnos para este día</p>';
        } else {
            container.innerHTML = turnosDelDia.map(turno => `
                <div class="card bg-secondary mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="card-title mb-1">${turno.hora} - ${turno.cliente}</h6>
                                <small class="text-muted">${turno.servicio}</small>
                            </div>
                            <div>${this.getEstadoBadge(turno.estado)}</div>
                        </div>
                        <div class="mt-2">
                            <button class="btn btn-outline-warning btn-sm me-1" onclick="editarTurno(${turno.id})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-outline-danger btn-sm" onclick="cancelarTurno(${turno.id})"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    async refreshData() {
        try {
            await this.cargarTurnosDesdeAPI();
            if (this.vistaActual === 'lista') {
                this.mostrarTurnos();
            } else {
                this.generarCalendario();
            }
            NotificationService.show('Datos actualizados correctamente');
        } catch (error) {
            console.error('Error al refrescar datos:', error);
            NotificationService.showError('Error al actualizar los datos');
        }
    }

    exportToCSV() {
        if (this.turnosData.length === 0) {
            alert('No hay turnos para exportar.');
            return;
        }
        let csv = "Fecha,Hora,Cliente,Telefono,Servicio,Precio,Estado\n";
        this.turnosData.forEach(t => {
            csv += `"${t.fecha}","${t.hora}","${t.cliente}","${t.telefono}","${t.servicio}","${t.precio}","${t.estado}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "turnos_barberia.csv";
        a.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap no está cargado');
        return;
    }

    const fechaInput = document.getElementById('editarFecha');
    if (fechaInput) {
        fechaInput.min = new Date().toISOString().split('T')[0];
    }

    window.turnosManager = new TurnosManager();

    const style = document.createElement('style');
    style.textContent = `
        .vista-activa { display: block !important; }
        .vista-oculta { display: none !important; }
        .calendario-grid .calendario-dia:hover { background-color: #333 !important; }
    `;
    document.head.appendChild(style);

    window.refreshTurnos = () => {
        if (window.turnosManager) window.turnosManager.refreshData();
    };
});

function toggleAdvancedFilters() {
    const advancedFilters = document.getElementById('advanced-filters');
    if (advancedFilters) advancedFilters.classList.toggle('d-none');
}

function applyAdvancedFilters() {
    if (!window.turnosManager) return;
    const criteria = {
        cliente: document.getElementById('filtro-cliente')?.value,
        precioMinimo: document.getElementById('filtro-precio-min')?.value,
        precioMaximo: document.getElementById('filtro-precio-max')?.value
    };
    const results = window.turnosManager.advancedSearch(criteria);
    window.turnosManager.turnosData = results;
    window.turnosManager.mostrarTurnos();
}

function updatePrecio() {
    const servicioSelect = document.getElementById('editarServicio');
    const precioInput = document.getElementById('editarPrecio');
    if (!servicioSelect || !precioInput) return;
    const precio = servicioSelect.selectedOptions[0]?.dataset?.precio || '';
    precioInput.value = precio;
}

function goToToday() {
    if (!window.turnosManager) return;
    window.turnosManager.fechaActualCalendario = new Date();
    window.turnosManager.actualizarMesActual();
    window.turnosManager.generarCalendario();
    window.turnosManager.seleccionarDia(new Date().toISOString().split('T')[0]);
}

function sortTable(column) {
    if (!window.turnosManager) return;
    const isAsc = window.turnosManager.sortDirection !== 'asc';
    window.turnosManager.sortDirection = isAsc ? 'asc' : 'desc';
    window.turnosManager.sortColumn = column;
    
    window.turnosManager.turnosData.sort((a, b) => {
        let aVal = a[column], bVal = b[column];
        if (column === 'precio') { aVal = parseFloat(aVal) || 0; bVal = parseFloat(bVal) || 0; }
        if (aVal < bVal) return isAsc ? -1 : 1;
        if (aVal > bVal) return isAsc ? 1 : -1;
        return 0;
    });
    window.turnosManager.mostrarTurnos();
}

function limpiarBusquedaAvanzada() {
    document.getElementById('formBusquedaAvanzada')?.reset();
}

function ejecutarBusquedaAvanzada() {
    if (!window.turnosManager) return;
    const criteria = {
        cliente: document.getElementById('searchCliente')?.value,
        estado: document.getElementById('searchEstado')?.value,
        precioMinimo: document.getElementById('searchPrecioMin')?.value,
        precioMaximo: document.getElementById('searchPrecioMax')?.value
    };
    const results = window.turnosManager.advancedSearch(criteria);
    window.turnosManager.turnosData = results;
    window.turnosManager.mostrarTurnos();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalBusquedaAvanzada'));
    if (modal) modal.hide();
}
